"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { mockOrders } from "@/types/mockOrders";

type TabKey = "tournees" | "signatures" | "retours";

type CityTour = {
  city: string;
  driver?: string;
  vehicle?: string;
  selectedOrders: string[];
  locked?: boolean;
  closed?: boolean;
  execClosed?: boolean;
  optimized?: boolean;
};

type PodRecord = {
  shipmentNo: string;
  signedBy?: string;
  note?: string;
  createdAt: string;
  imagePath?: string;
};

type ReturnsRecord = {
  shipmentNo: string;
  createdAt: string;
  updatedAt?: string;
  values: Record<string, number>;
  note?: string;
};

function loadAssignments(): Record<string, CityTour> {
  try {
    const rawV3 = localStorage.getItem("regions_planning_assignments_v3") || "";
    if (rawV3) {
      const parsed = JSON.parse(rawV3);
      if (parsed && typeof parsed === "object" && Object.keys(parsed).length > 0) return parsed;
    }
    const rawV1 = localStorage.getItem("regions_planning_assignments_v1") || "{}";
    return JSON.parse(rawV1);
  } catch {
    return {};
  }
}

function fmtDateTime(s?: string) {
  if (!s) return "-";
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return s;
  return d.toLocaleString();
}

export default function HistoriquePage() {
  const [tab, setTab] = useState<TabKey>("tournees");
  const [query, setQuery] = useState<string>("");

  const [assignments, setAssignments] = useState<Record<string, CityTour>>({});
  const [pods, setPods] = useState<PodRecord[]>([]);
  const [returns, setReturns] = useState<ReturnsRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAssignments(loadAssignments());
  }, []);

  const mockNoSet = useMemo(() => {
    const set = new Set<string>();
    for (const o of Array.isArray(mockOrders) ? mockOrders : []) {
      const no = String((o as any)?.No || "").trim();
      if (no) set.add(no);
    }
    return set;
  }, []);

  const isMockShipmentNo = (shipmentNoRaw?: string | null) => {
    const s = String(shipmentNoRaw || "").trim();
    if (!s) return false;
    const unprefixed = s.startsWith("WHS-") ? s.slice(4) : s;
    return mockNoSet.has(unprefixed) || mockNoSet.has(s);
  };

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [podRes, retRes] = await Promise.all([
          fetch("/api/pod", { cache: "no-store" }),
          fetch("/api/returns", { cache: "no-store" }),
        ]);

        const podJson = await podRes.json();
        const retJson = await retRes.json();

        if (!cancelled) {
          setPods((podJson.records || []) as PodRecord[]);
          setReturns((retJson.records || []) as ReturnsRecord[]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const closedTours = useMemo(() => {
    const list = Object.values(assignments || {})
      .filter((t) => t && t.closed && t.execClosed)
      .filter((t) => (t.selectedOrders || []).some((no) => isMockShipmentNo(no)));
    list.sort((a, b) => String(a.city || "").localeCompare(String(b.city || "")));
    return list;
  }, [assignments, mockNoSet]);

  const filteredTours = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return closedTours;
    return closedTours.filter((t) => {
      const city = String(t.city || "").toLowerCase();
      const driver = String(t.driver || "").toLowerCase();
      const vehicle = String(t.vehicle || "").toLowerCase();
      const orders = (t.selectedOrders || []).join(" ").toLowerCase();
      return city.includes(q) || driver.includes(q) || vehicle.includes(q) || orders.includes(q);
    });
  }, [closedTours, query]);

  const latestPodByShipment = useMemo(() => {
    const m = new Map<string, PodRecord>();
    for (const r of pods) {
      const k = String(r?.shipmentNo || "").trim();
      if (!k) continue;
      if (!isMockShipmentNo(k)) continue;
      const prev = m.get(k);
      if (!prev || String(r?.createdAt || "") > String(prev?.createdAt || "")) m.set(k, r);
    }
    return m;
  }, [pods]);

  const filteredPods = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = Array.from(latestPodByShipment.values());
    arr.sort((a, b) => String(b.createdAt || "").localeCompare(String(a.createdAt || "")));
    if (!q) return arr;
    return arr.filter((r) => {
      const no = String(r.shipmentNo || "").toLowerCase();
      const by = String(r.signedBy || "").toLowerCase();
      const note = String(r.note || "").toLowerCase();
      return no.includes(q) || by.includes(q) || note.includes(q);
    });
  }, [latestPodByShipment, query]);

  const filteredReturns = useMemo(() => {
    const q = query.trim().toLowerCase();
    const arr = [...(returns || [])].filter((r) => isMockShipmentNo(r?.shipmentNo));
    arr.sort((a, b) => String(b.updatedAt || b.createdAt || "").localeCompare(String(a.updatedAt || a.createdAt || "")));
    if (!q) return arr;
    return arr.filter((r) => {
      const no = String(r.shipmentNo || "").toLowerCase();
      const note = String(r.note || "").toLowerCase();
      const kv = Object.entries(r.values || {})
        .map(([k, v]) => `${k}:${v}`)
        .join(" ")
        .toLowerCase();
      return no.includes(q) || note.includes(q) || kv.includes(q);
    });
  }, [returns, query, mockNoSet]);

  const tabButton = (key: TabKey, label: string) => {
    const active = tab === key;
    return (
      <button
        onClick={() => setTab(key)}
        className={`xp-text px-3 py-2 rounded-lg ${active ? "text-white" : "bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"}`}
        style={active ? { backgroundColor: "var(--logo-1)" } : undefined}
      >
        {label}
      </button>
    );
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="container mx-auto p-4 md:p-6 max-w-6xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1
              className="xp1 text-2xl bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, var(--logo-1), var(--logo-3))" }}
            >
              Historique
            </h1>
            <div className="xp-text mt-1 text-slate-600">
              Historique des tournées validées + signatures/PDF + retours
            </div>
          </div>
          <Link
            href="/regions-planning"
            className="xp-text px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
          >
            Retour
          </Link>
        </div>

        <div className="bg-white/80 rounded-2xl border p-4" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
          <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
            <div className="flex flex-wrap gap-2">
              {tabButton("tournees", "Tournées")}
              {tabButton("signatures", "Signatures / PDF")}
              {tabButton("retours", "Retours")}
            </div>
            <div className="flex items-center gap-2">
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Rechercher..."
                className="xp-text px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 w-full md:w-80"
                style={{ borderColor: "rgba(79,88,165,0.25)" }}
              />
            </div>
          </div>

          {loading && <div className="xp-text mt-3 text-slate-500">Chargement...</div>}

          {tab === "tournees" && (
            <div className="mt-4">
              {filteredTours.length === 0 ? (
                <div className="xp-text text-slate-500">Aucune tournée validée</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredTours.map((t) => (
                    <div
                      key={t.city}
                      className="rounded-2xl border bg-white p-4"
                      style={{ borderColor: "rgba(79,88,165,0.14)" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="xp2" style={{ color: "var(--logo-4)" }}>
                            {t.city}
                          </div>
                          <div className="xp-text text-slate-600 mt-1">Chauffeur: {t.driver || "-"}</div>
                          <div className="xp-text text-slate-600">Camion: {t.vehicle || "-"}</div>
                          <div className="xp-text text-slate-600">Livraisons: {(t.selectedOrders || []).length}</div>
                        </div>
                        <Link
                          href={`/suivi-tournees?city=${encodeURIComponent(t.city)}`}
                          className="xp-text px-2 py-1 rounded-lg text-white"
                          style={{ backgroundColor: "var(--logo-1)" }}
                        >
                          Ouvrir
                        </Link>
                      </div>
                      {(t.selectedOrders || []).length > 0 && (
                        <div className="mt-3 flex flex-wrap gap-2">
                          {t.selectedOrders.slice(0, 12).map((no) => (
                            <span
                              key={no}
                              className="xp-text px-2 py-0.5 rounded-full"
                              style={{ backgroundColor: "rgba(64,111,181,0.10)", color: "var(--logo-1)" }}
                            >
                              {no}
                            </span>
                          ))}
                          {t.selectedOrders.length > 12 && (
                            <span className="xp-text text-slate-500">+{t.selectedOrders.length - 12}</span>
                          )}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}

          {tab === "signatures" && (
            <div className="mt-4">
              {filteredPods.length === 0 ? (
                <div className="xp-text text-slate-500">Aucune signature</div>
              ) : (
                <div className="overflow-auto rounded-xl border" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50">
                      <tr className="text-left text-slate-700">
                        <th className="xp3 px-3 py-2">Expédition</th>
                        <th className="xp3 px-3 py-2">Signé le</th>
                        <th className="xp3 px-3 py-2">Signé par</th>
                        <th className="xp3 px-3 py-2">Note</th>
                        <th className="xp3 px-3 py-2">Pièces</th>
                        <th className="xp3 px-3 py-2">Actions</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {filteredPods.map((r) => (
                        <tr
                          key={`${r.shipmentNo}-${r.createdAt}`}
                          className="border-t"
                          style={{ borderColor: "rgba(2,6,23,0.06)" }}
                        >
                          <td className="xp-text px-3 py-2">
                            <div className="font-semibold" style={{ color: "var(--logo-4)" }}>
                              {r.shipmentNo}
                            </div>
                          </td>
                          <td className="xp-text px-3 py-2">{fmtDateTime(r.createdAt)}</td>
                          <td className="xp-text px-3 py-2">{r.signedBy || "-"}</td>
                          <td className="xp-text px-3 py-2">{r.note || "-"}</td>
                          <td className="xp-text px-3 py-2">
                            <div className="flex flex-wrap gap-2">
                              {r.imagePath ? (
                                <a
                                  href={r.imagePath}
                                  target="_blank"
                                  rel="noreferrer"
                                  className="xp-text inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                                >
                                  Signature
                                </a>
                              ) : (
                                <span className="xp-text text-slate-500">-</span>
                              )}
                              <a
                                href={`/api/pod/pdf?shipmentNo=${encodeURIComponent(r.shipmentNo)}`}
                                target="_blank"
                                rel="noreferrer"
                                className="xp-text inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                              >
                                PDF
                              </a>
                            </div>
                          </td>
                          <td className="xp-text px-3 py-2">
                            <Link
                              href={`/pod-signature?shipmentNo=${encodeURIComponent(r.shipmentNo)}`}
                              className="xp-text inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-white"
                              style={{ backgroundColor: "var(--logo-1)" }}
                            >
                              Ouvrir
                            </Link>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          )}

          {tab === "retours" && (
            <div className="mt-4">
              {filteredReturns.length === 0 ? (
                <div className="xp-text text-slate-500">Aucun retour</div>
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredReturns.map((r) => (
                    <div
                      key={`${r.shipmentNo}-${r.updatedAt || r.createdAt}`}
                      className="rounded-2xl border bg-white p-4"
                      style={{ borderColor: "rgba(79,88,165,0.14)" }}
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="xp2" style={{ color: "var(--logo-4)" }}>
                            {r.shipmentNo}
                          </div>
                          <div className="xp-text text-slate-600 mt-1">Créé: {fmtDateTime(r.createdAt)}</div>
                          {r.updatedAt && <div className="xp-text text-slate-600">MAJ: {fmtDateTime(r.updatedAt)}</div>}
                          {r.note && <div className="xp-text text-slate-600">Note: {r.note}</div>}
                        </div>
                        <Link
                          href={`/retours-vides?shipmentNo=${encodeURIComponent(r.shipmentNo)}`}
                          className="xp-text px-2 py-1 rounded-lg text-white"
                          style={{ backgroundColor: "var(--shape-4)" }}
                        >
                          Ouvrir
                        </Link>
                      </div>
                      <div className="mt-3 grid grid-cols-2 gap-2">
                        {Object.entries(r.values || {}).map(([k, v]) => (
                          <div
                            key={k}
                            className="xp-text px-2 py-1 rounded-lg"
                            style={{ backgroundColor: "rgba(150,194,206,0.18)", color: "var(--logo-4)" }}
                          >
                            {k}: {Number.isFinite(v) ? String(v) : "0"}
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
