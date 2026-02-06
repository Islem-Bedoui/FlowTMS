import PodSignatureClient from "./PodSignatureClient";

export const dynamic = "force-dynamic";

export default async function PodSignaturePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const sp = await searchParams;
  const raw = sp?.shipmentNo;
  const shipmentNo = Array.isArray(raw) ? String(raw[0] || "") : String(raw || "");
  const rawNext = sp?.next;
  const nextUrl = Array.isArray(rawNext) ? String(rawNext[0] || "") : String(rawNext || "");
  return <PodSignatureClient shipmentNo={shipmentNo.trim()} nextUrl={nextUrl.trim()} />;
}
