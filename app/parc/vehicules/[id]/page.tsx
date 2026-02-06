"use client";
import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { Vehicle, InsurancePolicy, DocumentInfo, MaintenanceRecord, MileageRecord } from "@/types";

export default function FicheVehicule() {
  const params = useParams();
  const id = params?.id as string;
  const [vehicle, setVehicle] = useState<Vehicle | null>(null);
  const [insurance, setInsurance] = useState<InsurancePolicy[]>([]);
  const [documents, setDocuments] = useState<DocumentInfo[]>([]);
  const [maintenance, setMaintenance] = useState<MaintenanceRecord[]>([]);
  const [mileage, setMileage] = useState<MileageRecord[]>([]);

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      const [vs, ins, docs, maint, kms] = await Promise.all([
        fetch("/api/fleet/vehicles").then(r=>r.json()),
        fetch("/api/fleet/insurances?id="+id).then(r=>r.json()),
        fetch("/api/fleet/documents?id="+id).then(r=>r.json()),
        fetch("/api/fleet/maintenance?id="+id).then(r=>r.json()),
        fetch("/api/fleet/mileage?id="+id).then(r=>r.json()),
      ]);
      setVehicle((vs as Vehicle[]).find(v=>v.vehicle_id===id) ?? null);
      setInsurance(ins);
      setDocuments(docs);
      setMaintenance(maint);
      setMileage(kms);
    };
    load();
  }, [id]);

  if (!vehicle) return <div className="bg-white rounded-lg shadow p-4">Chargement de la fiche…</div>;

  return (
    <div className="space-y-6">
      <div className="bg-white rounded-lg shadow p-4">
        <h2 className="text-xl font-semibold mb-2">{vehicle.service_name ?? vehicle.vehicle_id}</h2>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2 text-sm text-gray-700">
          <div><span className="font-medium">ID:</span> {vehicle.vehicle_id}</div>
          <div><span className="font-medium">Plaque:</span> {vehicle.plate_number ?? '-'}</div>
          <div><span className="font-medium">Modèle:</span> {vehicle.make ?? ''} {vehicle.model ?? ''}</div>
          <div><span className="font-medium">Vitesse:</span> {Math.round(vehicle.speed ?? 0)} km/h</div>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <section className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Assurance</h3>
          <ul className="space-y-2 text-sm">
            {insurance.map(p => (
              <li key={p.id} className="border rounded p-2 flex justify-between">
                <div>
                  <div className="font-medium">{p.provider} - {p.policy_number}</div>
                  <div className="text-gray-600">{p.coverage} • {p.start_date} → {p.end_date}</div>
                </div>
                <span className={`text-xs px-2 py-1 rounded ${p.status==='expired'?'bg-red-100 text-red-700':p.status==='expiring_soon'?'bg-amber-100 text-amber-700':'bg-green-100 text-green-700'}`}>{p.status}</span>
              </li>
            ))}
            {insurance.length===0 && <li className="text-gray-500">Aucune police</li>}
          </ul>
        </section>

        <section className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Documents</h3>
          <ul className="space-y-2 text-sm">
            {documents.map(d => (
              <li key={d.id} className="border rounded p-2">
                <div className="font-medium">{d.name}</div>
                <div className="text-gray-600">{d.type} • {d.number ?? ''} • {d.issue_date} → {d.expiry_date}</div>
              </li>
            ))}
            {documents.length===0 && <li className="text-gray-500">Aucun document</li>}
          </ul>
        </section>

        <section className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Maintenance</h3>
          <ul className="space-y-2 text-sm">
            {maintenance.map(m => (
              <li key={m.id} className="border rounded p-2 flex justify-between">
                <div>
                  <div className="font-medium">{m.title}</div>
                  <div className="text-gray-600">{m.type} • {m.date} • {m.mileage_km ?? '-'} km</div>
                </div>
                <span className="text-xs bg-gray-100 px-2 py-1 rounded">{m.status}</span>
              </li>
            ))}
            {maintenance.length===0 && <li className="text-gray-500">Aucune intervention</li>}
          </ul>
        </section>

        <section className="bg-white rounded-lg shadow p-4">
          <h3 className="font-semibold mb-2">Kilométrage</h3>
          <ul className="space-y-2 text-sm">
            {mileage.map(k => (
              <li key={k.id} className="border rounded p-2 flex justify-between">
                <div>{k.date}</div>
                <div className="font-medium">{k.odometer_km} km</div>
              </li>
            ))}
            {mileage.length===0 && <li className="text-gray-500">Aucune donnée</li>}
          </ul>
        </section>
      </div>
    </div>
  );
}
