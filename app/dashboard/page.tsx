
"use client";

import React, { useEffect, useMemo, useState } from "react";

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

  const closedTours = useMemo(() => {
    const list = Object.values(assignments || {}).filter((t) => t && t.closed);
    list.sort((a, b) => String(a.city || "").localeCompare(String(b.city || "")));
    return list;
  }, [assignments]);

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
    const orders = closedTours.flatMap((t) => t.selectedOrders || []);
    const planned = orders.length;

    let delivered = 0;
    let inProgress = 0;

    for (const t of closedTours) {
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
      // only consider if delivered
      for (const t of closedTours) {
        if (!t.selectedOrders?.includes(o)) continue;
        const v = (statuses[t.city] || {})[o];
        return v === "livre" && !podSet.has(o);
      }
      return false;
    }).length;

    const missedReturns = orders.filter((o) => {
      for (const t of closedTours) {
        if (!t.selectedOrders?.includes(o)) continue;
        const v = (statuses[t.city] || {})[o];
        return v === "livre" && !returnsSet.has(o);
      }
      return false;
    }).length;

    return {
      tours: closedTours.length,
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
  }, [closedTours, podSet, returnsSet, statuses]);

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

    for (const t of closedTours) {
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
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex items-start justify-between gap-3 mb-5">
          <div>
            <h1
              className="xp1 text-2xl bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, var(--logo-1), var(--logo-3))" }}
            >
              Tableau de bord
            </h1>
            <div className="xp-text mt-1 text-slate-600">
              Traçabilité en temps réel • Oublis livraisons/retours • Statistiques par véhicule • RSE (CO₂ estimé)
            </div>
          </div>
          <button
            type="button"
            onClick={() => {
              setAssignments(pickAssignments());
              setStatuses(pickStatuses());
            }}
            className="xp-text px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            title="Recharger depuis le stockage local"
          >
            Rafraîchir
          </button>
        </div>

        {loading && <div className="xp-text text-slate-500 mb-4">Chargement POD / Retours…</div>}

        <div className="grid grid-cols-1 lg:grid-cols-12 gap-3">
          <div className="lg:col-span-3 p-4 rounded-2xl border bg-white/80" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
            <div className="xp3 text-slate-600">Tournées validées</div>
            <div className="xp1 text-3xl" style={{ color: "var(--logo-4)" }}>{global.tours}</div>
            <div className="xp-text text-slate-500 mt-1">Total stops planifiés: {global.planned}</div>
          </div>

          <div className="lg:col-span-9 grid grid-cols-1 md:grid-cols-3 gap-3">
            <div
              className="p-4 rounded-2xl border text-slate-800"
              style={{ borderColor: "rgba(16,185,129,0.28)", backgroundImage: "linear-gradient(135deg, rgba(16,185,129,0.12), rgba(255,255,255,0.85))" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="xp3 text-slate-600">Livraisons</div>
                  <div className="xp1 text-3xl">{global.delivered}/{global.planned}</div>
                  <div className="xp-text text-slate-600">Taux: {fmtPct(global.deliveryRate)}</div>
                </div>
                <div
                  className="w-16 h-16 rounded-full"
                  style={{
                    background: `conic-gradient(#10b981 ${rings.delivery}%, rgba(148,163,184,0.35) 0)`,
                  }}
                />
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-200/60 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${rings.delivery}%`, backgroundColor: "#10b981" }} />
              </div>
            </div>

            <div
              className="p-4 rounded-2xl border text-slate-800"
              style={{ borderColor: "rgba(59,130,246,0.28)", backgroundImage: "linear-gradient(135deg, rgba(59,130,246,0.12), rgba(255,255,255,0.85))" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="xp3 text-slate-600">POD (signatures)</div>
                  <div className="xp1 text-3xl">{global.signed}/{global.delivered}</div>
                  <div className="xp-text text-slate-600">Taux: {fmtPct(global.podRate)} • Oublis: {global.missedPod}</div>
                </div>
                <div
                  className="w-16 h-16 rounded-full"
                  style={{
                    background: `conic-gradient(#3b82f6 ${rings.pod}%, rgba(148,163,184,0.35) 0)`,
                  }}
                />
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-200/60 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${rings.pod}%`, backgroundColor: "#3b82f6" }} />
              </div>
            </div>

            <div
              className="p-4 rounded-2xl border text-slate-800"
              style={{ borderColor: "rgba(245,158,11,0.30)", backgroundImage: "linear-gradient(135deg, rgba(245,158,11,0.14), rgba(255,255,255,0.85))" }}
            >
              <div className="flex items-center justify-between">
                <div>
                  <div className="xp3 text-slate-600">Retours saisis</div>
                  <div className="xp1 text-3xl">{global.returnsDone}/{global.delivered}</div>
                  <div className="xp-text text-slate-600">Taux: {fmtPct(global.returnsRate)} • Oublis: {global.missedReturns}</div>
                </div>
                <div
                  className="w-16 h-16 rounded-full"
                  style={{
                    background: `conic-gradient(#f59e0b ${rings.ret}%, rgba(148,163,184,0.35) 0)`,
                  }}
                />
              </div>
              <div className="mt-3 h-2 rounded-full bg-slate-200/60 overflow-hidden">
                <div className="h-full rounded-full" style={{ width: `${rings.ret}%`, backgroundColor: "#f59e0b" }} />
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3 mt-3">
          <div className="p-4 rounded-2xl border bg-white/80 lg:col-span-1" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
            <div className="xp2" style={{ color: "var(--logo-4)" }}>Traçabilité (statuts)</div>
            <div className="mt-2 grid grid-cols-3 gap-2">
              <div className="p-3 rounded-xl bg-slate-50">
                <div className="xp3 text-slate-600">Non démarré</div>
                <div className="xp1 text-2xl" style={{ color: "var(--logo-4)" }}>{global.notStarted}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <div className="xp3 text-slate-600">En cours</div>
                <div className="xp1 text-2xl" style={{ color: "var(--logo-4)" }}>{global.inProgress}</div>
              </div>
              <div className="p-3 rounded-xl bg-slate-50">
                <div className="xp3 text-slate-600">Livré</div>
                <div className="xp1 text-2xl" style={{ color: "var(--logo-4)" }}>{global.delivered}</div>
              </div>
            </div>
            <div className="mt-3 h-3 rounded-full bg-slate-200/60 overflow-hidden">
              {(() => {
                const total = Math.max(1, global.planned);
                const pNon = (global.notStarted / total) * 100;
                const pEn = (global.inProgress / total) * 100;
                const pLiv = (global.delivered / total) * 100;
                return (
                  <div className="flex h-full">
                    <div style={{ width: `${pNon}%`, backgroundColor: "#94a3b8" }} />
                    <div style={{ width: `${pEn}%`, backgroundColor: "#8b5cf6" }} />
                    <div style={{ width: `${pLiv}%`, backgroundColor: "#10b981" }} />
                  </div>
                );
              })()}
            </div>
            <div className="xp-text text-slate-600 mt-2">
              Objectif: suppression des oublis + suivi temps réel.
            </div>
          </div>

          <div className="p-4 rounded-2xl border bg-white/80 lg:col-span-2" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
            <div className="xp2" style={{ color: "var(--logo-4)" }}>Véhicules (optimisation logistique & RSE)</div>
            {byVehicle.length === 0 ? (
              <div className="xp-text text-slate-500 mt-2">Aucune tournée validée.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
                <div className="rounded-xl border bg-white overflow-hidden" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
                  <div className="px-3 py-2 bg-slate-50 text-slate-700 xp3">Km estimés par véhicule</div>
                  <div className="p-3">
                    {byVehicle.slice(0, 6).map((r) => {
                      const w = maxKm <= 0 ? 0 : (r.kmEst / maxKm) * 100;
                      return (
                        <div key={`km-${r.vehicle}||${r.driver}`} className="mb-2">
                          <div className="flex items-center justify-between text-xs text-slate-600">
                            <div className="font-medium text-slate-800">{r.vehicle}</div>
                            <div>{r.kmEst.toFixed(0)} km</div>
                          </div>
                          <div className="h-2 rounded-full bg-slate-200/60 overflow-hidden mt-1">
                            <div className="h-full rounded-full" style={{ width: `${w}%`, backgroundImage: "linear-gradient(90deg, #0ea5e9, #3b82f6)" }} />
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>

                <div className="overflow-auto rounded-xl border" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-700">
                      <tr className="text-left">
                        <th className="xp3 px-3 py-2">Véhicule</th>
                        <th className="xp3 px-3 py-2">Livraison</th>
                        <th className="xp3 px-3 py-2">POD</th>
                        <th className="xp3 px-3 py-2">Retours</th>
                        <th className="xp3 px-3 py-2">CO₂</th>
                      </tr>
                    </thead>
                    <tbody className="bg-white">
                      {byVehicle.map((r) => {
                        const deliveryRate = r.planned === 0 ? 0 : (r.delivered / r.planned) * 100;
                        const podRate = r.delivered === 0 ? 0 : (r.signed / r.delivered) * 100;
                        const returnsRate = r.delivered === 0 ? 0 : (r.returnsDone / r.delivered) * 100;
                        return (
                          <tr key={`${r.vehicle}||${r.driver}`} className="border-t" style={{ borderColor: "rgba(2,6,23,0.06)" }}>
                            <td className="xp-text px-3 py-2 font-semibold" style={{ color: "var(--logo-4)" }}>{r.vehicle}</td>
                            <td className="xp-text px-3 py-2 text-slate-700">{fmtPct(deliveryRate)}</td>
                            <td className="xp-text px-3 py-2 text-slate-700">{fmtPct(podRate)}</td>
                            <td className="xp-text px-3 py-2 text-slate-700">{fmtPct(returnsRate)}</td>
                            <td className="xp-text px-3 py-2 text-slate-700">{r.co2EstKg.toFixed(0)} kg</td>
                          </tr>
                        );
                      })}
                    </tbody>
                  </table>
                </div>
              </div>
            )}
            <div className="xp-text text-slate-500 mt-2">
              Note: km/CO₂ sont des **estimations** basées sur la ville (à affiner quand on aura les points exacts).
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
