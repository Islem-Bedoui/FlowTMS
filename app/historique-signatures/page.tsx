"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type PodRecord = {
  shipmentNo: string;
  signedBy?: string;
  note?: string;
  createdAt: string;
  imagePath?: string;
};

type SalesShipment = {
  id?: string;
  no?: string;
  sellToCustomerName?: string;
  sellToCustomerNo?: string;
  postingDate?: string;
  documentDate?: string;
  orderNo?: string;
};

type ODataResponse<T> = {
  value?: T[];
};

function fmtDate(s?: string) {
  if (!s) return "-";
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return s;
  return d.toLocaleDateString();
}

export default function HistoriqueSignaturesPage() {
  const [records, setRecords] = useState<PodRecord[]>([]);
  const [shipments, setShipments] = useState<SalesShipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [podRes, shipRes] = await Promise.all([
          fetch("/api/pod", { cache: "no-store" }),
          fetch("/api/salesShipments?top=500&skip=0", { cache: "no-store" }),
        ]);

        const podJson = await podRes.json();
        const shipJson = await shipRes.json();

        const podRecords = (podJson.records || []) as PodRecord[];
        const shipData = shipJson as ODataResponse<SalesShipment>;
        const shipList = Array.isArray(shipJson)
          ? (shipJson as SalesShipment[])
          : Array.isArray(shipData?.value)
            ? shipData.value
            : [];

        if (!cancelled) {
          setRecords(podRecords);
          setShipments(shipList);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const podByShipmentNo = useMemo(() => {
    const m = new Map<string, PodRecord>();
    for (const r of records) {
      const k = String(r?.shipmentNo || "").trim();
      if (!k) continue;
      const existing = m.get(k);
      if (!existing || String(r?.createdAt || "") > String(existing.createdAt || "")) {
        m.set(k, r);
      }
    }
    return m;
  }, [records]);

  const signedShipments = useMemo(() => {
    const signedSet = new Set<string>();
    for (const r of records) {
      const k = String(r?.shipmentNo || "").trim();
      if (k) signedSet.add(k);
    }
    return shipments.filter((s) => {
      const no = String(s?.no || "").trim();
      return no && signedSet.has(no);
    });
  }, [records, shipments]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return signedShipments;
    return signedShipments.filter((s) => {
      const no = String(s?.no || "").toLowerCase();
      const customer = String(s?.sellToCustomerName || "").toLowerCase();
      const orderNo = String(s?.orderNo || "").toLowerCase();
      const pod = podByShipmentNo.get(String(s?.no || "").trim());
      const signedBy = String(pod?.signedBy || "").toLowerCase();
      const note = String(pod?.note || "").toLowerCase();
      return (
        no.includes(q) ||
        customer.includes(q) ||
        orderNo.includes(q) ||
        signedBy.includes(q) ||
        note.includes(q)
      );
    });
  }, [podByShipmentNo, query, signedShipments]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="container mx-auto p-4 md:p-6 max-w-5xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="xp1 text-2xl bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, var(--logo-1), var(--logo-3))" }}>
              Historique des signatures
            </h1>
            <div className="xp-text mt-1 text-slate-600">Toutes les signatures enregistrées (POD)</div>
          </div>
          <Link href="/regions-planning" className="xp-text px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            Retour
          </Link>
        </div>

        <div className="bg-white/80 rounded-2xl border p-4" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
          <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher expédition / client / note..."
              className="xp-text px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 w-full"
              style={{ borderColor: "rgba(79,88,165,0.25)" }}
            />
          </div>

          {loading ? (
            <div className="xp-text text-slate-500">Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="xp-text text-slate-500">Aucune signature</div>
          ) : (
            <div className="overflow-auto rounded-xl border mt-3" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
              <table className="min-w-full text-sm">
                <thead className="bg-slate-50">
                  <tr className="text-left text-slate-700">
                    <th className="xp3 px-3 py-2">No.</th>
                    <th className="xp3 px-3 py-2">Client</th>
                    <th className="xp3 px-3 py-2">Posting</th>
                    <th className="xp3 px-3 py-2">Order No.</th>
                    <th className="xp3 px-3 py-2">Signé le</th>
                    <th className="xp3 px-3 py-2">Signé par</th>
                    <th className="xp3 px-3 py-2">Signature</th>
                    <th className="xp3 px-3 py-2">Action</th>
                  </tr>
                </thead>
                <tbody className="bg-white">
                  {filtered.map((s) => {
                    const no = String(s?.no || "").trim();
                    const pod = podByShipmentNo.get(no);
                    return (
                      <tr
                        key={`${no}-${pod?.createdAt || ""}`}
                        className="border-t"
                        style={{ borderColor: "rgba(2,6,23,0.06)" }}
                      >
                        <td className="xp-text px-3 py-2">
                          <div className="font-semibold" style={{ color: "var(--logo-4)" }}>
                            {no || "-"}
                          </div>
                        </td>
                        <td className="xp-text px-3 py-2">
                          <div className="text-slate-800">{s.sellToCustomerName || "-"}</div>
                          <div className="text-slate-500 text-xs">{s.sellToCustomerNo || "-"}</div>
                        </td>
                        <td className="xp-text px-3 py-2">{fmtDate(s.postingDate)}</td>
                        <td className="xp-text px-3 py-2">{s.orderNo || "-"}</td>
                        <td className="xp-text px-3 py-2">
                          {pod?.createdAt ? new Date(pod.createdAt).toLocaleString() : "-"}
                        </td>
                        <td className="xp-text px-3 py-2">{pod?.signedBy || "-"}</td>
                        <td className="xp-text px-3 py-2">
                          {pod?.imagePath ? (
                            <a
                              href={pod.imagePath}
                              target="_blank"
                              rel="noreferrer"
                              className="xp-text inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                            >
                              Voir
                            </a>
                          ) : (
                            "-"
                          )}
                        </td>
                        <td className="xp-text px-3 py-2">
                          {no ? (
                            <Link
                              href={`/pod-signature?shipmentNo=${encodeURIComponent(no)}`}
                              className="xp-text inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-white"
                              style={{ backgroundColor: "var(--logo-1)" }}
                            >
                              Ouvrir
                            </Link>
                          ) : (
                            "-"
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
