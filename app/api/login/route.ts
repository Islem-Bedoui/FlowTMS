import { NextApiRequest, NextApiResponse } from "next";
import { NextResponse } from "next/server";
import { getValidAccessToken } from "../../functions/token";

// API Route Handler
export async function GET(req: NextApiRequest, res: NextApiResponse) {
  const apiUrl =
    "https://api.businesscentral.dynamics.com/v2.0/38681c7b-907c-49c7-9777-d0e3fabfd826/SandBox/ODataV4/Company(%27CRONUS%20FR%27)/resapi";
  const accessToken = await getValidAccessToken();
  try {
    const options = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    };

    console.log("Making request to:", apiUrl);
    const response = await fetch(apiUrl, options);
    console.log("Response status:", response.status);

    if (!response.ok) {
      const errorBody = await response.text();
      console.error("Error response body:", errorBody);
      throw new Error(`Error: ${response.status} - ${errorBody}`);
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