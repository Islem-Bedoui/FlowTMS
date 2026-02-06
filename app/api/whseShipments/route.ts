import { NextApiRequest, NextApiResponse } from "next";
import { NextResponse } from "next/server";
import {getValidAccessToken} from "../../functions/token";
import { getMockWhseShipments, isBcMockEnabled } from "../_mock/bc";
import { readAllWhseStatuses } from "../_mock/whseStatusStore";

// API Route Handler
export async function GET(req: NextApiRequest, res: NextApiResponse) {
  const urlStr = (req as any)?.url || "";

  const sourceNoFilter = (() => {
    try {
      if (!urlStr) return [] as string[];
      const u = new URL(urlStr, "http://localhost");
      const repeated = u.searchParams.getAll("sourceNo").map((s) => s.trim()).filter(Boolean);
      const csv = (u.searchParams.get("sourceNos") || "").split(",").map((s) => s.trim()).filter(Boolean);
      const out = [...repeated, ...csv];
      // de-dup while preserving order
      return Array.from(new Set(out));
    } catch {
      return [] as string[];
    }
  })();
  const driverNoParam = (() => {
    try {
      if (!urlStr) return "";
      const u = new URL(urlStr, "http://localhost");

      return (u.searchParams.get("driverNo") || "").trim();
    } catch {
      return "";
    }
  })();

  const normalize = (v: unknown) => String(v ?? "").trim().toLowerCase();

  if (isBcMockEnabled()) {
    const statusBy = await readAllWhseStatuses();
    let shipments: any[] = getMockWhseShipments(statusBy) as any[];

    if (driverNoParam) {
      const target = normalize(driverNoParam);
      shipments = shipments.filter((s: any) => normalize((s as any)?.Assigned_Driver_No) === target);
    }

    if (sourceNoFilter.length > 0) {
      const set = new Set(sourceNoFilter.map((s) => normalize(s)));
      shipments = shipments.filter((s: any) => set.has(normalize((s as any)?.Source_No)));
    }

    return NextResponse.json({ value: shipments });
  }

  // Return all fields - multiple pages need different subsets
  const apiBase =
    "https://api.businesscentral.dynamics.com/v2.0/38681c7b-907c-49c7-9777-d0e3fabfd826/SandBox/ODataV4/Company(%27CRONUS%20FR%27)";
  const whseShipmentsUrl = `${apiBase}/WhseShipment`;
  const salesOrdersUrl = `${apiBase}/salesorders`;
  const whseShipmentLinesUrl = `${apiBase}/WhseShipmentLine`;

  const accessToken = await getValidAccessToken();
  try {
    //await getValidAccessToken(); // Ensure we have a valid token

    const options = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    };

    const fetchJson = async (url: string) => {
      const response = await fetch(url, options);
      if (!response.ok) {
        const errorBody = await response.text();
        throw new Error(`Error: ${response.status} - ${errorBody}`);
      }
      return response.json();
    };

    console.log("Making request to:", whseShipmentsUrl);
    const data = await fetchJson(whseShipmentsUrl);
    console.log("Received data:", data);

    const shipments: any[] = Array.isArray((data as any)?.value) ? (data as any).value : [];

    const sourceNosFromHeader = new Set<string>();
    for (const s of shipments) {
      const sourceNo = typeof s?.Source_No === 'string' ? s.Source_No.trim() : '';
      if (sourceNo) {
        sourceNosFromHeader.add(sourceNo);
      }
    }

    const sourceNos = Array.from(sourceNosFromHeader);
    const salesOrderByNo: Record<string, any> = {};
    if (sourceNos.length > 0) {
      const batchSize = 10;
      for (let i = 0; i < sourceNos.length; i += batchSize) {
        const batch = sourceNos.slice(i, i + batchSize);
        const filter = batch.map(no => `No eq '${String(no).replace(/'/g, "''")}'`).join(' or ');
        const url = `${salesOrdersUrl}?$filter=${encodeURIComponent(filter)}`;
        try {
          const soData = await fetchJson(url);
          const orders: any[] = Array.isArray(soData?.value) ? soData.value : [];
          for (const o of orders) {
            if (o?.No) salesOrderByNo[o.No] = o;
          }
        } catch (e) {
          console.warn('Failed to fetch salesorders for address enrichment:', e);
        }
      }
    }

    const pickString = (obj: any, keys: string[]) => {
      for (const k of keys) {
        const v = obj?.[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      return undefined as string | undefined;
    };

    const scanStringByRegex = (obj: any, re: RegExp) => {
      if (!obj || typeof obj !== 'object') return undefined as string | undefined;
      for (const k of Object.keys(obj)) {
        if (!re.test(k)) continue;
        const v = (obj as any)[k];
        if (typeof v === 'string' && v.trim()) return v.trim();
      }
      return undefined as string | undefined;
    };

    let enriched = shipments.map((s) => {
      const shipmentNo = typeof s?.No === 'string' ? s.No : '';
      const headerSource = typeof s?.Source_No === 'string' ? s.Source_No.trim() : '';
      const effectiveSource = headerSource;
      const so = effectiveSource ? salesOrderByNo[effectiveSource] : undefined;
      if (!so) return s;

      const driver =
        pickString(so, [
          'Assigned_Driver_No',
          'AssignedDriverNo',
          'assignedDriverNo',
          'Assigned_DriverNo',
          'Assigned_Driver',

        ]) || scanStringByRegex(so, /driver/i);

      const truck =
        pickString(so, [
          'assignedTruckNo',
          'Assigned_Truck_No',
          'AssignedTruckNo',
          'Truck_No',
        ]) || scanStringByRegex(so, /truck/i);

      return {
        ...s,
        Source_No: headerSource || effectiveSource,
        Assigned_Driver_No: driver,
        assignedTruckNo: truck,
        Ship_to_Address: so.Sell_to_Address,
        Ship_to_Address_2: so.Sell_to_Address_2,
        Ship_to_City: so.Sell_to_City,
        Ship_to_Post_Code: so.Sell_to_Post_Code,
        Ship_to_Country_Region_Code: so.Sell_to_Country_Region_Code,
        Sell_to_Customer_Name: so.Sell_to_Customer_Name,
        Sell_to_Customer_No: so.Sell_to_Customer_No,
        DeliveryStatus: (s as any)?.DeliveryStatus ?? (s as any)?.Delivery_Status ?? (s as any)?.["Delivery Status"],
      };
    });

    if (driverNoParam) {
      const target = normalize(driverNoParam);
      enriched = enriched.filter((s: any) => normalize((s as any)?.Assigned_Driver_No) === target);
    }

    if (sourceNoFilter.length > 0) {
      const set = new Set(sourceNoFilter.map((s) => normalize(s)));
      enriched = enriched.filter((s: any) => set.has(normalize((s as any)?.Source_No)));
    }

    return NextResponse.json({ ...data, value: enriched });
  } catch (error: any) {
    console.error("Error occurred:", error.message);

    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}