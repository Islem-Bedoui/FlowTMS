import { NextResponse } from 'next/server';

// Véhicules fixes correspondant exactement à la liste BC (TruckTrans)
const mockVehicles = [
  {
    vehicle_id: 'TR001',
    service_name: 'Camion de livraison',
    make: 'Ford',
    model: 'Transit',
    year: 2019,
    destination: 'Paris',
    speed: 95,
    lat: 48.8566,
    lng: 2.3522,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: 'AB-123-CD',
    status: 'Actif',
  },
  {
    vehicle_id: 'TR002',
    service_name: 'Véhicule utilitaire',
    make: 'Renault',
    model: 'Kangoo',
    year: 2021,
    destination: 'Lyon',
    speed: 88,
    lat: 45.7640,
    lng: 4.8357,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: 'EF-456-GH',
    status: 'Actif',
  },
  {
    vehicle_id: 'TR003',
    service_name: 'Camion benne',
    make: 'Mercedes',
    model: 'Actros',
    year: 2022,
    destination: 'Marseille',
    speed: 105,
    lat: 43.2965,
    lng: 5.3698,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: 'MN-234-OP',
    status: 'Actif',
  },
  {
    vehicle_id: 'TR004',
    service_name: 'SUV',
    make: 'Nissan',
    model: 'X-Trail',
    year: 2021,
    destination: 'Toulouse',
    speed: 110,
    lat: 43.6047,
    lng: 1.4442,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: 'GH-789-IJ',
    status: 'Actif',
  },
  {
    vehicle_id: 'TR005',
    service_name: 'Camion frigorifique',
    make: 'Iveco',
    model: 'Eurocargo',
    year: 2020,
    destination: 'Bordeaux',
    speed: 92,
    lat: 44.8378,
    lng: -0.5792,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: 'XY-456-ZT',
    status: 'Actif',
  },
  {
    vehicle_id: 'TR010',
    service_name: 'Fourgon utilitaire',
    make: 'Peugeot',
    model: 'Boxer',
    year: 2020,
    destination: 'Lille',
    speed: 0,
    lat: 50.6292,
    lng: 3.0573,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: 'YY-777-BB',
    status: 'Retraité',
  },
  {
    vehicle_id: 'TR011',
    service_name: 'Camion de dépannage',
    make: 'Iveco',
    model: 'Daily',
    year: 0,
    destination: 'Nice',
    speed: 0,
    lat: 43.7102,
    lng: 7.2620,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: 'WW-321-CC',
    status: 'Retraité',
  },
  {
    vehicle_id: 'TR012',
    service_name: 'Camion de livraison',
    make: 'Iveco',
    model: '',
    year: 2020,
    destination: 'Strasbourg',
    speed: 0,
    lat: 48.5734,
    lng: 7.7521,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: '',
    status: 'En maintenance',
  },
  {
    vehicle_id: 'TR013',
    service_name: 'Camion de livraison',
    make: 'Iveco',
    model: '',
    year: 2020,
    destination: 'Nantes',
    speed: 0,
    lat: 47.2184,
    lng: -1.5536,
    last_gps_fix: Math.floor(Date.now() / 1000),
    plate_number: '',
    status: 'En maintenance',
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
