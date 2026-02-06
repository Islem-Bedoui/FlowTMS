import { NextResponse } from 'next/server';
import {getValidAccessToken} from "../../functions/token";

// Définition du type pour les données de suivi de carburant
type FuelEntry = {
  EntryNo: string;
  TruckNo: string;
  Date: string;
  FuelType: string;
  Liters: number;
  Odometer: number;
  LastOdometer: number;
};

// API Route Handler
export async function GET() {
  const apiUrl =
    "https://api.businesscentral.dynamics.com/v2.0/38681c7b-907c-49c7-9777-d0e3fabfd826/SandBox/api/Almakom/Almakom/v2.0/companies(ac7c4fa6-194e-ef11-bfe7-6045bdc8d3a7)/Fuel";
  
  try {
    const accessToken = await getValidAccessToken();
    
    const options = {
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${accessToken}`,
      },
      next: { revalidate: 60 } // Cache les données pendant 60 secondes
    };

    console.log("Making request to:", apiUrl);
    const response = await fetch(apiUrl, options);
    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error response body:", errorBody);
      return NextResponse.json(
        { message: `Error: ${response.status} - ${errorBody}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Received data:", data);

    // Retourner les données en s'assurant qu'elles correspondent au type attendu
    return NextResponse.json({
      success: true,
      data: data.value || data // S'adapte selon la structure de la réponse
    });
  } catch (error: any) {
    console.error("Error occurred:", error.message);
    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}

// Ajout de la méthode OPTIONS pour gérer les requêtes CORS
export async function OPTIONS() {
  return new NextResponse(null, {
    status: 204,
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    },
  });
}
