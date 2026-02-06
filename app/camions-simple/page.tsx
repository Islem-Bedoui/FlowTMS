'use client'

import React, { useEffect, useMemo, useState, useCallback } from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faTruck, faSearch, faDownload, faFilePdf, faSpinner, faCircleXmark, faTrash, faEdit, faInfoCircle, faSyncAlt } from '@fortawesome/free-solid-svg-icons';
import jsPDF from 'jspdf';
import 'jspdf-autotable';

type Truck = {
  No: string;
  Description: string;
  Make: string;
  Model: string;
  Year: string;
  License_Plate: string;
  Status: string;
  Resource_No: string;
  '@odata.etag': string;
};

type Driver = { No: string; Name: string };

type GpsRecord = {
  TruckNo: string;
  Latitude: number;
  Longitude: number;
  Speed: number;
  LastUpdate: string;
  Address?: string;
};

export default function CamionsSansDev() {
  const [trucks, setTrucks] = useState<Truck[] | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('All');
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [currentPage, setCurrentPage] = useState(1);
  const recordsPerPage = 10;

  const [openEdit, setOpenEdit] = useState(false);
  const [openAdd, setOpenAdd] = useState(false);
  const [editTruck, setEditTruck] = useState<Truck | null>(null);

  const [openGps, setOpenGps] = useState(false);
  const [gpsRecord, setGpsRecord] = useState<GpsRecord | null>(null);

  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch('/api/chauffeurs', { cache: 'no-store' });
      const data = await res.json();
      const list: Driver[] = Array.isArray(data?.value)
        ? data.value.map((d: any) => ({ No: d.No, Name: d.Name }))
        : [];
      setDrivers(list);
    } catch {
      setDrivers([]);
    }
  }, []);

  const fetchTrucks = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/listeCamions', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP ${response.status}`);
      const data = await response.json();
      const trucksList: Truck[] = (data?.value || []).map((t: any) => ({
        No: t.No,
        Description: t.Description || '',
        Make: t.Make || '',
        Model: t.Model || '',
        Year: t.Year || '',
        License_Plate: t.License_Plate || '',
        Status: t.Status || '',
        Resource_No: t.Resource_No || '',
        '@odata.etag': t['@odata.etag'] || ''
      }));
      setTrucks(trucksList);
    } catch (e: any) {
      setError(e?.message || 'Erreur chargement camions');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchTrucks(); fetchDrivers(); }, [fetchTrucks, fetchDrivers]);

  const filtered = useMemo(() => {
    const q = searchQuery.trim().toLowerCase();
    let res = (trucks || []);
    if (q) {
      res = res.filter(t =>
        t.Description.toLowerCase().includes(q) ||
        t.Make.toLowerCase().includes(q) ||
        t.Model.toLowerCase().includes(q) ||
        t.License_Plate.toLowerCase().includes(q) ||
        t.No.toLowerCase().includes(q)
      );
    }
    if (statusFilter !== 'All') res = res.filter(t => t.Status === statusFilter);
    return res;
  }, [trucks, searchQuery, statusFilter]);

  const totalPages = Math.ceil(filtered.length / recordsPerPage) || 1;
  const pageSlice = filtered.slice((currentPage-1)*recordsPerPage, currentPage*recordsPerPage);

  const toggleSelectAll = (checked: boolean) => {
    if (checked) setSelectedRows(pageSlice.map(t=>t.No));
    else setSelectedRows([]);
  };
  const toggleSelectRow = (no: string, checked: boolean) => {
    setSelectedRows(prev => checked ? [...new Set([...prev, no])] : prev.filter(x=>x!==no));
  };

  const exportCSV = () => {
    const headers = ['No','Description','Marque','Modèle','Année','Plaque','Statut','Chauffeur'];
    const rows = filtered.map(t => [t.No,t.Description,t.Make,t.Model,t.Year,t.License_Plate,t.Status,t.Resource_No]
      .map(v => '"'+String(v).replace(/"/g,'""')+'"'));
    const csv = [headers.join(','), ...rows.map(r=>r.join(','))].join('\n');
    const blob = new Blob([csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `camions_${new Date().toISOString().slice(0,10)}.csv`; a.click();
    URL.revokeObjectURL(url);
  };

  const exportPDF = () => {
    const doc = new jsPDF();
    doc.text('Liste des Camions', 14, 16);
    const head = [['No','Description','Marque','Modèle','Année','Plaque','Statut','Chauffeur']];
    const body = filtered.map(t => [t.No,t.Description,t.Make,t.Model,t.Year,t.License_Plate,t.Status,t.Resource_No]);
    (doc as any).autoTable({ head, body, startY: 22, styles: { fontSize: 8 } });
    doc.save(`camions_${new Date().toISOString().slice(0,10)}.pdf`);
  };

  const handleDelete = async (no: string) => {
    if (!confirm('Supprimer ce camion ?')) return;
    await fetch(`/api/listeCamions?No=${encodeURIComponent(no)}`, { method: 'DELETE' });
    setTrucks(prev => prev ? prev.filter(t=> t.No!==no) : prev);
  };

  const handleBulkDelete = async () => {
    if (!confirm(`Supprimer ${selectedRows.length} camions ?`)) return;
    for (const no of selectedRows) {
      await fetch(`/api/listeCamions?No=${encodeURIComponent(no)}`, { method: 'DELETE' });
    }
    setTrucks(prev => prev ? prev.filter(t=> !selectedRows.includes(t.No)) : prev);
    setSelectedRows([]);
  };

  const handleBulkStatus = async (status: string) => {
    for (const no of selectedRows) {
      const t = trucks?.find(x=>x.No===no);
      if (!t) continue;
      await fetch(`/api/listeCamions?No=${encodeURIComponent(no)}`, { method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify({ ...t, Status: status }) });
    }
    setTrucks(prev => prev ? prev.map(t => selectedRows.includes(t.No) ? { ...t, Status: status } : t) : prev);
    setSelectedRows([]);
  };

  const openEditModal = (t: Truck) => { setEditTruck(t); setOpenEdit(true); };
  const saveEdit = async () => {
    if (!editTruck) return;
    await fetch(`/api/listeCamions?No=${encodeURIComponent(editTruck.No)}`, { method: 'PATCH', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(editTruck) });
    setTrucks(prev => prev ? prev.map(t => t.No===editTruck.No ? editTruck : t) : prev);
    setOpenEdit(false);
  };

  const [newTruck, setNewTruck] = useState<Truck>({ No:'', Description:'', Make:'', Model:'', Year:'', License_Plate:'', Status:'', Resource_No:'', '@odata.etag':'' });
  const saveNew = async () => {
    if (!newTruck.Description || !newTruck.Make || !newTruck.Model || !newTruck.License_Plate) { alert('Champs obligatoires manquants'); return; }
    const res = await fetch('/api/listeCamions', { method: 'POST', headers: { 'Content-Type':'application/json' }, body: JSON.stringify(newTruck) });
    if (!res.ok) { alert('Erreur ajout'); return; }
    const added = await res.json();
    setTrucks(prev => prev ? [...prev, added] : [added]);
    setOpenAdd(false);
    setNewTruck({ No:'', Description:'', Make:'', Model:'', Year:'', License_Plate:'', Status:'', Resource_No:'', '@odata.etag':'' });
  };

  const fetchAddress = async (lat:number, lng:number) => {
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/reverse?format=json&lat=${lat}&lon=${lng}&zoom=18&addressdetails=1`);
      const data = await res.json();
      return data.display_name || '';
    } catch {
      return '';
    }
  };
  const openGpsDialog = async (no: string) => {
    try {
      const res = await fetch('/api/gps', { cache: 'no-store' });
      const data = await res.json();
      const value = Array.isArray(data?.value) ? data.value : data;
      const rec = value.find((r: GpsRecord) => r.TruckNo === no);
      if (rec) rec.Address = await fetchAddress(rec.Latitude, rec.Longitude);
      setGpsRecord(rec || null);
      setOpenGps(true);
    } catch {}
  };

  if (loading) return (
    <div className="flex items-center justify-center min-h-screen bg-slate-50">
      <div className="text-center">
        <FontAwesomeIcon icon={faSpinner} className="animate-spin h-12 w-12 text-blue-600 mb-4" />
        <p className="text-lg font-semibold text-slate-700">Chargement des camions...</p>
      </div>
    </div>
  );

  if (error) return (
    <div className="max-w-4xl mx-auto p-6 mt-10 bg-red-50 border-l-4 border-red-500 rounded-md">
      <div className="flex items-center">
        <FontAwesomeIcon icon={faCircleXmark} className="h-6 w-6 text-red-500 mr-3" />
        <div>
          <p className="font-medium text-red-700 mb-2">Erreur: {error}</p>
          <button onClick={()=>window.location.reload()} className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700"><FontAwesomeIcon icon={faSyncAlt} className="mr-2"/>Réessayer</button>
        </div>
      </div>
    </div>
  );

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 bg-slate-50 min-h-screen">
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6">
        <h1 className="text-3xl font-extrabold text-slate-900 flex items-center"><FontAwesomeIcon icon={faTruck} className="mr-3 text-blue-600"/> Liste des Camions </h1>
        <div className="flex gap-3 mt-4 sm:mt-0">
          <button onClick={()=>setOpenAdd(true)} className="px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700">Ajouter</button>
          <button onClick={exportCSV} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"><FontAwesomeIcon icon={faDownload} className="mr-2"/>CSV</button>
          <button onClick={exportPDF} className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"><FontAwesomeIcon icon={faFilePdf} className="mr-2"/>PDF</button>
        </div>
      </div>

      <div className="mb-4 bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-slate-700 mb-1">Rechercher</label>
            <div className="relative">
              <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400"/>
              <input value={searchQuery} onChange={e=>{ setSearchQuery(e.target.value); setCurrentPage(1); }} placeholder="Description, Marque, Modèle, Plaque, No" className="w-full pl-10 pr-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"/>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1">Statut</label>
            <select value={statusFilter} onChange={e=>{ setStatusFilter(e.target.value); setCurrentPage(1); }} className="w-48 px-3 py-2 border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500">
              <option value="All">Tous</option>
              <option value="Active">Actif</option>
              <option value="Inactive">Inactif</option>
            </select>
          </div>
        </div>
      </div>

      {selectedRows.length > 0 && (
        <div className="mb-4 bg-white p-4 rounded-lg shadow flex items-center gap-3">
          <div className="text-sm text-slate-700">{selectedRows.length} sélection(s)</div>
          <button onClick={handleBulkDelete} className="px-3 py-2 bg-red-600 text-white rounded-md hover:bg-red-700"><FontAwesomeIcon icon={faTrash} className="mr-2"/>Supprimer</button>
          <button onClick={()=>handleBulkStatus('Active')} className="px-3 py-2 bg-green-600 text-white rounded-md hover:bg-green-700">Marquer Actif</button>
          <button onClick={()=>handleBulkStatus('Inactive')} className="px-3 py-2 bg-slate-600 text-white rounded-md hover:bg-slate-700">Marquer Inactif</button>
        </div>
      )}

      <div className="bg-white rounded-lg shadow overflow-hidden">
        <table className="min-w-full">
          <thead className="bg-slate-50 text-left text-sm text-slate-600">
            <tr>
              <th className="px-4 py-2"><input type="checkbox" checked={pageSlice.length>0 && selectedRows.length===pageSlice.map(t=>t.No).length} onChange={e=>toggleSelectAll(e.target.checked)} /></th>
              <th className="px-4 py-2">No</th>
              <th className="px-4 py-2">Description</th>
              <th className="px-4 py-2">Marque</th>
              <th className="px-4 py-2">Modèle</th>
              <th className="px-4 py-2">Année</th>
              <th className="px-4 py-2">Plaque</th>
              <th className="px-4 py-2">Statut</th>
              <th className="px-4 py-2">Chauffeur</th>
              <th className="px-4 py-2">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {pageSlice.map(t => (
              <tr key={t.No} className="hover:bg-slate-50">
                <td className="px-4 py-2"><input type="checkbox" checked={selectedRows.includes(t.No)} onChange={e=>toggleSelectRow(t.No, e.target.checked)} /></td>
                <td className="px-4 py-2 text-xs text-slate-500">{t.No}</td>
                <td className="px-4 py-2">{t.Description}</td>
                <td className="px-4 py-2">{t.Make}</td>
                <td className="px-4 py-2">{t.Model}</td>
                <td className="px-4 py-2">{t.Year}</td>
                <td className="px-4 py-2">{t.License_Plate}</td>
                <td className="px-4 py-2"><span className={t.Status==='Active' ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>{t.Status}</span></td>
                <td className="px-4 py-2">
                  <select value={t.Resource_No} onChange={async (e)=>{
                    const Resource_No = e.target.value;
                    await fetch(`/api/listeCamions?No=${encodeURIComponent(t.No)}`, { method:'PATCH', headers:{'Content-Type':'application/json'}, body: JSON.stringify({ ...t, Resource_No })});
                    setTrucks(prev => prev ? prev.map(x => x.No===t.No ? { ...x, Resource_No } : x) : prev);
                  }} className="border border-slate-300 rounded px-2 py-1">
                    <option value="">Aucun</option>
                    {drivers.map(d => <option key={d.No} value={d.No}>{d.Name}</option>)}
                  </select>
                </td>
                <td className="px-4 py-2">
                  <div className="flex gap-2">
                    <button onClick={()=>openEditModal(t)} className="px-2 py-1 bg-blue-600 text-white rounded hover:bg-blue-700"><FontAwesomeIcon icon={faEdit}/></button>
                    <button onClick={()=>handleDelete(t.No)} className="px-2 py-1 bg-red-600 text-white rounded hover:bg-red-700"><FontAwesomeIcon icon={faTrash}/></button>
                    <button onClick={()=>openGpsDialog(t.No)} className="px-2 py-1 bg-green-600 text-white rounded hover:bg-green-700"><FontAwesomeIcon icon={faInfoCircle}/></button>
                  </div>
                </td>
              </tr>
            ))}
            {pageSlice.length===0 && (
              <tr><td colSpan={10} className="px-4 py-8 text-center text-slate-500">Aucun résultat</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="mt-4 flex items-center justify-between">
          <div className="text-sm text-slate-600">Page {currentPage} / {totalPages} — {filtered.length} camions</div>
          <div className="flex gap-2">
            <button onClick={()=>setCurrentPage(p=>Math.max(1,p-1))} disabled={currentPage===1} className="px-3 py-2 bg-slate-200 rounded disabled:opacity-50 hover:bg-slate-300">Précédent</button>
            <button onClick={()=>setCurrentPage(p=>Math.min(totalPages,p+1))} disabled={currentPage===totalPages} className="px-3 py-2 bg-slate-200 rounded disabled:opacity-50 hover:bg-slate-300">Suivant</button>
          </div>
        </div>
      )}

      {openEdit && editTruck && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Modifier Camion</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm">No</label>
                <input value={editTruck.No} disabled className="w-full px-3 py-2 border rounded bg-gray-100"/>
              </div>
              <div className="col-span-2">
                <label className="text-sm">Description</label>
                <input value={editTruck.Description} onChange={e=>setEditTruck({ ...editTruck, Description:e.target.value })} className="w-full px-3 py-2 border rounded"/>
              </div>
              <div>
                <label className="text-sm">Marque</label>
                <input value={editTruck.Make} onChange={e=>setEditTruck({ ...editTruck, Make:e.target.value })} className="w-full px-3 py-2 border rounded"/>
              </div>
              <div>
                <label className="text-sm">Modèle</label>
                <input value={editTruck.Model} onChange={e=>setEditTruck({ ...editTruck, Model:e.target.value })} className="w-full px-3 py-2 border rounded"/>
              </div>
              <div>
                <label className="text-sm">Année</label>
                <input value={editTruck.Year} onChange={e=>setEditTruck({ ...editTruck, Year:e.target.value })} className="w-full px-3 py-2 border rounded"/>
              </div>
              <div>
                <label className="text-sm">Plaque</label>
                <input value={editTruck.License_Plate} onChange={e=>setEditTruck({ ...editTruck, License_Plate:e.target.value })} className="w-full px-3 py-2 border rounded"/>
              </div>
              <div>
                <label className="text-sm">Statut</label>
                <select value={editTruck.Status} onChange={e=>setEditTruck({ ...editTruck, Status:e.target.value })} className="w-full px-3 py-2 border rounded">
                  <option value="Active">Actif</option>
                  <option value="Inactive">Inactif</option>
                </select>
              </div>
              <div>
                <label className="text-sm">Chauffeur</label>
                <select value={editTruck.Resource_No} onChange={e=>setEditTruck({ ...editTruck, Resource_No:e.target.value })} className="w-full px-3 py-2 border rounded">
                  <option value="">Aucun</option>
                  {drivers.map(d=> <option key={d.No} value={d.No}>{d.Name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={()=>setOpenEdit(false)} className="px-4 py-2 bg-slate-200 rounded">Annuler</button>
              <button onClick={saveEdit} className="px-4 py-2 bg-blue-600 text-white rounded">Sauvegarder</button>
            </div>
          </div>
        </div>
      )}

      {openAdd && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Ajouter Camion</h2>
            <div className="grid grid-cols-2 gap-3">
              <div className="col-span-2">
                <label className="text-sm">Description</label>
                <input value={newTruck.Description} onChange={e=>setNewTruck({ ...newTruck, Description:e.target.value })} className="w-full px-3 py-2 border rounded"/>
              </div>
              <div>
                <label className="text-sm">Marque</label>
                <input value={newTruck.Make} onChange={e=>setNewTruck({ ...newTruck, Make:e.target.value })} className="w-full px-3 py-2 border rounded"/>
              </div>
              <div>
                <label className="text-sm">Modèle</label>
                <input value={newTruck.Model} onChange={e=>setNewTruck({ ...newTruck, Model:e.target.value })} className="w-full px-3 py-2 border rounded"/>
              </div>
              <div>
                <label className="text-sm">Année</label>
                <input value={newTruck.Year} onChange={e=>setNewTruck({ ...newTruck, Year:e.target.value })} className="w-full px-3 py-2 border rounded"/>
              </div>
              <div>
                <label className="text-sm">Plaque</label>
                <input value={newTruck.License_Plate} onChange={e=>setNewTruck({ ...newTruck, License_Plate:e.target.value })} className="w-full px-3 py-2 border rounded"/>
              </div>
              <div>
                <label className="text-sm">Statut</label>
                <select value={newTruck.Status} onChange={e=>setNewTruck({ ...newTruck, Status:e.target.value })} className="w-full px-3 py-2 border rounded">
                  <option value="Active">Actif</option>
                  <option value="Inactive">Inactif</option>
                </select>
              </div>
              <div>
                <label className="text-sm">Chauffeur</label>
                <select value={newTruck.Resource_No} onChange={e=>setNewTruck({ ...newTruck, Resource_No:e.target.value })} className="w-full px-3 py-2 border rounded">
                  <option value="">Aucun</option>
                  {drivers.map(d=> <option key={d.No} value={d.No}>{d.Name}</option>)}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-2">
              <button onClick={()=>setOpenAdd(false)} className="px-4 py-2 bg-slate-200 rounded">Annuler</button>
              <button onClick={saveNew} className="px-4 py-2 bg-blue-600 text-white rounded">Ajouter</button>
            </div>
          </div>
        </div>
      )}

      {openGps && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold mb-4">Détails GPS</h2>
            {gpsRecord ? (
              <div className="space-y-2 text-sm">
                <div>Camion: <strong>{gpsRecord.TruckNo}</strong></div>
                <div>Lat: {gpsRecord.Latitude.toFixed(5)} | Lng: {gpsRecord.Longitude.toFixed(5)}</div>
                <div>Vitesse: {gpsRecord.Speed.toFixed(1)} km/h</div>
                <div>Adresse: {gpsRecord.Address || '—'}</div>
                <div>MAJ: {new Date(gpsRecord.LastUpdate).toLocaleString()}</div>
              </div>
            ) : (
              <div className="text-slate-500">Aucun enregistrement GPS.</div>
            )}
            <div className="mt-6 flex justify-end"><button onClick={()=>setOpenGps(false)} className="px-4 py-2 bg-slate-200 rounded">Fermer</button></div>
          </div>
        </div>
      )}
    </div>
  );
}
