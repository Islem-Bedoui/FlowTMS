import { NextRequest, NextResponse } from "next/server";
import { getValidAccessToken } from "../../../functions/token";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";
import { isBcMockEnabled } from "../../_mock/bc";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

function odataRootFromCompanyBase(companyBase: string) {
  const b = companyBase.replace(/\/+$/, "");
  const idx = b.toLowerCase().lastIndexOf("/company(");
  if (idx >= 0) return b.slice(0, idx);
  return b;
}

async function generateMockPodPdf(opts: {
  documentNo: string;
  signedBy?: string;
  note?: string;
  signaturePngBase64: string;
}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]); // A4
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const fontBold = await doc.embedFont(StandardFonts.HelveticaBold);

  const { width, height } = page.getSize();
  const margin = 48;
  let y = height - margin;

  page.drawText("POD - Preuve de Livraison", {
    x: margin,
    y,
    size: 18,
    font: fontBold,
    color: rgb(0.05, 0.07, 0.17),
  });
  y -= 28;

  page.drawText(`Document: ${opts.documentNo}`, {
    x: margin,
    y,
    size: 12,
    font,
    color: rgb(0.15, 0.15, 0.15),
  });
  y -= 18;

  const signedBy = String(opts.signedBy || "").trim();
  if (signedBy) {
    page.drawText(`Signé par: ${signedBy}`, {
      x: margin,
      y,
      size: 12,
      font,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= 18;
  }

  const note = String(opts.note || "").trim();
  if (note) {
    page.drawText("Note:", {
      x: margin,
      y,
      size: 12,
      font: fontBold,
      color: rgb(0.15, 0.15, 0.15),
    });
    y -= 16;
    const clipped = note.length > 220 ? `${note.slice(0, 220)}…` : note;
    page.drawText(clipped, {
      x: margin,
      y,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2),
      maxWidth: width - margin * 2,
      lineHeight: 14,
    });
    y -= 60;
  } else {
    y -= 12;
  }

  // Signature block
  page.drawText("Signature client:", {
    x: margin,
    y,
    size: 12,
    font: fontBold,
    color: rgb(0.15, 0.15, 0.15),
  });
  y -= 10;
  page.drawLine({
    start: { x: margin, y },
    end: { x: width - margin, y },
    thickness: 1,
    color: rgb(0.7, 0.75, 0.82),
  });
  y -= 160;

  const pngBytes = Buffer.from(opts.signaturePngBase64, "base64");
  const png = await doc.embedPng(pngBytes);
  const pngDims = png.scale(1);
  const maxW = width - margin * 2;
  const maxH = 140;
  const scale = Math.min(maxW / pngDims.width, maxH / pngDims.height, 1);
  const sigW = pngDims.width * scale;
  const sigH = pngDims.height * scale;
  page.drawImage(png, {
    x: margin,
    y: Math.max(margin, y),
    width: sigW,
    height: sigH,
  });

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

function decodeBase64PdfIfNeeded(buf: Buffer) {
  const headerAscii = buf.subarray(0, 8).toString("ascii");
  if (headerAscii.startsWith("%PDF-")) {
    return { ok: true as const, pdf: buf, headerAscii, mode: "pdf-bytes" as const };
  }

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

async function resolveShipmentId(accessToken: string, documentNo: string) {
  const lookupUrl =
    `${companyBase()}/salesShipments?` +
    `$top=1&$select=id,number&$filter=${encodeURIComponent(`number eq '${escOData(documentNo)}'`)}`;
  const res = await fetch(lookupUrl, {
    headers: {
      Authorization: `Bearer ${accessToken}`,
      Accept: "application/json",
    },
    cache: "no-store",
  });
  if (!res.ok) return null;
  const json = (await res.json()) as any;
  const first = Array.isArray(json?.value) ? json.value[0] : null;
  const id = String(first?.id || "").trim();
  return id || null;
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

function serviceName(): string {
  return (process.env.BC_SALES_SHIPMENT_SERVICE_NAME || "cdu").trim();
}

function actionUrl(actionName: string): string {
  const svc = encodeURIComponent(serviceName());
  const act = encodeURIComponent(actionName);
  return `${odataRoot()}/${svc}_${act}${companyParam()}`;
}

function companyBase(): string {
  const fallbackCompanyBase =
    "https://api.businesscentral.dynamics.com/v2.0/38681c7b-907c-49c7-9777-d0e3fabfd826/SandBox/ODataV4/Company(%27CRONUS%20FR%27)";
  return (process.env.BC_ODATA_COMPANY_BASE || fallbackCompanyBase).trim().replace(/\/+$/, "");
}

function escOData(v: string) {
  return v.replace(/'/g, "''");
}

function stripDataUrlPrefix(dataUrlOrBase64: string) {
  const s = (dataUrlOrBase64 || "").trim();
  const idx = s.indexOf("base64,");
  if (idx >= 0) return s.slice(idx + "base64,".length);
  return s;
}

async function readJsonSafe(req: NextRequest) {
  try {
    return await req.json();
  } catch {
    return null;
  }
}

async function postBcAction(accessToken: string, url: string, body: any) {
  const res = await fetch(url, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${accessToken}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
    cache: "no-store",
  });

  const text = await res.text();
  return { ok: res.ok, status: res.status, text };
}

async function postBcActionWithVariants(
  accessToken: string,
  url: string,
  variants: Array<{ body: any; keys: string[] }>
) {
  let last = { ok: false, status: 0, text: "" };
  for (const v of variants) {
    const res = await postBcAction(accessToken, url, v.body);
    if (res.ok) return { ...res, triedKeys: [v.keys] };
    last = res;
  }
  return { ...last, triedKeys: variants.map((v) => v.keys) };
}

function getPdfToTextValue(text: string) {
  // OData actions can return different shapes depending on exposure.
  // We'll try the common ones.
  try {
    const json = JSON.parse(text);
    const v =
      json?.value ??
      json?.PdfToText ??
      json?.pdfToText ??
      json?.d?.PdfToText ??
      json?.d?.results ??
      json;
    if (typeof v === "string") return v;
  } catch {
    // not json
  }
  if (typeof text === "string" && text.trim()) return text.trim();
  return null;
}

async function stampSignatureOnPdf(pdfBase64: string, signaturePngBase64: string) {
  const pdfBytes = Buffer.from(pdfBase64, "base64");
  const pngBytes = Buffer.from(signaturePngBase64, "base64");

  const pdfDoc = await PDFDocument.load(pdfBytes);
  const pngImage = await pdfDoc.embedPng(pngBytes);

  const pages = pdfDoc.getPages();
  const lastPage = pages[pages.length - 1];
  const { width, height } = lastPage.getSize();

  const marginX = 40;
  const marginBottom = 40;
  const maxW = Math.max(120, width - marginX * 2);

  const pngDims = pngImage.scale(1);
  const scale = Math.min(maxW / pngDims.width, 120 / pngDims.height, 1);
  const sigW = pngDims.width * scale;
  const sigH = pngDims.height * scale;

  const x = marginX;
  const y = Math.max(marginBottom, marginBottom);

  // Draw signature at bottom-left
  lastPage.drawImage(pngImage, {
    x,
    y,
    width: sigW,
    height: sigH,
  });

  const out = await pdfDoc.save();
  return Buffer.from(out).toString("base64");
}

/**
 * POST /api/salesShipments/sign-pdf
 * Body: { documentNo: string, signaturePngBase64: string } OR { documentNo, imageDataUrl }
 */
export async function POST(req: NextRequest) {
  const body = await readJsonSafe(req);
  if (!body) return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });

  const documentNo = String(body.documentNo || body.shipmentNo || "").trim();
  const imageDataUrl = String(body.imageDataUrl || "").trim();
  const signaturePngBase64 = String(body.signaturePngBase64 || "").trim();
  const signedBy = String(body.signedBy || "").trim();
  const note = String(body.note || "").trim();

  if (!documentNo) return NextResponse.json({ error: "Missing documentNo" }, { status: 400 });

  const sigBase64 = stripDataUrlPrefix(signaturePngBase64 || imageDataUrl);
  if (!sigBase64) return NextResponse.json({ error: "Missing signaturePngBase64/imageDataUrl" }, { status: 400 });

  if (isBcMockEnabled()) {
    const pdfBuf = await generateMockPodPdf({
      documentNo,
      signedBy: signedBy || undefined,
      note: note || undefined,
      signaturePngBase64: sigBase64,
    });
    return new NextResponse(new Uint8Array(pdfBuf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=POD_${encodeURIComponent(documentNo)}.pdf`,
        "Cache-Control": "no-store",
      },
    });
  }

  try {
    const accessToken = await getValidAccessToken();

    const mode = new URL(req.url).searchParams.get("mode") || "";

    const id = await resolveShipmentId(accessToken, documentNo);
    if (!id) {
      return NextResponse.json(
        { error: "Could not resolve sales shipment id from documentNo", documentNo },
        { status: 404 }
      );
    }

    // 1) Get original PDF from BC (media endpoint)
    const mediaPdfUrl = `${companyBase()}/salesShipments(${id})/pdf`;
    const pdfMediaRes = await fetch(mediaPdfUrl, {
      headers: {
        Authorization: `Bearer ${accessToken}`,
        Accept: "application/pdf",
      },
      cache: "no-store",
    });
    const originalContentType = pdfMediaRes.headers.get("content-type") || "";
    if (!pdfMediaRes.ok) {
      const errTxt = await pdfMediaRes.text();
      return NextResponse.json(
        { error: `BC error ${pdfMediaRes.status} (media pdf)`, details: errTxt, bcUrl: mediaPdfUrl, id },
        { status: pdfMediaRes.status }
      );
    }
    const ab = await pdfMediaRes.arrayBuffer();
    const decodedOriginal = decodeBase64PdfIfNeeded(Buffer.from(ab));
    if (!decodedOriginal.ok) {
      return NextResponse.json(
        {
          error: "BC media pdf did not return a PDF",
          id,
          documentNo,
          bcUrl: mediaPdfUrl,
          headerAscii: decodedOriginal.headerAscii,
          preview: decodedOriginal.preview,
        },
        { status: 502 }
      );
    }

    // 2) Stamp signature on PDF
    const originalPdfBase64 = decodedOriginal.pdf.toString("base64");
    const signedPdfBase64 = await stampSignatureOnPdf(originalPdfBase64, sigBase64);
    const signedPdfBytes = Buffer.from(signedPdfBase64, "base64");

    // If asked, return the signed PDF bytes for immediate preview.
    // We still try to upload/mark signed so BC is updated.

    // 3) Upload signed PDF back to BC
    let uploadOk = false;
    let uploadDetails: any = null;

    // IMPORTANT:
    // Your BC UI error is coming from Convert.FromBase64String(), which strongly suggests that BC expects
    // the stored PDF value to be a BASE64 STRING. So we must prefer the custom BC action that stores base64.
    const uploadUrl: string = actionUrl("GenerateAndStoreReportAsBase64");
    const uploadResp = await postBcActionWithVariants(accessToken, uploadUrl, [
      {
        body: { SalesShipmentHeaderNo: documentNo, Base64: signedPdfBase64 },
        keys: ["SalesShipmentHeaderNo", "Base64"],
      },
      {
        body: { salesShipmentHeaderNo: documentNo, Base64: signedPdfBase64 },
        keys: ["salesShipmentHeaderNo", "Base64"],
      },
      {
        body: { SalesShipmentHeaderNo: documentNo, base64: signedPdfBase64 },
        keys: ["SalesShipmentHeaderNo", "base64"],
      },
      {
        body: { salesShipmentHeaderNo: documentNo, base64: signedPdfBase64 },
        keys: ["salesShipmentHeaderNo", "base64"],
      },
      {
        body: { documentNo, Base64: signedPdfBase64 },
        keys: ["documentNo", "Base64"],
      },
      {
        body: { documentNo, base64: signedPdfBase64 },
        keys: ["documentNo", "base64"],
      },
    ]);
    if (uploadResp.ok) {
      uploadOk = true;
    } else {
      uploadDetails = {
        method: "GenerateAndStoreReportAsBase64",
        status: uploadResp.status,
        details: uploadResp.text,
        bcUrl: uploadUrl,
        triedKeys: (uploadResp as any).triedKeys,
      };
    }

    // 4) Mark as signed
    const signedUrl: string = actionUrl("UpdateSalesShipment");
    const signedResp = await postBcAction(accessToken, signedUrl, {
      documentNo,
      signed: true,
    });

    if (!signedResp.ok) {
      return NextResponse.json(
        {
          error: `BC error ${signedResp.status} (UpdateSalesShipment)`,
          details: signedResp.text,
          bcUrl: signedUrl,
        },
        { status: signedResp.status }
      );
    }

    if (!uploadOk) {
      return NextResponse.json(
        {
          error: "Signed PDF generated but upload to BC failed",
          documentNo,
          id,
          uploadDetails,
        },
        { status: 502 }
      );
    }

    if (mode === "pdf") {
      return new NextResponse(new Uint8Array(signedPdfBytes), {
        status: 200,
        headers: {
          "Content-Type": "application/pdf",
          "Content-Disposition": `inline; filename=SalesShipment_${encodeURIComponent(documentNo)}_signed.pdf`,
          "Cache-Control": "no-store",
        },
      });
    }

    return NextResponse.json({ ok: true, documentNo, id });
  } catch (error: any) {
    return NextResponse.json(
      { error: error?.message || "Internal Server Error" },
      { status: 500 }
    );
  }
}
