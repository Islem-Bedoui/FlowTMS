import { NextResponse } from "next/server";
import { promises as fs } from "fs";
import path from "path";
import { mockOrders } from "@/types/mockOrders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type ReturnsRecord = {
  shipmentNo: string;
  createdAt: string;
  updatedAt?: string;
  values: Record<string, number>;
  note?: string;
  hasColis?: boolean;
  hasEmballagesVides?: boolean;
  defects?: Array<{ itemNo: string; qty: number; reason?: string }>;
};

const dataDir = path.join(process.cwd(), "data", "tms");
const returnsDir = path.join(dataDir, "returns");

async function ensureDirs() {
  await fs.mkdir(returnsDir, { recursive: true });
}

function safeFilePart(v: string) {
  return v.replace(/[^a-zA-Z0-9._-]/g, "_");
}

function buildMockReturn(shipmentNo: string, createdAtISO: string): ReturnsRecord {
  const seed = Number(String(shipmentNo).replace(/\D/g, "").slice(-2)) || 10;
  return {
    shipmentNo,
    createdAt: createdAtISO,
    updatedAt: createdAtISO,
    values: {
      palettes: (seed % 8) + 1,
      caisses: (seed % 12) + 2,
      bouteilles: (seed % 20) + 3,
      futs: seed % 3,
      autre: seed % 2,
    },
    note: "",
    hasColis: true,
    hasEmballagesVides: true,
    defects: [],
  };
}

function getMockReturns(): ReturnsRecord[] {
  const list = Array.isArray(mockOrders) ? mockOrders : [];
  const picked = list.slice(0, 4);
  const records = picked.map((o, i) => {
    const shipmentNo = `WHS-${String((o as any)?.No || "").trim()}`;
    const baseDate = String((o as any)?.Requested_Delivery_Date || (o as any)?.Shipment_Date || "").slice(0, 10);
    const createdAtISO = baseDate
      ? `${baseDate}T${String(9 + i).padStart(2, "0")}:15:00.000Z`
      : new Date(Date.now() - i * 86400000).toISOString();
    return buildMockReturn(shipmentNo, createdAtISO);
  });

  records.sort((a, b) => {
    const da = a.updatedAt || a.createdAt || "";
    const db = b.updatedAt || b.createdAt || "";
    return db.localeCompare(da);
  });
  return records;
}

export async function GET(req: Request) {
  try {
    await ensureDirs();
    const { searchParams } = new URL(req.url);
    const shipmentNo = (searchParams.get("shipmentNo") || "").trim();

    if (!shipmentNo) {
      const files = await fs.readdir(returnsDir).catch(() => [] as string[]);
      const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json"));
      const records: ReturnsRecord[] = [];

      for (const f of jsonFiles) {
        try {
          const raw = await fs.readFile(path.join(returnsDir, f), "utf8");
          const rec = JSON.parse(raw) as ReturnsRecord;
          if (rec?.shipmentNo) records.push(rec);
        } catch {
        }
      }

      records.sort((a, b) => {
        const da = a.updatedAt || a.createdAt || "";
        const db = b.updatedAt || b.createdAt || "";
        return db.localeCompare(da);
      });

      if (records.length === 0) {
        return NextResponse.json({ records: getMockReturns() });
      }

      return NextResponse.json({ records });
    }

    const recPath = path.join(returnsDir, `${safeFilePart(shipmentNo)}.json`);

    try {
      const raw = await fs.readFile(recPath, "utf8");
      const record = JSON.parse(raw) as ReturnsRecord;
      return NextResponse.json({ record });
    } catch {
      const createdAtISO = new Date().toISOString();
      return NextResponse.json({ record: buildMockReturn(shipmentNo, createdAtISO) });
    }
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to read returns" }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    await ensureDirs();
    const { searchParams } = new URL(req.url);
    const shipmentNo = (searchParams.get("shipmentNo") || "").trim();
    if (!shipmentNo) {
      return NextResponse.json({ error: "shipmentNo is required" }, { status: 400 });
    }
    const recPath = path.join(returnsDir, `${safeFilePart(shipmentNo)}.json`);
    try { await fs.unlink(recPath); } catch {}
    return NextResponse.json({ ok: true });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to delete returns" }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await ensureDirs();
    const body = (await req.json()) as {
      shipmentNo?: string;
      values?: Record<string, number | string | null | undefined>;
      note?: string;
      hasColis?: boolean;
      hasEmballagesVides?: boolean;
      defects?: Array<{ itemNo?: string; qty?: number | string | null; reason?: string }>;
    };

    const shipmentNo = (body.shipmentNo || "").trim();
    if (!shipmentNo) {
      return NextResponse.json({ error: "shipmentNo is required" }, { status: 400 });
    }

    const now = new Date().toISOString();
    const values: Record<string, number> = {};

    for (const [k, v] of Object.entries(body.values || {})) {
      const n = typeof v === "number" ? v : Number(String(v ?? "").trim());
      values[k] = Number.isFinite(n) ? n : 0;
    }

    const recPath = path.join(returnsDir, `${safeFilePart(shipmentNo)}.json`);

    let createdAt = now;
    try {
      const existingRaw = await fs.readFile(recPath, "utf8");
      const existing = JSON.parse(existingRaw) as ReturnsRecord;
      if (existing?.createdAt) createdAt = existing.createdAt;
    } catch {
    }

    const defects = Array.isArray(body.defects)
      ? body.defects
          .map((d) => ({
            itemNo: String(d?.itemNo || '').trim(),
            qty: Number(d?.qty ?? 0),
            reason: String(d?.reason || '').trim() || undefined,
          }))
          .filter((d) => d.itemNo && Number.isFinite(d.qty) && d.qty > 0)
      : [];

    const record: ReturnsRecord = {
      shipmentNo,
      createdAt,
      updatedAt: now,
      values,
      note: body.note?.trim() || undefined,
      hasColis: typeof body.hasColis === 'boolean' ? body.hasColis : undefined,
      hasEmballagesVides: typeof body.hasEmballagesVides === 'boolean' ? body.hasEmballagesVides : undefined,
      defects,
    };

    await fs.writeFile(recPath, JSON.stringify(record, null, 2), "utf8");
    return NextResponse.json({ ok: true, record });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to save returns" }, { status: 500 });
  }
}
