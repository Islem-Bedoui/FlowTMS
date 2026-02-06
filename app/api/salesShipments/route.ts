import { NextResponse } from "next/server";
import { getValidAccessToken } from "../../functions/token";
import { getMockSalesShipments, isBcMockEnabled } from "../_mock/bc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function toInt(v: string | null, fallback: number) {
  const n = Number(v);
  return Number.isFinite(n) && n >= 0 ? Math.floor(n) : fallback;
}

function escOData(v: string) {
  return v.replace(/'/g, "''");
}

export async function GET(req: Request) {
  // FIXED: Correct company path encoding (NO extra spaces, proper %27 quotes)
  const apiBase =
    "https://api.businesscentral.dynamics.com/v2.0/38681c7b-907c-49c7-9777-d0e3fabfd826/SandBox/ODataV4/Company(%27CRONUS%20FR%27)";

  try {
    if (isBcMockEnabled()) {
      const { searchParams } = new URL(req.url);
      const q = (searchParams.get("q") || "").trim().toLowerCase();
      const number = (searchParams.get("number") || "").trim();
      const orderNumber = (searchParams.get("orderNumber") || "").trim();

      const all = getMockSalesShipments().map((r: any) => ({
        id: r.id,
        no: r.number,
        sellToCustomerName: r.customerName,
        sellToCustomerNo: r.customerNumber,
        shipToName: r.shipToName,
        shipToAddress: r.shipToAddressLine1,
        shipToAddress2: r.shipToAddressLine2,
        shipToCity: r.shipToCity,
        shipToPostCode: r.shipToPostCode,
        shipToCountryRegionCode: r.shipToCountry,
        postingDate: r.postingDate,
        documentDate: r.invoiceDate,
        externalDocumentNo: r.externalDocumentNumber,
        orderNo: r.orderNumber,
        signed: r.signed,
      }));

      const filtered = all.filter((r: any) => {
        if (number && String(r.no || "").trim() !== number) return false;
        if (orderNumber && String(r.orderNo || "").trim() !== orderNumber) return false;
        if (!q) return true;
        const blob = [
          r.no,
          r.sellToCustomerName,
          r.shipToName,
          r.externalDocumentNo,
          r.orderNo,
        ]
          .map((x: any) => String(x || "").toLowerCase())
          .join(" | ");
        return blob.includes(q);
      });

      return NextResponse.json({ value: filtered });
    }

    const { searchParams } = new URL(req.url);
    const top = Math.min(toInt(searchParams.get("top"), 100), 1000);
    const skip = toInt(searchParams.get("skip"), 0);
    const q = (searchParams.get("q") || "").trim();
    const number = (searchParams.get("number") || "").trim();
    const orderNumber = (searchParams.get("orderNumber") || "").trim();

    const filters: string[] = [];
    // FIXED: Use BC-standard field names (verified against your sample response)
    if (number) filters.push(`number eq '${escOData(number)}'`);
    if (orderNumber) filters.push(`orderNumber eq '${escOData(orderNumber)}'`);
    if (q) {
      const qq = escOData(q.toLowerCase());
      // FIXED: Updated field names to match BC OData schema
      filters.push(
        `contains(tolower(number), '${qq}') or ` +
        `contains(tolower(customerName), '${qq}') or ` +
        `contains(tolower(shipToName), '${qq}') or ` +
        `contains(tolower(externalDocumentNumber), '${qq}') or ` +
        `contains(tolower(orderNumber), '${qq}')`
      );
    }
    const filterPart = filters.length ? `&$filter=${encodeURIComponent(filters.join(" and "))}` : "";

    // CRITICAL: Added "pdf" to trigger media link annotations + updated field names
    const selectFields = [
      "id",
      "number",
      "customerName",
      "customerNumber",
      "shipToName",
      "shipToAddressLine1",
      "shipToAddressLine2",
      "shipToCity",
      "shipToPostCode",
      "shipToCountry",
      "postingDate",
      "invoiceDate", // Replaces non-existent "documentDate" (per your sample)
      "externalDocumentNumber",
      "orderNumber",
      "signed",
      "pdf" // REQUIRED to get @odata.mediaReadLink annotations
    ];
    const selectPart = `&$select=${encodeURIComponent(selectFields.join(","))}`;

    // FIXED: Endpoint name changed to lowercase plural "salesShipments"
    const apiUrl =
      `${apiBase}/salesShipments?` +
      `$top=${top}&$skip=${skip}` +
      filterPart +
      selectPart;

    const accessToken = await getValidAccessToken();
    const response = await fetch(apiUrl, {
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${accessToken}`,
      },
      cache: "no-store",
    });

    if (!response.ok) {
      const errorBody = await response.text();
      return NextResponse.json(
        { error: `BC error ${response.status}: ${errorBody}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const rows = Array.isArray((data as any)?.value) ? (data as any).value : [];
    const normalized = rows.map((r: any) => ({
      id: r?.id,
      no: r?.number,
      sellToCustomerName: r?.customerName,
      sellToCustomerNo: r?.customerNumber,
      shipToName: r?.shipToName,
      shipToAddress: r?.shipToAddressLine1,
      shipToAddress2: r?.shipToAddressLine2,
      shipToCity: r?.shipToCity,
      shipToPostCode: r?.shipToPostCode,
      shipToCountryRegionCode: r?.shipToCountry,
      postingDate: r?.postingDate,
      documentDate: r?.invoiceDate,
      externalDocumentNo: r?.externalDocumentNumber,
      orderNo: r?.orderNumber,
      signed: r?.signed,
      "pdf@odata.mediaReadLink": r?.["pdf@odata.mediaReadLink"],
      "pdf@odata.mediaEditLink": r?.["pdf@odata.mediaEditLink"],
    }));
    return NextResponse.json({ value: normalized });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}