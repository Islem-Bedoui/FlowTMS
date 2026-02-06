import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "../../functions/token";
import { getMockWhseShipments, isBcMockEnabled } from "../_mock/bc";
import { readAllWhseStatuses } from "../_mock/whseStatusStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildBcWarehouseShipmentUrl(req: NextRequest) {
  const companyBase = (
    process.env.BC_ODATA_COMPANY_BASE ||
    "https://api.businesscentral.dynamics.com/v2.0/38681c7b-907c-49c7-9777-d0e3fabfd826/SandBox/ODataV4/Company(%27CRONUS%20FR%27)"
  ).replace(/\/+$/, "");

  const base = companyBase.replace(/\/+$/, "");
  const qs = req.nextUrl.search;

  return `${base}/warehouseShipment${qs || ""}`;
}

export async function GET(req: NextRequest) {
  try {
    if (isBcMockEnabled()) {
      const statusBy = await readAllWhseStatuses();
      const value = getMockWhseShipments(statusBy);
      return NextResponse.json({ value });
    }

    const accessToken = await getValidAccessToken();
    const url = buildBcWarehouseShipmentUrl(req);

    const response = await fetch(url, {
      method: "GET",
      headers: {
        Authorization: `Bearer ${accessToken}`,
        "Content-Type": "application/json",
      },
      cache: "no-store",
    });

    const contentType = response.headers.get("content-type") || "";
    const text = await response.text();

    if (!response.ok) {
      return NextResponse.json(
        {
          error: `BC error ${response.status}`,
          details: text,
          bcUrl: url,
        },
        { status: response.status }
      );
    }

    if (contentType.includes("application/json")) {
      try {
        return NextResponse.json(JSON.parse(text || "{}"));
      } catch {
      }
    }

    return NextResponse.json({ ok: true, raw: text || null, bcUrl: url });
  } catch (e: any) {
    return NextResponse.json(
      { error: e?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
