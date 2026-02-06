import { promises as fs } from "fs";
import path from "path";

const dataDir = path.join(process.cwd(), "data", "tms");
const whseStatusDir = path.join(dataDir, "whse-status");

async function ensureDirs() {
  await fs.mkdir(whseStatusDir, { recursive: true });
}

function safeFilePart(v: string) {
  return v.replace(/[^a-zA-Z0-9._-]/g, "_");
}

export async function readAllWhseStatuses(): Promise<Record<string, string>> {
  await ensureDirs();
  const files = await fs.readdir(whseStatusDir).catch(() => [] as string[]);
  const jsonFiles = files.filter((f) => f.toLowerCase().endsWith(".json"));
  const out: Record<string, string> = {};

  for (const f of jsonFiles) {
    try {
      const raw = await fs.readFile(path.join(whseStatusDir, f), "utf8");
      const j = JSON.parse(raw) as { shipmentNo?: string; status?: string };
      const shipmentNo = String(j?.shipmentNo || "").trim();
      const status = String(j?.status || "").trim();
      if (shipmentNo && status) out[shipmentNo] = status;
    } catch {
    }
  }
  return out;
}

export async function writeWhseStatus(shipmentNo: string, status: string) {
  await ensureDirs();
  const rec = {
    shipmentNo,
    status,
    updatedAt: new Date().toISOString(),
  };
  const p = path.join(whseStatusDir, `${safeFilePart(shipmentNo)}.json`);
  await fs.writeFile(p, JSON.stringify(rec, null, 2), "utf8");
  return rec;
}
