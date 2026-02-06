"use client";
import { useEffect, useState } from "react";
import Link from "next/link";
import { Vehicle } from "@/types";

export default function VehiculesList() {
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/fleet/vehicles");
        const data = await res.json();
        setVehicles(data);
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  return (
    <div className="bg-white rounded-lg shadow p-4">
      <h2 className="text-xl font-semibold mb-4">Véhicules ({vehicles.length})</h2>
      {loading ? (
        <div>Chargement…</div>
      ) : (
        <div className="overflow-x-auto">
          <table className="min-w-full divide-y divide-gray-200">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">ID</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plaque</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Modèle</th>
                <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Dernière MAJ</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {vehicles.map(v => (
                <tr key={v.vehicle_id} className="hover:bg-gray-50">
                  <td className="px-4 py-2 text-blue-600">
                    <Link href={`/parc/vehicules/${v.vehicle_id}`}>{v.vehicle_id}</Link>
                  </td>
                  <td className="px-4 py-2">{v.plate_number ?? "-"}</td>
                  <td className="px-4 py-2">{v.service_name ?? `${v.make ?? ""} ${v.model ?? ""}`}</td>
                  <td className="px-4 py-2">{new Date(v.last_gps_fix * 1000).toLocaleTimeString()}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
