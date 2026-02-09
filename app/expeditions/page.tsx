"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { mockOrders } from "../../types/mockOrders";

type Order = {
  No: string;
  Sell_to_City?: string;
  Sell_to_Address?: string;
  Sell_to_Post_Code?: string;
  Sell_to_Country_Region_Code?: string;
  Requested_Delivery_Date?: string;
  volume?: number;
  capacity?: number;
};

type CityTour = {
  city: string;
  driver?: string;
  vehicle?: string;
  selectedOrders: string[];
  closed?: boolean;
};

type OrderStatus = "non_demarre" | "en_cours" | "livre";
type StatusMap = Record<string, OrderStatus>;
type CityStatus = Record<string, StatusMap>;

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
  return loadJson<Record<string, CityTour>>("regions_planning_assignments_v1", {});
}

function pickStatuses(): CityStatus {
  return loadJson<CityStatus>("regions_planning_status_v1", {} as CityStatus);
}

export default function ExpeditionsPage() {
  const [assignments, setAssignments] = useState<Record<string, CityTour>>({});
  const [statuses, setStatuses] = useState<CityStatus>({});
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [filterCity, setFilterCity] = useState("");
  const [filterStatus, setFilterStatus] = useState("");
  const [page, setPage] = useState(0);
  const [pageSize, setPageSize] = useState(5);

  useEffect(() => {
    setAssignments(pickAssignments());
    setStatuses(pickStatuses());

    // Fetch orders from API + merge mockOrders
    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/salesOrders", { cache: "no-store" });
        const data = await res.json();
        const apiRaw: Order[] = Array.isArray(data?.value) ? data.value : (Array.isArray(data) ? data : []);
        // Only keep API orders with a valid address (city + address must be non-empty)
        const apiOrders = apiRaw.filter(o =>
          (o.Sell_to_City || "").trim().length > 0 &&
          (o.Sell_to_Address || "").trim().length > 0
        );
        // Merge: mockOrders first (they have volume/capacity), then valid API orders
        const seen = new Set<string>();
        const merged: Order[] = [];
        for (const o of [...(mockOrders as Order[]), ...apiOrders]) {
          const no = (o.No || "").trim();
          if (!no || seen.has(no)) continue;
          seen.add(no);
          // Ensure volume/capacity have values
          merged.push({ ...o, volume: o.volume ?? 10, capacity: o.capacity ?? 6000 });
        }
        setOrders(merged);
      } catch {
        // Fallback to mockOrders only
        setOrders(mockOrders as Order[]);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const cities = useMemo(() => {
    const s = new Set<string>();
    for (const o of orders) s.add((o.Sell_to_City || "Autres").trim());
    return Array.from(s).sort();
  }, [orders]);

  const filtered = useMemo(() => {
    let list = [...orders];

    if (search.trim()) {
      const q = search.trim().toLowerCase();
      list = list.filter(
        (o: Order) =>
          (o.No || "").toLowerCase().includes(q) ||
          (o.Sell_to_City || "").toLowerCase().includes(q) ||
          (o.Sell_to_Address || "").toLowerCase().includes(q) ||
          (o.Sell_to_Post_Code || "").toLowerCase().includes(q)
      );
    }

    if (filterCity) {
      list = list.filter((o) => (o.Sell_to_City || "Autres").trim() === filterCity);
    }

    if (filterStatus) {
      list = list.filter((o) => {
        const city = (o.Sell_to_City || "Autres").trim();
        const tour = assignments[city];
        const isInTour = !!(tour && (tour.selectedOrders || []).includes(o.No));
        if (filterStatus === "non_assignee") return !isInTour;
        if (filterStatus === "validee") return isInTour && !!tour?.closed;
        if (filterStatus === "en_preparation") return isInTour && !tour?.closed;
        const st = statuses[city]?.[o.No];
        if (filterStatus === "livre") return st === "livre";
        if (filterStatus === "en_cours") return st === "en_cours";
        if (filterStatus === "non_demarre") return isInTour && (!st || st === "non_demarre");
        return true;
      });
    }

    return list;
  }, [orders, search, filterCity, filterStatus, assignments, statuses]);

  // Reset page when filters change
  React.useEffect(() => { setPage(0); }, [search, filterCity, filterStatus, pageSize]);

  const totalPages = Math.max(1, Math.ceil(filtered.length / pageSize));
  const paginated = useMemo(() => filtered.slice(page * pageSize, (page + 1) * pageSize), [filtered, page, pageSize]);

  const summary = useMemo(() => {
    let assigned = 0;
    let validated = 0;
    let delivered = 0;
    let inProgress = 0;
    for (const o of orders) {
      const city = (o.Sell_to_City || "Autres").trim();
      const tour = assignments[city];
      const isInTour = !!(tour && (tour.selectedOrders || []).includes(o.No));
      if (isInTour) {
        assigned++;
        if (tour?.closed) validated++;
        const st = statuses[city]?.[o.No];
        if (st === "livre") delivered++;
        else if (st === "en_cours") inProgress++;
      }
    }
    return { total: orders.length, assigned, validated, delivered, inProgress, notAssigned: orders.length - assigned };
  }, [orders, assignments, statuses]);

  const totalVol = useMemo(() => filtered.reduce((s, o) => s + (o.volume || 0), 0), [filtered]);
  const totalCap = useMemo(() => filtered.reduce((s, o) => s + (o.capacity || 0), 0), [filtered]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="container mx-auto p-3 md:p-6 max-w-7xl space-y-6">

        {/* Header */}
        <div className="relative overflow-hidden rounded-2xl p-6 md:p-8" style={{ background: "linear-gradient(135deg, #4f58a5 0%, #406fb5 40%, #49a2da 100%)" }}>
          <div className="absolute inset-0 opacity-10" style={{ backgroundImage: "radial-gradient(circle at 20% 50%, white 1px, transparent 1px), radial-gradient(circle at 80% 20%, white 1px, transparent 1px)", backgroundSize: "40px 40px" }} />
          <div className="relative flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div>
              <h1 className="text-2xl md:text-3xl font-extrabold text-white tracking-tight">Expéditions</h1>
              <p className="mt-1 text-sm text-white/80">Liste complète des commandes &bull; {orders.length} expéditions</p>
            </div>
            <div className="flex items-center gap-2">
              <Link
                href="/dashboard"
                className="shrink-0 px-4 py-2 rounded-xl bg-white/20 backdrop-blur text-white text-sm font-medium ring-1 ring-white/30 hover:bg-white/30 transition"
              >
                Tableau de bord
              </Link>
              <button
                type="button"
                onClick={() => { setAssignments(pickAssignments()); setStatuses(pickStatuses()); }}
                className="shrink-0 px-4 py-2 rounded-xl bg-white/20 backdrop-blur text-white text-sm font-medium ring-1 ring-white/30 hover:bg-white/30 transition"
              >
                Rafraîchir
              </button>
            </div>
          </div>
        </div>

        {loading && <div className="text-sm text-slate-500 text-center py-2">Chargement des expéditions…</div>}

        {/* Summary pills */}
        <div className="grid grid-cols-3 sm:grid-cols-6 gap-3">
          <div className="rounded-xl bg-white shadow-sm border border-slate-100 p-3 text-center">
            <div className="text-xl font-extrabold" style={{ color: "var(--logo-1)" }}>{summary.total}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Total</div>
          </div>
          <div className="rounded-xl bg-white shadow-sm border border-slate-100 p-3 text-center">
            <div className="text-xl font-extrabold text-sky-600">{summary.assigned}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Assignées</div>
          </div>
          <div className="rounded-xl bg-white shadow-sm border border-slate-100 p-3 text-center">
            <div className="text-xl font-extrabold text-emerald-600">{summary.validated}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Validées</div>
          </div>
          <div className="rounded-xl bg-white shadow-sm border border-slate-100 p-3 text-center">
            <div className="text-xl font-extrabold text-violet-600">{summary.inProgress}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">En cours</div>
          </div>
          <div className="rounded-xl bg-white shadow-sm border border-slate-100 p-3 text-center">
            <div className="text-xl font-extrabold text-emerald-600">{summary.delivered}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Livrées</div>
          </div>
          <div className="rounded-xl bg-white shadow-sm border border-slate-100 p-3 text-center">
            <div className="text-xl font-extrabold text-slate-400">{summary.notAssigned}</div>
            <div className="text-[10px] font-semibold text-slate-500 uppercase tracking-wider">Non assignées</div>
          </div>
        </div>

        {/* Filters */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 p-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <input
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Rechercher (N°, ville, adresse, CP)…"
              className="flex-1 px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
            />
            <select
              value={filterCity}
              onChange={(e) => setFilterCity(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Toutes les villes</option>
              {cities.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="px-3 py-2 text-sm border border-slate-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-sky-500"
            >
              <option value="">Tous les statuts</option>
              <option value="non_assignee">Non assignée</option>
              <option value="en_preparation">En préparation</option>
              <option value="validee">Validée</option>
              <option value="en_cours">En cours</option>
              <option value="livre">Livré</option>
              <option value="non_demarre">Non démarré</option>
            </select>
          </div>
        </div>

        {/* Table */}
        <div className="rounded-2xl bg-white shadow-sm border border-slate-100 overflow-hidden">
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-[11px] uppercase tracking-wider text-slate-500" style={{ background: "linear-gradient(135deg, #f8fafc, #f1f5f9)" }}>
                  <th className="px-4 py-3 font-semibold">N° Commande</th>
                  <th className="px-4 py-3 font-semibold">Ville</th>
                  <th className="px-4 py-3 font-semibold">Adresse</th>
                  <th className="px-4 py-3 font-semibold">Date livraison</th>
                  <th className="px-4 py-3 font-semibold text-right">Vol. (m³)</th>
                  <th className="px-4 py-3 font-semibold text-right">Cap. (kg)</th>
                  <th className="px-4 py-3 font-semibold">Tournée</th>
                  <th className="px-4 py-3 font-semibold">Statut</th>
                </tr>
              </thead>
              <tbody>
                {paginated.map((o, i) => {
                  const city = (o.Sell_to_City || "Autres").trim();
                  const tour = assignments[city];
                  const isInTour = !!(tour && (tour.selectedOrders || []).includes(o.No));
                  const isValidated = isInTour && !!tour?.closed;
                  const st = statuses[city]?.[o.No];
                  const statusLabel = st === "livre" ? "Livré" : st === "en_cours" ? "En cours" : "Non démarré";
                  const statusColor = st === "livre" ? "bg-emerald-100 text-emerald-700" : st === "en_cours" ? "bg-sky-100 text-sky-700" : "bg-slate-100 text-slate-500";
                  return (
                    <tr key={o.No} className={`border-t border-slate-100 hover:bg-sky-50/30 transition ${i % 2 === 0 ? "bg-white" : "bg-slate-50/50"}`}>
                      <td className="px-4 py-3 font-semibold text-xs" style={{ color: "var(--logo-1)" }}>{o.No}</td>
                      <td className="px-4 py-3 text-xs text-slate-700 font-medium">{city}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 max-w-[220px]">
                        <div className="truncate">{o.Sell_to_Address}</div>
                        <div className="text-[10px] text-slate-400">{o.Sell_to_Post_Code} {o.Sell_to_Country_Region_Code}</div>
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-600">{o.Requested_Delivery_Date}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 text-right font-medium">{o.volume ?? '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-600 text-right font-medium">{o.capacity ? o.capacity.toLocaleString() : '—'}</td>
                      <td className="px-4 py-3">
                        {isInTour ? (
                          <div>
                            <span className="text-xs font-medium text-slate-800">{city}</span>
                            {tour?.driver && <div className="text-[10px] text-slate-400">{tour.driver}</div>}
                            {tour?.vehicle && <div className="text-[10px] text-slate-400">{tour.vehicle}</div>}
                          </div>
                        ) : (
                          <span className="text-[11px] text-slate-400 italic">Non assignée</span>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {isInTour ? (
                          <span className={`inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold ${isValidated ? "bg-emerald-100 text-emerald-700" : statusColor}`}>
                            {isValidated && st !== "livre" && st !== "en_cours" ? "Validée" : statusLabel}
                          </span>
                        ) : (
                          <span className="inline-block px-2.5 py-1 rounded-full text-[10px] font-semibold bg-slate-50 text-slate-400">Non assignée</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
                {filtered.length === 0 && (
                  <tr>
                    <td colSpan={8} className="px-4 py-8 text-center text-sm text-slate-400">Aucune expédition trouvée</td>
                  </tr>
                )}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-slate-200" style={{ background: "linear-gradient(135deg, #f8fafc, #f1f5f9)" }}>
                  <td className="px-4 py-3 text-xs font-bold text-slate-700" colSpan={4}>{filtered.length} expédition(s)</td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-700 text-right">{totalVol} m³</td>
                  <td className="px-4 py-3 text-xs font-bold text-slate-700 text-right">{totalCap.toLocaleString()} kg</td>
                  <td className="px-4 py-3" colSpan={2} />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Pagination */}
          <div className="flex flex-col sm:flex-row items-center justify-between gap-3 px-4 py-3 border-t border-slate-100">
            <div className="flex items-center gap-2 text-xs text-slate-500">
              <span>Afficher</span>
              <select
                value={pageSize}
                onChange={(e) => setPageSize(Number(e.target.value))}
                className="px-2 py-1 border border-slate-200 rounded-lg bg-white text-xs focus:outline-none focus:ring-2 focus:ring-sky-500"
              >
                <option value={5}>5</option>
                <option value={10}>10</option>
              </select>
              <span>par page</span>
            </div>
            <div className="flex items-center gap-1">
              <button
                onClick={() => setPage(0)}
                disabled={page === 0}
                className="px-2 py-1 rounded-lg text-xs border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                &laquo;
              </button>
              <button
                onClick={() => setPage(p => Math.max(0, p - 1))}
                disabled={page === 0}
                className="px-2.5 py-1 rounded-lg text-xs border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                &lsaquo;
              </button>
              <span className="px-3 py-1 text-xs font-medium text-slate-700">
                {page + 1} / {totalPages}
              </span>
              <button
                onClick={() => setPage(p => Math.min(totalPages - 1, p + 1))}
                disabled={page >= totalPages - 1}
                className="px-2.5 py-1 rounded-lg text-xs border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                &rsaquo;
              </button>
              <button
                onClick={() => setPage(totalPages - 1)}
                disabled={page >= totalPages - 1}
                className="px-2 py-1 rounded-lg text-xs border border-slate-200 bg-white hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed"
              >
                &raquo;
              </button>
            </div>
          </div>
        </div>

      </div>
    </div>
  );
}
