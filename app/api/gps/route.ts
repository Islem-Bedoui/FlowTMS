import { NextResponse } from "next/server";
import { getValidAccessToken } from "../../functions/token";

// API Route Handler for /api/repair (App Router style)
export async function GET(req: Request) {
  const apiUrl =
    "https://api.businesscentral.dynamics.com/v2.0/38681c7b-907c-49c7-9777-d0e3fabfd826/SandBox/api/Almakom/Almakom/v2.0/companies(ac7c4fa6-194e-ef11-bfe7-6045bdc8d3a7)/TruckGPS";

  try {
    const accessToken = await getValidAccessToken();

    const options: RequestInit = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store", // always fetch fresh data
    };

    console.log("Making request to:", apiUrl);
    const response = await fetch(apiUrl, options);
    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error response body:", errorBody);
      return NextResponse.json(
        { message: `Upstream error ${response.status}: ${errorBody}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    console.log("Received data:", data);

    return NextResponse.json(data);
  } catch (error: any) {
    console.error("Error occurred:", error.message);
    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
