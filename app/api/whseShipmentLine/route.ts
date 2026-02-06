import { NextApiRequest, NextApiResponse } from "next";
import { NextResponse } from "next/server";
import { getValidAccessToken } from "../../functions/token";
import { getMockWhseShipmentLines, isBcMockEnabled } from "../_mock/bc";

// API Route Handler
export async function GET(req: NextApiRequest, res: NextApiResponse) {
  if (isBcMockEnabled()) {
    const url = new URL((req as any).url, "http://localhost");
    const repeated = url.searchParams.getAll('sourceNo').map((s) => s.trim()).filter(Boolean);
    const csv = (url.searchParams.get('sourceNos') || '')
      .split(',')
      .map((s) => s.trim())
      .filter(Boolean);
    const sourceNos = Array.from(new Set([...repeated, ...csv]));
    const value = getMockWhseShipmentLines(sourceNos);
    return NextResponse.json({ value });
  }

  // Return all fields - multiple pages need different subsets
  const apiBase =
    "https://api.businesscentral.dynamics.com/v2.0/38681c7b-907c-49c7-9777-d0e3fabfd826/SandBox/ODataV4/Company(%27CRONUS%20FR%27)";
  const whseShipmentLinesUrl = `${apiBase}/WhseShipmentLine`;
  const salesOrdersUrl = `${apiBase}/salesorders`;

  const accessToken = await getValidAccessToken();
  try {
    //await getValidAccessToken(); // Ensure we have a valid token

    const options = {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
    };

    const fetchText = async (url: string) => {
      const response = await fetch(url, options);
      const text = await response.text();
      if (!response.ok) {
        throw new Error(`Error: ${response.status} - ${text}`);
      }
      return text;
    };

    const safeJson = (text: string) => {
      try {
        return JSON.parse(text);
      } catch {
        return { value: [] };
      }
    };

    const extractMissingProperty = (errMsg: string): string | null => {
      const m = String(errMsg || "").match(/Could not find a property named '([^']+)'/);
      return m?.[1] || null;
    };

    const url = new URL((req as any).url);
    const shipmentNo = url.searchParams.get('No')?.trim();
    const sourceNoList = (() => {
      const repeated = url.searchParams.getAll('sourceNo').map((s) => s.trim()).filter(Boolean);
      const csv = (url.searchParams.get('sourceNos') || '')
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      return Array.from(new Set([...repeated, ...csv]));
    })();

    const shipmentNoEsc = shipmentNo ? shipmentNo.replace(/'/g, "''") : '';

    const filterFieldCandidates = [
      'No',
      'Document_No',
      'DocumentNo',
      'Whse_Shipment_No',
      'WhseShipmentNo',
      'Shipment_No',
      'ShipmentNo',
    ];

    let apiUrl = whseShipmentLinesUrl;

    const fetchLinesData = async () => {
      // Prefer filtering by Source_No (order no)
      if (sourceNoList.length > 0) {
        const filter = sourceNoList
          .map((s) => `Source_No eq '${String(s).replace(/'/g, "''")}'`)
          .join(' or ');
        const candidate = `${whseShipmentLinesUrl}?$filter=${encodeURIComponent(filter)}`;
        try {
          const text = await fetchText(candidate);
          return { url: candidate, data: safeJson(text) };
        } catch (e) {
          // If BC doesn't allow Source_No filter (metadata / permissions), fallback to client-side filter
          const text = await fetchText(whseShipmentLinesUrl);
          const all = safeJson(text);
          const set = new Set(sourceNoList.map((x) => String(x).trim()));
          const value = Array.isArray(all?.value) ? all.value : [];
          return { url: whseShipmentLinesUrl, data: { ...all, value: value.filter((l: any) => set.has(String(l?.Source_No || '').trim())) } };
        }
      }

      // Otherwise filter by shipment number (best effort)
      if (shipmentNo && shipmentNoEsc) {
        for (const field of filterFieldCandidates) {
          const candidate = `${whseShipmentLinesUrl}?$filter=${encodeURIComponent(`${field} eq '${shipmentNoEsc}'`)}`;
          try {
            const text = await fetchText(candidate);
            return { url: candidate, data: safeJson(text) };
          } catch (e: any) {
            const msg = String(e?.message || "");
            const missing = extractMissingProperty(msg);
            if (missing) continue;
          }
        }
      }

      const text = await fetchText(whseShipmentLinesUrl);
      return { url: whseShipmentLinesUrl, data: safeJson(text) };
    };

    const out = await fetchLinesData();
    apiUrl = out.url;
    const data = out.data;
    console.log("Making request to:", apiUrl);
    console.log("Received data:", data);

    const rawLines: any[] = Array.isArray((data as any)?.value) ? (data as any).value : [];
    const lines: any[] = rawLines.map((l) => {
      if (l && l.Document_No === undefined && typeof l.No === 'string') {
        return { ...l, Document_No: l.No };
      }
      return l;
    });

    const sourceNos = Array.from(
      new Set(
        lines
          .map(l => (typeof l?.Source_No === 'string' ? l.Source_No.trim() : ''))
          .filter(Boolean)
      )
    );

    const salesOrderByNo: Record<string, any> = {};
    if (sourceNos.length > 0) {
      console.log('WhseShipmentLine enrichment - unique Source_No count:', sourceNos.length);
      const batchSize = 10;
      for (let i = 0; i < sourceNos.length; i += batchSize) {
        const batch = sourceNos.slice(i, i + batchSize);
        const filter = batch
          .map((no) => {
            const safe = String(no).replace(/'/g, "''");
            return `(No eq '${safe}' or endswith(No,'${safe}'))`;
          })
          .join(' or ');
        const soUrl = `${salesOrdersUrl}?$filter=${encodeURIComponent(filter)}`;
        try {
          const soText = await fetchText(soUrl);
          const soData = safeJson(soText);
          const orders: any[] = Array.isArray(soData?.value) ? soData.value : [];
          console.log('WhseShipmentLine enrichment - salesorders returned:', orders.length);
          for (const srcNo of batch) {
            const srcStr = String(srcNo);
            const match = orders.find((o) =>
              o?.No === srcStr || (typeof o?.No === 'string' && o.No.endsWith(srcStr))
            );
            if (match) salesOrderByNo[srcStr] = match;
          }
        } catch (e) {
          console.warn('Failed to fetch salesorders for WhseShipmentLine enrichment:', e);
        }
      }
    }

    const enriched = lines.map((l) => {
      const src = typeof l?.Source_No === 'string' ? l.Source_No.trim() : '';
      const so = src ? salesOrderByNo[src] : undefined;
      if (!so) return l;
      const shipToAddress = so.Sell_to_Address || l.Ship_to_Address || l.Sell_to_Address;
      const shipToAddress2 = so.Sell_to_Address_2 || l.Ship_to_Address_2 || l.Sell_to_Address_2;
      const shipToCity = so.Sell_to_City || l.Ship_to_City || l.Sell_to_City;
      const shipToPostCode = so.Sell_to_Post_Code || l.Ship_to_Post_Code || l.Sell_to_Post_Code;
      const shipToCountry = so.Sell_to_Country_Region_Code || l.Ship_to_Country_Region_Code || l.Sell_to_Country_Region_Code;
      return {
        ...l,
        Ship_to_Address: shipToAddress,
        Ship_to_Address_2: shipToAddress2,
        Ship_to_City: shipToCity,
        Ship_to_Post_Code: shipToPostCode,
        Ship_to_Country_Region_Code: shipToCountry,
        Sell_to_Customer_Name: so.Sell_to_Customer_Name,
        Sell_to_Customer_No: so.Sell_to_Customer_No,
        Sell_to_Address: so.Sell_to_Address,
        Sell_to_Address_2: so.Sell_to_Address_2,
        Sell_to_City: so.Sell_to_City,
        Sell_to_Post_Code: so.Sell_to_Post_Code,
        Sell_to_Country_Region_Code: so.Sell_to_Country_Region_Code,
      };
    });

    return NextResponse.json({ ...data, value: enriched });
  } catch (error: any) {
    console.error("Error occurred:", error.message);
    return NextResponse.json(
      { message: error.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}