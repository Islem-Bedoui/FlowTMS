import { NextApiRequest, NextApiResponse } from "next";
import { NextResponse } from "next/server";
import {getValidAccessToken} from "../../functions/token";
import { getMockSalesOrders, isBcMockEnabled } from "../_mock/bc";

// API Route Handler
export async function GET(req: NextApiRequest, res: NextApiResponse) {
  if (isBcMockEnabled()) {
    const value = getMockSalesOrders();
    return NextResponse.json({ value });
  }

  // Return all fields - multiple pages need different subsets
  const baseUrl =
    "https://api.businesscentral.dynamics.com/v2.0/38681c7b-907c-49c7-9777-d0e3fabfd826/SandBox/ODataV4/Company('CRONUS%20FR')/salesorders";

  const selectFieldsFull = [
    "No",
    "Document_Type",
    "Sell_to_Customer_No",
    "Sell_to_Customer_Name",
    "Sell_to_Address",
    "Sell_to_Address_2",
    "Sell_to_City",
    "Sell_to_Post_Code",
    "Ship_to_Address",
    "Ship_to_City",
    "Requested_Delivery_Date",
    "PromisedDeliveryHours",
    "Shipment_Date",
    "Sell_to_Contact",
    "CompletelyShipped",
    "status",
    "Assigned_Driver_No",
    "assignedTruckNo",
  ];

  const selectFieldsSafe = [
    "No",
    "Document_Type",
    "Sell_to_Customer_No",
    "Sell_to_Customer_Name",
    "Sell_to_Address",
    "Sell_to_Address_2",
    "Sell_to_City",
    "Sell_to_Post_Code",
    "Ship_to_Address",
    "Ship_to_City",
    "Requested_Delivery_Date",
    "Shipment_Date",
    "Sell_to_Contact",
    "CompletelyShipped",
    "Assigned_Driver_No",
  ];

  const buildUrl = (fields?: string[]) => {
    if (!fields || fields.length === 0) return baseUrl;
    return `${baseUrl}?$select=${encodeURIComponent(fields.join(","))}`;
  };

  const accessToken = await getValidAccessToken();
  try {
    //await getValidAccessToken(); // Ensure we have a valid token

    const options = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    };

    const tryFetch = async (url: string) => {
      console.log("Making request to:", url);
      const response = await fetch(url, options);
      console.log("Response status:", response.status);

      const text = await response.text();
      if (!response.ok) {
        console.error("Error response body:", text);
        return { ok: false as const, status: response.status, text };
      }

      try {
        const data = text ? JSON.parse(text) : {};
        return { ok: true as const, status: response.status, data };
      } catch {
        console.error("Non-JSON response body:", text);
        return { ok: false as const, status: response.status, text: text || "(non-json/empty response)" };
      }
    };

    const extractMissingProperty = (bodyText: string): string | null => {
      try {
        const j = JSON.parse(bodyText);
        const msg = String(j?.error?.message || "");
        const m = msg.match(/Could not find a property named '([^']+)'/);
        return m?.[1] || null;
      } catch {
        const m = String(bodyText || "").match(/Could not find a property named '([^']+)'/);
        return m?.[1] || null;
      }
    };

    let fields = [...selectFieldsFull];
    let data: any = null;
    for (let attempt = 0; attempt < 10; attempt++) {
      const r = await tryFetch(buildUrl(fields));
      if (r.ok) {
        data = r.data;
        break;
      }

      if (r.status !== 400) {
        throw new Error(`Error: ${r.status} - ${r.text}`);
      }

      const missing = extractMissingProperty(r.text);
      if (missing) {
        const next = fields.filter((f) => f !== missing);
        if (next.length === fields.length) {
          break;
        }
        fields = next;
        continue;
      }

      break;
    }

    if (!data) {
      const r2 = await tryFetch(buildUrl(selectFieldsSafe));
      if (r2.ok) data = r2.data;
    }
    if (!data) {
      const r3 = await tryFetch(buildUrl(undefined));
      if (!r3.ok) throw new Error(`Error: ${r3.status} - ${r3.text}`);
      data = r3.data;
    }

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