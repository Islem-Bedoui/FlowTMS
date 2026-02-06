import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "../../../functions/token";
import { isBcMockEnabled } from "../../_mock/bc";
import { writeWhseStatus } from "../../_mock/whseStatusStore";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function buildCandidatePayloads(shipmentNo: string, newStatus: string) {
  const shipmentParam = (process.env.BC_UPDATE_WHSE_SHIPMENT_STATUS_PARAM_SHIPMENT_NO || "").trim();
  const statusParam = (process.env.BC_UPDATE_WHSE_SHIPMENT_STATUS_PARAM_STATUS || "").trim();

  const out: Array<Record<string, string>> = [];

  if (shipmentParam && statusParam) {
    out.push({ [shipmentParam]: shipmentNo, [statusParam]: newStatus });
  }

  // Common variants seen in BC OData action payloads
  out.push({ ShipmentNo: shipmentNo, NewStatus: newStatus });
  out.push({ shipmentNo, newStatus });
  out.push({ shipmentNo: shipmentNo, NewStatus: newStatus });
  out.push({ ShipmentNo: shipmentNo, newStatus: newStatus });

  // De-dup by stable JSON key order
  const seen = new Set<string>();
  return out.filter((p) => {
    const k = JSON.stringify(Object.keys(p).sort().map((kk) => [kk, p[kk]]));
    if (seen.has(k)) return false;
    seen.add(k);
    return true;
  });
}

function getODataRootFromCompanyBase(companyBase: string) {
  const b = companyBase.replace(/\/+$/, "");
  const idx = b.toLowerCase().lastIndexOf("/company(");
  if (idx >= 0) return b.slice(0, idx);
  return b;
}

function buildBcActionUrls() {
  // Format:
  //   .../ODataV4/<ServiceName>_<ActionName>?company='CRONUS%20FR'
  const companyBase = (
    process.env.BC_ODATA_COMPANY_BASE ||
    "https://api.businesscentral.dynamics.com/v2.0/38681c7b-907c-49c7-9777-d0e3fabfd826/SandBox/ODataV4/Company(%27CRONUS%20FR%27)"
  ).replace(/\/+$/, "");

  const odataRoot = (
    process.env.BC_ODATA_ROOT || getODataRootFromCompanyBase(companyBase)
  ).replace(/\/+$/, "");

  const companyName = (process.env.BC_COMPANY_NAME || "CRONUS FR").trim();
  const companyParam = companyName ? `?company='${encodeURIComponent(companyName)}'` : "";

  const serviceName = (process.env.BC_WHSE_SHIPMENT_SERVICE_NAME || "cdu").trim();
  const actionName = (process.env.BC_UPDATE_WHSE_SHIPMENT_STATUS_ACTION_NAME || "UpdateWhseShipmentStatus").trim();

  if (!serviceName || !actionName) return [];

  const svc = encodeURIComponent(serviceName);
  const act = encodeURIComponent(actionName);
  return [`${odataRoot}/${svc}_${act}${companyParam}`];
}

async function readJsonSafe(req: NextRequest) {
  try {
    const text = await req.text();
    if (!text) return null;
    try {
      return JSON.parse(text);
    } catch {
      return { __invalidJson: true, __raw: text };
    }
  } catch {
    return null;
  }
}

/**
 * POST /api/whseShipments/status
 * Body: { shipmentNo: string, newStatus: string }
 *
 * Calls a published Business Central service-enabled procedure:
 *   UpdateWhseShipmentStatus(ShipmentNo, NewStatus)
 */
export async function POST(req: NextRequest) {
  if (isBcMockEnabled()) {
    const body = await readJsonSafe(req);
    if (!body) {
      return NextResponse.json({ error: "Invalid JSON body", body: null }, { status: 400 });
    }

    if ((body as any)?.__invalidJson) {
      return NextResponse.json({ error: "Invalid JSON body", body }, { status: 400 });
    }

    const shipmentNo = String((body as any).shipmentNo ?? (body as any).ShipmentNo ?? "").trim();
    const newStatus = String((body as any).newStatus ?? (body as any).NewStatus ?? "").trim();
    if (!shipmentNo) return NextResponse.json({ error: "Missing shipmentNo", body }, { status: 400 });
    if (!newStatus) return NextResponse.json({ error: "Missing newStatus", body }, { status: 400 });

    const rec = await writeWhseStatus(shipmentNo, newStatus);
    return NextResponse.json({ ok: true, shipmentNo, newStatus, record: rec, mock: true });
  }

  const bcUrls = buildBcActionUrls();
  if (bcUrls.length === 0) {
    return NextResponse.json(
      {
        error:
          "Missing Business Central action URL parts. Set BC_ODATA_COMPANY_BASE + BC_WHSE_SHIPMENT_SERVICE_NAME + BC_UPDATE_WHSE_SHIPMENT_STATUS_ACTION_NAME (or BC_ODATA_ROOT).",
      },
      { status: 500 }
    );
  }

  const body = await readJsonSafe(req);
  if (!body) {
    return NextResponse.json({ error: "Invalid JSON body", body: null }, { status: 400 });
  }

  if ((body as any)?.__invalidJson) {
    return NextResponse.json(
      { error: "Invalid JSON body", body },
      { status: 400 }
    );
  }

  const shipmentNo = String(body.shipmentNo ?? body.ShipmentNo ?? "").trim();
  const newStatus = String(body.newStatus ?? body.NewStatus ?? "").trim();

  if (!shipmentNo) {
    return NextResponse.json({ error: "Missing shipmentNo", body }, { status: 400 });
  }
  if (!newStatus) {
    return NextResponse.json({ error: "Missing newStatus", body }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken();

    let lastStatus = 0;
    let lastText = "";

    const candidatePayloads = buildCandidatePayloads(shipmentNo, newStatus);

    for (const url of bcUrls) {
      for (const payload of candidatePayloads) {
        const response = await fetch(url, {
          method: "POST",
          headers: {
            Authorization: `Bearer ${accessToken}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
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
            }
          }
          return NextResponse.json({ ok: true, shipmentNo, newStatus, raw: text || null, bcUrl: url, payload });
        }

        // Try next URL if this action isn't published at this endpoint
        if (response.status === 404) break;

        // If BC complains about invalid parameter names, try other payload shapes
        const lower = String(text || "").toLowerCase();
        const looksLikeParamMismatch =
          response.status === 400 &&
          (lower.includes("not a valid parameter") || lower.includes("is not a valid parameter"));
        if (looksLikeParamMismatch) continue;

        return NextResponse.json(
          {
            error: `BC error ${response.status}`,
            details: text,
            tried: bcUrls,
            bcUrl: url,
            payload,
          },
          { status: response.status }
        );
      }
    }

    return NextResponse.json(
      {
        error: `BC error ${lastStatus || 404}`,
        details: lastText,
        tried: bcUrls,
      },
      { status: lastStatus || 404 }
    );
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Internal Server Error" }, { status: 500 });
  }
}
