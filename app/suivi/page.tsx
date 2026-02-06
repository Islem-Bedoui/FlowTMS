"use client";

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { Vehicle } from '@/types';

// Dynamically import the MapComponent with SSR disabled
const MapComponent = dynamic(
  () => import('../components/MapComponent'),
  { 
    ssr: false, 
    loading: () => (
      <div className="h-[500px] flex items-center justify-center bg-white rounded-lg shadow-md">
        <p className="text-gray-500">Chargement de la carte...</p>
      </div>
    ) 
  }
);



export default function SuiviTempsReel() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [lineFilter, setLineFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'id'|'speed'|'updated'>('updated');
  const [sortDir, setSortDir] = useState<'asc'|'desc'>('desc');
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(20);
  const [autoRefreshSec, setAutoRefreshSec] = useState(30);
  const [lastUpdated, setLastUpdated] = useState<number | null>(null);

  useEffect(() => {
    // Replace this with your actual API endpoint
    const fetchVehicles = async (signal?: AbortSignal) => {
      try {
        setError(null);
        const response = await fetch('/api/vehicles', { signal });
        
        if (!response.ok) {
          throw new Error(`Erreur HTTP: ${response.status}`);
        }
        
        const data = await response.json();
        setVehicles(data);
        setLastUpdated(Date.now());
      } catch (error) {
        if ((error as any)?.name === 'AbortError') return;
        console.error('Erreur lors de la récupération des véhicules:', error);
        setError('Impossible de charger les données des véhicules. Veuillez réessayer plus tard.');
      } finally {
        setLoading(false);
      }
    };

    const controller = new AbortController();
    setLoading(true);
    fetchVehicles(controller.signal);

    const interval = setInterval(() => {
      const ctrl = new AbortController();
      fetchVehicles(ctrl.signal);
    }, autoRefreshSec * 1000);

    return () => {
      controller.abort();
      clearInterval(interval);
    };
  }, [autoRefreshSec]);

  const lines = Array.from(new Set(vehicles.map(v => v.service_name).filter(Boolean))) as string[];

  const filteredSorted = (() => {
    let list = vehicles;
    const q = query.trim().toLowerCase();
    if (q) {
      list = list.filter(v =>
        v.vehicle_id.toLowerCase().includes(q) ||
        (v.service_name || '').toLowerCase().includes(q) ||
        (v.destination || '').toLowerCase().includes(q)
      );
    }
    if (lineFilter !== 'all') list = list.filter(v => v.service_name === lineFilter);
    const sorted = [...list].sort((a,b)=>{
      let av: number|string = '';
      let bv: number|string = '';
      if (sortBy==='id') { av=a.vehicle_id; bv=b.vehicle_id; }
      else if (sortBy==='speed') { av = (a.speed ?? 0); bv = (b.speed ?? 0); }
      else { av = a.last_gps_fix; bv = b.last_gps_fix; }
      if (typeof av === 'number' && typeof bv === 'number') return (av-bv);
      return String(av).localeCompare(String(bv));
    });
    return sortDir==='asc'? sorted : sorted.reverse();
  })();

  const totalPages = Math.max(1, Math.ceil(filteredSorted.length / pageSize));
  const currentPage = Math.min(page, totalPages);
  const pageSlice = filteredSorted.slice((currentPage-1)*pageSize, currentPage*pageSize);

  return (
    <div className="container mx-auto p-4">
      <h1 className="text-2xl font-bold mb-6">Suivi en Temps Réel</h1>
      
      <div className="bg-white rounded-lg shadow-md p-4 mb-6">
        <h2 className="text-xl font-semibold mb-4">Carte</h2>
        <div className="h-[500px] w-full">
          <MapComponent vehicles={vehicles} />
        </div>
      </div>



      <div className="bg-white rounded-lg shadow overflow-hidden">
        <div className="p-4 flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <h2 className="text-xl font-semibold">Liste des Véhicules ({filteredSorted.length})</h2>
          <div className="flex flex-wrap items-center gap-2">
            <input value={query} onChange={e=>{setPage(1); setQuery(e.target.value);}} placeholder="Rechercher ID / Ligne / Destination" className="border rounded px-3 py-2 text-sm w-64" />
            <select value={lineFilter} onChange={e=>{setPage(1); setLineFilter(e.target.value);}} className="border rounded px-2 py-2 text-sm">
              <option value="all">Toutes les lignes</option>
              {lines.map(l=> <option key={l} value={l}>{l}</option>)}
            </select>
            <select value={sortBy} onChange={e=>setSortBy(e.target.value as any)} className="border rounded px-2 py-2 text-sm">
              <option value="updated">Tri: Dernière MAJ</option>
              <option value="speed">Tri: Vitesse</option>
              <option value="id">Tri: ID</option>
            </select>
            <button onClick={()=>setSortDir(d=> d==='asc'?'desc':'asc')} className="border rounded px-2 py-2 text-sm">{sortDir==='asc'?'Asc':'Desc'}</button>
            <button onClick={()=>{ setLoading(true); setError(null); setLastUpdated(null); }} className="ml-2 border rounded px-3 py-2 text-sm">Rafraîchir</button>
            <select value={autoRefreshSec} onChange={e=>setAutoRefreshSec(Number(e.target.value))} className="border rounded px-2 py-2 text-sm">
              <option value={15}>Auto: 15s</option>
              <option value={30}>Auto: 30s</option>
              <option value={60}>Auto: 60s</option>
              <option value={120}>Auto: 2min</option>
              <option value={0}>Auto: Off</option>
            </select>
            {lastUpdated && (
              <span className="text-xs text-gray-500">MAJ: {new Date(lastUpdated).toLocaleTimeString()}</span>
            )}
          </div>
        </div>
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">ID</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Ligne</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Destination</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Vitesse</th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Position</th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {error ? (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-red-600">
                    {error}
                  </td>
                </tr>
              ) : loading ? (
                Array.from({ length: 8 }).map((_,i)=> (
                  <tr key={i}>
                    <td className="px-6 py-4"><div className="h-4 w-24 bg-gray-200 animate-pulse rounded"/></td>
                    <td className="px-6 py-4"><div className="h-4 w-28 bg-gray-200 animate-pulse rounded"/></td>
                    <td className="px-6 py-4"><div className="h-4 w-36 bg-gray-200 animate-pulse rounded"/></td>
                    <td className="px-6 py-4"><div className="h-4 w-16 bg-gray-200 animate-pulse rounded"/></td>
                    <td className="px-6 py-4"><div className="h-4 w-40 bg-gray-200 animate-pulse rounded"/></td>
                  </tr>
                ))
              ) : pageSlice.length > 0 ? (
                pageSlice.map((vehicle) => {
                  const lastUpdate = new Date(vehicle.last_gps_fix * 1000).toLocaleTimeString();
                  
                  return (
                    <tr key={vehicle.vehicle_id} className="hover:bg-gray-50">
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {vehicle.vehicle_id}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {vehicle.service_name || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {vehicle.destination || 'N/A'}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {Math.min(Math.round((vehicle.speed ?? 0) * 3.6), 110)} km/h
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                        {vehicle.lat.toFixed(4)}, {vehicle.lng.toFixed(4)}
                      </td>
                    </tr>
                  );
                })
              ) : (
                <tr>
                  <td colSpan={5} className="px-6 py-4 text-center text-sm text-gray-500">
                    Aucun véhicule en service pour le moment
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
        <div className="flex items-center justify-between p-4 border-t bg-white">
          <div className="text-sm text-gray-600">Page {currentPage} / {totalPages} • {filteredSorted.length} éléments</div>
          <div className="flex items-center gap-2">
            <button disabled={currentPage<=1} onClick={()=>setPage(p=>Math.max(1,p-1))} className="px-3 py-1 border rounded disabled:opacity-50">Préc.</button>
            <button disabled={currentPage>=totalPages} onClick={()=>setPage(p=>Math.min(totalPages,p+1))} className="px-3 py-1 border rounded disabled:opacity-50">Suiv.</button>
            <select value={pageSize} onChange={e=>{setPage(1); setPageSize(Number(e.target.value));}} className="border rounded px-2 py-1 text-sm">
              <option value={10}>10</option>
              <option value={20}>20</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
            </select>
          </div>
        </div>
      </div>
    </div>
  );
}
