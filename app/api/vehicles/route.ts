import { NextResponse } from 'next/server';

// Données factices pour les véhicules en Europe
const europeanCities = [
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { name: 'Berlin', lat: 52.5200, lng: 13.4050 },
  { name: 'Madrid', lat: 40.4168, lng: -3.7038 },
  { name: 'Rome', lat: 41.9028, lng: 12.4964 },
  { name: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
  { name: 'Vienne', lat: 48.2082, lng: 16.3738 },
  { name: 'Prague', lat: 50.0755, lng: 14.4378 },
  { name: 'Bruxelles', lat: 50.8503, lng: 4.3517 }
];

const truckBrands = ['Volvo', 'Mercedes', 'MAN', 'Scania', 'DAF', 'Iveco', 'Renault', 'DAF'];
const truckModels = ['FH16', 'Actros', 'TGX', 'R-Series', 'XF', 'S-Way', 'T-Range', 'CF'];

// Générer des camions factices avec des positions en Europe
function generateMockVehicles() {
  return europeanCities.map((city, index) => {
    const brand = truckBrands[index % truckBrands.length];
    const model = truckModels[index % truckModels.length];
    const randomOffset = () => (Math.random() * 0.5 - 0.25); // ±0.25 degrés de décalage
    
    return {
      vehicle_id: `TRK-${1000 + index}`,
      service_name: `${brand} ${model}`,
      destination: europeanCities[(index + 3) % europeanCities.length].name,
      speed: 60 + Math.floor(Math.random() * 40), // Vitesse entre 60 et 100 km/h
      lat: city.lat + randomOffset(),
      lng: city.lng + randomOffset(),
      last_gps_fix: Math.floor(Date.now() / 1000) - Math.floor(Math.random() * 60)
    };
  });
}

// Générer les véhicules initiaux
let mockVehicles = generateMockVehicles();

export async function GET() {
  try {
    // Générer de nouvelles positions aléatoires à chaque appel
    mockVehicles = generateMockVehicles();
    
    // Simuler un délai de chargement réaliste
    await new Promise(resolve => setTimeout(resolve, 300));
    
    return NextResponse.json(mockVehicles);
  } catch (error) {
    console.error('Error fetching vehicles:', error);
    return NextResponse.json(
      { error: 'Erreur lors de la récupération des véhicules' },
      { status: 500 }
    );
  }
}
