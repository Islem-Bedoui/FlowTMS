
"use client";

import { useState, useEffect, useMemo, useCallback } from "react";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import {
  faTruck,
  faTachometerAlt,
  faClock,
  faSyncAlt,
  faSpinner,
  faCircleXmark,
  faSearch,
  faDownload,
  faSort,
  faExclamationTriangle,
  faUser,
  faFilePdf,
  faInfoCircle,
} from "@fortawesome/free-solid-svg-icons";

// Chart.js imports
import { Chart as ChartJS, CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend } from "chart.js";
ChartJS.register(CategoryScale, LinearScale, BarElement, Title, Tooltip, Legend);

// Import jsPDF for PDF export
import jsPDF from "jspdf";
import "jspdf-autotable";
import { mockGps } from "../../types/mockGps";

// Data shape returned by /api/gps
export type GpsRecord = {
  TruckNo: string;
  Latitude: number;
  Longitude: number;
  Speed: number;
  LastUpdate: string;
  Address?: string; // For geocoding
  Driver?: string; // For driver information
};

export default function GpsPage() {
  const [records, setRecords] = useState<GpsRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>("");
  const [sortField, setSortField] = useState<keyof GpsRecord>("LastUpdate");
  const [sortOrder, setSortOrder] = useState<"asc" | "desc">("desc");
  const [isMobile, setIsMobile] = useState(false);
  const [autoRefresh, setAutoRefresh] = useState(false);
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRecord, setSelectedRecord] = useState<GpsRecord | null>(null);
  const recordsPerPage = 10;
  const SPEED_THRESHOLD = 80; // km/h

  // Check for mobile view
  useEffect(() => {
    const handleResize = () => setIsMobile(window.innerWidth < 640);
    handleResize();
    window.addEventListener("resize", handleResize);
    return () => window.removeEventListener("resize", handleResize);
  }, []);

  // Reverse geocoding function
  const fetchAddress = async (latitude: number, longitude: number): Promise<string> => {
    try {
      const res = await fetch(
        `https://nominatim.openstreetmap.org/reverse?format=json&lat=${latitude}&lon=${longitude}&zoom=18&addressdetails=1`
      );
      const data = await res.json();
      return data.display_name || "Unknown address";
    } catch (err) {
      console.error("Error fetching address:", err);
      return "Failed to fetch address";
    }
  };

  // Mock driver fetch (replace with actual API in production)
  const fetchDriver = async (truckNo: string): Promise<string> => {
    // Simulate API call
    await new Promise(resolve => setTimeout(resolve, 500));
    const drivers = {
      TR001: "John Doe",
      TR002: "Jane Smith",
      TR003: "Mike Johnson",
    };
    return drivers[truckNo as keyof typeof drivers] || "Unassigned";
  };

  const fetchGps = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const value = mockGps.map(m => ({
        TruckNo: m.truckNo,
        Latitude: m.lat,
        Longitude: m.lon,
        Speed: m.speedKmh,
        LastUpdate: m.timestamp,
        Address: m.address,
      })) as GpsRecord[];
      const recordsWithDetails = await Promise.all(
        value.map(async (record: GpsRecord) => ({
          ...record,
          Address: record.Address || await fetchAddress(record.Latitude, record.Longitude),
          Driver: await fetchDriver(record.TruckNo),
        }))
      );
      setRecords(recordsWithDetails);
    } catch (err) {
      console.error(err);
      setError(err instanceof Error ? err.message : "Failed to fetch GPS data");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchGps();
    if (autoRefresh) {
      const interval = setInterval(fetchGps, 30000); // Refresh every 30 seconds
      return () => clearInterval(interval);
    }
  }, [fetchGps, autoRefresh]);

  // Export to CSV
  const exportToCSV = () => {
    const headers = ["Truck No", "Latitude", "Longitude", "Speed (km/h)", "Last Update", "Address", "Driver"];
    const rows = filteredAndSortedRecords.map(record => [
      record.TruckNo,
      record.Latitude.toFixed(5),
      record.Longitude.toFixed(5),
      record.Speed.toFixed(1),
      new Date(record.LastUpdate).toLocaleString(),
      record.Address || "N/A",
      record.Driver || "N/A",
    ].map(field => `"${String(field).replace(/"/g, '""')}"`));

    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `gps_records_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Truck GPS Report", 20, 20);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);

    const tableColumn = ["Truck No", "Latitude", "Longitude", "Speed (km/h)", "Last Update", "Address", "Driver"];
    const tableRows = filteredAndSortedRecords.map(record => [
      record.TruckNo,
      record.Latitude.toFixed(5),
      record.Longitude.toFixed(5),
      record.Speed.toFixed(1),
      new Date(record.LastUpdate).toLocaleString(),
      record.Address || "N/A",
      record.Driver || "N/A",
    ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`gps_report_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  // Filtering and sorting logic
  const filteredAndSortedRecords = useMemo(() => {
    let result = [...records];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(record =>
        record.TruckNo.toLowerCase().includes(query) ||
        (record.Driver?.toLowerCase().includes(query) ?? false)
      );
    }

    // Sort
    result.sort((a, b) => {
      const aValue = a[sortField];
      const bValue = b[sortField];

      if (aValue == null && bValue == null) return 0;
      if (aValue == null) return sortOrder === "asc" ? -1 : 1;
      if (bValue == null) return sortOrder === "asc" ? 1 : -1;

      if (sortField === "Latitude" || sortField === "Longitude" || sortField === "Speed") {
        return sortOrder === "asc" ? Number(aValue) - Number(bValue) : Number(bValue) - Number(aValue);
      }

      if (sortField === "LastUpdate") {
        const aDate = new Date(aValue);
        const bDate = new Date(bValue);
        if (isNaN(aDate.getTime()) && isNaN(bDate.getTime())) return 0;
        if (isNaN(aDate.getTime())) return sortOrder === "asc" ? -1 : 1;
        if (isNaN(bDate.getTime())) return sortOrder === "asc" ? 1 : -1;
        return sortOrder === "asc"
          ? aDate.getTime() - bDate.getTime()
          : bDate.getTime() - aDate.getTime();
      }

      return sortOrder === "asc"
        ? String(aValue).localeCompare(String(bValue))
        : String(bValue).localeCompare(String(aValue));
    });

    return result;
  }, [records, searchQuery, sortField, sortOrder]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedRecords.length / recordsPerPage);
  const paginatedRecords = filteredAndSortedRecords.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  // Chart data for speed ranges
  const chartData = useMemo(() => {
    const speedRanges = {
      "0-30 km/h": 0,
      "30-60 km/h": 0,
      "60+ km/h": 0,
    };
    filteredAndSortedRecords.forEach(record => {
      if (record.Speed <= 30) speedRanges["0-30 km/h"]++;
      else if (record.Speed <= 60) speedRanges["30-60 km/h"]++;
      else speedRanges["60+ km/h"]++;
    });

    return {
      labels: ["0-30 km/h", "30-60 km/h", "60+ km/h"],
      datasets: [{
        label: "Trucks by Speed Range",
        data: [speedRanges["0-30 km/h"], speedRanges["30-60 km/h"], speedRanges["60+ km/h"]],
        backgroundColor: ["#10B981", "#FBBF24", "#EF4444"],
        borderColor: ["#059669", "#D97706", "#DC2626"],
        borderWidth: 1,
      }],
    };
  }, [filteredAndSortedRecords]);

  const handleSort = (field: keyof GpsRecord) => {
    if (sortField === field) {
      setSortOrder(sortOrder === "asc" ? "desc" : "asc");
    } else {
      setSortField(field);
      setSortOrder("asc");
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin h-12 w-12 text-blue-600 mb-4" />
          <p className="text-lg font-semibold text-gray-700">Chargement des données GPS...</p>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="max-w-4xl mx-auto p-6 mt-10 bg-red-50 border-l-4 border-red-500 rounded-md">
        <div className="flex items-center">
          <FontAwesomeIcon icon={faCircleXmark} className="h-6 w-6 text-red-500 mr-3" />
          <div>
            <p className="font-medium text-red-700 mb-2">Erreur : {error}</p>
            <button
              onClick={fetchGps}
              className="inline-flex items-center px-3 py-1.5 bg-blue-600 text-white rounded-md hover:bg-blue-700"
            >
              <FontAwesomeIcon icon={faSyncAlt} className="mr-2" /> Réessayer
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8 bg-gray-100 min-h-screen">
      {/* Header */}
      <div className="flex flex-col sm:flex-row items-center justify-between mb-6">
        <h1 className="text-3xl font-extrabold text-gray-900 flex items-center">
          <FontAwesomeIcon icon={faTruck} className="mr-3 text-blue-600" /> Suivi GPS des camions
        </h1>
        <div className="flex space-x-4 mt-4 sm:mt-0">
          <button
            onClick={fetchGps}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FontAwesomeIcon icon={faSyncAlt} className="mr-2" /> Actualiser
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            <FontAwesomeIcon icon={faDownload} className="mr-2" /> Exporter CSV
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <FontAwesomeIcon icon={faFilePdf} className="mr-2" /> Exporter PDF
          </button>
          <button
            onClick={() => setAutoRefresh(!autoRefresh)}
            className={`flex items-center px-4 py-2 rounded-lg ${
              autoRefresh ? "bg-blue-100 text-blue-700" : "bg-gray-200 text-gray-700"
            } hover:bg-opacity-80`}
          >
            <FontAwesomeIcon icon={faSyncAlt} className={`mr-2 ${autoRefresh ? "animate-spin" : ""}`} />
            {autoRefresh ? "Arrêter l'actualisation auto" : "Activer l'actualisation auto"}
          </button>
        </div>
      </div>

      {/* Search */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="flex items-center">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">Rechercher par camion ou chauffeur</label>
            <div className="relative">
              <FontAwesomeIcon icon={faSearch} className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher par n° camion ou chauffeur"
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
        </div>
      </div>

      
      {/* Table or Cards */}
      {isMobile ? (
        <div className="space-y-4">
          {paginatedRecords.length > 0 ? (
            paginatedRecords.map((record) => (
              <div
                key={`${record.TruckNo}-${record.LastUpdate}`}
                className={`bg-white p-4 rounded-lg shadow hover:shadow-md transition-shadow ${
                  record.Speed > SPEED_THRESHOLD ? "border-l-4 border-red-500" : ""
                }`}
              >
                <div className="flex justify-between items-center mb-2">
                  <h3 className="text-lg font-semibold text-gray-900">{record.TruckNo}</h3>
                  {record.Speed > SPEED_THRESHOLD && (
                    <FontAwesomeIcon icon={faExclamationTriangle} className="text-red-500" />
                  )}
                </div>
                <p className="text-sm text-gray-600">
                  <FontAwesomeIcon icon={faTachometerAlt} className="mr-2" />
                  {record.Speed.toFixed(1)} km/h
                </p>
                <p className="text-sm text-gray-600">
                  <FontAwesomeIcon icon={faClock} className="mr-2" />
                  {new Date(record.LastUpdate).toLocaleString()}
                </p>
                <p className="text-sm text-gray-600">
                  <FontAwesomeIcon icon={faUser} className="mr-2" />
                  {record.Driver || "Loading..."}
                </p>
                <p className="text-sm text-gray-600">
                  <FontAwesomeIcon icon={faTruck} className="mr-2" />
                  {record.Address || "Loading..."}
                </p>
                <button
                  onClick={() => setSelectedRecord(record)}
                  className="mt-3 text-blue-600 hover:text-blue-800"
                >
                  <FontAwesomeIcon icon={faInfoCircle} className="mr-2" /> View Details
                </button>
              </div>
            ))
          ) : (
            <div className="bg-white p-4 rounded-lg shadow text-center text-sm text-gray-500">
              Aucun enregistrement GPS trouvé
            </div>
          )}
        </div>
      ) : (
        <div className="bg-white shadow-lg rounded-lg overflow-hidden">
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  {[
                    { label: "Camion", field: "TruckNo", icon: faTruck },
                    { label: "Latitude", field: "Latitude" },
                    { label: "Longitude", field: "Longitude" },
                    { label: "Adresse", field: "Address" },
                    { label: "Vitesse (km/h)", field: "Speed", icon: faTachometerAlt },
                    { label: "Dernière mise à jour", field: "LastUpdate", icon: faClock },
                    { label: "Chauffeur", field: "Driver", icon: faUser },
                    { label: "Action", field: null },
                  ].map(({ label, field, icon }) => (
                    <th
                      key={field || label}
                      scope="col"
                      className={`px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider ${
                        field ? "cursor-pointer hover:bg-gray-100" : ""
                      }`}
                      onClick={field ? () => handleSort(field as keyof GpsRecord) : undefined}
                    >
                      <div className="flex items-center">
                        {icon && <FontAwesomeIcon icon={icon} className="mr-2" />}
                        {label}
                        {field && sortField === field && (
                          <FontAwesomeIcon
                            icon={faSort}
                            className={`ml-1 ${sortOrder === "asc" ? "rotate-180" : ""}`}
                          />
                        )}
                      </div>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {paginatedRecords.length > 0 ? (
                  paginatedRecords.map((record) => (
                    <tr
                      key={`${record.TruckNo}-${record.LastUpdate}`}
                      className={`hover:bg-gray-50 ${record.Speed > SPEED_THRESHOLD ? "bg-red-50" : ""}`}
                    >
                      <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">
                        {record.TruckNo}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {record.Latitude.toFixed(5)}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {record.Longitude.toFixed(5)}
                      </td>
                      <td className="px-6 py-4 text-sm text-gray-600">{record.Address || "Loading..."}</td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {record.Speed.toFixed(1)}
                        {record.Speed > SPEED_THRESHOLD && (
                          <FontAwesomeIcon icon={faExclamationTriangle} className="ml-2 text-red-500" />
                        )}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {new Date(record.LastUpdate).toLocaleString()}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        {record.Driver || "Loading..."}
                      </td>
                      <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                        <button
                          onClick={() => setSelectedRecord(record)}
                          className="text-blue-600 hover:text-blue-800"
                        >
                          <FontAwesomeIcon icon={faInfoCircle} className="h-5 w-5" />
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={8} className="px-6 py-4 text-center text-sm text-gray-500">
                      Aucun enregistrement GPS trouvé
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Affichage de {(currentPage - 1) * recordsPerPage + 1} à {Math.min(currentPage * recordsPerPage, filteredAndSortedRecords.length)} sur {filteredAndSortedRecords.length} enregistrements
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
      {selectedRecord && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Détails de l'enregistrement GPS</h2>
            <div className="space-y-3">
              <p><strong>Camion :</strong> {selectedRecord.TruckNo}</p>
              <p><strong>Latitude :</strong> {selectedRecord.Latitude.toFixed(5)}</p>
              <p><strong>Longitude :</strong> {selectedRecord.Longitude.toFixed(5)}</p>
              <p><strong>Adresse :</strong> {selectedRecord.Address || "Chargement..."}</p>
              <p><strong>Vitesse :</strong> {selectedRecord.Speed.toFixed(1)} km/h</p>
              <p><strong>Dernière mise à jour :</strong> {new Date(selectedRecord.LastUpdate).toLocaleString('fr-FR')}</p>
              <p><strong>Chauffeur :</strong> {selectedRecord.Driver || "Chargement..."}</p>
              {selectedRecord.Speed > SPEED_THRESHOLD && (
                <p className="text-red-600 font-semibold">
                  <FontAwesomeIcon icon={faExclamationTriangle} className="mr-2" />
                  Attention : vitesse supérieure à {SPEED_THRESHOLD} km/h
                </p>
              )}
            </div>
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setSelectedRecord(null)}
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
