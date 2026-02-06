"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type SalesShipment = {
  id?: string;
  no?: string;
  sellToCustomerName?: string;
  sellToCustomerNo?: string;
  shipToName?: string;
  shipToAddress?: string;
  shipToAddress2?: string;
  shipToCity?: string;
  shipToPostCode?: string;
  shipToCountryRegionCode?: string;
  postingDate?: string;
  documentDate?: string;
  externalDocumentNo?: string;
  orderNo?: string;
};

type ODataResponse<T> = {
  value?: T[];
};

type PodListResponse = {
  records?: Array<{ shipmentNo: string }>;
};

function fmtDate(s?: string) {
  if (!s) return "-";
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return s;
  return d.toLocaleDateString();
}

export default function SalesPage() {
  const pageSize = 20;
  const fetchTop = 200;

  const [items, setItems] = useState<SalesShipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [signedSet, setSignedSet] = useState<Set<string>>(new Set());

  const [q, setQ] = useState("");
  const [page, setPage] = useState(1);

  const load = async (query: string) => {
    setLoading(true);
    setError(null);
    try {
      const url = `/api/salesShipments?top=${fetchTop}&skip=0&q=${encodeURIComponent(query.trim())}`;
      const res = await fetch(url, { cache: "no-store" });
      const json = (await res.json()) as any;
      if (!res.ok) throw new Error(json?.error || json?.message || "Erreur chargement");

      const data = json as ODataResponse<SalesShipment>;
      const list = Array.isArray(json) ? (json as SalesShipment[]) : Array.isArray(data?.value) ? data.value : [];

      if (process.env.NODE_ENV !== "production") {
        console.log("/sales raw api response:", json);
        console.log("/sales parsed list length:", list.length);
        console.log("/sales first record:", list[0]);
      }

      setItems(list);
      setPage(1);
    } catch (e: any) {
      setError(e?.message || "Erreur chargement");
      setItems([]);
      setPage(1);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load("");
  }, []);

  useEffect(() => {
    const loadPods = async () => {
      try {
        const res = await fetch(`/api/pod`, { cache: "no-store" });
        const json = (await res.json()) as PodListResponse;
        const set = new Set<string>();
        for (const r of json?.records || []) {
          if (r?.shipmentNo) set.add(String(r.shipmentNo));
        }
        setSignedSet(set);
      } catch {
        setSignedSet(new Set());
      }
    };
    void loadPods();
  }, []);

  const totalPages = useMemo(() => {
    const n = Math.ceil(items.length / pageSize);
    return n > 0 ? n : 1;
  }, [items.length]);

  const display = useMemo(() => {
    const p = Math.min(Math.max(page, 1), totalPages);
    const start = (p - 1) * pageSize;
    return items.slice(start, start + pageSize);
  }, [items, page, totalPages]);

  const firstKeys = useMemo(() => {
    if (!items[0]) return "(none)";
    return Object.keys(items[0] as any).join(", ");
  }, [items]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="xp1 text-2xl">Sales</h1>
          </div>
          <Link
            href="/regions-planning"
            className="xp-text px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Retour
          </Link>
        </div>

        <div className="bg-white/80 rounded-2xl border p-4" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
          <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4">
            <input
              value={q}
              onChange={(e) => setQ(e.target.value)}
              placeholder="Rechercher: No / client / ship-to / doc externe..."
              className="xp-text px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 w-full"
              style={{ borderColor: "rgba(79,88,165,0.25)" }}
            />
            <button
              onClick={() => load(q)}
              className="xp-text px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: "var(--logo-1)" }}
              disabled={loading}
            >
              {loading ? "Chargement..." : "Rechercher"}
            </button>
            <button
              onClick={() => {
                setQ("");
                void load("");
              }}
              className="xp-text px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
              disabled={loading}
            >
              Réinitialiser
            </button>
          </div>

          {error && (
            <div className="xp-text" style={{ color: "#b45309" }}>
              {error}
            </div>
          )}

        
          <div className="overflow-auto rounded-xl border mt-3" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
            <table className="min-w-full text-sm">
              <thead className="bg-slate-50">
                <tr className="text-left text-slate-700">
                  <th className="xp3 px-3 py-2">No.</th>
                  <th className="xp3 px-3 py-2">Client</th>
                  <th className="xp3 px-3 py-2">Ship-to</th>
                  <th className="xp3 px-3 py-2">Posting</th>
                  <th className="xp3 px-3 py-2">Order No.</th>
                  <th className="xp3 px-3 py-2">Signed</th>
                  <th className="xp3 px-3 py-2">Action</th>
                </tr>
              </thead>
              <tbody className="bg-white">
                {loading ? (
                  <tr>
                    <td colSpan={7} className="xp-text px-3 py-6 text-slate-500">
                      Chargement...
                    </td>
                  </tr>
                ) : display.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="xp-text px-3 py-6 text-slate-500">
                      Aucun résultat
                    </td>
                  </tr>
                ) : (
                  display.map((s) => (
                    <tr
                      key={s.no || Math.random()}
                      className="border-t"
                      style={{ borderColor: "rgba(2,6,23,0.06)" }}
                    >
                      <td className="xp-text px-3 py-2">
                        <div className="font-semibold" style={{ color: "var(--logo-4)" }}>
                          {s.no || "-"}
                        </div>
                        <div className="text-slate-500 text-xs">Ext: {s.externalDocumentNo || "-"}</div>
                      </td>
                      <td className="xp-text px-3 py-2">
                        <div className="text-slate-800">{s.sellToCustomerName || "-"}</div>
                        <div className="text-slate-500 text-xs">{s.sellToCustomerNo || "-"}</div>
                      </td>
                      <td className="xp-text px-3 py-2">
                        <div className="text-slate-800">{s.shipToName || "-"}</div>
                        <div className="text-slate-500 text-xs">
                          {[s.shipToAddress, s.shipToAddress2].filter(Boolean).join(" ") || "-"}
                        </div>
                      </td>
                      <td className="xp-text px-3 py-2">
                        <div className="text-slate-800">{fmtDate(s.postingDate)}</div>
                        <div className="text-slate-500 text-xs">Doc: {fmtDate(s.documentDate)}</div>
                      </td>
                      <td className="xp-text px-3 py-2">{s.orderNo || "-"}</td>
                      <td className="xp-text px-3 py-2">
                        {signedSet.has(String(s.no || "")) ? (
                          <span
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs"
                            style={{ backgroundColor: "rgba(34,197,94,0.12)", color: "rgb(22,101,52)" }}
                          >
                            Oui
                          </span>
                        ) : (
                          <span
                            className="inline-flex items-center px-2 py-1 rounded-full text-xs"
                            style={{ backgroundColor: "rgba(245,158,11,0.14)", color: "rgb(180,83,9)" }}
                          >
                            Non
                          </span>
                        )}
                      </td>
                      <td className="xp-text px-3 py-2">
                        {s.no ? (
                          <div className="flex items-center gap-2">
                            <a
                              href={
                                s.id
                                  ? `/api/salesShipments/pdf-file?id=${encodeURIComponent(s.id)}`
                                  : `/api/salesShipments/pdf-file?documentNo=${encodeURIComponent(s.no)}`
                              }
                              target="_blank"
                              rel="noreferrer"
                              className="xp-text inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                            >
                              PDF
                            </a>
                            <Link
                              href={`/pod-signature?shipmentNo=${encodeURIComponent(s.no)}`}
                              className="xp-text inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-white"
                              style={{ backgroundColor: "var(--logo-1)" }}
                            >
                              Signature
                            </Link>
                          </div>
                        ) : (
                          "-"
                        )}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="flex items-center justify-between mt-4">
            <div className="xp-text text-slate-600">
              Page: {Math.min(Math.max(page, 1), totalPages)} / {totalPages}
              <span className="text-slate-400"> • </span>
              Total: {items.length}
            </div>
            <div className="flex gap-2">
              <button
                onClick={() => setPage((p) => Math.max(1, p - 1))}
                disabled={loading || page <= 1}
                className="xp-text px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 disabled:opacity-60"
              >
                Précédent
              </button>
              <button
                onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
                disabled={loading || page >= totalPages}
                className="xp-text px-3 py-2 rounded-lg text-white disabled:opacity-60"
                style={{ backgroundColor: "var(--logo-1)" }}
              >
                Suivant
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
