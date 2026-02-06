import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";

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
const publicPodsDir = path.join(process.cwd(), "public", "tms", "pods");

async function ensureDirs() {
  await fs.mkdir(podsDir, { recursive: true });
  await fs.mkdir(publicPodsDir, { recursive: true });
}

function safeFilePart(v: string) {
  return v.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function GET(req: Request) {
  try {
    await ensureDirs();
    const { searchParams } = new URL(req.url);
    const shipmentNo = (searchParams.get("shipmentNo") || "").trim();

    if (!shipmentNo) {
      const files = await fs.readdir(podsDir).catch(() => [] as string[]);
      const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json"));
      const records: PodRecord[] = [];

      for (const f of jsonFiles) {
        try {
          const raw = await fs.readFile(path.join(podsDir, f), "utf8");
          const rec = JSON.parse(raw) as PodRecord;
          if (rec?.shipmentNo) records.push(rec);
        } catch {
        }
      }

      records.sort((a, b) => (b.createdAt || "").localeCompare(a.createdAt || ""));
      return NextResponse.json({ records });
    }

    const metaPath = path.join(podsDir, `${safeFilePart(shipmentNo)}.json`);

    try {
      const raw = await fs.readFile(metaPath, "utf8");
      const record = JSON.parse(raw) as PodRecord;
      return NextResponse.json({ record });
    } catch {
      return NextResponse.json({ record: null });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to read POD" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDirs();
    const body = (await req.json()) as {
      shipmentNo?: string;
      signedBy?: string;
      note?: string;
      imageDataUrl?: string;
    };

    const shipmentNo = (body.shipmentNo || "").trim();
    if (!shipmentNo) {
      return NextResponse.json({ error: "shipmentNo is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    let imagePath: string | undefined;

    if (body.imageDataUrl) {
      const m = body.imageDataUrl.match(/^data:image\/(png|jpeg);base64,(.*)$/);
      if (!m) {
        return NextResponse.json({ error: "Invalid imageDataUrl" }, { status: 400 });
      }
      const ext = m[1] === "jpeg" ? "jpg" : "png";
      const b64 = m[2];
      const buf = Buffer.from(b64, "base64");

      const fileName = `${safeFilePart(shipmentNo)}-${Date.now()}.${ext}`;
      const filePath = path.join(publicPodsDir, fileName);
      await fs.writeFile(filePath, buf);
      imagePath = path.posix.join("/tms/pods", fileName);
    }

    const record: PodRecord = {
      shipmentNo,
      signedBy: body.signedBy?.trim() || undefined,
      note: body.note?.trim() || undefined,
      createdAt: now,
      imagePath,
    };

    const metaPath = path.join(podsDir, `${safeFilePart(shipmentNo)}.json`);
    await fs.writeFile(metaPath, JSON.stringify(record, null, 2), "utf8");

    return NextResponse.json({ ok: true, record });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to save POD" }, { status: 500 });
  }
}
