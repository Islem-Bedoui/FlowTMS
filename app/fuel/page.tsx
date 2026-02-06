"use client";

import { useState, useEffect } from 'react';
import { mockFuel } from "../../types/mockFuel";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { 
  faGasPump, 
  faTruck, 
  faCalendarAlt, 
  faGaugeHigh,
  faGaugeSimple,
  faIdBadge,
  faGasPump as faFuelType,
  faListNumeric,
  faUser,
  faFile,
  faClipboardList,
  faWrench,
  faCalendarDays,
  faClockRotateLeft,
  faExclamationTriangle
} from "@fortawesome/free-solid-svg-icons";

// Définition du type pour les données de suivi de carburant
type FuelEntry = {
  EntryNo: string;
  TruckNo: string;
  Date: string;
  FuelType: string;
  Liters: number;
  Odometer: number;
  LastOdometer: number;
};

export default function FuelPage() {
  const [fuelData, setFuelData] = useState<FuelEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<'fuel'|'profile'|'docs'|'assignment'|'mileage'|'maintenance'>('fuel');
  const [selectedTruck, setSelectedTruck] = useState<string>('');
  const [docs, setDocs] = useState<Array<{ id: string; truckNo: string; name: string; type: string; expiresOn: string }>>([]);
  const [assignments, setAssignments] = useState<Array<{ id: string; truckNo: string; driver: string; from: string; to: string }>>([]);

  useEffect(() => {
    // Charger depuis les mock data locales
    try {
      setLoading(true);
      setFuelData(mockFuel as any);
    } catch (err: any) {
      setError(err?.message || "Impossible de charger les données mock de carburant");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!selectedTruck && fuelData.length > 0) {
      setSelectedTruck(fuelData[0].TruckNo);
    }
  }, [fuelData, selectedTruck]);

  // Fonction pour formater la date
  const formatDate = (dateString: string) => {
    if (!dateString) return 'N/A';
    const date = new Date(dateString);
    if (isNaN(date.getTime())) return dateString; // Retourne la chaîne originale si la date n'est pas valide
    
    const options: Intl.DateTimeFormatOptions = { 
      year: 'numeric', 
      month: 'short', 
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      timeZone: 'UTC' // Ajustez selon le fuseau horaire de vos données
    };
    return date.toLocaleDateString('fr-FR', options);
  };

  // Calculer les statistiques
  const totalLiters = fuelData.reduce((sum, item) => sum + (item.Liters || 0), 0);
  const uniqueTrucks = new Set(fuelData.map(item => item.TruckNo)).size;
  const lastUpdate = fuelData.length > 0 ? fuelData[0].Date : null;

  // Dérivés par camion
  const trucks = Array.from(new Set(fuelData.map(f => f.TruckNo))).sort();
  const currentTruckFuel = selectedTruck ? fuelData.filter(f => f.TruckNo === selectedTruck).sort((a,b)=> new Date(b.Date).getTime()-new Date(a.Date).getTime()) : [];
  const lastOdometer = currentTruckFuel.length ? currentTruckFuel[0].Odometer : undefined;
  const mileageHistory = (() => {
    const arr = [...currentTruckFuel].sort((a,b)=> new Date(a.Date).getTime()-new Date(b.Date).getTime());
    const rows: Array<{ date: string; odometer: number; delta: number }>=[];
    for (let i=0;i<arr.length;i++) {
      const prev = i>0 ? arr[i-1] : undefined;
      const delta = prev ? Math.max(0, (arr[i].Odometer||0) - (prev.Odometer||0)) : 0;
      rows.push({ date: arr[i].Date, odometer: arr[i].Odometer||0, delta });
    }
    return rows.reverse();
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="p-4 bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded relative" role="alert">
        <strong className="font-bold">Erreur ! </strong>
        <span className="block sm:inline">{error}</span>
      </div>
    );
  }

  return (
    <div className="container mx-auto p-6">
      <div className="flex items-center mb-6">
        <FontAwesomeIcon icon={faTruck} className="text-2xl text-blue-600 mr-3" />
        <h1 className="text-3xl font-bold text-gray-800">Journal du Camion</h1>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow p-2 mb-6 flex flex-wrap gap-2">
        <button onClick={()=>setActiveTab('fuel')} className={`px-3 py-2 rounded ${activeTab==='fuel'?'bg-blue-600 text-white':'bg-gray-100 text-gray-700'}`}>
          <FontAwesomeIcon icon={faGasPump} className="mr-2"/> Carburant
        </button>
        <button onClick={()=>setActiveTab('profile')} className={`px-3 py-2 rounded ${activeTab==='profile'?'bg-blue-600 text-white':'bg-gray-100 text-gray-700'}`}>
          <FontAwesomeIcon icon={faUser} className="mr-2"/> Fiche véhicule
        </button>
        <button onClick={()=>setActiveTab('docs')} className={`px-3 py-2 rounded ${activeTab==='docs'?'bg-blue-600 text-white':'bg-gray-100 text-gray-700'}`}>
          <FontAwesomeIcon icon={faFile} className="mr-2"/> Assurance & Docs
        </button>
        <button onClick={()=>setActiveTab('assignment')} className={`px-3 py-2 rounded ${activeTab==='assignment'?'bg-blue-600 text-white':'bg-gray-100 text-gray-700'}`}>
          <FontAwesomeIcon icon={faClipboardList} className="mr-2"/> Affectations
        </button>
        <button onClick={()=>setActiveTab('mileage')} className={`px-3 py-2 rounded ${activeTab==='mileage'?'bg-blue-600 text-white':'bg-gray-100 text-gray-700'}`}>
          <FontAwesomeIcon icon={faClockRotateLeft} className="mr-2"/> Kilométrage
        </button>
        <button onClick={()=>setActiveTab('maintenance')} className={`px-3 py-2 rounded ${activeTab==='maintenance'?'bg-blue-600 text-white':'bg-gray-100 text-gray-700'}`}>
          <FontAwesomeIcon icon={faWrench} className="mr-2"/> Maintenance
        </button>
        <div className="ml-auto flex items-center gap-2">
          <label className="text-sm text-gray-600">Camion:</label>
          <select value={selectedTruck} onChange={(e)=>setSelectedTruck(e.target.value)} className="px-2 py-1 border rounded">
            {trucks.map(t=> <option key={t} value={t}>{t}</option>)}
          </select>
        </div>
      </div>

      {/* Fuel Tab */}
      {activeTab === 'fuel' && (
      <div className="bg-white rounded-lg shadow-md p-6 mb-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-6">
          <div className="bg-blue-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500 flex items-center">
              <FontAwesomeIcon icon={faListNumeric} className="mr-2" />
              Total des entrées
            </h3>
            <p className="text-2xl font-semibold text-gray-900">{fuelData.length}</p>
          </div>
          <div className="bg-green-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500 flex items-center">
              <FontAwesomeIcon icon={faGasPump} className="mr-2" />
              Volume total (L)
            </h3>
            <p className="text-2xl font-semibold text-gray-900">
              {totalLiters.toFixed(2)}
            </p>
          </div>
          <div className="bg-yellow-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500 flex items-center">
              <FontAwesomeIcon icon={faTruck} className="mr-2" />
              Véhicules uniques
            </h3>
            <p className="text-2xl font-semibold text-gray-900">
              {uniqueTrucks}
            </p>
          </div>
          <div className="bg-purple-50 p-4 rounded-lg">
            <h3 className="text-sm font-medium text-gray-500 flex items-center">
              <FontAwesomeIcon icon={faCalendarAlt} className="mr-2" />
              Dernière mise à jour
            </h3>
            <p className="text-md font-semibold text-gray-900">
              {lastUpdate ? formatDate(lastUpdate) : 'N/A'}
            </p>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <FontAwesomeIcon icon={faIdBadge} className="mr-1" /> N° Entrée
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <FontAwesomeIcon icon={faTruck} className="mr-1" /> Camion
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <FontAwesomeIcon icon={faCalendarAlt} className="mr-1" /> Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <FontAwesomeIcon icon={faFuelType} className="mr-1" /> Type
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <FontAwesomeIcon icon={faGasPump} className="mr-1" /> Litres
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <FontAwesomeIcon icon={faGaugeHigh} className="mr-1" /> Compteur (km)
                </th>
                <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  <FontAwesomeIcon icon={faGaugeSimple} className="mr-1" /> Dernier relevé (km)
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {fuelData.map((item) => (
                <tr key={item.EntryNo} className="hover:bg-gray-50">
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-blue-600">
                    {item.EntryNo || 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm font-medium text-gray-900">
                    {item.TruckNo || 'N/A'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                    {formatDate(item.Date)}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap">
                    <span className={`px-2 inline-flex text-xs leading-5 font-semibold rounded-full 
                      ${item.FuelType?.toLowerCase() === 'diesel' ? 'bg-blue-100 text-blue-800' : 
                        'bg-gray-100 text-gray-800'}`}>
                      {item.FuelType || 'N/A'}
                    </span>
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500">
                    {item.Liters?.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 }) || '0.00'} L
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500">
                    {item.Odometer?.toLocaleString('fr-FR') || '0'}
                  </td>
                  <td className="px-4 py-3 whitespace-nowrap text-sm text-right text-gray-500">
                    {item.LastOdometer?.toLocaleString('fr-FR') || '0'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      )}

      {/* Fiche véhicule */}
      {activeTab === 'profile' && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center"><FontAwesomeIcon icon={faUser} className="mr-2"/>Fiche du véhicule</h2>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            <div className="p-4 border rounded">
              <div className="text-sm text-gray-500">Camion</div>
              <div className="text-lg font-semibold">{selectedTruck || '-'}</div>
            </div>
            <div className="p-4 border rounded">
              <div className="text-sm text-gray-500">Dernier compteur</div>
              <div className="text-lg font-semibold">{lastOdometer?.toLocaleString('fr-FR') || '-'}</div>
            </div>
            <div className="p-4 border rounded">
              <div className="text-sm text-gray-500">Type carburant dominant</div>
              <div className="text-lg font-semibold">{(currentTruckFuel[0]?.FuelType)|| '-'}</div>
            </div>
          </div>
        </div>
      )}

      {/* Assurance & Documents */}
      {activeTab === 'docs' && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center"><FontAwesomeIcon icon={faFile} className="mr-2"/>Assurance, documents, dates limites</h2>
          <div className="flex gap-2 mb-4">
            <input placeholder="Nom du document" className="px-2 py-1 border rounded" id="docName" />
            <select className="px-2 py-1 border rounded" id="docType">
              <option>Assurance</option>
              <option>Carte grise</option>
              <option>Vignette</option>
              <option>Autre</option>
            </select>
            <input type="date" className="px-2 py-1 border rounded" id="docDate" />
            <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => {
              const name = (document.getElementById('docName') as HTMLInputElement)?.value || '';
              const type = (document.getElementById('docType') as HTMLSelectElement)?.value || '';
              const expiresOn = (document.getElementById('docDate') as HTMLInputElement)?.value || '';
              if (!name || !type || !expiresOn || !selectedTruck) return;
              setDocs(prev => [{ id: crypto.randomUUID(), truckNo: selectedTruck, name, type, expiresOn }, ...prev]);
            }}>Ajouter</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Camion</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Nom</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Type</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase"><FontAwesomeIcon icon={faCalendarDays} className="mr-1"/>Échéance</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {docs.filter(d=> d.truckNo===selectedTruck).map(d => (
                  <tr key={d.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{d.truckNo}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{d.name}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{d.type}</td>
                    <td className="px-4 py-3 text-sm text-gray-700 flex items-center gap-2">
                      {new Date(d.expiresOn).toLocaleDateString('fr-FR')} 
                      {new Date(d.expiresOn).getTime() - Date.now() < 7*24*3600*1000 && (
                        <span className="inline-flex items-center text-amber-600"><FontAwesomeIcon icon={faExclamationTriangle} className="mr-1"/>Bientôt</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Planning d'affectation */}
      {activeTab === 'assignment' && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center"><FontAwesomeIcon icon={faClipboardList} className="mr-2"/>Planning d’affectation</h2>
          <div className="flex gap-2 mb-4">
            <input placeholder="Chauffeur" className="px-2 py-1 border rounded" id="assDriver" />
            <input type="datetime-local" className="px-2 py-1 border rounded" id="assFrom" />
            <input type="datetime-local" className="px-2 py-1 border rounded" id="assTo" />
            <button className="px-3 py-1 bg-blue-600 text-white rounded" onClick={() => {
              const driver = (document.getElementById('assDriver') as HTMLInputElement)?.value || '';
              const from = (document.getElementById('assFrom') as HTMLInputElement)?.value || '';
              const to = (document.getElementById('assTo') as HTMLInputElement)?.value || '';
              if (!driver || !from || !to || !selectedTruck) return;
              setAssignments(prev => [{ id: crypto.randomUUID(), truckNo: selectedTruck, driver, from, to }, ...prev]);
            }}>Affecter</button>
          </div>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Camion</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Chauffeur</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">De</th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">À</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {assignments.filter(a=> a.truckNo===selectedTruck).map(a => (
                  <tr key={a.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{a.truckNo}</td>
                    <td className="px-4 py-3 text-sm font-medium text-gray-900">{a.driver}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{new Date(a.from).toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3 text-sm text-gray-700">{new Date(a.to).toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Kilométrage & Historique */}
      {activeTab === 'mileage' && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center"><FontAwesomeIcon icon={faClockRotateLeft} className="mr-2"/>Kilométrage & historique</h2>
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Date</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Compteur (km)</th>
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase">Parcours (km)</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {mileageHistory.slice(0, 20).map((m, idx) => (
                  <tr key={idx} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-700">{formatDate(m.date)}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">{m.odometer.toLocaleString('fr-FR')}</td>
                    <td className="px-4 py-3 text-sm text-right text-gray-700">{m.delta.toLocaleString('fr-FR')}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Interface Maintenance */}
      {activeTab === 'maintenance' && (
        <div className="bg-white rounded-lg shadow-md p-6 mb-6">
          <h2 className="text-xl font-semibold mb-4 flex items-center"><FontAwesomeIcon icon={faWrench} className="mr-2"/>Maintenance</h2>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="p-4 border rounded">
              <div className="text-sm text-gray-500">Dernier compteur</div>
              <div className="text-lg font-semibold">{lastOdometer?.toLocaleString('fr-FR') || '-'}</div>
            </div>
            <div className="p-4 border rounded">
              <div className="text-sm text-gray-500">Prochaine révision (tous 15 000 km)</div>
              <div className="text-lg font-semibold">{lastOdometer ? ((Math.floor(lastOdometer/15000)+1)*15000).toLocaleString('fr-FR') : '-'}</div>
            </div>
            <div className="p-4 border rounded">
              <div className="text-sm text-gray-500">Échéance estimée</div>
              <div className="text-lg font-semibold">{lastOdometer ? 'Selon usage' : '-'}</div>
            </div>
          </div>
          <div className="mt-4 text-sm text-gray-600">Connectez une API de GMAO pour synchroniser les ordres de travail et historiques.</div>
        </div>
      )}

      </div>
 
  );
}
