import { NextResponse } from 'next/server';

// Véhicules fixes avec positions stables
const mockVehicles = [
  {
    vehicle_id: 'TRK-1000',
    service_name: 'Volvo FH16',
    destination: 'Rome',
    speed: 110,
    lat: 48.7571,
    lng: 2.1776,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: 'AB-123-CD',
  },
  {
    vehicle_id: 'TRK-1001',
    service_name: 'Mercedes Actros',
    destination: 'Amsterdam',
    speed: 110,
    lat: 52.3824,
    lng: 13.5420,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: 'EF-456-GH',
  },
  {
    vehicle_id: 'TRK-1002',
    service_name: 'MAN TGX',
    destination: 'Vienne',
    speed: 110,
    lat: 40.6025,
    lng: -3.8336,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: 'IJ-789-KL',
  },
  {
    vehicle_id: 'TRK-1003',
    service_name: 'Scania R-Series',
    destination: 'Prague',
    speed: 110,
    lat: 41.9550,
    lng: 12.5612,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: 'MN-012-OP',
  },
  {
    vehicle_id: 'TRK-1004',
    service_name: 'DAF XF',
    destination: 'Bruxelles',
    speed: 110,
    lat: 52.3676,
    lng: 4.9041,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: 'QR-345-ST',
  },
  {
    vehicle_id: 'TRK-1005',
    service_name: 'Iveco S-Way',
    destination: 'Paris',
    speed: 110,
    lat: 48.0181,
    lng: 16.3025,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: 'UV-678-WX',
  },
  {
    vehicle_id: 'TRK-1006',
    service_name: 'Renault T-Range',
    destination: 'Berlin',
    speed: 110,
    lat: 49.8635,
    lng: 14.3190,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: 'YZ-901-AB',
  },
  {
    vehicle_id: 'TRK-1007',
    service_name: 'DAF CF',
    destination: 'Madrid',
    speed: 110,
    lat: 50.7680,
    lng: 4.3256,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: 'CD-234-EF',
  },
];

export async function GET() {
  try {
    // Simuler un délai de chargement réaliste
    await new Promise(resolve => setTimeout(resolve, 300));

    // Mettre à jour le timestamp GPS à chaque appel
    const vehicles = mockVehicles.map(v => ({
      ...v,
      last_gps_fix: Math.floor(Date.now() / 1000),
    }));

    return NextResponse.json(vehicles);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des véhicules' },
      { status: 500 }
    );
  }
}
