"use client";
// build-v2
import React, { useEffect, useMemo, useState } from "react";
import { mockOrders } from "../../types/mockOrders";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useToast } from "../components/ToastProvider";

type Order = {
  No: string;
  Sell_to_City?: string;
  Sell_to_Address?: string;
  Sell_to_Post_Code?: string;
  Sell_to_Country_Region_Code?: string;
  Requested_Delivery_Date?: string;
  PromisedDeliveryHours?: string;
  Assigned_Driver_No?: string;
  volume?: number;
  capacity?: number;
};

type CityTour = {
  city: string;
  driver?: string;
  vehicle?: string;
  selectedOrders: string[]; // list of order Nos in the tour
  locked?: boolean;
  closed?: boolean; // tour validated and closed
  includeReturns?: boolean;
};

type Chauffeur = { No: string; Name: string };
type Truck = { No: string; Description: string; License_Plate?: string };

type Point = { lat: number; lng: number };

type StopPlan = {
  shipmentNo: string;
  city: string;
  dateISO: string;
  seq: number;
  windowStart: string; // HH:MM
  windowEnd: string; // HH:MM
  eta: string; // HH:MM
  driver?: string;
  vehicle?: string;
};

function hashToUnit(input: string): number {
  // Deterministic 0..1 value from string
  let h = 2166136261;
  for (let i = 0; i < input.length; i++) {
    h ^= input.charCodeAt(i);
    h = Math.imul(h, 16777619);
  }
  const u = (h >>> 0) / 4294967295;
  return u;
}

function cityCenter(cityRaw: string): Point {
  const city = (cityRaw || '').trim().toLowerCase();
  
  // Villes suisses (Lausanne région)
  if (city === 'lausanne') return { lat: 46.5197, lng: 6.6323 };
  if (city === 'morges') return { lat: 46.5505, lng: 6.4923 };
  if (city === 'tolochenaz') return { lat: 46.4838, lng: 6.4756 };
  if (city === 'pully') return { lat: 46.5173, lng: 6.6588 };
  if (city === 'prilly') return { lat: 46.5344, lng: 6.6397 };
  if (city === 'renens') return { lat: 46.5458, lng: 6.5958 };
  if (city === 'crissier') return { lat: 46.5386, lng: 6.5697 };
  if (city === 'bussigny') return { lat: 46.5453, lng: 6.5786 };
  if (city === 'ecublens') return { lat: 46.5313, lng: 6.5803 };
  if (city === 'chavannes') return { lat: 46.5292, lng: 6.5686 };
  
  // Villes françaises (conservées pour compatibilité)
  if (city === 'paris') return { lat: 48.8566, lng: 2.3522 };
  if (city === 'lyon') return { lat: 45.7640, lng: 4.8357 };
  if (city === 'marseille') return { lat: 43.2965, lng: 5.3698 };
  if (city === 'toulouse') return { lat: 43.6047, lng: 1.4442 };
  if (city === 'nice') return { lat: 43.7102, lng: 7.2620 };
  if (city === 'bordeaux') return { lat: 44.8378, lng: -0.5792 };
  if (city === 'lille') return { lat: 50.6292, lng: 3.0573 };
  if (city === 'strasbourg') return { lat: 48.5734, lng: 7.7521 };
  if (city === 'nantes') return { lat: 47.2184, lng: -1.5536 };
  
  // Par défaut : centre de la Suisse romande
  return { lat: 46.5197, lng: 6.6323 }; // Lausanne
}

function mockGeo(o: Order): Point {
  const city = (o.Sell_to_City || 'Autres').trim();
  const base = cityCenter(city);
  const seed = `${o.No}|${o.Sell_to_Address || ''}|${o.Sell_to_Post_Code || ''}|${city}`;
  const u1 = hashToUnit(seed);
  const u2 = hashToUnit(seed + '|2');
  // Spread points in a small radius (~0.06 deg)
  const lat = base.lat + (u1 - 0.5) * 0.12;
  const lng = base.lng + (u2 - 0.5) * 0.12;
  return { lat, lng };
}

function dist(a: Point, b: Point): number {
  const dx = a.lat - b.lat;
  const dy = a.lng - b.lng;
  return Math.hypot(dx, dy);
}

function startOfWeekISO(dISO: string): string {
  const [y, m, d] = dISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  const day = dt.getDay(); // 0 Sun ... 6 Sat
  const diff = (day === 0 ? -6 : 1) - day; // move to Monday
  const s = new Date(dt);
  s.setDate(dt.getDate() + diff);
  const yy = s.getFullYear();
  const mm = String(s.getMonth() + 1).padStart(2, '0');
  const dd = String(s.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

function addDaysISO(dISO: string, add: number): string {
  const [y, m, d] = dISO.split('-').map(Number);
  const dt = new Date(y, m - 1, d);
  dt.setDate(dt.getDate() + add);
  const yy = dt.getFullYear();
  const mm = String(dt.getMonth() + 1).padStart(2, '0');
  const dd = String(dt.getDate()).padStart(2, '0');
  return `${yy}-${mm}-${dd}`;
}

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

function hhmmToMinutes(hhmm: string): number {
  const m = String(hhmm || "").match(/^(\d{1,2}):(\d{2})$/);
  if (!m) return 0;
  const h = Math.max(0, Math.min(23, Number(m[1])));
  const mi = Math.max(0, Math.min(59, Number(m[2])));
  return h * 60 + mi;
}

function minutesToHhmm(mins: number): string {
  const m = ((mins % 1440) + 1440) % 1440;
  const h = Math.floor(m / 60);
  const mi = Math.floor(m % 60);
  return `${String(h).padStart(2, "0")}:${String(mi).padStart(2, "0")}`;
}

function buildMockTimeWindow(orderNo: string): { start: string; end: string } {
  // Deterministic time windows for mock mode.
  const u = hashToUnit(orderNo);
  const slot = Math.floor(u * 5); // 0..4
  const baseStart = 8 * 60 + slot * 90; // 08:00, 09:30, 11:00, 12:30, 14:00
  const start = minutesToHhmm(baseStart);
  const end = minutesToHhmm(baseStart + 120);
  return { start, end };
}

function saveStopPlans(plans: StopPlan[]) {
  try {
    const key = "tms_stop_plans_v1";
    const raw = localStorage.getItem(key) || "[]";
    const existing = (JSON.parse(raw) as StopPlan[]) || [];
    const byId = new Map<string, StopPlan>();
    for (const p of Array.isArray(existing) ? existing : []) {
      const id = `${p.dateISO}|${p.city}|${p.shipmentNo}`;
      byId.set(id, p);
    }
    for (const p of plans) {
      const id = `${p.dateISO}|${p.city}|${p.shipmentNo}`;
      byId.set(id, p);
    }
    localStorage.setItem(key, JSON.stringify(Array.from(byId.values())));
  } catch {}
}

export default function RegionsPlanningPage() {
  const router = useRouter();
  const { toast } = useToast();
  const MAX_STOPS_PER_TOUR = 3;
  const [sessionRole, setSessionRole] = useState<string>('');
  const [sessionDriverNo, setSessionDriverNo] = useState<string>('');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [assignments, setAssignments] = useState<Record<string, CityTour>>({});
  const [query, setQuery] = useState('');
  const [cityFilter, setCityFilter] = useState<string>('');
  const [orderDate, setOrderDate] = useState<string>(''); // YYYY-MM-DD
  const [viewMode, setViewMode] = useState<'day' | 'week'>('day');
  const [chauffeurs, setChauffeurs] = useState<Chauffeur[]>([]);
  const [trucks, setTrucks] = useState<Truck[]>([]);

  useEffect(() => {
    setAssignments(loadAssignments());
    try {
      const r = (localStorage.getItem('userRole') || '').trim().toLowerCase();
      const dno = (localStorage.getItem('driverNo') || '').trim();
      setSessionRole(r);
      setSessionDriverNo(dno);
    } catch {}
    if (!orderDate) {
      const t = new Date();
      const y = t.getFullYear();
      const m = String(t.getMonth()+1).padStart(2,'0');
      const d = String(t.getDate()).padStart(2,'0');
      setOrderDate(`${y}-${m}-${d}`);
    }
  }, []);

 

  function exportToursCSV() {
    const rows: string[] = [];
    rows.push(['Date','Ville','Chauffeur','Camion','Commande'].join(','));
    byCity.forEach(([city, list]) => {
      const t = getTour(city);
      const sel = new Set(t.selectedOrders || []);
      const selected = list.filter(o => sel.has(o.No));
      if (selected.length === 0) return;
      selected.forEach(o => {
        const r = [orderDate, city, t.driver || '', t.vehicle || '', o.No].map(v => {
          const s = String(v ?? '');
          return /[",\n]/.test(s) ? '"' + s.replace(/"/g,'""') + '"' : s;
        }).join(',');
        rows.push(r);
      });
    });
    const csv = rows.join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `tournées_${orderDate}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  }

  function printPage() { window.print(); }

  async function copyCityTour(city: string) {
    const t = getTour(city);
    const sel = new Set(t.selectedOrders || []);
    const ordersOfCity = (byCity.find(([c]) => c === city)?.[1] || []).filter(o => sel.has(o.No));
    const lines = [
      `Date: ${orderDate}`,
      `Ville: ${city}`,
      `Chauffeur: ${t.driver || ''}`,
      `Camion: ${t.vehicle || ''}`,
      `Commandes: ${ordersOfCity.map(o=>o.No).join(', ')}`,
    ];
    const text = lines.join('\n');
    try { await navigator.clipboard.writeText(text); } catch {}
  }

  const spreadOrdersAcrossWeek = (date: string, mode: 'day' | 'week') => {
    // Group cities by proximity and create 2 tours per day with max 3 orders each
    const weekStart = startOfWeekISO(date); // Monday
    const cities = [...new Set(mockOrders.map(o => (o.Sell_to_City || '').trim()).filter(Boolean))].sort((a, b) => a.localeCompare(b));
    const days = mode === 'day'
      ? [date]
      : [0, 1, 2, 3, 4, 5, 6].map((d) => addDaysISO(weekStart, d));

    if (cities.length === 0) {
      return mockOrders.map(o => ({ ...o, Requested_Delivery_Date: weekStart })) as Order[];
    }

    // Group cities by proximity (simplified: pair consecutive cities)
    const cityPairs: string[][] = [];
    for (let i = 0; i < cities.length; i += 2) {
      cityPairs.push([cities[i], cities[i + 1]].filter(Boolean));
    }

    // Assign each pair to a specific day (2 tours per day max)
    const dayAssignments: Record<number, string[]> = {};
    if (mode === 'day') {
      // Day mode: 2 tours proches + répétition de Lausanne/Tolochenaz/Morges/etc.
      // Rotation sur une liste de paires “proches”, filtrée selon les villes présentes.
      const base = startOfWeekISO(date);
      const dayIdx = Math.max(0, Math.min(6, Math.floor((Date.parse(date) - Date.parse(base)) / 86400000)));

      const preferredPairs: Array<[string, string]> = [
        ['Lausanne', 'Morges'],
        ['Lausanne', 'Tolochenaz'],
        ['Lausanne', 'Pully'],
        ['Lausanne', 'Prilly'],
        ['Lausanne', 'Renens'],
        ['Morges', 'Tolochenaz'],
        ['Renens', 'Crissier'],
        ['Bussigny', 'Crissier'],
        ['Ecublens', 'Chavannes'],
      ];

      const citySet = new Set(cities);
      const availablePairs = preferredPairs
        .map(([a, b]) => [a, b] as [string, string])
        .filter(([a, b]) => citySet.has(a) && citySet.has(b));

      let picked: string[] = [];
      if (availablePairs.length > 0) {
        const pair = availablePairs[dayIdx % availablePairs.length];
        picked = [pair[0], pair[1]];
      } else {
        // Fallback: take first two cities
        picked = cities.slice(0, 2);
      }

      dayAssignments[0] = picked;
    } else {
      cityPairs.forEach((pair, pairIdx) => {
        const dayIdx = pairIdx % days.length;
        if (!dayAssignments[dayIdx]) dayAssignments[dayIdx] = [];
        dayAssignments[dayIdx].push(...pair);
      });
    }

    // Limit orders per city to max 3 per tour
    const ordersByCity: Record<string, any[]> = {};
    mockOrders.forEach(o => {
      const city = String(o?.Sell_to_City || '').trim();
      if (!city) return;
      if (!ordersByCity[city]) ordersByCity[city] = [];
      ordersByCity[city].push(o);
    });

    // Take max 3 orders per city
    Object.keys(ordersByCity).forEach(city => {
      if (ordersByCity[city].length > 3) {
        ordersByCity[city] = ordersByCity[city].slice(0, 3);
      }
    });

    // Assign dates based on day assignments
    const result: any[] = [];
    Object.entries(dayAssignments).forEach(([dayIdx, cities]) => {
      cities.forEach(city => {
        const cityOrders = ordersByCity[city] || [];
        cityOrders.forEach(order => {
          const idx = parseInt(dayIdx);
          const d = days[idx] || days[0] || weekStart;
          result.push({
            ...order,
            Requested_Delivery_Date: d,
          });
        });
      });
    });

    return result as Order[];
  };

  const loadOrders = async () => {
    setLoading(true); setError(null);
    try {
      setOrders(spreadOrdersAcrossWeek(orderDate, viewMode));
    } catch (e:any) {
      setError(e?.message || "Échec chargement commandes");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { if (orderDate) loadOrders(); }, [orderDate, viewMode]);

  useEffect(() => {
    // Load chauffeurs (BC)
    (async () => {
      try {
        const res = await fetch('/api/chauffeurs', { cache: 'no-store' });
        const data = await res.json();
        const list: any[] = Array.isArray(data?.value) ? data.value : (Array.isArray(data) ? data : []);
        // Mock available chauffeurs
        setChauffeurs(list.map((c: any, i: number) => ({ No: c.No, Name: c.Name + (i % 2 === 0 ? ' (disponible)' : ' (occupé)') })));
      } catch {}
    })();
    // Load trucks from /api/vehicles (fixed list matching BC data)
    (async () => {
      try {
        const res = await fetch('/api/vehicles', { cache: 'no-store' });
        const data = await res.json();
        const list: any[] = Array.isArray(data) ? data : [];
        const truckList: Truck[] = list.map((v: any) => {
          const status = (v.status || '').trim();
          const suffix = status ? ` (${status.toLowerCase()})` : '';
          return {
            No: v.vehicle_id || '',
            Description: (v.service_name || v.vehicle_id || '') + suffix,
            License_Plate: v.plate_number || '',
          };
        });
        setTrucks(truckList);
      } catch {
        setTrucks([]);
      }
    })();
  }, [orderDate]);

  // Normalize incoming date strings to YYYY-MM-DD when possible (supports DD/MM/YYYY and ISO variants)
  function normalizeDateToISO(input?: string | null): string | null {
    if (!input) return null;
    const s = String(input).trim();
    const base = s.includes('T') ? s.split('T')[0] : s;
    if (/^\d{4}-\d{2}-\d{2}$/.test(base)) return base;
    const m = base.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (m) {
      const dd = m[1].padStart(2,'0');
      const mm = m[2].padStart(2,'0');
      const yy = m[3];
      return `${yy}-${mm}-${dd}`;
    }
    const dt = new Date(s);
    if (!isNaN(dt.getTime())) {
      const y = dt.getFullYear();
      const mo = String(dt.getMonth()+1).padStart(2,'0');
      const d = String(dt.getDate()).padStart(2,'0');
      return `${y}-${mo}-${d}`;
    }
    return null;
  }

  const filteredOrders = useMemo(() => {
    const q = query.trim().toLowerCase();
    const hasValidAddress = (o: Order) =>
      (o.Sell_to_City || '').trim().length > 0 &&
      (o.Sell_to_Address || '').trim().length > 0;
    const matchesQuery = (o: Order) =>
      (o.Sell_to_City || '').toLowerCase().includes(q) ||
      (o.No || '').toLowerCase().includes(q) ||
      (o.Sell_to_Post_Code || '').toLowerCase().includes(q);
    const matchesDate = (o: Order) => {
      if (!orderDate) return true;
      const d = normalizeDateToISO(o.Requested_Delivery_Date);
      if (!d) return false;
      if (viewMode === 'day') return d === orderDate;
      // week mode: Monday..Sunday containing orderDate
      const weekStart = startOfWeekISO(orderDate);
      const weekEnd = addDaysISO(weekStart, 6);
      return d && d >= weekStart && d <= weekEnd;
    };
    const matchesCity = (o: Order) => {
      if (!cityFilter) return true;
      return (o.Sell_to_City || '').toLowerCase() === cityFilter.toLowerCase();
    };
    return orders.filter(o => hasValidAddress(o) && (q ? matchesQuery(o) : true) && matchesDate(o) && matchesCity(o));
  }, [orders, query, orderDate, viewMode, cityFilter]);

  const getTour = React.useCallback((city: string): CityTour => {
    const existing = assignments[city];
    if (existing) return existing;
    return { city, selectedOrders: [] };
  }, [assignments]);

  const byCity = useMemo(() => {
    const norm = (s: string) => String(s).trim().toLowerCase().replace(/\s+/g, '');
    const _matchesLoggedDriver = (tourDriver?: string | null): boolean => {
      const role = (sessionRole || '').trim().toLowerCase();
      const isDriver = role === 'driver' || role === 'chauffeur';
      if (!isDriver) return true;
      const driverNo = (sessionDriverNo || '').trim();
      if (!driverNo) return true;
      if (!tourDriver) return false;
      return norm(tourDriver).includes(norm(driverNo));
    };

    const m: Record<string, Order[]> = {};
    filteredOrders.forEach(o => {
      const key = (o.Sell_to_City || "Autres").trim() || "Autres";
      if (!m[key]) m[key] = [];
      m[key].push(o);
    });

    let entries = Object.entries(m).sort((a, b) => a[0].localeCompare(b[0]));

    entries = entries.filter(([city]) => {
      const t = assignments[city];
      const driver = t ? t.driver : undefined;
      return _matchesLoggedDriver(driver);
    });

    if (viewMode === 'day') {
      entries = entries.slice(0, 2);
    }

    return entries;
  }, [filteredOrders, viewMode, assignments, sessionRole, sessionDriverNo]);

  const availableDriversByCity = useMemo(() => {
    const result: Record<string, typeof chauffeurs> = {};
    
    // Get all assigned drivers with their count
    const assignedDriverCounts = new Map<string, number>();
    Object.entries(assignments).forEach(([city, tour]) => {
      if (tour.driver && tour.driver.trim()) {
        const driverLabel = tour.driver.trim();
        const currentCount = assignedDriverCounts.get(driverLabel) || 0;
        assignedDriverCounts.set(driverLabel, currentCount + 1);
      }
    });

    // For each city, calculate available drivers
    byCity.forEach(([city]) => {
      const currentDriver = assignments[city]?.driver?.trim();
      
      result[city] = chauffeurs.filter(ch => {
        const label = `${ch.Name} (${ch.No})`;
        const currentCount = assignedDriverCounts.get(label) || 0;
        const isCurrentDriver = label === currentDriver;

        // Allow if driver has less than 2 assignments OR is the current driver for this city
        return currentCount < 2 || isCurrentDriver;
      });
    });

    return result;
  }, [assignments, chauffeurs, byCity]);

  // Auto-select all orders per city — tours are ready directly
  useEffect(() => {
    setAssignments(prev => {
      const next = { ...prev };
      byCity.forEach(([city, list]) => {
        const existing = next[city];
        if (!existing || !existing.selectedOrders || existing.selectedOrders.length === 0) {
          // Sélectionner automatiquement toutes les commandes par défaut
          next[city] = { 
            city, 
            selectedOrders: list.map(o => o.No).slice(0, MAX_STOPS_PER_TOUR) 
          };
        }
      });
      saveAssignments(next);
      return next;
    });
  }, [byCity.length]); // Utiliser byCity.length au lieu de byCity pour éviter la boucle

  // Helper function to check if vehicle is in maintenance
  const isVehicleInMaintenance = (vehicleLabel: string): boolean => {
    const vehicle = trucks.find(tr => {
      const label = `${tr.No} - ${tr.Description || tr.No}${tr.License_Plate ? ' - ' + tr.License_Plate : ''}`;
      return label === vehicleLabel;
    });
    return vehicle?.Description?.toLowerCase().includes('maintenance') || false;
  };

  // Available vehicles by city (similar to availableDriversByCity)
  const availableVehiclesByCity = useMemo(() => {
    const result: Record<string, typeof trucks> = {};
    
    // Get all assigned vehicles with their count
    const assignedVehicleCounts = new Map<string, number>();
    Object.entries(assignments).forEach(([city, tour]) => {
      if (tour.vehicle && tour.vehicle.trim()) {
        const vehicleLabel = tour.vehicle.trim();
        const currentCount = assignedVehicleCounts.get(vehicleLabel) || 0;
        assignedVehicleCounts.set(vehicleLabel, currentCount + 1);
      }
    });

    // For each city, calculate available vehicles
    byCity.forEach(([city]) => {
      const currentVehicle = assignments[city]?.vehicle?.trim();
      
      result[city] = trucks.filter(tr => {
        const label = `${tr.No} - ${tr.Description || tr.No}${tr.License_Plate ? ' - ' + tr.License_Plate : ''}`;
        const currentCount = assignedVehicleCounts.get(label) || 0;
        const isCurrentVehicle = label === currentVehicle;
        const isInMaintenance = isVehicleInMaintenance(label);

        // Allow if vehicle has less than 1 assignment OR is the current vehicle for this city
        // But exclude vehicles in maintenance unless they are already assigned
        return (currentCount < 1 || isCurrentVehicle) && (!isInMaintenance || isCurrentVehicle);
      });
    });

    return result;
  }, [assignments, trucks, byCity]);

  const validation = useMemo(() => {
    const missingDriver: string[] = [];
    const missingVehicle: string[] = [];
    const emptySelection: string[] = [];
    const driverUse: Record<string, string[]> = {};
    let readyCount = 0;
    byCity.forEach(([city, list]) => {
      const t = getTour(city);
      const selectedCount = (t.selectedOrders || []).filter(no => list.some(o=>o.No===no)).length;
      const hasDriver = !!(t.driver && t.driver.trim());
      const hasVehicle = !!(t.vehicle && t.vehicle.trim());
      if (selectedCount === 0) emptySelection.push(city);
      if (!hasDriver && selectedCount > 0) missingDriver.push(city);
      if (!hasVehicle && selectedCount > 0) missingVehicle.push(city);
      if (hasDriver && selectedCount > 0) {
        const key = t.driver!.trim();
        driverUse[key] = driverUse[key] || [];
        driverUse[key].push(city);
      }
      if (selectedCount > 0 && hasDriver && hasVehicle) readyCount++;
    });
    const duplicateDrivers: Array<{driver:string; cities:string[]}> = Object.entries(driverUse)
      .filter(([, cities]) => cities.length > 1)
      .map(([driver, cities]) => ({ driver, cities }));
    return { missingDriver, missingVehicle, emptySelection, duplicateDrivers, readyCount };
  }, [byCity, assignments]);

 

  const validateTour = async (city: string, list: Order[]) => {
    const t = getTour(city);
    
    // Validation simplifiée et plus robuste
    const hasDriver = t.driver && t.driver.trim() !== "" && t.driver !== "Sélectionner chauffeur…";
    const hasVehicle = t.vehicle && t.vehicle.trim() !== "" && t.vehicle !== "Sélectionner camion…";
    
    console.log('Validation:', {
      city,
      totalOrdersInList: list.length,
      driver: t.driver,
      vehicle: t.vehicle,
      hasDriver,
      hasVehicle
    });
    
    if (!hasDriver) {
      toast.warning('Veuillez affecter un chauffeur');
      return;
    }
    
    if (!hasVehicle) {
      toast.warning('Veuillez affecter un camion');
      return;
    }

    if (list.length === 0) {
      toast.warning('Aucune commande disponible pour cette tournée');
      return;
    }

    // Check if vehicle is in maintenance
    if (t.vehicle && isVehicleInMaintenance(t.vehicle)) {
      toast.error('Impossible de valider : ce camion est en maintenance. Veuillez sélectionner un autre camion.');
      return;
    }

    // Ensure a tour does not contain multiple orders for the same client
    try {
      const dup: Record<string, string[]> = {};
      for (const o of selectedOrders) {
        const clientName = String((o as any)?.Sell_to_Customer_Name || '').trim();
        if (!clientName) continue;
        if (!dup[clientName]) dup[clientName] = [];
        dup[clientName].push(String(o.No || '').trim());
      }
      const duplicates = Object.entries(dup).filter(([, nos]) => nos.length > 1);
      if (duplicates.length > 0) {
        const msg = duplicates
          .map(([c, nos]) => `${c}: ${nos.join(', ')}`)
          .slice(0, 5)
          .join(' | ');
        toast.error(`Client en double dans la tournée. Une tournée ne peut pas contenir 2 commandes du même client. (${msg})`);
        return;
      }
    } catch {
      // if something goes wrong, do not block validation
    }

    // Auto-planning (mock): compute ETA sequentially based on selected order.
    // We persist per-shipment schedule in localStorage for /suivi-tournees and /scanner.
    try {
      const dateISO = normalizeDateToISO(orderDate) || orderDate || new Date().toISOString().slice(0, 10);
      const startMin = 8 * 60; // 08:00
      const travelMin = 15;
      const serviceMin = 20;
      let cursor = startMin;
      const plans: StopPlan[] = [];
      for (let i = 0; i < (t.selectedOrders || []).length; i++) {
        const no = t.selectedOrders[i];
        const tw = buildMockTimeWindow(no);
        if (i === 0) cursor = Math.max(cursor, hhmmToMinutes(tw.start));
        else cursor += travelMin;
        const eta = minutesToHhmm(cursor);
        plans.push({
          shipmentNo: no,
          city,
          dateISO,
          seq: i + 1,
          windowStart: tw.start,
          windowEnd: tw.end,
          eta,
          driver: t.driver,
          vehicle: t.vehicle,
        });
        cursor += serviceMin;
      }
      saveStopPlans(plans);
    } catch {
    }

    setAssignments(prev => {
      const next = { ...prev };
      next[city] = { ...getTour(city), closed: true };
      saveAssignments(next);
      return next;
    });

    // Auto-set all selected orders to "en_cours" in suivi-tournees statuses
    try {
      const statusKey = 'regions_planning_status_v1';
      const rawSt = localStorage.getItem(statusKey) || '{}';
      const allStatuses: Record<string, Record<string, string>> = JSON.parse(rawSt);
      if (!allStatuses[city]) allStatuses[city] = {};
      selectedOrders.forEach((o) => {
        allStatuses[city][o.No] = 'en_cours';
      });
      localStorage.setItem(statusKey, JSON.stringify(allStatuses));
    } catch {
    }

    try {
      const key = 'whse_shipment_status_v1';
      const raw = localStorage.getItem(key) || '{}';
      const statusBy: Record<string, string> = JSON.parse(raw);
      selectedOrders.forEach((o) => {
        statusBy[o.No] = 'Validated';
      });
      localStorage.setItem(key, JSON.stringify(statusBy));
    } catch {
    }

    await Promise.all(
      selectedOrders.map((o) =>
        fetch('/api/whseShipments/status', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ shipmentNo: o.No, newStatus: 'Validated' }),
          cache: 'no-store',
        }).catch(() => null)
      )
    );

    const params = new URLSearchParams();
    if (orderDate) params.set('date', orderDate);
    if (viewMode) params.set('view', viewMode);
    if (city) params.set('city', city);
    router.push(`/suivi-tournees?${params.toString()}`);
  };

  const optimizeCityTour = (city: string, list: Order[]) => {
    setAssignments(prev => {
      const next = { ...prev };
      const t = getTour(city);
      const selectedSet = new Set(t.selectedOrders || []);
      const selectedOrders = list.filter(o => selectedSet.has(o.No));
      if (selectedOrders.length < 2) return prev;

      const remaining = selectedOrders.map((o) => ({ no: o.No, p: mockGeo(o) }));
      const start = cityCenter(city);
      const ordered: string[] = [];
      let curr = start;

      while (remaining.length > 0) {
        let bestIdx = 0;
        let bestD = Infinity;
        for (let i = 0; i < remaining.length; i++) {
          const d = dist(curr, remaining[i].p);
          if (d < bestD) {
            bestD = d;
            bestIdx = i;
          }
        }
        const picked = remaining.splice(bestIdx, 1)[0];
        ordered.push(picked.no);
        curr = picked.p;
      }

      next[city] = { ...t, selectedOrders: ordered };
      saveAssignments(next);
      return next;
    });
  };

  const toggleOrder = (city: string, orderNo: string) => {
    setAssignments(prev => {
      const next = { ...prev };
      const t = getTour(city);
      const has = t.selectedOrders.includes(orderNo);
      if (!has && (t.selectedOrders?.length || 0) >= MAX_STOPS_PER_TOUR) {
        alert(`Une tournée ne peut pas dépasser ${MAX_STOPS_PER_TOUR} expéditions.`);
        return prev;
      }
      const updated: CityTour = { ...t, selectedOrders: has ? t.selectedOrders.filter(n=> n!==orderNo) : [...t.selectedOrders, orderNo] };
      next[city] = updated;
      saveAssignments(next);
      return next;
    });
  };

  const setDriver = (city: string, driver: string) => {
    console.log('setDriver:', city, '->', driver);
    
    if (driver && driver.trim() && driver !== "Sélectionner chauffeur…") {
      const alreadyAssignedCount = Object.entries(assignments).filter(([c, t]) => 
        c !== city && t.driver && t.driver.trim() === driver.trim()
      ).length;
      
      if (alreadyAssignedCount >= 2) {
        alert(`Ce chauffeur est déjà assigné à ${alreadyAssignedCount} autres tournées aujourd'hui (maximum autorisé : 2)`);
        return;
      }
    }
    
    setAssignments(prev => { 
      const next = { ...prev, [city]: { ...getTour(city), driver } }; 
      saveAssignments(next); 
      return next; 
    });
  };

  const setVehicle = (city: string, vehicle: string) => {
    console.log('setVehicle:', city, '->', vehicle);
    setAssignments(prev => { 
      const next = { ...prev, [city]: { ...getTour(city), vehicle } }; 
      saveAssignments(next); 
      return next; 
    });
  };

  const setIncludeReturns = (city: string, includeReturns: boolean) => {
    setAssignments(prev => {
      const next = { ...prev, [city]: { ...getTour(city), includeReturns } };
      saveAssignments(next);
      return next;
    });
  };

  const selectAllCity = (city: string, list: Order[]) => {
    setAssignments(prev => {
      const next = { ...prev };
      next[city] = { ...getTour(city), selectedOrders: list.map(o => o.No).slice(0, MAX_STOPS_PER_TOUR) };
      saveAssignments(next);
      return next;
    });
  };

  const selectNoneCity = (city: string) => {
    setAssignments(prev => {
      const next = { ...prev };
      next[city] = { ...getTour(city), selectedOrders: [] };
      saveAssignments(next);
      return next;
    });
  };

  const toggleOrderSelection = (city: string, orderNo: string, isSelected: boolean) => {
    setAssignments(prev => {
      const next = { ...prev };
      const tour = getTour(city);
      const selectedOrders = [...(tour.selectedOrders || [])];
      
      if (isSelected) {
        if (!selectedOrders.includes(orderNo)) {
          selectedOrders.push(orderNo);
        }
      } else {
        const index = selectedOrders.indexOf(orderNo);
        if (index > -1) {
          selectedOrders.splice(index, 1);
        }
      }
      
      next[city] = { ...tour, selectedOrders };
      saveAssignments(next);
      return next;
    });
  };

  const clearCity = (city: string) => {
    setAssignments(prev => {
      const next = { ...prev };
      next[city] = { ...getTour(city), selectedOrders: [] };
      saveAssignments(next);
      return next;
    });
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="container mx-auto p-3 md:p-6 max-w-7xl">
      {/* Header / Controls */}
      <div className="flex flex-col gap-4 mb-6 md:flex-row md:items-center md:justify-between">
        <div>
          <h1 className="text-3xl font-extrabold bg-clip-text text-transparent bg-gradient-to-r from-sky-600 to-indigo-600 tracking-tight">Tournées</h1>
          <p className="mt-1 text-sm text-slate-600">Regroupez par ville, sélectionnez les commandes de la tournée, assignez chauffeur et camion.</p>
        </div>

        <div className="flex flex-wrap gap-2">
          <select
            value={cityFilter}
            onChange={e => setCityFilter(e.target.value)}
            className="px-3 py-2 border rounded-lg shadow-sm bg-white/80 backdrop-blur focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          >
            <option value="">Toutes les villes</option>
            {[...new Set(orders.map(o => o.Sell_to_City).filter(Boolean))].sort().map(city => (
              <option key={city} value={city!}>{city}</option>
            ))}
          </select>
          <input
            type="date"
            value={orderDate}
            onChange={(e)=> setOrderDate(e.target.value)}
            className="px-3 py-2 border rounded-lg shadow-sm bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
          <div className="flex rounded-lg overflow-hidden ring-1 ring-slate-200">
            <button onClick={()=> setViewMode('day')} className={`px-3 py-2 text-sm transition-colors ${viewMode==='day' ? 'bg-sky-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>Jour</button>
            <button onClick={()=> setViewMode('week')} className={`px-3 py-2 text-sm transition-colors ${viewMode==='week' ? 'bg-sky-600 text-white' : 'bg-white text-slate-700 hover:bg-slate-50'}`}>Semaine</button>
          </div>
          <input
            value={query}
            onChange={(e)=> setQuery(e.target.value)}
            placeholder="Rechercher (ville, N° commande, CP)"
            className="px-3 py-2 border rounded-lg w-full md:w-64 shadow-sm bg-white/80 backdrop-blur supports-[backdrop-filter]:bg-white/60 focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
          />
          <button onClick={loadOrders} className="px-3 py-2 rounded-lg bg-gradient-to-r from-sky-600 to-indigo-600 text-white shadow hover:from-sky-500 hover:to-indigo-500 active:scale-[.99] disabled:opacity-60" disabled={loading}>{loading? 'Chargement…' : 'Recharger'}</button>
          <button onClick={exportToursCSV} className="px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Exporter CSV</button>
          <Link href={`/suivi-tournees?date=${orderDate}&view=${viewMode}`} className="px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">Suivre</Link>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 mb-6">
        <div className="bg-white/70 backdrop-blur border rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500">Villes</div>
          <div className="text-2xl font-bold text-slate-900">{byCity.length}</div>
        </div>
        <div className="bg-white/70 backdrop-blur border rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500">{viewMode === 'day' ? 'Commandes du jour' : 'Commandes de la semaine'}</div>
          <div className="text-2xl font-bold text-slate-900">{filteredOrders.length}</div>
        </div>
        <div className="bg-white/70 backdrop-blur border rounded-xl p-4 shadow-sm">
          <div className="text-xs text-slate-500">Tournées prêtes</div>
          <div className="text-2xl font-bold text-slate-900">{validation.readyCount}</div>
        </div>
      </div>

      {/* Validation */}
      <div className="mb-6 space-y-2">
        <div className="flex flex-wrap items-center gap-2 text-sm">
          <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-white/70 border text-slate-800">
            <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
            Prêtes: {validation.readyCount}
          </span>
          {validation.missingDriver.length > 0 && (
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500"></span>
              Chauffeur manquant: {validation.missingDriver.length}
            </span>
          )}
          {validation.missingVehicle.length > 0 && (
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-amber-50 border border-amber-200 text-amber-800">
              <span className="inline-block h-2 w-2 rounded-full bg-amber-500"></span>
              Camion manquant: {validation.missingVehicle.length}
            </span>
          )}
          {validation.duplicateDrivers.length > 0 && (
            <span className="inline-flex items-center gap-2 px-3 py-2 rounded-lg bg-rose-50 border border-rose-200 text-rose-800">
              <span className="inline-block h-2 w-2 rounded-full bg-rose-500"></span>
              Chauffeurs en double: {validation.duplicateDrivers.length}
            </span>
          )}
        </div>
        {validation.duplicateDrivers.length > 0 && (
          <div className="text-xs text-rose-700">
            {validation.duplicateDrivers.map(d => (
              <div key={d.driver}>Chauffeur {d.driver}: {d.cities.join(', ')}</div>
            ))}
          </div>
        )}
      </div>

      {/* City Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5">
        {byCity.map(([city, list]) => {
          const tour = getTour(city);
          const isClosed = !!tour.closed;
          return (
            <div key={city} className={`group bg-white/80 backdrop-blur rounded-2xl border border-slate-200 shadow-sm p-4 hover:shadow-md transition-all duration-200 ring-1 ring-transparent hover:ring-sky-100 ${isClosed ? 'opacity-70' : ''}`}>
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-2">
                <div className="flex flex-wrap items-center gap-1.5">
                  <div className="text-sm font-semibold text-slate-900">{city}</div>
                  <span className="text-xs px-2 py-0.5 rounded-full border bg-slate-50 text-slate-700">{list.length} cmd</span>
                  {(tour.driver && tour.vehicle) && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-emerald-50 text-emerald-700">Prêt</span>
                  )}
                  {isClosed && (
                    <span className="text-[10px] px-2 py-0.5 rounded-full border bg-rose-50 text-rose-700 ml-2">Tournée validée</span>
                  )}
                </div>
                <div className="flex flex-wrap items-center gap-1">
                  {!isClosed && (
                    <button
                      onClick={()=> validateTour(city, list)}
                      className={`text-xs px-2 py-1 border rounded-lg hover:bg-sky-50 transition-colors bg-sky-600 text-white`}
                      disabled={isClosed || !(tour.driver && tour.vehicle)}
                    >Valider tournée</button>
                  )}
                  {isClosed && (
                    <button
                      onClick={() => {
                        setAssignments(prev => {
                          const next = { ...prev };
                          next[city] = { ...getTour(city), closed: false };
                          saveAssignments(next);
                          return next;
                        });
                      }}
                      className="text-xs px-2 py-1 border rounded-lg bg-rose-100 text-rose-700 hover:bg-rose-200 transition-colors ml-2"
                    >Réouvrir tournée</button>
                  )}
                </div>
              </div>
              {/* Progress */}
              <div className="mb-3">
                <div className="h-1.5 w-full rounded bg-slate-100 overflow-hidden">
                  <div className="h-full bg-gradient-to-r from-sky-500 to-indigo-500" style={{ width: '100%' }} />
                </div>
                <div className="mt-1 text-[10px] text-slate-500">100% des commandes affectées</div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-3">
                {/* Chauffeur dropdown: only show chauffeurs not already assigned to other tours */}
                <select
                  className="px-2 py-2 border rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  value={tour.driver || ''}
                  onChange={(e)=> setDriver(city, e.target.value)}
                >
                  <option value="">Sélectionner chauffeur…</option>
                  {(availableDriversByCity[city] || chauffeurs).map(ch => (
                    <option key={ch.No} value={ch.Name + ' (' + ch.No + ')'}>
                      {ch.Name} ({ch.No})
                    </option>
                  ))}
                </select>
                <select
                  className="px-2 py-2 border rounded-lg bg-white shadow-sm focus:outline-none focus:ring-2 focus:ring-sky-500 focus:border-sky-500"
                  value={tour.vehicle || ''}
                  onChange={(e)=> setVehicle(city, e.target.value)}
                >
                  <option value="">Sélectionner camion…</option>
                  {(availableVehiclesByCity[city] || trucks).map(tr => {
                    const label = `${tr.No} - ${tr.Description || tr.No}${tr.License_Plate ? ' - ' + tr.License_Plate : ''}`;
                    const isInMaintenance = isVehicleInMaintenance(label);
                    const isAssigned = Object.entries(assignments).some(([c, t]) => c !== city && t.vehicle === label);
                    
                    return (
                      <option 
                        key={tr.No} 
                        value={label}
                        disabled={isInMaintenance && !isAssigned}
                        style={{ 
                          color: isInMaintenance ? '#ef4444' : isAssigned ? '#6b7280' : '#000000',
                          fontStyle: isInMaintenance ? 'italic' : 'normal'
                        }}
                      >
                        {label}{isInMaintenance ? ' (En maintenance)' : isAssigned ? ' (Déjà assigné)' : ''}
                      </option>
                    );
                  })}
                </select>
              </div>

              <div className="flex items-center justify-between mb-3">
                <label className="text-xs text-slate-700 flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={tour.includeReturns !== false}
                    onChange={(e) => setIncludeReturns(city, e.target.checked)}
                    disabled={isClosed}
                  />
                  Inclure retours
                </label>
                <span className="text-[10px] text-slate-500">Obligatoire à la clôture si activé</span>
              </div>

              <div className="text-xs text-slate-600 mb-1">Commandes de la tournée:</div>
              <div className="border rounded-xl divide-y max-h-64 overflow-auto bg-white/60">
                {list.map((o, idx) => (
                  <div key={o.No + '-' + idx} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
                    <span className="inline-block h-2 w-2 rounded-full bg-emerald-500"></span>
                    <span className="text-slate-800 font-medium text-emerald-700">{o.No}</span>
                    <span className="text-slate-500 ml-auto text-xs">{o.Sell_to_Post_Code || ''} {o.Sell_to_City || ''}</span>
                    <span className="text-xs text-slate-500">Vol: {o.volume ?? '-'} m³</span>
                    <span className="text-xs text-slate-500">Cap: {o.capacity ?? '-'} kg</span>
                  </div>
                ))}
                {list.length === 0 && (
                  <div className="px-3 py-4 text-sm text-slate-500">Aucune commande</div>
                )}
              </div>
              <div className="mt-2 text-xs text-slate-600">
                {list.length} commande(s) automatiquement incluses<br />
                {(() => {
                  const totalVolume = list.reduce((sum, o) => sum + (o.volume ?? 0), 0);
                  const totalCapacity = list.reduce((sum, o) => sum + (o.capacity ?? 0), 0);
                  const duration = list.length > 0 ? (list.length * 45) : 0;
                  return (
                    <>
                      <span className="mr-2">Total Vol: {totalVolume} m³</span>
                      <span className="mr-2">Total Cap: {totalCapacity} kg</span>
                      <span className="mr-2">Durée estimée: {duration} min</span>
                    </>
                  );
                })()}
              </div>
            </div>
          );
        })}
      </div>

      <div className="mt-6 p-4 rounded-xl bg-gradient-to-r from-sky-50 to-indigo-50 text-sky-900 border border-sky-100 text-sm shadow-sm">
        - Regroupement par ville automatique. Les commandes sont réparties automatiquement. Saisissez un Chauffeur et un Camion par ville, puis validez la tournée.
        <br /> 
      </div>
      </div>
    </div>
  );
}
