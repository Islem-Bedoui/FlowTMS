
import { NextResponse } from 'next/server';

type BusLocation = {
  lat: number;
  lng: number;
  line: string;
  destination: string;
};

export async function GET() {
  try {
    // Simulate bus location data
    const busLocation: BusLocation = {
      lat: 46.5197 + Math.random() * 0.01,
      lng: 6.6323 + Math.random() * 0.01,
      line: 'Bus 21',
      destination: 'Lausanne Gare',
    };
    
    return NextResponse.json(busLocation, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Content-Type': 'application/json',
      },
    });
  } catch (error) {
    console.error('Error fetching bus location:', error);
    return NextResponse.json(
      { error: 'Failed to fetch bus location' },
      { status: 500 }
    );
  }
}

// Handle CORS preflight
export async function OPTIONS() {
  return new Response(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}







