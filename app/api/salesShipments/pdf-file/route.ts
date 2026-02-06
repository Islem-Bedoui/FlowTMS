import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "@/app/functions/token";

export const dynamic = "force-dynamic";
export const revalidate = 0;

function odataRootFromCompanyBase(companyBase: string) {
  const b = companyBase.replace(/\/+$/, "");
  const idx = b.toLowerCase().lastIndexOf("/company(");
  if (idx >= 0) return b.slice(0, idx);
  return b;
}

function companyParam(): string {
  const name = (process.env.BC_COMPANY_NAME || "CRONUS FR").trim();
  return name ? `?company='${encodeURIComponent(name)}'` : "";
}

function odataRoot(): string {
  const fallbackCompanyBase =
    "https://api.businesscentral.dynamics.com/v2.0/38681c7b-907c-49c7-9777-d0e3fabfd826/SandBox/ODataV4/Company(%27CRONUS%20FR%27)";

  const companyBase = (process.env.BC_ODATA_COMPANY_BASE || fallbackCompanyBase).trim();
  return (process.env.BC_ODATA_ROOT || odataRootFromCompanyBase(companyBase)).replace(/\/+$/, "");
}

function companyBase(): string {
  const fallbackCompanyBase =
    "https://api.businesscentral.dynamics.com/v2.0/38681c7b-907c-49c7-9777-d0e3fabfd826/SandBox/ODataV4/Company(%27CRONUS%20FR%27)";
  return (process.env.BC_ODATA_COMPANY_BASE || fallbackCompanyBase).trim().replace(/\/+$/, "");
}

function serviceName(): string {
  return (process.env.BC_SALES_SHIPMENT_SERVICE_NAME || "cdu").trim();
}

function escOData(v: string) {
  return v.replace(/'/g, "''");
}

function actionUrl(actionName: string): string {
  const svc = encodeURIComponent(serviceName());
  const act = encodeURIComponent(actionName);
  return `${odataRoot()}/${svc}_${act}${companyParam()}`;
}

async function readJsonSafe(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

function getPdfToTextValue(respText: string): string | null {
  const t = (respText || "").trim();
  if (!t) return null;

  try {
    const obj = JSON.parse(t);
    if (typeof obj === "string") return obj;
    if (obj && typeof obj === "object") {
      const maybe = (obj as any).value;
      if (typeof maybe === "string") return maybe;
      const maybe2 = (obj as any).PdfBase64;
      if (typeof maybe2 === "string") return maybe2;
      const maybe3 = (obj as any).pdfBase64;
      if (typeof maybe3 === "string") return maybe3;
    }
  } catch {
  }

  if (/^[A-Za-z0-9+/=\r\n]+$/.test(t) && t.length > 256) return t;
  return null;
}

async function postBcAction(accessToken: string, url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

function decodeBase64PdfIfNeeded(buf: Buffer) {
  const headerAscii = buf.subarray(0, 8).toString("ascii");
  if (headerAscii.startsWith("%PDF-")) {
    return { ok: true as const, pdf: buf, headerAscii, mode: "pdf-bytes" as const };
  }

  // Some BC setups return the PDF as a base64 string (starts with "JVBERi0" which is "%PDF-" in base64)
  const asText = buf.toString("utf8").trim();
  const cleaned = asText
    .replace(/^"|"$/g, "")
    .replace(/\s+/g, "");
  if (cleaned.startsWith("JVBER")) {
    try {
      const decoded = Buffer.from(cleaned, "base64");
      const decodedHeader = decoded.subarray(0, 8).toString("ascii");
      if (decodedHeader.startsWith("%PDF-")) {
        return { ok: true as const, pdf: decoded, headerAscii: decodedHeader, mode: "base64" as const };
      }
    } catch {
    }
  }

  return { ok: false as const, headerAscii, preview: asText.slice(0, 800) };
}

export async function GET(req: NextRequest) {
  const { searchParams } = new URL(req.url);
  const id = String(searchParams.get("id") || "").trim();
  const documentNo = String(searchParams.get("documentNo") || searchParams.get("shipmentNo") || "").trim();

  if (!id && !documentNo) {
    return NextResponse.json({ error: "Missing id or documentNo" }, { status: 400 });
  }

  try {
    const accessToken = await getValidAccessToken();

    // If we only have documentNo, first resolve the BC GUID id using the standard entity.
    // This avoids relying on the custom PdfToText action (which may have different parameter names).
    if (!id && documentNo) {
      try {
        const lookupUrl =
          `${companyBase()}/salesShipments?` +
          `$top=1&$select=id,number&$filter=${encodeURIComponent(`number eq '${escOData(documentNo)}'`)}`;

        const lookupRes = await fetch(lookupUrl, {
          headers: {
            Authorization: `Bearer ${accessToken}`,
            Accept: "application/json",
          },
          cache: "no-store",
        });

        if (lookupRes.ok) {
          const lookupJson = (await lookupRes.json()) as any;
          const first = Array.isArray(lookupJson?.value) ? lookupJson.value[0] : null;
          const resolvedId = String(first?.id || "").trim();
          if (resolvedId) {
            const pdfUrl = `${companyBase()}/salesShipments(${resolvedId})/pdf`;
            const res = await fetch(pdfUrl, {
              headers: {
                Authorization: `Bearer ${accessToken}`,
                Accept: "application/pdf",
              },
              cache: "no-store",
            });

            if (res.ok) {
              const ct = res.headers.get("content-type") || "";
              const ab = await res.arrayBuffer();
              const buf = Buffer.from(ab);

              const decoded = decodeBase64PdfIfNeeded(buf);
              if (!decoded.ok) {
                console.log(
                  "[salesShipments/pdf-file] media PDF invalid payload:",
                  JSON.stringify({ id: resolvedId, contentType: ct, headerAscii: decoded.headerAscii, preview: decoded.preview.slice(0, 500) })
                );
                return NextResponse.json(
                  {
                    error: "BC media pdf did not return a PDF",
                    id: resolvedId,
                    documentNo,
                    bcUrl: pdfUrl,
                    contentType: ct,
                    headerAscii: decoded.headerAscii,
                    preview: decoded.preview,
                  },
                  { status: 502 }
                );
              }

              console.log(
                "[salesShipments/pdf-file] media PDF:",
                JSON.stringify({ id: resolvedId, bytes: decoded.pdf.length, headerAscii: decoded.headerAscii, mode: decoded.mode })
              );
              return new NextResponse(new Uint8Array(decoded.pdf), {
                status: 200,
                headers: {
                  "Content-Type": "application/pdf",
                  "Content-Disposition": `inline; filename=SalesShipment_${encodeURIComponent(resolvedId)}.pdf`,
                  "Cache-Control": "no-store",
                },
              });
            }

            const errTxt = await res.text();
            console.log(
              "[salesShipments/pdf-file] media PDF failed:",
              JSON.stringify({ id: resolvedId, status: res.status, details: errTxt.slice(0, 500) })
            );
          }
        }
      } catch {
        // fall back to PdfToText below
      }
    }

    if (id) {
      const pdfUrl = `${companyBase()}/salesShipments(${id})/pdf`;
      const res = await fetch(pdfUrl, {
        headers: {
          Authorization: `Bearer ${accessToken}`,
          Accept: "application/pdf",
        },
        cache: "no-store",
      });

      if (res.ok) {
        const ct = res.headers.get("content-type") || "";
        const ab = await res.arrayBuffer();
        const buf = Buffer.from(ab);

        const decoded = decodeBase64PdfIfNeeded(buf);
        if (!decoded.ok) {
          console.log(
            "[salesShipments/pdf-file] media PDF invalid payload:",
            JSON.stringify({ id, contentType: ct, headerAscii: decoded.headerAscii, preview: decoded.preview.slice(0, 500) })
          );
          return NextResponse.json(
            {
              error: "BC media pdf did not return a PDF",
              id,
              bcUrl: pdfUrl,
              contentType: ct,
              headerAscii: decoded.headerAscii,
              preview: decoded.preview,
            },
            { status: 502 }
          );
        }

        console.log(
          "[salesShipments/pdf-file] media PDF:",
          JSON.stringify({ id, bytes: decoded.pdf.length, headerAscii: decoded.headerAscii, mode: decoded.mode })
        );
        return new NextResponse(new Uint8Array(decoded.pdf), {
          status: 200,
          headers: {
            "Content-Type": "application/pdf",
            "Content-Disposition": `inline; filename=SalesShipment_${encodeURIComponent(id)}.pdf`,
            "Cache-Control": "no-store",
          },
        });
      }

      const errTxt = await res.text();
      console.log(
        "[salesShipments/pdf-file] media PDF failed:",
        JSON.stringify({ id, status: res.status, details: errTxt.slice(0, 500) })
      );
      if (!documentNo) {
        return NextResponse.json(
          { error: `BC error ${res.status} (media pdf)`, details: errTxt, bcUrl: pdfUrl },
          { status: res.status }
        );
      }
    }
    const pdfToTextUrl: string = actionUrl("PdfToText");

    const pdfResp = await postBcAction(accessToken, pdfToTextUrl, {
      SalesShipmentHeaderNo: documentNo,
    });

    if (!pdfResp.ok) {
      return NextResponse.json(
        { error: `BC error ${pdfResp.status} (PdfToText)`, details: pdfResp.text, bcUrl: pdfToTextUrl },
        { status: pdfResp.status }
      );
    }

    const base64Val = getPdfToTextValue(pdfResp.text);
    if (!base64Val) {
      return NextResponse.json(
        { error: "Could not parse PdfToText result as base64", details: pdfResp.text, bcUrl: pdfToTextUrl },
        { status: 502 }
      );
    }

    console.log(
      "[salesShipments/pdf-file] PdfToText base64:",
      JSON.stringify({
        documentNo,
        length: base64Val.length,
        prefix: base64Val.slice(0, 80),
        suffix: base64Val.slice(Math.max(0, base64Val.length - 80)),
      })
    );

    const pdfBuffer = Buffer.from(base64Val, "base64");
    return new NextResponse(pdfBuffer, {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=SalesShipment_${encodeURIComponent(documentNo)}.pdf`,
        "Cache-Control": "no-store",
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error?.message || "Internal Server Error" }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const body = await readJsonSafe(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const documentNo = String(body.documentNo || body.shipmentNo || "").trim();
  if (!documentNo) return NextResponse.json({ error: "Missing documentNo" }, { status: 400 });

  const url = new URL(req.url);
  url.searchParams.set("documentNo", documentNo);

  return GET(new NextRequest(url.toString(), req));
}
