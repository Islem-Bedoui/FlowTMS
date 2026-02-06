import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "../../../functions/token";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function getODataRootFromCompanyBase(companyBase: string) {
  const b = companyBase.replace(/\/+$/, "");
  const idx = b.toLowerCase().lastIndexOf("/company(");
  if (idx >= 0) return b.slice(0, idx);
  return b;
}

function buildBcActionUrls() {
  // Confirmed codeunit action format:
  //   .../ODataV4/<ServiceName>_<ActionName>?company='CRONUS%20FR'
  const companyBase = (
    process.env.BC_ODATA_COMPANY_BASE ||
    "https://api.businesscentral.dynamics.com/v2.0/38681c7b-907c-49c7-9777-d0e3fabfd826/SandBox/ODataV4/Company(%27CRONUS%20FR%27)"
  ).replace(/\/+$/, "");

  const odataRoot = (
    process.env.BC_ODATA_ROOT ||
    getODataRootFromCompanyBase(companyBase)
  ).replace(/\/+$/, "");

  const companyName = (process.env.BC_COMPANY_NAME || "CRONUS FR").trim();
  const companyParam = companyName ? `?company='${encodeURIComponent(companyName)}'` : "";

  const serviceName = (process.env.BC_SALES_SHIPMENT_SERVICE_NAME || "cdu").trim();
  const actionName = (process.env.BC_UPDATE_SALES_SHIPMENT_ACTION_NAME || "UpdateSalesShipment").trim();

  if (!serviceName || !actionName) return [];

  const svc = encodeURIComponent(serviceName);
  const act = encodeURIComponent(actionName);
  return [`${odataRoot}/${svc}_${act}${companyParam}`];
}

function asBool(v: any, fallback: boolean) {
  if (typeof v === "boolean") return v;
  if (typeof v === "string") {
    const s = v.trim().toLowerCase();
    if (s === "true" || s === "1" || s === "yes") return true;
    if (s === "false" || s === "0" || s === "no") return false;
  }
  return fallback;
}

async function readJsonSafe(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

/**
 * POST /api/salesShipments/signed
 * Body: { documentNo: string, signed: boolean }
 *
 * This calls a published Business Central service-enabled procedure UpdateSalesShipment(documentNo, signed).
 *
 * Configure the BC endpoint with env var BC_UPDATE_SALES_SHIPMENT_URL.
 * Example formats depend on how you published the codeunit/page action.
 */
export async function POST(req: NextRequest) {
  const bcUrls = buildBcActionUrls();
  if (bcUrls.length === 0) {
    return NextResponse.json(
      {
        error:
          "Missing Business Central action URL. Either set BC_UPDATE_SALES_SHIPMENT_URL (full URL), or set BC_ODATA_COMPANY_BASE + BC_SALES_SHIPMENT_SERVICE_NAME + BC_UPDATE_SALES_SHIPMENT_ACTION_NAME.",
      },
      { status: 500 }
    );
  }

  console.log("[salesShipments/signed] BC URLs tried:", bcUrls);

  const body = await readJsonSafe(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
  }

  const documentNo = String(body.documentNo || "").trim();
  const signed = asBool(body.signed, true);

  if (!documentNo) {
    return NextResponse.json({ error: "Missing documentNo" }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken();

    let lastStatus = 0;
    let lastText = "";
    for (const url of bcUrls) {
      const response = await fetch(url, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${accessToken}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ documentNo, signed }),
        cache: "no-store",
      });

      const contentType = response.headers.get("content-type") || "";
      const text = await response.text();
      lastStatus = response.status;
      lastText = text;

      if (response.ok) {
        if (contentType.includes("application/json")) {
          try {
            return NextResponse.json(JSON.parse(text || "{}"));
          } catch {
            // fallthrough
          }
        }
        return NextResponse.json({ ok: true, documentNo, signed, raw: text || null, bcUrl: url });
      }

      // If endpoint is wrong (404), try next candidate.
      if (response.status === 404) continue;

      // Non-404 failure: stop and return it.
      return NextResponse.json(
        {
          error: `BC error ${response.status}`,
          details: text,
          tried: bcUrls,
          bcUrl: url,
        },
        { status: response.status }
      );
    }

    return NextResponse.json(
      {
        error: `BC error ${lastStatus || 404}`,
        details: lastText,
        tried: bcUrls,
      },
      { status: lastStatus || 404 }
    );
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
