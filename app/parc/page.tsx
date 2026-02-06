"use client";
import Link from "next/link";

export default function ParcOverview() {
  return (
    <div className="space-y-6">
      <h1 className="text-2xl font-bold">Parc Automobile</h1>
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        <Link href="/parc/vehicules" className="block bg-white rounded-lg shadow p-4 hover:shadow-md">
          <div className="text-lg font-semibold">Fiches Véhicules</div>
          <div className="text-sm text-gray-600">Détails complets des véhicules</div>
        </Link>
        <Link href="/parc/assurance" className="block bg-white rounded-lg shadow p-4 hover:shadow-md">
          <div className="text-lg font-semibold">Assurance & Documents</div>
          <div className="text-sm text-gray-600">Assurances, documents, dates limites</div>
        </Link>
        <Link href="/parc/planning" className="block bg-white rounded-lg shadow p-4 hover:shadow-md">
          <div className="text-lg font-semibold">Planning d’affectation</div>
          <div className="text-sm text-gray-600">Affectation des véhicules</div>
        </Link>
        <Link href="/parc/kilometrage" className="block bg-white rounded-lg shadow p-4 hover:shadow-md">
          <div className="text-lg font-semibold">Kilométrage & Historique</div>
          <div className="text-sm text-gray-600">Suivi du kilométrage</div>
        </Link>
        <Link href="/parc/maintenance" className="block bg-white rounded-lg shadow p-4 hover:shadow-md">
          <div className="text-lg font-semibold">Maintenance</div>
          <div className="text-sm text-gray-600">Entretien et interventions</div>
        </Link>
      </div>
    </div>
  );
}
