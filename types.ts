// Types partagés pour le Parc Automobile
export interface Vehicle {
  vehicle_id: string;
  service_name?: string;
  plate_number?: string;
  make?: string;
  model?: string;
  year?: number;
  vin?: string;
  destination?: string;
  speed?: number; // km/h
  lat: number;
  lng: number;
  last_gps_fix: number; // epoch seconds
}

export interface DocumentInfo {
  id: string;
  vehicle_id: string;
  type: 'carte_grise' | 'assurance' | 'vignette' | 'controle_technique' | 'autre';
  name: string;
  number?: string;
  issue_date?: string; // ISO date
  expiry_date?: string; // ISO date
  file_url?: string;
}

export interface InsurancePolicy {
  id: string;
  vehicle_id: string;
  provider: string;
  policy_number: string;
  start_date: string; // ISO date
  end_date: string;   // ISO date
  coverage: 'tiers' | 'tous_risques' | 'intermediaire';
  status: 'active' | 'expiring_soon' | 'expired';
}

export interface Assignment {
  id: string;
  vehicle_id: string;
  assignee_type: 'driver' | 'mission' | 'client';
  assignee_id: string;
  title: string;
  start: string; // ISO datetime
  end: string;   // ISO datetime
  location?: string;
  notes?: string;
}

export interface MileageRecord {
  id: string;
  vehicle_id: string;
  date: string; // ISO date
  odometer_km: number;
  delta_km?: number;
  source?: 'manual' | 'iot' | 'import';
}

export interface MaintenanceRecord {
  id: string;
  vehicle_id: string;
  type: 'revision' | 'vidange' | 'pneus' | 'freins' | 'diagnostic' | 'reparation' | 'autre';
  title: string;
  date: string; // ISO date
  status: 'planned' | 'in_progress' | 'done';
  cost_eur?: number;
  mileage_km?: number;
  notes?: string;
}
