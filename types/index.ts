export interface Vehicle {
  vehicle_id: string;
  service_name: string;
  destination?: string;
  speed?: number;
  lat: number;
  lng: number;
  last_gps_fix: number;
  plate_number?: string;
}
