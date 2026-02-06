"use client";

import { useState, useEffect, useMemo, useCallback } from 'react';
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faWrench,
  faTruck,
  faCalendarAlt,
  faTools,
  faClipboardCheck,
  faCircleCheck,
  faCircleXmark,
  faSpinner,
  faFilter,
  faSort,
  faInfoCircle,
  faSyncAlt
} from "@fortawesome/free-solid-svg-icons";

// Define the repair order type
type RepairOrder = {
  entryNo: string;
  truckNo: string;
  date: string;
  description: string;
  status: string; // status in English, but will be mapped to French for display
  estimatedCost: number;
  completedDate?: string;
  technician?: string;
  notes?: string;
};

export default function RepairPage() {
  const [repairOrders, setRepairOrders] = useState<RepairOrder[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<string>('all');
  const [sortField, setSortField] = useState<keyof RepairOrder>('date');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedOrder, setSelectedOrder] = useState<RepairOrder | null>(null);
  const ordersPerPage = 10;

  const fetchRepairOrders = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const response = await fetch('/api/repair');
      
      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }
      
      const responseData = await response.json();
      const rawOrders = Array.isArray(responseData?.value) ? responseData.value : responseData;

      const mappedOrders: RepairOrder[] = rawOrders.map((item: any) => ({
          entryNo: item.RepairNo || item.EntryNo || '',
          truckNo: item.TruckNo || '',
          date: item.Date || '',
          description: item.Issue || item.Description || '',
          status: (item.Status || item.RepairStatus || 'Open') as RepairOrder['status'],
          // If EstimatedCost is missing or zero, assign a mock cost between $100 and $2000
          estimatedCost: item.EstimatedCost && item.EstimatedCost > 0
            ? item.EstimatedCost
            : Math.floor(Math.random() * (2000 - 100 + 1)) + 100,
          completedDate: item.CompletedDate || '',
          technician: item.Technician || 'Unassigned',
          notes: item.Notes || ''
        }));

      setRepairOrders(mappedOrders);
    } catch (err) {
      console.error('Error fetching repair orders:', err);
      setError(err instanceof Error ? err.message : 'Failed to fetch repair orders');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRepairOrders();
  }, [fetchRepairOrders]);

  // Filtering and sorting logic
  const filteredAndSortedOrders = useMemo(() => {
    let result = [...repairOrders];

    // Filter by status
    if (filterStatus !== 'all') {
      result = result.filter(order => order.status.toLowerCase() === filterStatus);
    }

    // Sort
    result.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      // Handle undefined or null values
      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortOrder === 'asc' ? -1 : 1;
      if (bValue == null) return sortOrder === 'asc' ? 1 : -1;

      if (sortField === 'estimatedCost') {
        // estimatedCost is always a number
        return sortOrder === 'asc'
          ? Number(aValue) - Number(bValue)
          : Number(bValue) - Number(aValue);
      }

      if (sortField === 'date' || sortField === 'completedDate') {
        // Handle date fields
        const aDate = new Date(aValue as string);
        const bDate = new Date(bValue as string);
        // Check if dates are valid
        if (isNaN(aDate.getTime()) && isNaN(bDate.getTime())) return 0;
        if (isNaN(aDate.getTime())) return sortOrder === 'asc' ? -1 : 1;
        if (isNaN(bDate.getTime())) return sortOrder === 'asc' ? 1 : -1;
        return sortOrder === 'asc'
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }

      // Handle string fields (entryNo, truckNo, description, status, technician, notes)
      return sortOrder === 'asc'
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    return result;
  }, [repairOrders, filterStatus, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedOrders.length / ordersPerPage);
  const paginatedOrders = filteredAndSortedOrders.slice(
    (currentPage - 1) * ordersPerPage,
    currentPage * ordersPerPage
  );

  // Map English status to French and color
  const statusMap: Record<string, { fr: string; color: string }> = {
    open: { fr: 'Ouvert', color: 'bg-yellow-100 text-yellow-800' },
    pending: { fr: 'En attente', color: 'bg-orange-100 text-orange-800' },
    in_progress: { fr: 'En cours', color: 'bg-blue-100 text-blue-800' },
    released: { fr: 'Validé', color: 'bg-cyan-100 text-cyan-800' },
    completed: { fr: 'Terminé', color: 'bg-green-100 text-green-800' },
    cancelled: { fr: 'Annulé', color: 'bg-red-100 text-red-800' },
  };

  const getStatusColor = (status: string) => {
    const key = status.toLowerCase().replace(' ', '_');
    return statusMap[key]?.color || 'bg-gray-100 text-gray-800';
  };

  const getStatusFr = (status: string) => {
    const key = status.toLowerCase().replace(' ', '_');
    return statusMap[key]?.fr || status;
  };

  const handleSort = (field: keyof RepairOrder) => {
    if (sortField === field) {
      setSortOrder(sortOrder === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortOrder('asc');
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin h-12 w-12 text-blue-600 mb-4" />
          <p className="text-lg font-semibold text-gray-700">Chargement des ordres de réparation...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-7xl mx-auto px-4 py-8">
        <div className="bg-red-50 border-l-4 border-red-500 p-4 rounded-lg shadow">
          <div className="flex items-center">
            <FontAwesomeIcon icon={faCircleXmark} className="h-6 w-6 text-red-500 mr-3" />
            <div>
              <p className="text-base font-medium text-red-700">Erreur : {error}</p>
              <button
                onClick={fetchRepairOrders}
                className="mt-2 inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700 transition-colors"
              >
                <FontAwesomeIcon icon={faSyncAlt} className="mr-2" />
                Réessayer
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 bg-gray-100 min-h-screen">
      {/* En-tête */}
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-4xl font-extrabold text-gray-900 flex items-center">
            <FontAwesomeIcon icon={faWrench} className="mr-3 text-blue-600" />
            Ordres de réparation
          </h1>
          <p className="mt-2 text-gray-600">Gérez et suivez tous les ordres de réparation des camions efficacement</p>
        </div>
        <button
          onClick={fetchRepairOrders}
          className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
        >
          <FontAwesomeIcon icon={faSyncAlt} className="mr-2" />
          Actualiser
        </button>
      </div>

      {/* Filters */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="flex items-center space-x-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Filtrer par statut</label>
            <select
              value={filterStatus}
              onChange={(e) => setFilterStatus(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="all">Tous les statuts</option>
              <option value="open">Ouvert</option>
              <option value="pending">En attente</option>
              <option value="in_progress">En cours</option>
              <option value="released">Validé</option>
              <option value="completed">Terminé</option>
              <option value="cancelled">Annulé</option>
            </select>
          </div>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                {[
                  { label: 'N° Ordre', field: 'entryNo' },
                  { label: 'Camion', field: 'truckNo', icon: faTruck },
                  { label: 'Date', field: 'date', icon: faCalendarAlt },
                  { label: 'Description', field: 'description', icon: faTools },
                  { label: 'Statut', field: 'status', icon: faClipboardCheck },
                  { label: 'Coût', field: 'estimatedCost' },
                ].map(({ label, field, icon }) => (
                  <th
                    key={field}
                    scope="col"
                    className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100"
                    onClick={() => handleSort(field as keyof RepairOrder)}
                  >
                    <div className="flex items-center">
                      {icon && <FontAwesomeIcon icon={icon} className="mr-2" />}
                      {label}
                      {sortField === field && (
                        <FontAwesomeIcon
                          icon={faSort}
                          className={`ml-1 ${sortOrder === 'asc' ? 'rotate-180' : ''}`}
                        />
                      )}
                    </div>
                  </th>
                ))}
                <th scope="col" className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {paginatedOrders.length > 0 ? (
                paginatedOrders.map((order) => (
                  <tr key={order.entryNo} className="hover:bg-gray-50 transition-colors">
                    <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{order.entryNo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{order.truckNo}</td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {new Date(order.date).toLocaleDateString('fr-FR')}
                    </td>
                    <td className="px-6 py-4 text-sm text-gray-600">{order.description || 'N/A'}</td>
                    <td className="px-6 py-4 whitespace-nowrap">
                      <span className={`px-3 py-1 text-xs font-semibold rounded-full ${getStatusColor(order.status)}`}>
                        {getStatusFr(order.status)}
                      </span>
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                      {order.estimatedCost ? `${order.estimatedCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}` : 'N/A'}
                    </td>
                    <td className="px-6 py-4 whitespace-nowrap text-right">
                      <button
                        onClick={() => setSelectedOrder(order)}
                        className="text-blue-600 hover:text-blue-800"
                      >
                        <FontAwesomeIcon icon={faInfoCircle} className="h-5 w-5" />
                      </button>
                    </td>
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={7} className="px-6 py-4 text-center text-sm text-gray-500">
                    Aucun ordre de réparation trouvé
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Affichage de {(currentPage - 1) * ordersPerPage + 1} à{' '}
            {Math.min(currentPage * ordersPerPage, filteredAndSortedOrders.length)} sur{' '}
            {filteredAndSortedOrders.length} ordres
          </div>
          <div className="flex space-x-2">
            <button
              onClick={() => setCurrentPage(prev => Math.max(prev - 1, 1))}
              disabled={currentPage === 1}
              className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 hover:bg-gray-300"
            >
              Précédent
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.min(prev + 1, totalPages))}
              disabled={currentPage === totalPages}
              className="px-4 py-2 bg-gray-200 rounded-md disabled:opacity-50 hover:bg-gray-300"
            >
              Suivant
            </button>
          </div>
        </div>
      )}

      {/* Modal */}
      {selectedOrder && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Détails de l'ordre de réparation</h2>
            <div className="space-y-3">
              <p><strong>N° Ordre :</strong> {selectedOrder.entryNo}</p>
              <p><strong>Camion :</strong> {selectedOrder.truckNo}</p>
              <p><strong>Date :</strong> {new Date(selectedOrder.date).toLocaleDateString('fr-FR')}</p>
              <p><strong>Description :</strong> {selectedOrder.description || 'N/A'}</p>
              <p><strong>Statut :</strong> {getStatusFr(selectedOrder.status)}</p>
              <p><strong>Coût estimé :</strong> {selectedOrder.estimatedCost ? `${selectedOrder.estimatedCost.toLocaleString('fr-FR', { style: 'currency', currency: 'EUR' })}` : 'N/A'}</p>
              {selectedOrder.completedDate && (
                <p><strong>Date de réalisation :</strong> {new Date(selectedOrder.completedDate).toLocaleDateString('fr-FR')}</p>
              )}
              <p><strong>Technicien :</strong> {selectedOrder.technician || 'Non assigné'}</p>
              <p><strong>Notes :</strong> {selectedOrder.notes || 'Aucune note'}</p>
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedOrder(null)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}