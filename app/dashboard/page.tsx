
"use client";

import React, { useEffect, useMemo, useState } from "react";
import { mockOrders } from "../../types/mockOrders";

type CityTour = {
  city: string;
  driver?: string;
  vehicle?: string;
  selectedOrders: string[];
  closed?: boolean;
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
  hasColis?: boolean;
  hasEmballagesVides?: boolean;
  defects?: Array<{ itemNo: string; qty: number; reason?: string }>;
};

type OrderStatus = "non_demarre" | "en_cours" | "livre";
type StatusMap = Record<string /*orderNo*/, OrderStatus>;
type CityStatus = Record<string /*city*/, StatusMap>;

function loadJson<T>(key: string, fallback: T): T {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) return fallback;
    return JSON.parse(raw) as T;
  } catch {
    return fallback;
  }
}

function pickAssignments(): Record<string, CityTour> {
  const a3 = loadJson<Record<string, CityTour>>("regions_planning_assignments_v3", {});
  if (a3 && Object.keys(a3).length > 0) return a3;
  const a1 = loadJson<Record<string, CityTour>>("regions_planning_assignments_v1", {});
  return a1;
}

function pickStatuses(): CityStatus {
  return loadJson<CityStatus>("regions_planning_status_v1", {} as CityStatus);
}

const cityCoords: Record<string, { lat: number; lng: number }> = {
  Paris: { lat: 48.8566, lng: 2.3522 },
  Lyon: { lat: 45.764, lng: 4.8357 },
  Marseille: { lat: 43.2965, lng: 5.3698 },
  Toulouse: { lat: 43.6047, lng: 1.4442 },
  Nice: { lat: 43.7102, lng: 7.262 },
  Bordeaux: { lat: 44.8378, lng: -0.5792 },
  Lille: { lat: 50.6292, lng: 3.0573 },
  Strasbourg: { lat: 48.5734, lng: 7.7521 },
  Nantes: { lat: 47.2184, lng: -1.5536 },
  Berlin: { lat: 52.52, lng: 13.405 },
  Rome: { lat: 41.9028, lng: 12.4964 },
  Madrid: { lat: 40.4168, lng: -3.7038 },
  London: { lat: 51.5074, lng: -0.1278 },
  Brussels: { lat: 50.8503, lng: 4.3517 },
  Amsterdam: { lat: 52.3676, lng: 4.9041 },
};

const start = cityCoords["Lyon"];

function haversineKm(a: { lat: number; lng: number }, b: { lat: number; lng: number }) {
  const R = 6371;
  const dLat = ((b.lat - a.lat) * Math.PI) / 180;
  const dLon = ((b.lng - a.lng) * Math.PI) / 180;
  const la1 = (a.lat * Math.PI) / 180;
  const la2 = (b.lat * Math.PI) / 180;
  const s1 = Math.sin(dLat / 2);
  const s2 = Math.sin(dLon / 2);
  const h = s1 * s1 + Math.cos(la1) * Math.cos(la2) * s2 * s2;
  return 2 * R * Math.asin(Math.sqrt(h));
}

function fmtPct(n: number) {
  if (!Number.isFinite(n)) return "0%";
  return `${Math.round(n)}%`;
}

function clampPct(n: number) {
  if (!Number.isFinite(n)) return 0;
  return Math.max(0, Math.min(100, n));
}

export default function DashboardPage() {
  const [assignments, setAssignments] = useState<Record<string, CityTour>>({});
  const [statuses, setStatuses] = useState<CityStatus>({});
  const [pods, setPods] = useState<PodRecord[]>([]);
  const [returns, setReturns] = useState<ReturnsRecord[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    setAssignments(pickAssignments());
    setStatuses(pickStatuses());
  }, []);

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
      } catch {
        if (!cancelled) {
          setPods([]);
          setReturns([]);
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const allTours = useMemo(() => {
    const list = Object.values(assignments || {}).filter((t) => t && (t.selectedOrders || []).length > 0);
    list.sort((a, b) => String(a.city || "").localeCompare(String(b.city || "")));
    return list;
  }, [assignments]);

  const closedTours = useMemo(() => allTours.filter(t => t.closed), [allTours]);

  const ordersByCity = useMemo(() => {
    const m: Record<string, number> = {};
    for (const o of mockOrders) {
      const city = (o.Sell_to_City || "Autres").trim();
      m[city] = (m[city] || 0) + 1;
    }
    return Object.entries(m).sort((a, b) => b[1] - a[1]);
  }, []);

  const podSet = useMemo(() => {
    const s = new Set<string>();
    for (const r of pods || []) {
      const k = String(r?.shipmentNo || "").trim();
      if (k) s.add(k);
    }
    return s;
  }, [pods]);

  const returnsSet = useMemo(() => {
    const s = new Set<string>();
    for (const r of returns || []) {
      const k = String(r?.shipmentNo || "").trim();
      if (k) s.add(k);
    }
    return s;
  }, [returns]);

  const global = useMemo(() => {
    const orders = allTours.flatMap((t) => t.selectedOrders || []);
    const planned = orders.length;

    let delivered = 0;
    let inProgress = 0;

    for (const t of allTours) {
      const city = t.city;
      const st = statuses[city] || {};
      for (const o of t.selectedOrders || []) {
        const v = st[o] || "non_demarre";
        if (v === "livre") delivered++;
        else if (v === "en_cours") inProgress++;
      }
    }

    const notStarted = Math.max(0, planned - delivered - inProgress);

    const signed = orders.filter((o) => podSet.has(o)).length;
    const returnsDone = orders.filter((o) => returnsSet.has(o)).length;

    const deliveryRate = planned === 0 ? 0 : (delivered / planned) * 100;
    const podRate = delivered === 0 ? 0 : (signed / delivered) * 100;
    const returnsRate = delivered === 0 ? 0 : (returnsDone / delivered) * 100;

    // Oublis: livré mais pas POD ou pas retours
    const missedPod = orders.filter((o) => {
      for (const t of allTours) {
        if (!t.selectedOrders?.includes(o)) continue;
        const v = (statuses[t.city] || {})[o];
        return v === "livre" && !podSet.has(o);
      }
      return false;
    }).length;

    const missedReturns = orders.filter((o) => {
      for (const t of allTours) {
        if (!t.selectedOrders?.includes(o)) continue;
        const v = (statuses[t.city] || {})[o];
        return v === "livre" && !returnsSet.has(o);
      }
      return false;
    }).length;

    return {
      tours: allTours.length,
      closedTours: closedTours.length,
      planned,
      delivered,
      inProgress,
      notStarted,
      signed,
      returnsDone,
      deliveryRate,
      podRate,
      returnsRate,
      missedPod,
      missedReturns,
    };
  }, [allTours, closedTours, podSet, returnsSet, statuses]);

  const byVehicle = useMemo(() => {
    const out: Array<{
      vehicle: string;
      driver: string;
      tours: number;
      planned: number;
      delivered: number;
      signed: number;
      returnsDone: number;
      kmEst: number;
      co2EstKg: number;
    }> = [];

    const m = new Map<string, typeof out[number]>();
    const emissionKgPerKm = 0.9; // estimation camion léger/moyen (à ajuster)

    for (const t of allTours) {
      const vehicle = String(t.vehicle || "-").trim() || "-";
      const driver = String(t.driver || "-").trim() || "-";
      const key = `${vehicle}||${driver}`;

      if (!m.has(key)) {
        m.set(key, {
          vehicle,
          driver,
          tours: 0,
          planned: 0,
          delivered: 0,
          signed: 0,
          returnsDone: 0,
          kmEst: 0,
          co2EstKg: 0,
        });
      }

      const row = m.get(key)!;
      row.tours += 1;
      row.planned += (t.selectedOrders || []).length;

      const st = statuses[t.city] || {};
      for (const o of t.selectedOrders || []) {
        if (st[o] === "livre") row.delivered += 1;
        if (podSet.has(o)) row.signed += 1;
        if (returnsSet.has(o)) row.returnsDone += 1;
      }

      const coord = cityCoords[t.city];
      if (coord && start) {
        // Estimation: aller-retour dépôt(lyon) -> ville, pondéré par nombre de stops
        const baseKm = haversineKm(start, coord) * 2;
        const stops = Math.max(1, (t.selectedOrders || []).length);
        const km = baseKm * (1 + Math.min(2, (stops - 1) * 0.15));
        row.kmEst += km;
      }
    }

    for (const row of m.values()) {
      row.co2EstKg = row.kmEst * emissionKgPerKm;
      out.push(row);
    }

    out.sort((a, b) => b.kmEst - a.kmEst);
    return out;
  }, [closedTours, podSet, returnsSet, statuses]);

  const rings = useMemo(() => {
    const delivery = clampPct(global.deliveryRate);
    const pod = clampPct(global.podRate);
    const ret = clampPct(global.returnsRate);
    return { delivery, pod, ret };
  }, [global.deliveryRate, global.podRate, global.returnsRate]);

  const maxKm = useMemo(() => {
    return byVehicle.reduce((m, r) => Math.max(m, r.kmEst || 0), 0);
  }, [byVehicle]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="container mx-auto p-3 md:p-6 max-w-7xl space-y-6">

        {/* ── Hero Header ── */}
        <div className="relative overflow-hidden rounded-2xl p-6 md:p-8" style={{ background: "linear-gradient(135deg, #4f58a5 0%, #406fb5 40%, #49a2da 100%)" }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Tableau de bord</h1>
              <p className="mt-1 text-sm text-white/80">Traçabilité en temps réel &bull; Oublis &bull; Statistiques véhicules &bull; RSE</p>
            </div>
            <button
              type="button"
              onClick={() => {
                setAssignments(pickAssignments());
                setStatuses(pickStatuses());
              }}
              className="shrink-0 px-4 py-2 rounded-xl bg-white/20 backdrop-blur text-white text-sm font-medium ring-1 ring-white/30 hover:bg-white/30 transition"
              title="Recharger depuis le stockage local"
            >
              Rafraîchir
            </button>
          </div>
          {loading && <div className="relative mt-3 text-sm text-white/70">Chargement POD / Retours…</div>}
        </div>

        {/* ── Top KPI Row ── */}
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
          {/* Tours card */}
          <div className="rounded-2xl p-5 bg-white shadow-sm border border-slate-100 flex flex-col items-center justify-center text-center">
            <div className="text-4xl font-extrabold" style={{ color: "var(--logo-1)" }}>{global.tours}</div>
            <div className="text-xs font-semibold text-slate-500 mt-1 uppercase tracking-wider">Tournées</div>
            <div className="text-[11px] text-slate-400 mt-0.5">{global.planned} stops &bull; {global.closedTours} validée(s)</div>
            <div className="text-[11px] text-slate-400">{mockOrders.length} commandes totales</div>
          </div>

          {/* Delivery ring */}
          <div className="rounded-2xl p-5 bg-white shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="relative h-20 w-20">
              <div className="h-20 w-20 rounded-full" style={{ background: `conic-gradient(#10b981 ${rings.delivery}%, #e5e7eb 0)` }}>
                <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
                  <span className="text-lg font-extrabold text-emerald-600">{fmtPct(global.deliveryRate)}</span>
                </div>
              </div>
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Livraisons</div>
            <div className="text-[11px] text-slate-400">{global.delivered} / {global.planned}</div>
          </div>

          {/* POD ring */}
          <div className="rounded-2xl p-5 bg-white shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="relative h-20 w-20">
              <div className="h-20 w-20 rounded-full" style={{ background: `conic-gradient(#3b82f6 ${rings.pod}%, #e5e7eb 0)` }}>
                <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
                  <span className="text-lg font-extrabold text-blue-600">{fmtPct(global.podRate)}</span>
                </div>
              </div>
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Signatures POD</div>
            <div className="text-[11px] text-slate-400">{global.signed} / {global.delivered}{global.missedPod > 0 && <span className="text-rose-500 ml-1">({global.missedPod} oublis)</span>}</div>
          </div>

          {/* Returns ring */}
          <div className="rounded-2xl p-5 bg-white shadow-sm border border-slate-100 flex flex-col items-center">
            <div className="relative h-20 w-20">
              <div className="h-20 w-20 rounded-full" style={{ background: `conic-gradient(#f59e0b ${rings.ret}%, #e5e7eb 0)` }}>
                <div className="absolute inset-2 rounded-full bg-white flex items-center justify-center">
                  <span className="text-lg font-extrabold text-amber-600">{fmtPct(global.returnsRate)}</span>
                </div>
              </div>
            </div>
            <div className="mt-2 text-xs font-semibold text-slate-500 uppercase tracking-wider">Retours saisis</div>
            <div className="text-[11px] text-slate-400">{global.returnsDone} / {global.delivered}{global.missedReturns > 0 && <span className="text-rose-500 ml-1">({global.missedReturns} oublis)</span>}</div>
          </div>
        </div>

        {/* ── Status Distribution ── */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5 md:p-6">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">Répartition des statuts</h2>
              <p className="text-xs text-slate-500 mt-0.5">Suivi en temps réel de toutes les commandes</p>
            </div>
          </div>

          <div className="grid grid-cols-3 gap-3 mb-5">
            <div className="rounded-xl p-4 text-center" style={{ background: "linear-gradient(135deg, rgba(148,163,184,0.12), rgba(148,163,184,0.04))" }}>
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-slate-200/60 mb-2">
                <span className="text-lg">⏳</span>
              </div>
              <div className="text-2xl font-extrabold text-slate-700">{global.notStarted}</div>
              <div className="text-[11px] font-medium text-slate-500 mt-0.5">Non démarré</div>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: "linear-gradient(135deg, rgba(139,92,246,0.12), rgba(139,92,246,0.04))" }}>
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-violet-200/60 mb-2">
                <span className="text-lg">🚚</span>
              </div>
              <div className="text-2xl font-extrabold text-violet-700">{global.inProgress}</div>
              <div className="text-[11px] font-medium text-slate-500 mt-0.5">En cours</div>
            </div>
            <div className="rounded-xl p-4 text-center" style={{ background: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(16,185,129,0.04))" }}>
              <div className="inline-flex items-center justify-center h-10 w-10 rounded-full bg-emerald-200/60 mb-2">
                <span className="text-lg">✅</span>
              </div>
              <div className="text-2xl font-extrabold text-emerald-700">{global.delivered}</div>
              <div className="text-[11px] font-medium text-slate-500 mt-0.5">Livré</div>
            </div>
          </div>

          {/* Stacked bar */}
          <div className="h-4 rounded-full bg-slate-100 overflow-hidden flex">
            {(() => {
              const total = Math.max(1, global.planned);
              const pNon = (global.notStarted / total) * 100;
              const pEn = (global.inProgress / total) * 100;
              const pLiv = (global.delivered / total) * 100;
              return (
                <>
                  <div className="h-full transition-all duration-700" style={{ width: `${pLiv}%`, background: "linear-gradient(90deg, #10b981, #34d399)" }} />
                  <div className="h-full transition-all duration-700" style={{ width: `${pEn}%`, background: "linear-gradient(90deg, #8b5cf6, #a78bfa)" }} />
                  <div className="h-full transition-all duration-700" style={{ width: `${pNon}%`, background: "linear-gradient(90deg, #94a3b8, #cbd5e1)" }} />
                </>
              );
            })()}
          </div>
          <div className="flex flex-wrap items-center gap-4 mt-3 text-[11px] text-slate-500">
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-emerald-500" /> Livré</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-violet-500" /> En cours</span>
            <span className="flex items-center gap-1.5"><span className="h-2.5 w-2.5 rounded-full bg-slate-400" /> Non démarré</span>
          </div>
        </div>

        {/* ── Vehicles & RSE ── */}
        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
          {/* Km chart */}
          <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5 md:p-6">
            <h2 className="text-base font-bold text-slate-900 mb-1">Distance par véhicule</h2>
            <p className="text-xs text-slate-500 mb-4">Km estimés (aller-retour dépôt)</p>
            {byVehicle.length === 0 ? (
              <div className="text-sm text-slate-400 py-8 text-center">Aucune tournée validée</div>
            ) : (
              <div className="space-y-3">
                {byVehicle.slice(0, 8).map((r, i) => {
                  const w = maxKm <= 0 ? 0 : (r.kmEst / maxKm) * 100;
                  const colors = [
                    "linear-gradient(90deg, #4f58a5, #49a2da)",
                    "linear-gradient(90deg, #0ea5e9, #38bdf8)",
                    "linear-gradient(90deg, #6366f1, #818cf8)",
                    "linear-gradient(90deg, #8b5cf6, #a78bfa)",
                  ];
                  return (
                    <div key={`km-${r.vehicle}||${r.driver}`}>
                      <div className="flex items-center justify-between mb-1">
                        <div className="flex items-center gap-2">
                          <span className="inline-flex items-center justify-center h-6 w-6 rounded-md text-[10px] font-bold text-white" style={{ background: colors[i % colors.length] }}>{i + 1}</span>
                          <span className="text-xs font-semibold text-slate-800 truncate max-w-[160px]">{r.vehicle}</span>
                        </div>
                        <span className="text-xs font-medium text-slate-600">{r.kmEst.toFixed(0)} km</span>
                      </div>
                      <div className="h-2.5 rounded-full bg-slate-100 overflow-hidden">
                        <div className="h-full rounded-full transition-all duration-700" style={{ width: `${w}%`, backgroundImage: colors[i % colors.length] }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Vehicle table */}
          <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5 md:p-6">
            <h2 className="text-base font-bold text-slate-900 mb-1">Performance & RSE</h2>
            <p className="text-xs text-slate-500 mb-4">Taux par véhicule et impact carbone</p>
            {byVehicle.length === 0 ? (
              <div className="text-sm text-slate-400 py-8 text-center">Aucune tournée validée</div>
            ) : (
              <div className="overflow-auto rounded-xl border border-slate-100">
                <table className="min-w-full text-sm">
                  <thead>
                    <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500" style={{ background: "linear-gradient(135deg, #f8fafc, #f1f5f9)" }}>
                      <th className="px-3 py-2.5 font-semibold">Véhicule</th>
                      <th className="px-3 py-2.5 font-semibold">Livraison</th>
                      <th className="px-3 py-2.5 font-semibold">POD</th>
                      <th className="px-3 py-2.5 font-semibold">Retours</th>
                      <th className="px-3 py-2.5 font-semibold">CO₂</th>
                    </tr>
                  </thead>
                  <tbody>
                    {byVehicle.map((r, i) => {
                      const deliveryRate = r.planned === 0 ? 0 : (r.delivered / r.planned) * 100;
                      const podRate = r.delivered === 0 ? 0 : (r.signed / r.delivered) * 100;
                      const returnsRate = r.delivered === 0 ? 0 : (r.returnsDone / r.delivered) * 100;
                      const pillColor = (v: number) => v >= 80 ? "bg-emerald-100 text-emerald-700" : v >= 50 ? "bg-amber-100 text-amber-700" : "bg-rose-100 text-rose-700";
                      return (
                        <tr key={`${r.vehicle}||${r.driver}`} className={`border-t border-slate-100 ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                          <td className="px-3 py-2.5">
                            <div className="font-semibold text-xs" style={{ color: "var(--logo-4)" }}>{r.vehicle}</div>
                            <div className="text-[10px] text-slate-400">{r.driver}</div>
                          </td>
                          <td className="px-3 py-2.5"><span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${pillColor(deliveryRate)}`}>{fmtPct(deliveryRate)}</span></td>
                          <td className="px-3 py-2.5"><span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${pillColor(podRate)}`}>{fmtPct(podRate)}</span></td>
                          <td className="px-3 py-2.5"><span className={`inline-block px-2 py-0.5 rounded-full text-[11px] font-medium ${pillColor(returnsRate)}`}>{fmtPct(returnsRate)}</span></td>
                          <td className="px-3 py-2.5 text-xs text-slate-600 font-medium">{r.co2EstKg.toFixed(0)} kg</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <div className="text-[11px] text-slate-400 mt-3">
              km/CO₂ sont des estimations basées sur la distance ville (haversine).
            </div>
          </div>
        </div>

        {/* ── Orders by City ── */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-5 md:p-6">
          <h2 className="text-base font-bold text-slate-900 mb-1">Commandes par ville</h2>
          <p className="text-xs text-slate-500 mb-4">{mockOrders.length} commandes au total</p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {ordersByCity.map(([city, count]) => {
              const tour = assignments[city];
              const isValidated = !!tour?.closed;
              const hasAssignment = !!(tour && (tour.selectedOrders || []).length > 0);
              return (
                <div key={city} className="rounded-xl p-4 border border-slate-100 relative overflow-hidden" style={{ background: "linear-gradient(135deg, rgba(79,88,165,0.06), rgba(73,162,218,0.06))" }}>
                  <div className="text-lg font-extrabold" style={{ color: "var(--logo-1)" }}>{count}</div>
                  <div className="text-xs font-semibold text-slate-700 mt-0.5">{city}</div>
                  <div className="mt-2">
                    {isValidated ? (
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-emerald-100 text-emerald-700 font-medium">Validée</span>
                    ) : hasAssignment ? (
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-sky-100 text-sky-700 font-medium">En préparation</span>
                    ) : (
                      <span className="inline-block text-[10px] px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 font-medium">Non planifiée</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

      </div>
    </div>
  );
}
