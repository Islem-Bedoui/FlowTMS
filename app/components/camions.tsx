
"use client";

import { useEffect, useState, useMemo, useCallback } from "react";
import DataGrid, { Column } from "devextreme-react/data-grid";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import { library } from '@fortawesome/fontawesome-svg-core';
import { faSyncAlt} from '@fortawesome/free-solid-svg-icons';

library.add(faSyncAlt);
import {
  faSearch,
  faDownload,
  faFilePdf,
  faSpinner,
  faCircleXmark,
  faTruck,
  faInfoCircle,
  faTrash,
  faEdit,
} from "@fortawesome/free-solid-svg-icons";
import jsPDF from "jspdf";
import "jspdf-autotable";

// Interface for truck data
interface Truck {
  No: string;
  Description: string;
  Make: string;
  Model: string;
  Year: string;
  License_Plate: string;
  Status: string;
  Resource_No: string;
  "@odata.etag": string;
}

// Interface for GPS data (from GpsPage.tsx)
interface GpsRecord {
  TruckNo: string;
  Latitude: number;
  Longitude: number;
  Speed: number;
  LastUpdate: string;
  Address?: string;
}

// Interface for Driver data
interface Driver {
  No: string;
  Name: string;
}

const columns = [
  { dataField: "Description", caption: "Description" },
  { dataField: "Make", caption: "Marque" },
  { dataField: "Model", caption: "Modèle" },
  { dataField: "Year", caption: "Année" },
  { dataField: "License_Plate", caption: "Plaque d’immatriculation" },
  { dataField: "Status", caption: "Statut" },
  { dataField: "Resource_No", caption: "Chauffeur" },
];

const Trucks = () => {
  const [trucks, setTrucks] = useState<Truck[] | null>(null);
  const [drivers, setDrivers] = useState<Driver[]>([]);
  const [openEditDialog, setOpenEditDialog] = useState(false);
  const [openAddDialog, setOpenAddDialog] = useState(false);
  const [openGpsDialog, setOpenGpsDialog] = useState(false);
  const [selectedTruck, setSelectedTruck] = useState<Truck | null>(null);
  const [gpsRecord, setGpsRecord] = useState<GpsRecord | null>(null);
  const [newTruck, setNewTruck] = useState<Truck>({
    No: "",
    Description: "",
    Make: "",
    Model: "",
    Year: "",
    License_Plate: "",
    Status: "",
    Resource_No: "",
    "@odata.etag": "",
  });
  const [searchQuery, setSearchQuery] = useState("");
  const [statusFilter, setStatusFilter] = useState("All");
  const [currentPage, setCurrentPage] = useState(1);
  const [selectedRows, setSelectedRows] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const recordsPerPage = 10;

  // Fetch drivers from Business Central API
  const fetchDrivers = useCallback(async () => {
    try {
      const res = await fetch('/api/chauffeurs', { cache: 'no-store' });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(`HTTP ${res.status}: ${text}`);
      }
      const data = await res.json();
      const list: Driver[] = Array.isArray(data?.value)
        ? data.value.map((d: any) => ({ No: d.No, Name: d.Name }))
        : [];
      setDrivers(list);
    } catch (err) {
      console.error('Error fetching drivers:', err);
      setDrivers([]);
    }
  }, []);

  // Reverse geocoding for GPS records
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

  // Fetch trucks
  useEffect(() => {
    const fetchTrucks = async () => {
      try {
        setLoading(true);
        setError(null);
        const response = await fetch("/api/listeCamions");
        if (!response.ok) {
          const text = await response.text();
          throw new Error(`HTTP ${response.status}: ${text}`);
        }
        const data = await response.json();

        const trucksList = data.value
          .filter((truck: any) => truck.Description && truck.Make && truck.Model)
          .map((truck: any) => ({
            No: truck.No,
            Description: truck.Description,
            Make: truck.Make,
            Model: truck.Model,
            Year: truck.Year || "",
            License_Plate: truck.License_Plate || "",
            Status: truck.Status || "",
            Resource_No: truck.Resource_No || "",
            "@odata.etag": truck["@odata.etag"],
          }));

        setTrucks(trucksList);
        await fetchDrivers();
      } catch (err) {
        console.error("Erreur lors du chargement des camions:", err);
        setError(err instanceof Error ? err.message : "Failed to load trucks");
      } finally {
        setLoading(false);
      }
    };

    fetchTrucks();
  }, [fetchDrivers]);

  // Fetch GPS data for a truck
  const fetchGpsRecord = async (truckNo: string) => {
    try {
      const res = await fetch("/api/gps", { cache: "no-store" });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      const value = Array.isArray(data?.value) ? data.value : data;
      const record = value.find((r: GpsRecord) => r.TruckNo === truckNo);
      if (record) {
        record.Address = await fetchAddress(record.Latitude, record.Longitude);
        setGpsRecord(record);
      } else {
        setGpsRecord(null);
      }
      setOpenGpsDialog(true);
    } catch (err) {
      console.error("Error fetching GPS:", err);
      setError(err instanceof Error ? err.message : "Failed to fetch GPS data");
    }
  };

  // Handle edit
  const handleEdit = (truck: Truck) => {
    setSelectedTruck(truck);
    setOpenEditDialog(true);
  };

  // Handle delete
  const handleDelete = async (no: string) => {
    if (!confirm("Êtes-vous sûr de vouloir supprimer ce camion ?")) return;

    try {
      const truckToDelete = trucks?.find(t => t.No === no);
      if (!truckToDelete?.No) throw new Error("No not found for deletion");

      const response = await fetch(`/api/listeCamions?No=${encodeURIComponent(truckToDelete.No)}`, {
        method: "DELETE",
      });

      if (!response.ok) throw new Error("Erreur lors de la suppression du camion");

      setTrucks((prev) => prev?.filter(t => t.No !== truckToDelete.No) || null);
    } catch (err) {
      console.error("Erreur lors de la suppression:", err);
      alert("Erreur lors de la suppression du camion");
    }
  };

  // Handle bulk delete
  const handleBulkDelete = async () => {
    if (!confirm(`Êtes-vous sûr de vouloir supprimer ${selectedRows.length} camions ?`)) return;

    try {
      for (const no of selectedRows) {
        const response = await fetch(`/api/listeCamions?No=${encodeURIComponent(no)}`, {
          method: "DELETE",
        });
        if (!response.ok) throw new Error(`Erreur lors de la suppression du camion ${no}`);
      }
      setTrucks((prev) => prev?.filter(t => !selectedRows.includes(t.No)) || null);
      setSelectedRows([]);
    } catch (err) {
      console.error("Erreur lors de la suppression en masse:", err);
      alert("Erreur lors de la suppression des camions");
    }
  };

  // Handle bulk status update
  const handleBulkStatusUpdate = async (status: string) => {
    try {
      for (const no of selectedRows) {
        const truck = trucks?.find(t => t.No === no);
        if (!truck) continue;

        const response = await fetch(`/api/listeCamions?No=${encodeURIComponent(no)}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ ...truck, Status: status }),
        });

        if (!response.ok) throw new Error(`Erreur lors de la mise à jour du camion ${no}`);
      }
      setTrucks((prev) =>
        prev?.map(t => (selectedRows.includes(t.No) ? { ...t, Status: status } : t)) || null
      );
      setSelectedRows([]);
    } catch (err) {
      console.error("Erreur lors de la mise à jour en masse:", err);
      alert("Erreur lors de la mise à jour des camions");
    }
  };

  // Handle save edit
  const handleSaveEdit = async () => {
    if (!selectedTruck) return;

    try {
      if (!selectedTruck.No) throw new Error("No not found for update");

      const response = await fetch(`/api/listeCamions?No=${encodeURIComponent(selectedTruck.No)}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(selectedTruck),
      });

      if (!response.ok) throw new Error("Erreur lors de la mise à jour du camion");

      setTrucks((prev) =>
        prev?.map(t => (t.No === selectedTruck.No ? selectedTruck : t)) || null
      );
      setOpenEditDialog(false);
      setSelectedTruck(null);
    } catch (err) {
      console.error("Erreur lors de la mise à jour:", err);
      alert("Erreur lors de la mise à jour du camion");
    }
  };

  // Handle add truck
  const handleAddTruck = async () => {
    if (!newTruck.Description || !newTruck.Make || !newTruck.Model || !newTruck.License_Plate) {
      alert("Veuillez remplir tous les champs obligatoires");
      return;
    }

    try {
      const response = await fetch("/api/listeCamions", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(newTruck),
      });

      if (!response.ok) throw new Error("Erreur lors de l'ajout du camion");

      const addedTruck = await response.json();
      setTrucks((prev) => [...(prev || []), addedTruck]);
      setOpenAddDialog(false);
      setNewTruck({
        No: "",
        Description: "",
        Make: "",
        Model: "",
        Year: "",
        License_Plate: "",
        Status: "",
        Resource_No: "",
        "@odata.etag": "",
      });
    } catch (err) {
      console.error("Erreur lors de l'ajout:", err);
      alert("Erreur lors de l'ajout du camion");
    }
  };

  // Export to CSV
  const exportToCSV = () => {
    const headers = [
      "No",
      "Description",
      "Marque",
      "Modèle",
      "Année",
      "Plaque d’immatriculation",
      "Statut",
      "Chauffeur",
    ];
    const rows = filteredAndSortedTrucks.map(truck => [
      truck.No,
      truck.Description,
      truck.Make,
      truck.Model,
      truck.Year,
      truck.License_Plate,
      truck.Status,
      truck.Resource_No,
    ].map(field => `"${String(field).replace(/"/g, '""')}"`));

    const csvContent = [headers.join(","), ...rows.map(row => row.join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `trucks_${new Date().toISOString().split("T")[0]}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  };

  // Export to PDF
  const exportToPDF = () => {
    const doc = new jsPDF();
    doc.text("Truck Management Report", 20, 20);
    doc.text(`Generated on: ${new Date().toLocaleString()}`, 20, 30);

    const tableColumn = [
      "No",
      "Description",
      "Marque",
      "Modèle",
      "Année",
      "Plaque d’immatriculation",
      "Statut",
      "Chauffeur",
    ];
    const tableRows = filteredAndSortedTrucks.map(truck => [
      truck.No,
      truck.Description,
      truck.Make,
      truck.Model,
      truck.Year,
      truck.License_Plate,
      truck.Status,
      truck.Resource_No,
    ]);

    (doc as any).autoTable({
      head: [tableColumn],
      body: tableRows,
      startY: 40,
      theme: "striped",
      headStyles: { fillColor: [59, 130, 246] },
    });

    doc.save(`trucks_report_${new Date().toISOString().split("T")[0]}.pdf`);
  };

  // Filtering and sorting logic
  const filteredAndSortedTrucks = useMemo(() => {
    if (!trucks) return [];

    let result = [...trucks];

    // Search
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      result = result.filter(truck =>
        truck.Description.toLowerCase().includes(query) ||
        truck.Make.toLowerCase().includes(query) ||
        truck.Model.toLowerCase().includes(query) ||
        truck.License_Plate.toLowerCase().includes(query)
      );
    }

    // Status filter
    if (statusFilter !== "All") {
      result = result.filter(truck => truck.Status === statusFilter);
    }

    return result;
  }, [trucks, searchQuery, statusFilter]);

  // Pagination
  const totalPages = Math.ceil(filteredAndSortedTrucks.length / recordsPerPage);
  const paginatedTrucks = filteredAndSortedTrucks.slice(
    (currentPage - 1) * recordsPerPage,
    currentPage * recordsPerPage
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen bg-gray-100">
        <div className="text-center">
          <FontAwesomeIcon icon={faSpinner} className="animate-spin h-12 w-12 text-blue-600 mb-4" />
          <p className="text-lg font-semibold text-gray-700">Chargement des camions...</p>
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
            <p className="font-medium text-red-700 mb-2">Erreur: {error}</p>
            <button
              onClick={() => window.location.reload()}
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
          <FontAwesomeIcon icon={faTruck} className="mr-3 text-blue-600" /> Gestion des Camions
        </h1>
        <div className="flex space-x-4 mt-4 sm:mt-0">
          <button
            onClick={() => setOpenAddDialog(true)}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Ajouter un Camion
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
          >
            <FontAwesomeIcon icon={faDownload} className="mr-2" /> Exporter CSV
          </button>
          <button
            onClick={exportToPDF}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <FontAwesomeIcon icon={faFilePdf} className="mr-2" /> Exporter PDF
          </button>
        </div>
      </div>

      {/* Search and Filter */}
      <div className="mb-6 bg-white p-4 rounded-lg shadow">
        <div className="flex flex-col sm:flex-row items-center gap-4">
          <div className="flex-1">
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Rechercher par Description, Marque, Modèle ou Plaque
            </label>
            <div className="relative">
              <FontAwesomeIcon
                icon={faSearch}
                className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400"
              />
              <input
                type="text"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Rechercher..."
                className="w-full pl-10 pr-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Statut</label>
            <select
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              <option value="All">Tous</option>
              <option value="Active">Actif</option>
              <option value="Inactive">Inactif</option>
            </select>
          </div>
        </div>
      </div>

      {/* Bulk Actions */}
      {selectedRows.length > 0 && (
        <div className="mb-6 bg-white p-4 rounded-lg shadow flex items-center gap-4">
          <p className="text-sm font-medium text-gray-700">
            {selectedRows.length} camions sélectionnés
          </p>
          <button
            onClick={handleBulkDelete}
            className="flex items-center px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
          >
            <FontAwesomeIcon icon={faTrash} className="mr-2" /> Supprimer
          </button>
          <button
            onClick={() => handleBulkStatusUpdate("Active")}
            className="flex items-center px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
          >
            Marquer Actif
          </button>
          <button
            onClick={() => handleBulkStatusUpdate("Inactive")}
            className="flex items-center px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700"
          >
            Marquer Inactif
          </button>
        </div>
      )}

      {/* DataGrid or Cards */}
      <div className="bg-white shadow-lg rounded-lg overflow-hidden">
        <DataGrid
          dataSource={paginatedTrucks}
          keyExpr="No"
          columnAutoWidth={true}
          rowAlternationEnabled={true}
          showBorders={false}
          selection={{ mode: "multiple", showCheckBoxesMode: "always" }}
          onSelectionChanged={(e) => setSelectedRows(e.selectedRowKeys)}
          className="custom-datagrid transition-all duration-500"
          onContentReady={(e) => e.component.updateDimensions()}
        >
          {columns.map((col, index) => (
            <Column
              key={index}
              dataField={col.dataField}
              caption={col.caption}
              cellRender={(data) => (
                <span
                  className={
                    col.dataField === "Status"
                      ? data.value === "Active"
                        ? "text-green-600 font-semibold"
                        : "text-red-600 font-semibold"
                      : ""
                  }
                >
                  {data.value}
                </span>
              )}
            />
          ))}
          <Column
            caption="Actions"
            cellRender={(data) => (
              <div className="flex gap-2">
                <button
                  onClick={() => handleEdit(data.data)}
                  className="px-3 py-1 bg-blue-600 text-white rounded-md hover:bg-blue-700"
                >
                  <FontAwesomeIcon icon={faEdit} />
                </button>
                <button
                  onClick={() => handleDelete(data.data.No)}
                  className="px-3 py-1 bg-red-600 text-white rounded-md hover:bg-red-700"
                >
                  <FontAwesomeIcon icon={faTrash} />
                </button>
                <button
                  onClick={() => fetchGpsRecord(data.data.No)}
                  className="px-3 py-1 bg-green-600 text-white rounded-md hover:bg-green-700"
                >
                  <FontAwesomeIcon icon={faInfoCircle} />
                </button>
              </div>
            )}
          />
        </DataGrid>
      </div>

      {/* Pagination */}
      {totalPages > 1 && (
        <div className="mt-6 flex items-center justify-between">
          <div className="text-sm text-gray-600">
            Affichage de {(currentPage - 1) * recordsPerPage + 1} à{" "}
            {Math.min(currentPage * recordsPerPage, filteredAndSortedTrucks.length)} sur{" "}
            {filteredAndSortedTrucks.length} camions
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

      {/* Edit Dialog */}
      {openEditDialog && selectedTruck && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Modifier Camion</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">No</label>
                <input
                  value={selectedTruck.No}
                  disabled
                  className="w-full px-3 py-2 border border-gray-300 rounded-md bg-gray-100"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input
                  value={selectedTruck.Description}
                  onChange={(e) =>
                    setSelectedTruck({ ...selectedTruck, Description: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Marque</label>
                <input
                  value={selectedTruck.Make}
                  onChange={(e) => setSelectedTruck({ ...selectedTruck, Make: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Modèle</label>
                <input
                  value={selectedTruck.Model}
                  onChange={(e) => setSelectedTruck({ ...selectedTruck, Model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Année</label>
                <input
                  value={selectedTruck.Year}
                  onChange={(e) => setSelectedTruck({ ...selectedTruck, Year: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Plaque d’immatriculation</label>
                <input
                  value={selectedTruck.License_Plate}
                  onChange={(e) =>
                    setSelectedTruck({ ...selectedTruck, License_Plate: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Statut</label>
                <select
                  value={selectedTruck.Status}
                  onChange={(e) => setSelectedTruck({ ...selectedTruck, Status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Active">Actif</option>
                  <option value="Inactive">Inactif</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Chauffeur</label>
                <select
                  value={selectedTruck.Resource_No}
                  onChange={(e) =>
                    setSelectedTruck({ ...selectedTruck, Resource_No: e.target.value })
                  }
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Aucun</option>
                  {drivers.map(driver => (
                    <option key={driver.No} value={driver.No}>
                      {driver.Name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-4">
              <button
                onClick={() => setOpenEditDialog(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Annuler
              </button>
              <button
                onClick={handleSaveEdit}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Sauvegarder
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add Dialog */}
      {openAddDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Ajouter Camion</h2>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700">Description</label>
                <input
                  value={newTruck.Description}
                  onChange={(e) => setNewTruck({ ...newTruck, Description: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Marque</label>
                <input
                  value={newTruck.Make}
                  onChange={(e) => setNewTruck({ ...newTruck, Make: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Modèle</label>
                <input
                  value={newTruck.Model}
                  onChange={(e) => setNewTruck({ ...newTruck, Model: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Année</label>
                <input
                  value={newTruck.Year}
                  onChange={(e) => setNewTruck({ ...newTruck, Year: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Plaque d’immatriculation</label>
                <input
                  value={newTruck.License_Plate}
                  onChange={(e) => setNewTruck({ ...newTruck, License_Plate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Statut</label>
                <select
                  value={newTruck.Status}
                  onChange={(e) => setNewTruck({ ...newTruck, Status: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="Active">Actif</option>
                  <option value="Inactive">Inactif</option>
                </select>
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700">Chauffeur</label>
                <select
                  value={newTruck.Resource_No}
                  onChange={(e) => setNewTruck({ ...newTruck, Resource_No: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-md focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  <option value="">Aucun</option>
                  {drivers.map(driver => (
                    <option key={driver.No} value={driver.No}>
                      {driver.Name}
                    </option>
                  ))}
                </select>
              </div>
            </div>
            <div className="mt-6 flex justify-end gap-4">
              <button
                onClick={() => setOpenAddDialog(false)}
                className="px-4 py-2 bg-gray-200 text-gray-700 rounded-lg hover:bg-gray-300"
              >
                Annuler
              </button>
              <button
                onClick={handleAddTruck}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Ajouter
              </button>
            </div>
          </div>
        </div>
      )}

      {/* GPS Dialog */}
      {openGpsDialog && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4">
          <div className="bg-white rounded-lg max-w-lg w-full p-6 animate-fade-in-up">
            <h2 className="text-2xl font-bold text-gray-900 mb-4">Détails GPS</h2>
            {gpsRecord ? (
              <div className="space-y-3">
                <p><strong>Camion:</strong> {gpsRecord.TruckNo}</p>
                <p><strong>Latitude:</strong> {gpsRecord.Latitude.toFixed(5)}</p>
                <p><strong>Longitude:</strong> {gpsRecord.Longitude.toFixed(5)}</p>
                <p><strong>Adresse:</strong> {gpsRecord.Address || "Chargement..."}</p>
                <p><strong>Vitesse:</strong> {gpsRecord.Speed.toFixed(1)} km/h</p>
                <p><strong>Dernière mise à jour:</strong> {new Date(gpsRecord.LastUpdate).toLocaleString()}</p>
              </div>
            ) : (
              <p className="text-gray-600">Aucune donnée GPS disponible pour ce camion.</p>
            )}
            <div className="mt-6 flex justify-end">
              <button
                onClick={() => setOpenGpsDialog(false)}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
              >
                Fermer
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default Trucks;
