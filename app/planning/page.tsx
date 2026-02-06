"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { mockOrders } from "../../types/mockOrders";

// Types
type Mission = {
  id: string;
  kind?: "delivery" | "return";
  orderNo?: string;
  address: string;
  windowStart?: string; // ISO datetime or HH:mm
  windowEnd?: string;   // ISO datetime or HH:mm
  volume?: number;
  weight?: number;
  serviceMin?: number; // service time in minutes
};

type Vehicle = {
  id: string;
  name: string;
  capVolume?: number;
  capWeight?: number;
  startTime?: string; // HH:mm
  maxStops?: number;
};

type GeoPoint = { lon: number; lat: number };

type Driver = { No: string; Name: string };

type PlannedStop = {
  mission: Mission;
  arrival: string; // time string
  distanceKmFromPrev: number;
};

type RoutePlan = {
  vehicle: Vehicle;
  stops: PlannedStop[];
  totalDistanceKm: number;
};

type AlgoMode = 'demo_greedy_nn_2opt' | 'current_feasible';

// Simple Haversine distance
function haversine(p1: GeoPoint, p2: GeoPoint) {
  const toRad = (d: number) => (d * Math.PI) / 180;
  const R = 6371; // km
  const dLat = toRad(p2.lat - p1.lat);
  const dLon = toRad(p2.lon - p1.lon);
  const lat1 = toRad(p1.lat);
  const lat2 = toRad(p2.lat);
  const a = Math.sin(dLat / 2) ** 2 + Math.cos(lat1) * Math.cos(lat2) * Math.sin(dLon / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return R * c;
}

// Parse HH:mm to minutes
function parseHM(h?: string) {
  if (!h) return 0;
  const [H, M] = h.split(":").map((x) => parseInt(x || "0", 10));
  return (H || 0) * 60 + (M || 0);
}

function fmtHM(m: number) {
  m = Math.max(0, Math.round(m));
  const H = Math.floor(m / 60)
    .toString()
    .padStart(2, "0");
  const M = (m % 60).toString().padStart(2, "0");
  return `${H}:${M}`;
}

// === Demo Algorithms (moved to module scope) ===
function assignGreedyCapacity(depot: GeoPoint, missions: Array<Mission & { point: GeoPoint }>, vehicles: Vehicle[]) {
  const assignments: Record<string, Array<Mission & { point: GeoPoint }>> = {};
  vehicles.forEach(v => { assignments[v.id] = []; });
  const remaining = new Set(missions.map(m => m.id));
  for (const v of vehicles) {
    let usedVol = 0, usedW = 0;
    // pick missions nearest to depot until capacity reached
    const sorted = [...missions].sort((a,b)=> haversine(depot,a.point) - haversine(depot,b.point));
    for (const m of sorted) {
      if (!remaining.has(m.id)) continue;
      const nextVol = usedVol + (m.volume || 0);
      const nextW = usedW + (m.weight || 0);
      if ((v.capVolume && nextVol > (v.capVolume||0)) || (v.capWeight && nextW > (v.capWeight||0))) continue;
      assignments[v.id].push(m);
      remaining.delete(m.id);
      usedVol = nextVol; usedW = nextW;
      if ((v.maxStops || 0) > 0 && assignments[v.id].length >= (v.maxStops || 0)) break;
    }
  }
  return { assignments, unassigned: remaining };
}

function sequenceNearestNeighbor(start: GeoPoint, list: Array<Mission & { point: GeoPoint }>) {
  const order: typeof list = [];
  const remaining = new Set(list.map(m => m.id));
  let curr = start;
  while (remaining.size > 0) {
    let best: (Mission & { point: GeoPoint }) | null = null;
    let bestDist = Infinity;
    for (const m of list) {
      if (!remaining.has(m.id)) continue;
      const d = haversine(curr, m.point);
      if (d < bestDist) { bestDist = d; best = m; }
    }
    if (!best) break;
    order.push(best);
    remaining.delete(best.id);
    curr = best.point;
  }
  return order;
}

function twoOpt(points: Array<Mission & { point: GeoPoint }>, start: GeoPoint, maxIter = 200) {
  // simple 2-opt without depot return
  const route = [...points];
  const distFrom = (a: GeoPoint, b: GeoPoint) => haversine(a,b);
  const length = () => {
    let total = distFrom(start, route[0]?.point || start);
    for (let i=0;i<route.length-1;i++) total += distFrom(route[i].point, route[i+1].point);
    return total;
  };
  let improved = true; let iter = 0; let bestLen = length();
  while (improved && iter++ < maxIter) {
    improved = false;
    for (let i=0; i<route.length-2; i++) {
      for (let k=i+1; k<route.length-1; k++) {
        const before = bestLen;
        const aPrev = i===0 ? start : route[i-1].point;
        const a = route[i].point;
        const b = route[k].point;
        const bNext = route[k+1].point;
        const delta = (distFrom(aPrev,a) + distFrom(b,bNext)) - (distFrom(aPrev,b) + distFrom(a,bNext));
        if (delta > 0.0001) {
          const newRoute = [...route];
          const segment = newRoute.slice(i, k+1).reverse();
          newRoute.splice(i, k+1 - i, ...segment);
          route.splice(0, route.length, ...newRoute);
          bestLen = length();
          improved = true;
        }
      }
    }
  }
  return route;
}

// Normalize incoming date strings to YYYY-MM-DD when possible (supports DD/MM/YYYY and ISO variants)
function normalizeDateToISO(input?: string | null): string | null {
  if (!input) return null;
  const s = String(input).trim();
  // If includes time, take date part before 'T'
  const base = s.includes('T') ? s.split('T')[0] : s;
  // Already looks like YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(base)) return base;
  // Handle DD/MM/YYYY or D/M/YYYY
  const m = base.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (m) {
    const d = m[1].padStart(2,'0');
    const mo = m[2].padStart(2,'0');
    const y = m[3];
    return `${y}-${mo}-${d}`;
  }
  // Fallback: try Date parse and format
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) {
    const y = dt.getFullYear();
    const mo = String(dt.getMonth()+1).padStart(2,'0');
    const d = String(dt.getDate()).padStart(2,'0');
    return `${y}-${mo}-${d}`;
  }
  return null;
}

export default function PlanningPage() {
  const [depotAddress, setDepotAddress] = useState<string>("Lyon, France");
  const [missions, setMissions] = useState<Mission[]>([]);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [routes, setRoutes] = useState<RoutePlan[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [driverNo, setDriverNo] = useState<string>("");
  const [orderDate, setOrderDate] = useState<string>("" ); // YYYY-MM-DD
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [driversLoading, setDriversLoading] = useState<boolean>(false);
  const [truckLoading, setTruckLoading] = useState<boolean>(false);
  const [truckError, setTruckError] = useState<string | null>(null);
  const [algo, setAlgo] = useState<AlgoMode>('current_feasible');
  const [includeReturns, setIncludeReturns] = useState<boolean>(true);

  // Form temp states
  const [mAddress, setMAddress] = useState("");
  const [mWinStart, setMWinStart] = useState("");
  const [mWinEnd, setMWinEnd] = useState("");
  const [mVolume, setMVolume] = useState(0);
  const [mWeight, setMWeight] = useState(0);
  const [mService, setMService] = useState(10);

  const [vName, setVName] = useState("");
  const [vCapVol, setVCapVol] = useState(1000);
  const [vCapW, setVCapW] = useState(1000);
  const [vStart, setVStart] = useState("08:00");
  const [vMaxStops, setVMaxStops] = useState(30);

  // Local geocode cache
  const geocodeCacheRef = useRef<Record<string, GeoPoint>>({});

  useEffect(() => {
    try {
      geocodeCacheRef.current = JSON.parse(localStorage.getItem("geocode_planning_v1") || "{}");
    } catch {}
    // Prefill driver/date
    try {
      const u = localStorage.getItem('userIdentifier') || '';
      if (u && !driverNo) setDriverNo(u);
    } catch {}
    if (!orderDate) {
      const today = new Date();
      const yyyy = today.getFullYear();
      const mm = String(today.getMonth()+1).padStart(2,'0');
      const dd = String(today.getDate()).padStart(2,'0');
      setOrderDate(`${yyyy}-${mm}-${dd}`);
    }
  }, []);

  // Load drivers from BC
  useEffect(() => {
    const run = async () => {
      setDriversLoading(true);
      try {
        const res = await fetch('/api/chauffeurs', { cache: 'no-store' });
        if (!res.ok) throw new Error('HTTP '+res.status);
        const data = await res.json();
        const list: Driver[] = Array.isArray(data?.value)
          ? data.value.map((d:any)=>({ No: d.No, Name: d.Name }))
          : [];
        setDrivers(list);
        // if no driver prefilled, default to first
        if (!driverNo && list.length) setDriverNo(list[0].No);
      } catch (e) {
        // leave empty on error
        setDrivers([]);
      } finally {
        setDriversLoading(false);
      }
    };
    run();
  }, []);

  const saveCache = () => {
    try {
      localStorage.setItem("geocode_planning_v1", JSON.stringify(geocodeCacheRef.current));
    } catch {}
  };

  // Remove prefixes like "#<No> — " from addresses for geocoding and normalize spacing
  function cleanAddress(addr: string): string {
    const ws = '[\\s\u00A0]';
    const dash = '[—–-]';
    const re = new RegExp(`^#[^${dash}]+${ws}${dash}${ws}+`);
    const cleaned = addr.replace(re, '')
      .replace(/\u00A0/g, ' ') // NBSP -> space
      .replace(/\s+,/g, ',')   // trim space before commas
      .replace(/,+/g, ',')
      .replace(/\s+/g, ' ')
      .trim();
    return cleaned;
  }

  async function geocode(addr: string): Promise<GeoPoint | null> {
    if (!addr) return null;
    const queryAddr = cleanAddress(addr);
    if (geocodeCacheRef.current[addr]) return geocodeCacheRef.current[addr];
    if (geocodeCacheRef.current[queryAddr]) return geocodeCacheRef.current[queryAddr];
    // detect country code from query
    const detectCountryCode = (s: string): string | null => {
      const m = s.match(/\b(FR|France|DE|Germany|IT|Italia|ES|Spain|GB|UK|United Kingdom|BE|Belgique|Belgium|NL|Netherlands)\b/i);
      if (!m) return null;
      const v = m[0].toLowerCase();
      if (v.includes('fr')) return 'fr';
      if (v.includes('germany') || v === 'de') return 'de';
      if (v.includes('ital') || v === 'it') return 'it';
      if (v.includes('spain') || v === 'es') return 'es';
      if (v === 'gb' || v.includes('united kingdom') || v === 'uk') return 'gb';
      if (v.includes('belg') || v === 'be') return 'be';
      if (v.includes('nether') || v === 'nl') return 'nl';
      return null;
    };
    const cc = detectCountryCode(queryAddr);
    const fetchGeo = async (q: string, country?: string | null) => {
      const base = `https://nominatim.openstreetmap.org/search?format=json&limit=1`;
      const url = base + (country ? `&countrycodes=${country}` : '') + `&q=${encodeURIComponent(q)}`;
      const res = await fetch(url, { headers: { "User-Agent": "TruckPlanningApp/1.0 (contact@example.com)" } });
      if (!res.ok) return null;
      const data = await res.json();
      if (Array.isArray(data) && data.length > 0) {
        const p = { lon: parseFloat(data[0].lon), lat: parseFloat(data[0].lat) };
        if (!isNaN(p.lon) && !isNaN(p.lat)) return p;
      }
      return null;
    };

    // Build candidate variants
    const parts = queryAddr.split(',').map(s => s.trim()).filter(Boolean);
    const countryName = cc ? undefined : null; // if cc detected, we don't need to force country name string
    const cityGuess = parts.length >= 2 ? parts[parts.length - 2] : (parts[parts.length - 1] || '');
    const countryGuess = ((): string => {
      if (/(fr|france)/i.test(queryAddr)) return 'France';
      if (/(de|germany|allemagne)/i.test(queryAddr)) return 'Germany';
      if (/(it|italy|italie)/i.test(queryAddr)) return 'Italy';
      if (/(es|spain|espagne)/i.test(queryAddr)) return 'Spain';
      if (/(gb|uk|united kingdom|royaume-uni)/i.test(queryAddr)) return 'United Kingdom';
      if (/(be|belgium|belgique)/i.test(queryAddr)) return 'Belgium';
      if (/(nl|netherlands|pays-bas)/i.test(queryAddr)) return 'Netherlands';
      return '';
    })();

    // try original
    let p = await fetchGeo(queryAddr, cc || undefined);
    if (!p) {
      const hasCountry = /\b(FR|France|Belgique|Belgium|ES|Spain|DE|Germany|IT|Italy|GB|UK|United Kingdom|NL|Netherlands)\b/i.test(queryAddr);
      if (!hasCountry) {
        // default to France if none specified
        p = await fetchGeo(`${queryAddr}, France`, 'fr');
      }
    }
    // Try without postal code or standalone numeric tokens if still not found
    if (!p) {
      const withoutPostCode = queryAddr.replace(/,?\s*\b\d{4,6}\b/g, '').replace(/\s+,/g, ',');
      if (withoutPostCode !== queryAddr) {
        p = await fetchGeo(withoutPostCode, cc || undefined);
        if (!p && !/\b(FR|France)\b/i.test(withoutPostCode)) {
          p = await fetchGeo(`${withoutPostCode}, ${countryGuess || 'France'}`, cc || (countryGuess ? undefined : 'fr'));
        }
      }
    }
    // Try only first two components (street, city/country) as a last resort
    if (!p) {
      if (parts.length >= 2) {
        // try street + city
        const streetTokens = parts.slice(0, parts.length - 2).join(' ') || parts[0];
        const numberFirst = streetTokens.replace(/^(.*?)(?:,\s*)?(\b\d+[A-Za-z]?\b)(.*)$/,'$2 $1$3').trim();
        const city = parts[parts.length - 2];
        const countryF = countryGuess || '';
        const candidates = [
          `${numberFirst}, ${city}${countryF ? ', ' + countryF : ''}`,
          `${streetTokens}, ${city}${countryF ? ', ' + countryF : ''}`,
          `${city}${countryF ? ', ' + countryF : ''}`,
        ];
        for (const c of candidates) {
          p = await fetchGeo(c, cc || undefined);
          if (p) break;
        }
      }
    }
    if (p) {
      geocodeCacheRef.current[addr] = p;
      geocodeCacheRef.current[queryAddr] = p;
      saveCache();
      return p;
    }
    return null;
  }

  async function importFromSales() {
    setError(null);
    try {
      if (!orderDate) {
        setError("Veuillez saisir une date");
        return;
      }
      // Use local mock orders like itinéraires pages
      const list: any[] = mockOrders || [];

      const parseWindow = (o: any) => {
        const raw = String(
          o?.PromisedDeliveryHours ||
            o?.promisedDeliveryHours ||
            o?.DeliveryHours ||
            o?.deliveryHours ||
            ""
        ).trim();
        const m = raw.match(/(\d{1,2}:\d{2})\s*[-–—]\s*(\d{1,2}:\d{2})/);
        if (m) return { start: m[1], end: m[2] };
        // Default time window when not provided by mock order
        return { start: "08:00", end: "10:00" };
      };

      const sameDay = (incoming?: string) => {
        const d = normalizeDateToISO(incoming);
        return !!d && d === orderDate;
      };
      let filtered = list.filter(o => sameDay(o.Requested_Delivery_Date));
      if (filtered.length === 0) {
        const dates = Array.from(
          new Set(
            list
              .map((o) => normalizeDateToISO(o?.Requested_Delivery_Date))
              .filter(Boolean)
          )
        ).slice(0, 8);
        setError(
          `Aucune commande trouvée pour ce chauffeur et cette date. Dates mock dispo: ${dates.length ? dates.join(", ") : "-"}. (Affichage: toutes les commandes mock)`
        );
        filtered = list;
      }
      const deliveryMissions: Mission[] = filtered.map((o:any) => {
        const baseAddr = [o.Sell_to_Address || '', o.Sell_to_Post_Code || '', o.Sell_to_City || '', o.Sell_to_Country_Region_Code || '']
          .filter(Boolean).join(', ');
        const address = o.No && baseAddr ? `#${o.No} — ${baseAddr}` : (baseAddr || '');
        const w = parseWindow(o);
        return {
          id: crypto.randomUUID(),
          kind: "delivery",
          orderNo: String(o.No || '').trim() || undefined,
          address,
          windowStart: w.start,
          windowEnd: w.end,
          volume: Number(o.volume) || 0,
          weight: Number(o.capacity) || 0,
          serviceMin: 10,
        } as Mission;
      }).filter((m: Mission) => !!m.address);

      const returnMissions: Mission[] = includeReturns
        ? filtered.map((o:any) => {
            const baseAddr = [o.Sell_to_Address || '', o.Sell_to_Post_Code || '', o.Sell_to_City || '', o.Sell_to_Country_Region_Code || '']
              .filter(Boolean).join(', ');
            const address = o.No && baseAddr ? `#${o.No} — ${baseAddr}` : (baseAddr || '');
            // Returns planned after deliveries by default
            return {
              id: crypto.randomUUID(),
              kind: "return",
              orderNo: String(o.No || '').trim() || undefined,
              address,
              windowStart: "14:00",
              windowEnd: "17:00",
              volume: 0,
              weight: 0,
              serviceMin: 7,
            } as Mission;
          }).filter((m: Mission) => !!m.address)
        : [];

      const newMissions: Mission[] = [...deliveryMissions, ...returnMissions];
      // replace missions by imported list
      setMissions(newMissions);
    } catch (e:any) {
      setError(e?.message || 'Échec import commandes');
    }
  }

  // Auto import when driver/date changes
  useEffect(() => {
    if (!driverNo || !orderDate) return;
    importFromSales();
  }, [driverNo, orderDate, includeReturns]);

  // Manual action to link truck
  async function linkTruckFromBC() {
    setTruckError(null);
    if (!driverNo) return;
    setTruckLoading(true);
    try {
      const res = await fetch('/api/listeCamions', { cache: 'no-store' });
      if (!res.ok) {
        const txt = await res.text().catch(()=> '');
        throw new Error(`${res.status} ${txt}`);
      }
      const data = await res.json();
      const list = Array.isArray(data?.value) ? data.value : [];
      const truck = list.find((t:any) => (t.Resource_No || '').toLowerCase() === driverNo.toLowerCase());
      if (!truck) {
        setTruckError('Aucun camion lié à ce chauffeur.');
        return;
      }
      const name = `${truck.No || 'TRK'}${truck.License_Plate ? ' ('+truck.License_Plate+')' : ''}`;
      setVehicles([
        {
          id: crypto.randomUUID(),
          name,
          capVolume: 1000,
          capWeight: 1000,
          startTime: vStart,
          maxStops: 30,
        }
      ]);
    } catch (e:any) {
      setTruckError('Impossible de lier le camion depuis BC (permissions ou API).');
    } finally {
      setTruckLoading(false);
    }
  }

  function addMission() {
    if (!mAddress) return;
    setMissions((prev) => [
      {
        id: crypto.randomUUID(),
        address: mAddress,
        windowStart: mWinStart,
        windowEnd: mWinEnd,
        volume: Number(mVolume) || 0,
        weight: Number(mWeight) || 0,
        serviceMin: Number(mService) || 0,
      },
      ...prev,
    ]);
    setMAddress("");
    setMWinStart("");
    setMWinEnd("");
    setMVolume(0);
    setMWeight(0);
    setMService(10);
  }

  function addVehicle() {
    if (!vName) return;
    setVehicles((prev) => [
      {
        id: crypto.randomUUID(),
        name: vName,
        capVolume: Number(vCapVol) || 0,
        capWeight: Number(vCapW) || 0,
        startTime: vStart,
        maxStops: Number(vMaxStops) || 0,
      },
      ...prev,
    ]);
    setVName("");
    setVCapVol(1000);
    setVCapW(1000);
    setVStart("08:00");
    setVMaxStops(30);
  }

  async function optimize() {
    console.log('[optimize] START - missions:', missions.length, 'vehicles:', vehicles.length);
    setLoading(true);
    setError(null);
    try {
      if (missions.length === 0) {
        throw new Error("Aucune mission à optimiser. Veuillez d'abord importer des commandes.");
      }
      // Geocode depot and missions
      console.log('[optimize] Geocoding depot:', depotAddress);
      const depot = await geocode(depotAddress);
      console.log('[optimize] Depot result:', depot);
      if (!depot) throw new Error("Échec géocodage dépôt");
      const geoMissions: Array<Mission & { point: GeoPoint }> = [];
      const failed: string[] = [];
      for (let i = 0; i < missions.length; i++) {
        const m = missions[i];
        console.log(`[optimize] Geocoding mission ${i + 1}/${missions.length}:`, m.address);
        const p = await geocode(m.address);
        console.log(`[optimize] Mission ${i + 1} result:`, p ? 'OK' : 'FAIL');
        if (p) {
          geoMissions.push({ ...m, point: p });
        } else {
          failed.push(m.address);
        }
        await new Promise(r => setTimeout(r, 250));
      }
      console.log('[optimize] Geocoded:', geoMissions.length, 'Failed:', failed.length);
      if (geoMissions.length === 0) {
        const sample = failed.slice(0, 3).join(' | ');
        throw new Error(sample ? `Aucune mission géocodée. Exemples d'adresses non résolues: ${sample}` : "Aucune mission géocodée");
      }
      // If no vehicles defined, create a temporary default one to allow simple optimization
      const localVehicles: Vehicle[] = vehicles.length ? vehicles : [{
        id: 'default-vehicle',
        name: 'Itinéraire',
        capVolume: 0,
        capWeight: 0,
        startTime: '08:00',
        maxStops: 0,
      }];
      let built: RoutePlan[] = [];
      if (algo === 'demo_greedy_nn_2opt') {
        const { assignments, unassigned } = assignGreedyCapacity(depot, geoMissions, localVehicles);
        if (unassigned.size > 0) setError(`${unassigned.size} mission(s) non affectées (capacité)`);
        for (const v of localVehicles) {
          const assigned = assignments[v.id] || [];
          if (assigned.length === 0) continue;
          const nn = sequenceNearestNeighbor(depot, assigned);
          const opt = twoOpt(nn, depot, 100);
          let total = 0;
          let curr = depot;
          const stops: PlannedStop[] = [];
          let timeMin = parseHM(v.startTime || '08:00');
          opt.forEach(m => {
            const d = haversine(curr, m.point);
            total += d;
            const travelMin = (d / 40) * 60;
            const arrive = timeMin + travelMin;
            const service = m.serviceMin || 0;
            timeMin = arrive + service;
            stops.push({ mission: m, arrival: fmtHM(arrive), distanceKmFromPrev: Math.round(d*10)/10 });
            curr = m.point;
          });
          built.push({ vehicle: v, stops, totalDistanceKm: Math.round(total*10)/10 });
        }
        setRoutes(built);
      } else {
        // fallback to previous feasible nearest with windows
        const remaining = new Set(geoMissions.map((m) => m.id));
        for (const v of localVehicles) {
          let curr = depot;
          let timeMin = parseHM(v.startTime || '08:00');
          let usedVol = 0, usedW = 0; const stops: PlannedStop[] = []; let total = 0;
          while (stops.length < (v.maxStops || 999) && remaining.size > 0) {
            let best: (Mission & { point: GeoPoint }) | null = null; let bestDist = Infinity;
            for (const m of geoMissions) {
              if (!remaining.has(m.id)) continue;
              const dist = haversine(curr, m.point);
              const nextVol = usedVol + (m.volume || 0); const nextW = usedW + (m.weight || 0);
              if ((v.capVolume && nextVol > v.capVolume) || (v.capWeight && nextW > v.capWeight)) continue;
              const travelMin = (dist / 40) * 60; const arrive = timeMin + travelMin;
              const winStart = parseHM(m.windowStart); const winEnd = parseHM(m.windowEnd) || 24*60;
              if (winStart && arrive < winStart) { /* wait allowed */ }
              if (arrive > winEnd) continue;
              if (dist < bestDist) { bestDist = dist; best = m; }
            }
            if (!best) break;
            const distKm = bestDist === Infinity ? 0 : bestDist; const travelMin = (distKm/40)*60; let arrive = timeMin + travelMin;
            const winStart = parseHM(best.windowStart); if (winStart && arrive < winStart) arrive = winStart; const service = best.serviceMin || 0; timeMin = arrive + service;
            usedVol += best.volume||0; usedW += best.weight||0; total += distKm; curr = best.point; remaining.delete(best.id);
            stops.push({ mission: best, arrival: fmtHM(arrive), distanceKmFromPrev: Math.round(distKm*10)/10 });
          }
          if (stops.length>0) built.push({ vehicle: v, stops, totalDistanceKm: Math.round(total*10)/10 });
        }
        setRoutes(built);
      }
    } catch (e: any) {
      setError(e?.message || "Échec optimisation");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="container mx-auto p-6">
      <h1 className="text-3xl font-bold text-gray-800 mb-4">Planification & Optimisation IoT</h1>

      {/* Depot & Import Sales Orders */}
      <div className="bg-white p-4 rounded-lg shadow mb-4 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3 items-end">
        <div>
          <label className="block text-sm text-gray-600 mb-1">Adresse Dépôt</label>
          <input value={depotAddress} onChange={(e)=>setDepotAddress(e.target.value)} className="w-full px-3 py-2 border rounded" placeholder="Adresse du dépôt" />
        </div>
        <div className="grid grid-cols-2 gap-2">
          <div>
            <label className="block text-sm text-gray-600 mb-1">Chauffeur</label>
            <select value={driverNo} onChange={(e)=>setDriverNo(e.target.value)} className="w-full px-3 py-2 border rounded">
              {driversLoading && <option>Chargement...</option>}
              {!driversLoading && drivers.length === 0 && <option value="">Aucun chauffeur</option>}
              {drivers.map(d => (
                <option key={d.No} value={d.No}>{d.No} — {d.Name}</option>
              ))}
            </select>
          </div>
          <div>
            <label className="block text-sm text-gray-600 mb-1">Date</label>
            <input type="date" value={orderDate} onChange={(e)=>setOrderDate(e.target.value)} className="w-full px-3 py-2 border rounded" />
          </div>
          <div className="col-span-2 flex gap-2 flex-wrap items-center">
            <label className="hidden">Algo:</label>
            <select value={algo} onChange={(e)=> setAlgo(e.target.value as AlgoMode)} className="px-3 py-2 border rounded">
              <option value="demo_greedy_nn_2opt">Greedy Capacity + Nearest Neighbor + 2-opt (démo)</option>
              <option value="current_feasible">Greedy nearest avec fenêtres (actuel)</option>
            </select>
            <label className="flex items-center gap-2 px-3 py-2 border rounded bg-white text-sm text-gray-700">
              <input type="checkbox" checked={includeReturns} onChange={(e)=> setIncludeReturns(e.target.checked)} />
              Inclure retours
            </label>
            <button onClick={importFromSales} className="px-4 py-2 bg-gray-700 text-white rounded">Importer les commandes</button>
            <button onClick={optimize} className="px-4 py-2 bg-blue-600 text-white rounded disabled:opacity-60" disabled={loading}>
              {loading ? 'Calcul en cours...' : 'Optimiser' }
            </button>
            <button onClick={linkTruckFromBC} className="px-4 py-2 bg-emerald-600 text-white rounded disabled:opacity-60" disabled={truckLoading}>
              {truckLoading ? 'Lien du camion…' : 'Lier le camion'}
            </button>
            {truckError && <span className="text-sm text-amber-700 bg-amber-50 border border-amber-200 px-2 py-1 rounded">{truckError}</span>}
          </div>
        </div>
      </div>

      {error && (
        <div className="mb-4 p-3 rounded bg-amber-50 text-amber-800 border border-amber-200">{error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Missions */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3">Saisie des missions / livraisons IoT</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            <input value={mAddress} onChange={(e)=>setMAddress(e.target.value)} className="px-3 py-2 border rounded" placeholder="Adresse" />
            <input value={mVolume} onChange={(e)=>setMVolume(Number(e.target.value))} type="number" className="px-3 py-2 border rounded" placeholder="Volume" />
            <input value={mWeight} onChange={(e)=>setMWeight(Number(e.target.value))} type="number" className="px-3 py-2 border rounded" placeholder="Poids" />
            <input value={mService} onChange={(e)=>setMService(Number(e.target.value))} type="number" className="px-3 py-2 border rounded" placeholder="Service (min)" />
            <input value={mWinStart} onChange={(e)=>setMWinStart(e.target.value)} className="px-3 py-2 border rounded" placeholder="Fenêtre début (HH:mm)" />
            <input value={mWinEnd} onChange={(e)=>setMWinEnd(e.target.value)} className="px-3 py-2 border rounded" placeholder="Fenêtre fin (HH:mm)" />
          </div>
          <button onClick={addMission} className="px-3 py-2 bg-gray-800 text-white rounded">Ajouter une mission</button>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-gray-600 uppercase">Type</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-600 uppercase">Adresse</th>
                  <th className="px-3 py-2 text-left text-xs text-gray-600 uppercase">Fenêtre</th>
                  <th className="px-3 py-2 text-right text-xs text-gray-600 uppercase">Vol</th>
                  <th className="px-3 py-2 text-right text-xs text-gray-600 uppercase">Poids</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {missions.map(m => (
                  <tr key={m.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-700">{m.kind === "return" ? "Retour" : "Livraison"}</td>
                    <td className="px-3 py-2 text-sm text-gray-800">{m.address}</td>
                    <td className="px-3 py-2 text-sm text-gray-600">{m.windowStart || '-'} - {m.windowEnd || '-'}</td>
                    <td className="px-3 py-2 text-sm text-right text-gray-800">{m.volume ?? 0}</td>
                    <td className="px-3 py-2 text-sm text-right text-gray-800">{m.weight ?? 0}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>

        {/* Vehicles */}
        <div className="bg-white p-4 rounded-lg shadow">
          <h2 className="text-xl font-semibold mb-3">Véhicules & contraintes IoT</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2 mb-3">
            <input value={vName} onChange={(e)=>setVName(e.target.value)} className="px-3 py-2 border rounded" placeholder="Nom véhicule" />
            <input value={vStart} onChange={(e)=>setVStart(e.target.value)} className="px-3 py-2 border rounded" placeholder="Départ (HH:mm)" />
            <input value={vCapVol} onChange={(e)=>setVCapVol(Number(e.target.value))} type="number" className="px-3 py-2 border rounded" placeholder="Capacité volume" />
            <input value={vCapW} onChange={(e)=>setVCapW(Number(e.target.value))} type="number" className="px-3 py-2 border rounded" placeholder="Capacité poids" />
            <input value={vMaxStops} onChange={(e)=>setVMaxStops(Number(e.target.value))} type="number" className="px-3 py-2 border rounded" placeholder="Max arrêts" />
          </div>
          <button onClick={addVehicle} className="px-3 py-2 bg-gray-800 text-white rounded">Ajouter un véhicule</button>
          <div className="mt-3 overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-3 py-2 text-left text-xs text-gray-600 uppercase">Nom</th>
                  <th className="px-3 py-2 text-right text-xs text-gray-600 uppercase">Vol</th>
                  <th className="px-3 py-2 text-right text-xs text-gray-600 uppercase">Poids</th>
                  <th className="px-3 py-2 text-right text-xs text-gray-600 uppercase">Départ</th>
                  <th className="px-3 py-2 text-right text-xs text-gray-600 uppercase">Max</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {vehicles.map(v => (
                  <tr key={v.id} className="hover:bg-gray-50">
                    <td className="px-3 py-2 text-sm text-gray-800">{v.name}</td>
                    <td className="px-3 py-2 text-sm text-right text-gray-800">{v.capVolume ?? 0}</td>
                    <td className="px-3 py-2 text-sm text-right text-gray-800">{v.capWeight ?? 0}</td>
                    <td className="px-3 py-2 text-sm text-right text-gray-800">{v.startTime}</td>
                    <td className="px-3 py-2 text-sm text-right text-gray-800">{v.maxStops}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Routes */}
      {routes.length > 0 && (
        <div className="bg-white p-4 rounded-lg shadow mt-4">
          <h2 className="text-xl font-semibold mb-3">Résultats de l'optimisation IoT</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {routes.map((r) => (
              <div key={r.vehicle.id} className="border rounded p-3">
                <div className="font-semibold mb-2">{r.vehicle.name}</div>
                <div className="text-sm text-gray-600 mb-2">Distance totale: {r.totalDistanceKm.toLocaleString('fr-FR')} km</div>
                <ol className="list-decimal ml-5 space-y-1">
                  {r.stops.map((s, idx) => (
                    <li key={idx} className="text-sm">
                      <span className="text-gray-800">{s.mission.address}</span>
                      <span className="text-gray-500"> — Arrivée {s.arrival} (+{s.distanceKmFromPrev} km)</span>
                    </li>
                  ))}
                </ol>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
