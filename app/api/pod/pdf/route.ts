import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { PDFDocument, StandardFonts, rgb } from "pdf-lib";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type PodRecord = {
  shipmentNo: string;
  signedBy?: string;
  note?: string;
  createdAt: string;
  imagePath?: string;
};

const dataDir = path.join(process.cwd(), "data", "tms");
const podsDir = path.join(dataDir, "pods");

function safeFilePart(v: string) {
  return v.replace(/[^a-zA-Z0-9._-]/g, "_");
}

async function ensureDirs() {
  await fs.mkdir(podsDir, { recursive: true });
}

async function loadPodRecord(shipmentNo: string): Promise<PodRecord | null> {
  await ensureDirs();
  const metaPath = path.join(podsDir, `${safeFilePart(shipmentNo)}.json`);
  try {
    const raw = await fs.readFile(metaPath, "utf8");
    const rec = JSON.parse(raw) as PodRecord;
    return rec && rec.shipmentNo ? rec : null;
  } catch {
    return null;
  }
}

async function loadSignatureBytesFromPublicPath(imagePath: string): Promise<Uint8Array | null> {
  const rel = String(imagePath || "").trim();
  if (!rel.startsWith("/")) return null;
  const abs = path.join(process.cwd(), "public", rel.replace(/^\/+/, ""));
  try {
    const buf = await fs.readFile(abs);
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

async function generatePodPdf(opts: {
  shipmentNo: string;
  signedBy?: string;
  note?: string;
  createdAt?: string;
  signatureBytes?: Uint8Array | null;
}) {
  const doc = await PDFDocument.create();
  const page = doc.addPage([595.28, 841.89]);
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

  page.drawText(`Expédition: ${opts.shipmentNo}`, {
    x: margin,
    y,
    size: 12,
    font,
    color: rgb(0.15, 0.15, 0.15),
  });
  y -= 18;

  if (opts.createdAt) {
    page.drawText(`Date: ${new Date(opts.createdAt).toLocaleString()}`, {
      x: margin,
      y,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2),
    });
    y -= 16;
  }

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
    const clipped = note.length > 500 ? `${note.slice(0, 500)}…` : note;
    page.drawText(clipped, {
      x: margin,
      y,
      size: 11,
      font,
      color: rgb(0.2, 0.2, 0.2),
      maxWidth: width - margin * 2,
      lineHeight: 14,
    });
    y -= 70;
  } else {
    y -= 12;
  }

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

  y -= 170;

  if (opts.signatureBytes && opts.signatureBytes.length > 0) {
    try {
      const png = await doc.embedPng(opts.signatureBytes);
      const dims = png.scale(1);
      const maxW = width - margin * 2;
      const maxH = 140;
      const scale = Math.min(maxW / dims.width, maxH / dims.height, 1);
      page.drawImage(png, {
        x: margin,
        y: Math.max(margin, y),
        width: dims.width * scale,
        height: dims.height * scale,
      });
    } catch {
      // ignore image embed failure
    }
  }

  const bytes = await doc.save();
  return Buffer.from(bytes);
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const shipmentNo = String(searchParams.get("shipmentNo") || "").trim();
    if (!shipmentNo) {
      return NextResponse.json({ error: "shipmentNo is required" }, { status: 400 });
    }

    const rec = await loadPodRecord(shipmentNo);
    if (!rec) {
      return NextResponse.json({ error: "POD record not found", shipmentNo }, { status: 404 });
    }

    const signatureBytes = rec.imagePath ? await loadSignatureBytesFromPublicPath(rec.imagePath) : null;
    const pdfBuf = await generatePodPdf({
      shipmentNo: rec.shipmentNo,
      signedBy: rec.signedBy,
      note: rec.note,
      createdAt: rec.createdAt,
      signatureBytes,
    });

    return new NextResponse(new Uint8Array(pdfBuf), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `inline; filename=POD_${encodeURIComponent(shipmentNo)}.pdf`,
        "Cache-Control": "no-store",
      },
    });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to generate POD PDF" }, { status: 500 });
  }
}
