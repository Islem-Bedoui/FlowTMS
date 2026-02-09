"use client";
import React, { useEffect, useMemo, useState } from "react";
import { mockOrders } from "../../types/mockOrders";
import dynamic from "next/dynamic";
const MapTours = dynamic(() => import("./MapTours"), { ssr: false });
import { useSearchParams, useRouter } from "next/navigation";

// Types aligned with existing app
// ...existing types...
type Order = {
  No: string;
  Sell_to_City?: string;
  Sell_to_Post_Code?: string;
  Requested_Delivery_Date?: string;
};

type CityTour = {
  city: string;
  driver?: string;
  vehicle?: string;
  selectedOrders: string[];
  closed?: boolean;
  includeReturns?: boolean;
  execClosed?: boolean;
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

type StopPlan = {
  shipmentNo: string;
  city: string;
  dateISO: string;
  seq: number;
  windowStart: string;
  windowEnd: string;
  eta: string;
  driver?: string;
  vehicle?: string;
};

type OrderStatus = "non_demarre" | "en_cours" | "livre";
type StatusMap = Record<string /*orderNo*/, OrderStatus>;
type CityStatus = Record<string /*city*/, StatusMap>;

function loadAssignments(): Record<string, CityTour> {
  try {
    const raw = localStorage.getItem("regions_planning_assignments_v1") || "{}";
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

function saveAssignments(data: Record<string, CityTour>) {
  try {
    localStorage.setItem("regions_planning_assignments_v1", JSON.stringify(data));
  } catch {}
}

function loadStatuses(): CityStatus {
  try {
    const raw = localStorage.getItem("regions_planning_status_v1") || "{}";
    return JSON.parse(raw);
  } catch {
    return {} as CityStatus;
  }
}

function saveStatuses(data: CityStatus) {
  try {
    localStorage.setItem("regions_planning_status_v1", JSON.stringify(data));
  } catch {}
}

function hhmmToMinutes(hhmm: string): number {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  const h = Math.max(0, Math.min(23, Number(m[1])));
  const mi = Math.max(0, Math.min(59, Number(m[2])));
  return h * 60 + mi;
}

function loadStopPlans(): StopPlan[] {
  try {
    const raw = localStorage.getItem("tms_stop_plans_v1") || "[]";
    const arr = JSON.parse(raw) as StopPlan[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

function normalizeDateToISO(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  const base = s.includes("T") ? s.split("T")[0] : s;
  if (/^\d{4}-\d{2}-\d{2}$/.test(base)) return base;
  const m = base.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const dd = m[1].padStart(2, "0");
    const mm = m[2].padStart(2, "0");
    const yy = m[3];
    return `${yy}-${mm}-${dd}`;
  }
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const mo = String(dt.getMonth() + 1).padStart(2, "0");
    const d = String(dt.getDate()).padStart(2, "0");
    return `${y}-${mo}-${d}`;
  }
  return null;
}

export default function SuiviTourneesComponent() {
  // ...existing logic from page...
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [assignments, setAssignments] = useState<Record<string, CityTour>>({});
  const [statuses, setStatuses] = useState<CityStatus>({});
  const [stopPlans, setStopPlans] = useState<StopPlan[]>([]);
  const [pods, setPods] = useState<PodRecord[]>([]);
  const [returns, setReturns] = useState<ReturnsRecord[]>([]);
  const [proofLoading, setProofLoading] = useState<boolean>(false);
  const [orderDate, setOrderDate] = useState<string>("");
  const [viewMode, setViewMode] = useState<"day" | "week">("day");
  const [openMaps, setOpenMaps] = useState<Record<string, boolean>>({});
  const searchParams = useSearchParams();
  const router = useRouter();
  const cityParam = (searchParams.get("city") || "").trim();
  const [sessionRole, setSessionRole] = useState<string>('');
  const [sessionDriverNo, setSessionDriverNo] = useState<string>('');

  useEffect(() => {
    setAssignments(loadAssignments());
    setStatuses(loadStatuses());
    try {
      const r = (localStorage.getItem('userRole') || '').trim().toLowerCase();
      const dno = (localStorage.getItem('driverNo') || '').trim();
      setSessionRole(r);
      setSessionDriverNo(dno);
    } catch {}
  }, []);

  function matchesLoggedDriver(tourDriver?: string | null): boolean {
    const role = (sessionRole || '').trim().toLowerCase();
    const isDriver = role === 'driver' || role === 'chauffeur';
    if (!isDriver) return true;
    const driverNo = (sessionDriverNo || '').trim();
    if (!driverNo) return true;
    if (!tourDriver) return false;
    const norm = (s: string) => String(s).trim().toLowerCase().replace(/\s+/g, '');
    return norm(tourDriver).includes(norm(driverNo));
  }

  useEffect(() => {
    setStopPlans(loadStopPlans());
    const dateFromUrl = searchParams?.get("date");
    const viewFromUrl = (searchParams?.get("view") as "day" | "week") || undefined;
    if (dateFromUrl) setOrderDate(dateFromUrl);
    if (viewFromUrl) setViewMode(viewFromUrl);
    if (!dateFromUrl && !orderDate) {
      const t = new Date();
      const y = t.getFullYear();
      const m = String(t.getMonth() + 1).padStart(2, "0");
      const d = String(t.getDate()).padStart(2, "0");
      setOrderDate(`${y}-${m}-${d}`);
    }
  }, [searchParams]);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setProofLoading(true);
      try {
        const [podRes, retRes] = await Promise.all([
          fetch('/api/pod', { cache: 'no-store' }),
          fetch('/api/returns', { cache: 'no-store' }),
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
        if (!cancelled) setProofLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const loadOrders = async () => {
    setLoading(true);
    try {
      setOrders(
        mockOrders.map((o: any) => ({
          No: o.No,
          Sell_to_City: o.Sell_to_City || "",
          Sell_to_Post_Code: o.Sell_to_Post_Code || "",
          Requested_Delivery_Date: o.Requested_Delivery_Date || o.requestedDeliveryDate || undefined,
        })) as Order[]
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadOrders();
  }, []);

  const stopPlanByNo = useMemo(() => {
    const m = new Map<string, StopPlan>();
    const dateISO = normalizeDateToISO(orderDate);
    for (const p of stopPlans || []) {
      const no = String(p?.shipmentNo || "").trim();
      if (!no) continue;
      if (dateISO && String(p?.dateISO || "").slice(0, 10) !== dateISO) continue;
      const existing = m.get(no);
      if (!existing || (p.seq || 0) < (existing.seq || 0)) m.set(no, p);
    }
    return m;
  }, [stopPlans, orderDate]);

  const podSet = useMemo(() => {
    const s = new Set<string>();
    for (const r of pods || []) {
      const k = String(r?.shipmentNo || '').trim();
      if (k) s.add(k);
    }
    return s;
  }, [pods]);

  const returnsSet = useMemo(() => {
    const s = new Set<string>();
    for (const r of returns || []) {
      const k = String(r?.shipmentNo || '').trim();
      if (k) s.add(k);
    }
    return s;
  }, [returns]);

  const closeExecutionTour = (city: string) => {
    const tour = assignments[city];
    if (!tour) return;
    const selectedNos = new Set(tour.selectedOrders || []);
    const cityOrders = orders.filter(o => (o.Sell_to_City || "Autres").trim() === city && selectedNos.has(o.No));
    const st = statuses[city] || {};
    const includeRet = tour.includeReturns !== false;

    // Check all orders are "livré"
    const notDelivered = cityOrders.filter(o => st[o.No] !== 'livre');
    if (notDelivered.length > 0) {
      alert(`Impossible de clôturer : ${notDelivered.length} commande(s) non livrée(s) (${notDelivered.map(o => o.No).join(', ')})`);
      return;
    }

    // Check all orders have POD signature
    const missingPod = cityOrders.filter(o => !podSet.has(o.No));
    if (missingPod.length > 0) {
      alert(`Impossible de clôturer : signature POD manquante pour ${missingPod.length} commande(s) (${missingPod.map(o => o.No).join(', ')})`);
      return;
    }

    // Check returns if required
    if (includeRet) {
      const missingRet = cityOrders.filter(o => !returnsSet.has(o.No));
      if (missingRet.length > 0) {
        alert(`Impossible de clôturer : retours manquants pour ${missingRet.length} commande(s) (${missingRet.map(o => o.No).join(', ')})`);
        return;
      }
    }

    setAssignments((prev) => {
      const next = { ...prev };
      const t = next[city];
      if (!t) return prev;
      next[city] = { ...t, execClosed: true };
      saveAssignments(next);
      return next;
    });
  };

  // Show all orders for validated tours, ignore date filter
  const filteredOrders = useMemo(() => orders, [orders]);

  const byCity = useMemo(() => {
    const m: Record<string, Order[]> = {};
    filteredOrders.forEach((o) => {
      const key = (o.Sell_to_City || "Autres").trim() || "Autres";
      if (!m[key]) m[key] = [];
      m[key].push(o);
    });
    let entries = Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));
    // Only show validated tours
    entries = entries.filter(([city]) => assignments[city]?.closed === true);
    // Driver/chauffeur: only show tours assigned to the logged driverNo
    entries = entries.filter(([city]) => matchesLoggedDriver(assignments[city]?.driver));
    if (cityParam) {
      const tour = assignments[cityParam];
      if (tour && tour.selectedOrders && m[cityParam]) {
        const selectedSet = new Set(tour.selectedOrders);
        entries = entries.filter(([city]) => city === cityParam)
          .map(([city, orders]) => [city, orders.filter(o => selectedSet.has(o.No))]);
      } else {
        entries = entries.filter(([city]) => city === cityParam);
      }
    }
    return entries;
  }, [filteredOrders, cityParam, assignments, sessionRole, sessionDriverNo]);

  const startSignatureFlow = (city: string, orderNo: string) => {
    const params = new URLSearchParams();
    if (orderDate) params.set('date', orderDate);
    if (viewMode) params.set('view', viewMode);
    if (city) params.set('city', city);
    const backUrl = `/suivi-tournees?${params.toString()}`;

    const to = new URLSearchParams();
    to.set('shipmentNo', orderNo);
    to.set('next', backUrl);
    router.push(`/pod-signature?${to.toString()}`);
  };

  function orderStatusToWhseKanbanStatus(st: OrderStatus): string {
    if (st === 'en_cours') return 'InProgress';
    if (st === 'livre') return 'Delivered';
    return 'Planned';
  }

  const setStatus = (city: string, orderNo: string, st: OrderStatus) => {
    setStatuses((prev) => {
      const next: CityStatus = { ...prev, [city]: { ...(prev[city] || {}) } };
      next[city][orderNo] = st;
      saveStatuses(next);
      return next;
    });

    try {
      const shipmentNo = `WHS-${String(orderNo || '').trim()}`;
      const newStatus = orderStatusToWhseKanbanStatus(st);
      fetch('/api/whseShipments/status', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ shipmentNo, newStatus }),
        cache: 'no-store',
      }).catch(() => null);
    } catch {
    }
  };

  // Dashboard and render logic
  const globalRecap = useMemo(() => {
    let total = 0;
    let delivered = 0;
    let inProgress = 0;
    byCity.forEach(([city, list]) => {
      const sel = new Set(assignments[city]?.selectedOrders || []);
      const inTour = list.filter(o => sel.has(o.No));
      const st = statuses[city] || {};
      total += inTour.length;
      delivered += inTour.filter(o => st[o.No] === 'livre').length;
      inProgress += inTour.filter(o => st[o.No] === 'en_cours').length;
    });
    const percent = total === 0 ? 0 : Math.round((delivered / total) * 100);
    return { total, delivered, inProgress, percent };
  }, [byCity, assignments, statuses]);

  const cityPercents = useMemo(() => {
    return byCity.map(([city, list]) => {
      const sel = new Set(assignments[city]?.selectedOrders || []);
      const inTour = list.filter(o => sel.has(o.No));
      const st = statuses[city] || {};
      const total = inTour.length;
      const delivered = inTour.filter(o => st[o.No] === 'livre').length;
      const percent = total === 0 ? 0 : Math.round((delivered / total) * 100);
      return { city, percent, total };
    }).sort((a,b)=> b.percent - a.percent);
  }, [byCity, assignments, statuses]);

  const globalDistribution = useMemo(() => {
    let non = 0, en = 0, liv = 0;
    byCity.forEach(([city, list]) => {
      const sel = new Set(assignments[city]?.selectedOrders || []);
      const inTour = list.filter(o => sel.has(o.No));
      const st = statuses[city] || {};
      inTour.forEach(o => {
        const v = st[o.No] || 'non_demarre';
        if (v === 'livre') liv++; else if (v === 'en_cours') en++; else non++;
      });
    });
    const total = non + en + liv;
    return { non, en, liv, total };
  }, [byCity, assignments, statuses]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="container mx-auto p-3 md:p-6 max-w-7xl">
        <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
          <div>
            <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-indigo-600 tracking-tight">Suivi des Tournées</h1>
            <p className="mt-1 text-sm text-slate-600">Suivez l'avancement des commandes par tournée, avec pourcentage de livraison.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <input
              type="date"
              value={orderDate}
              onChange={(e) => setOrderDate(e.target.value)}
              className="px-3 py-2 border rounded-lg shadow-sm bg-white/80 backdrop-blur focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
            <div className="flex rounded-lg overflow-hidden ring-1 ring-slate-200">
              <button onClick={() => setViewMode("day")} className={`px-3 py-2 text-sm transition-colors ${viewMode === "day" ? "bg-sky-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>Jour</button>
              <button onClick={() => setViewMode("week")} className={`px-3 py-2 text-sm transition-colors ${viewMode === "week" ? "bg-sky-600 text-white" : "bg-white text-slate-700 hover:bg-slate-50"}`}>Semaine</button>
            </div>
            <button onClick={loadOrders} className="px-3 py-2 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow hover:from-sky-500 hover:to-indigo-500">Recharger</button>
          </div>
        </div>

        {/* Global Recap */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-8">
          <div className="bg-white/70 backdrop-blur border rounded-xl p-4 shadow-sm flex items-center gap-4">
            <div className="shrink-0 relative h-16 w-16 rounded-full" style={{
              background: `conic-gradient(#10b981 ${globalRecap.percent}%, #e5e7eb 0)`
            }}>
              <div className="absolute inset-1 rounded-full bg-white/80 flex items-center justify-center">
                <div className="text-sm font-bold text-slate-900">{globalRecap.percent}%</div>
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-500">% Global livré</div>
              <div className="text-2xl font-bold text-slate-900">{globalRecap.delivered} / {globalRecap.total}</div>
            </div>
          </div>
          <div className="bg-white/70 backdrop-blur border rounded-xl p-4 shadow-sm">
            <div className="text-xs text-slate-500">Livrées</div>
            <div className="text-2xl font-bold text-slate-900">{globalRecap.delivered}</div>
            <div className="mt-1 text-[11px] text-slate-500">En cours: {globalRecap.inProgress}</div>
          </div>
          <div className="bg-white/70 backdrop-blur border rounded-xl p-4 shadow-sm">
            <div className="text-xs text-slate-500">Total commandes (toutes villes)</div>
            <div className="text-2xl font-bold text-slate-900">{globalRecap.total}</div>
          </div>
        </div>

        {/* Map is now hidden by default, shown per tour */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
          {byCity.map(([city, list]) => {
            const tour = assignments[city];
            const selectedNos = new Set(tour?.selectedOrders || []);
            const inTour = list.filter((o) => selectedNos.has(o.No));
            const total = inTour.length;
            const st = statuses[city] || {};
            const delivered = inTour.filter((o) => st[o.No] === "livre").length;
            const inProgress = inTour.filter((o) => st[o.No] === "en_cours").length;
            const percent = total === 0 ? 0 : Math.round((delivered / total) * 100);
            const includeReturns = tour?.includeReturns !== false;
            const missingPOD = inTour.filter((o) => st[o.No] === 'livre' && !podSet.has(o.No)).length;
            const missingReturns = includeReturns
              ? inTour.filter((o) => st[o.No] === 'livre' && !returnsSet.has(o.No)).length
              : 0;
            const allOk = inTour.every((o) => {
              if (st[o.No] !== 'livre') return false;
              if (!podSet.has(o.No)) return false;
              if (includeReturns && !returnsSet.has(o.No)) return false;
              return true;
            });
            const execClosed = !!tour?.execClosed;
            const showMap = openMaps[city] || false;
            const driverRaw = (tour?.driver || '').trim();
            const driverIsOccupied = /occup[ée]/i.test(driverRaw);
            const driverClean = driverRaw.replace(/\s*\(\s*occup[ée]\s*\)\s*/gi, ' ').replace(/\s+/g, ' ').trim();
            return (
              <div key={city} className={`group bg-white/80 backdrop-blur rounded-2xl border shadow-sm p-4 hover:shadow-md transition-all duration-200 ${execClosed ? 'border-emerald-300 opacity-80' : 'border-slate-200'}`}>
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-3">
                    <div className="relative h-14 w-14 rounded-full shrink-0" style={{
                      background: `conic-gradient(#10b981 ${percent}%, #e5e7eb 0)`
                    }}>
                      <div className="absolute inset-1 rounded-full bg-white/90 flex items-center justify-center">
                        <div className="text-xs font-bold text-slate-900">{percent}%</div>
                      </div>
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="text-sm font-semibold text-slate-900">{city}</span>
                        {execClosed ? (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-emerald-600 text-white font-medium">Clôturée</span>
                        ) : (
                          <span className="text-[10px] px-2 py-0.5 rounded-full bg-sky-600 text-white font-medium">En cours</span>
                        )}
                      </div>
                      <div className="text-[11px] text-slate-500">Livré: {delivered} • En cours: {inProgress} • Total: {total}</div>
                      <div className="mt-2 grid gap-1">
                        {!!driverRaw && (
                          <div className="grid grid-cols-[70px,1fr,auto] items-center gap-2">
                            <span className="text-[11px] text-slate-500">Chauffeur</span>
                            <span className="text-xs font-medium text-sky-800 truncate">{driverClean}</span>
                            {driverIsOccupied ? (
                              <span className="text-[10px] px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 border-rose-200 whitespace-nowrap">Occupé</span>
                            ) : (
                              <span />
                            )}
                          </div>
                        )}
                        {!!tour?.vehicle && (
                          <div className="grid grid-cols-[70px,1fr] items-center gap-2">
                            <span className="text-[11px] text-slate-500">Camion</span>
                            <span className="text-xs font-medium text-indigo-800 truncate">{tour.vehicle}</span>
                          </div>
                        )}
                      </div>

                      <div className="mt-2 flex flex-wrap gap-2">
                        <span className={`text-[11px] px-2 py-0.5 rounded border ${includeReturns ? 'bg-amber-50 text-amber-800 border-amber-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}>
                          Retours: {includeReturns ? 'Obligatoires' : 'Optionnels'}
                        </span>
                        {missingPOD > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded border bg-rose-50 text-rose-700 border-rose-200">
                            POD manquant: {missingPOD}
                          </span>
                        )}
                        {includeReturns && missingReturns > 0 && (
                          <span className="text-[11px] px-2 py-0.5 rounded border bg-rose-50 text-rose-700 border-rose-200">
                            Retours manquants: {missingReturns}
                          </span>
                        )}
                        {execClosed && (
                          <span className="text-[11px] px-2 py-0.5 rounded border bg-emerald-50 text-emerald-700 border-emerald-200 font-medium">
                            ✓ Tournée clôturée
                          </span>
                        )}
                        {proofLoading && (
                          <span className="text-[11px] px-2 py-0.5 rounded border bg-slate-50 text-slate-600 border-slate-200">
                            Vérification POD/retours…
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700">{total} cmd</span>
                </div>

                <div className="flex flex-wrap items-center gap-2 mb-3">
                  <button
                    onClick={() => setOpenMaps((prev) => ({ ...prev, [city]: !(prev[city] || false) }))}
                    className="px-3 py-1.5 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50 text-xs"
                    disabled={total === 0}
                    title={total === 0 ? 'Aucune commande dans la tournée' : 'Afficher la carte de la tournée'}
                  >
                    {showMap ? 'Masquer carte' : 'Carte'}
                  </button>

                  {!execClosed && (
                    <button
                      onClick={() => closeExecutionTour(city)}
                      className={`px-3 py-1.5 rounded-lg text-xs ring-1 ${allOk ? 'bg-indigo-600 text-white ring-indigo-600 hover:bg-indigo-500' : 'bg-slate-100 text-slate-400 ring-slate-200 cursor-not-allowed'}`}
                      title={allOk ? 'Clôturer la tournée' : 'Impossible: livraisons/POD/signatures manquants'}
                    >
                      Clôturer la tournée
                    </button>
                  )}
                </div>

                {total > 0 && (
                  <div className={showMap ? '' : 'hidden'}>
                    <MapTours
                      tour={{
                        city,
                        driver: tour?.driver,
                        vehicle: tour?.vehicle,
                        orders: inTour.map((o) => ({
                          No: o.No,
                          Sell_to_City: o.Sell_to_City || city,
                          Sell_to_Post_Code: o.Sell_to_Post_Code || '',
                        })),
                      }}
                    />
                  </div>
                )}

                <div className="mb-4">
                  <div className="h-2.5 w-full rounded bg-slate-100 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-sky-500 to-emerald-500" style={{ width: `${percent}%` }} />
                  </div>
                </div>
                <div className="border rounded-xl divide-y max-h-64 overflow-auto bg-white/60">
                  {inTour.map((o) => {
                    const value = st[o.No] || "non_demarre";
                    const plan = stopPlanByNo.get(o.No);
                    const isLate = !!plan && hhmmToMinutes(plan.eta) > hhmmToMinutes(plan.windowEnd);
                    const podOk = podSet.has(o.No);
                    const returnsOk = returnsSet.has(o.No);
                    const requireReturns = includeReturns;
                    return (
                      <div key={o.No} className="grid grid-cols-1 gap-2 px-3 py-2 text-sm md:grid-cols-[1fr,auto] md:items-center">
                        <div className="min-w-0">
                          <div className="flex items-center gap-2 min-w-0">
                            <span className="text-slate-800 font-medium shrink-0">{o.No}</span>
                            <span className="text-slate-500 truncate">{o.Sell_to_Post_Code || ""} {o.Sell_to_City || ""}</span>
                          </div>

                          <div className="mt-1 flex flex-wrap items-center gap-2">
                            {plan && (
                              <span
                                className={`text-[11px] px-2 py-1 rounded border ${isLate ? 'bg-rose-50 text-rose-700 border-rose-200' : 'bg-slate-50 text-slate-700 border-slate-200'}`}
                                title={isLate ? 'ETA hors créneau' : 'ETA dans le créneau'}
                              >
                                #{plan.seq} • ETA {plan.eta} • {plan.windowStart}-{plan.windowEnd}
                              </span>
                            )}
                            <span className={`text-xs px-2 py-1 rounded ${value === "livre" ? "bg-emerald-100 text-emerald-700" : value === "en_cours" ? "bg-amber-100 text-amber-700" : "bg-slate-100 text-slate-700"}`}>{value === "livre" ? "Livré" : value === "en_cours" ? "En cours" : "Non démarré"}</span>
                            {value === 'livre' && !podOk && (
                              <span className="text-[11px] px-2 py-1 rounded border bg-rose-50 text-rose-700 border-rose-200" title="Signature POD manquante">
                                POD manquant
                              </span>
                            )}
                            {value === 'livre' && requireReturns && !returnsOk && (
                              <span className="text-[11px] px-2 py-1 rounded border bg-rose-50 text-rose-700 border-rose-200" title="Retours non saisis">
                                Retours manquants
                              </span>
                            )}
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2 md:justify-end">
                          <select
                            value={value}
                            onChange={(e) => setStatus(city, o.No, e.target.value as any)}
                            className="px-2 py-1 text-[11px] rounded border bg-white hover:bg-slate-50"
                            title="Changer le statut"
                          >
                            <option value="non_demarre">Non démarré</option>
                            <option value="en_cours">En cours</option>
                            <option value="livre">Livré</option>
                          </select>

                          <button
                            onClick={() => startSignatureFlow(city, o.No)}
                            disabled={value !== 'livre'}
                            className={`px-2 py-1 text-[11px] rounded border ${value === 'livre' ? 'bg-sky-600 text-white border-sky-600 hover:bg-sky-500' : 'bg-slate-100 text-slate-400 border-slate-200 cursor-not-allowed'}`}
                            title={value === 'livre' ? 'Passer à la signature puis aux retours' : 'Disponible après Livré'}
                          >Signature</button>
                        </div>
                      </div>
                    );
                  })}
                  {inTour.length === 0 && (
                    <div className="px-3 py-4 text-sm text-slate-500">Aucune commande sélectionnée pour cette tournée.</div>
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Mini Dashboard */}
        <div className="mt-8 grid grid-cols-1 lg:grid-cols-2 gap-5">
          {/* Per-city bar chart */}
          <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="mb-3 flex items-center justify-between">
              <div className="text-sm font-semibold text-slate-900">Progression par ville (%)</div>
              <div className="text-xs text-slate-500">Trié par % décroissant</div>
            </div>
            <div className="space-y-2 max-h-80 overflow-auto pr-1">
              {cityPercents.map(({city, percent, total}) => (
                <div key={city} className="">
                  <div className="flex items-center justify-between text-xs mb-1">
                    <span className="text-slate-700 truncate mr-2">{city}</span>
                    <span className="text-slate-500">{percent}% ({total})</span>
                  </div>
                  <div className="h-2.5 w-full rounded bg-slate-100 overflow-hidden">
                    <div className="h-full bg-gradient-to-r from-sky-500 to-emerald-500" style={{ width: `${percent}%` }} />
                  </div>
                </div>
              ))}
              {cityPercents.length === 0 && (
                <div className="text-sm text-slate-500">Aucune tournée sélectionnée.</div>
              )}
            </div>
          </div>

          {/* Global distribution donut */}
          <div className="bg-white/80 backdrop-blur rounded-2xl border border-slate-200 shadow-sm p-4">
            <div className="mb-3 text-sm font-semibold text-slate-900">Répartition globale des statuts</div>
            <div className="flex flex-col sm:flex-row items-center gap-6">
              <div className="relative h-28 w-28 sm:h-36 sm:w-36 shrink-0">
                {(() => {
                  const total = Math.max(1, globalDistribution.total);
                  const pctLiv = (globalDistribution.liv/total)*100;
                  const pctEn = (globalDistribution.en/total)*100;
                  const pctNon = 100 - pctLiv - pctEn;
                  const grad = `conic-gradient(#10b981 0 ${pctLiv}%, #f59e0b ${pctLiv}% ${pctLiv+pctEn}%, #94a3b8 ${pctLiv+pctEn}% 100%)`;
                  return (
                    <div className="h-28 w-28 sm:h-36 sm:w-36 rounded-full" style={{ background: grad }}>
                      <div className="absolute inset-4 sm:inset-5 rounded-full bg-white/90 flex items-center justify-center">
                        <div className="text-base sm:text-lg font-bold text-slate-900">{globalRecap.percent}%</div>
                      </div>
                    </div>
                  );
                })()}
              </div>
              <div className="text-xs space-y-2">
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-emerald-500" /> Livré: {globalDistribution.liv}</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-amber-500" /> En cours: {globalDistribution.en}</div>
                <div className="flex items-center gap-2"><span className="h-2 w-2 rounded-full bg-slate-400" /> Non démarré: {globalDistribution.non}</div>
                <div className="pt-2 text-slate-500">Total: {globalDistribution.total}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
