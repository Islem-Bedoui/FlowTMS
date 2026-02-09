"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mockOrders } from "@/types/mockOrders";

type PodRecord = {
  shipmentNo: string;
  signedBy?: string;
  note?: string;
  createdAt: string;
  imagePath?: string;
};

type SalesShipmentLookup = {
  id?: string;
  no?: string;
};

function getCanvasPoint(canvas: HTMLCanvasElement, e: PointerEvent) {
  const rect = canvas.getBoundingClientRect();
  const x = (e.clientX - rect.left) * (canvas.width / rect.width);
  const y = (e.clientY - rect.top) * (canvas.height / rect.height);
  return { x, y };
}

export default function PodSignatureClient({ shipmentNo, nextUrl, skipReturns }: { shipmentNo: string; nextUrl?: string; skipReturns?: boolean }) {
  const router = useRouter();
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const lastRef = useRef<{ x: number; y: number } | null>(null);
  const [hasDrawn, setHasDrawn] = useState(false);

  const customerName = useMemo(() => {
    const no = String(shipmentNo || '').trim();
    if (!no) return '';
    const order = (mockOrders as any[]).find(o => String(o?.No || '').trim() === no);
    return String(order?.Sell_to_Customer_Name || '').trim();
  }, [shipmentNo]);

  const [signedBy, setSignedBy] = useState("");

  useEffect(() => {
    if (customerName && !signedBy) setSignedBy(customerName);
  }, [customerName]);
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [bcSigning, setBcSigning] = useState(false);
  const [bcMessage, setBcMessage] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [record, setRecord] = useState<PodRecord | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string | null>(null);

  const salesShipmentDocumentNo = useMemo(() => {
    const s = String(shipmentNo || "").trim();
    if (!s) return "";
    if (s.toUpperCase().startsWith("WHS-")) {
      return `SS-${s.slice(4)}`;
    }
    return s;
  }, [shipmentNo]);

  const showBcSignPdfButton =
    (process.env.NEXT_PUBLIC_SHOW_BC_SIGN_PDF_BUTTON || "")
      .trim()
      .toLowerCase() === "true" ||
    (process.env.NEXT_PUBLIC_SHOW_BC_SIGN_PDF_BUTTON || "")
      .trim()
      .toLowerCase() === "1" ||
    (process.env.NEXT_PUBLIC_SHOW_BC_SIGN_PDF_BUTTON || "")
      .trim()
      .toLowerCase() === "yes";

  const canSave = useMemo(() => Boolean(shipmentNo) && !saving && hasDrawn && signedBy.trim().length > 0, [shipmentNo, saving, hasDrawn, signedBy]);

  useEffect(() => {
    return () => {
      if (pdfPreviewUrl && pdfPreviewUrl.startsWith("blob:")) {
        try {
          URL.revokeObjectURL(pdfPreviewUrl);
        } catch {
        }
      }
    };
  }, [pdfPreviewUrl]);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    const cssW = canvas.clientWidth || 640;
    const cssH = canvas.clientHeight || 260;
    canvas.width = Math.round(cssW * dpr);
    canvas.height = Math.round(cssH * dpr);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0e112c";

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.strokeStyle = "rgba(64,111,181,0.35)";
    ctx.beginPath();
    ctx.moveTo(16, cssH - 42);
    ctx.lineTo(cssW - 16, cssH - 42);
    ctx.stroke();

    ctx.fillStyle = "rgba(14,17,44,0.55)";
    ctx.font = "12px Segoe UI";
    ctx.fillText("Signature client", 16, cssH - 20);
  }, []);

  useEffect(() => {
    if (!shipmentNo) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/pod?shipmentNo=${encodeURIComponent(shipmentNo)}`, { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) {
          const rec = (json.record || null) as PodRecord | null;
          setRecord(rec);
          if (rec?.signedBy) setSignedBy(rec.signedBy);
          if (rec?.note) setNote(rec.note);
        }
      } catch (e: any) {
        if (!cancelled) setError(e?.message || "Erreur de chargement");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shipmentNo]);

  const resolveSignedPdfUrl = async () => {
    if (!shipmentNo) return null;
    try {
      const res = await fetch(
        `/api/salesShipments?top=1&skip=0&number=${encodeURIComponent(salesShipmentDocumentNo)}`,
        { cache: "no-store" }
      );
      const json = await res.json();
      const first = (json?.value?.[0] || null) as SalesShipmentLookup | null;
      const id = String(first?.id || "").trim();
      const url = id
        ? `/api/salesShipments/pdf-file?id=${encodeURIComponent(id)}`
        : `/api/salesShipments/pdf-file?documentNo=${encodeURIComponent(salesShipmentDocumentNo)}`;
      return url;
    } catch {
      return `/api/salesShipments/pdf-file?documentNo=${encodeURIComponent(salesShipmentDocumentNo)}`;
    }
  };

  const signPdfInBc = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    if (!shipmentNo) {
      setError("shipmentNo manquant dans l’URL");
      return;
    }
    if (!hasDrawn) {
      setError("Veuillez signer avant d’envoyer vers Business Central.");
      return;
    }

    setBcSigning(true);
    setBcMessage(null);
    setError(null);
    try {
      const imageDataUrl = canvas.toDataURL("image/png");
      const res = await fetch("/api/salesShipments/sign-pdf?mode=pdf", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentNo: salesShipmentDocumentNo, imageDataUrl, signedBy, note }),
      });
      if (!res.ok) {
        const txt = await res.text();
        throw new Error(txt || `HTTP ${res.status}`);
      }

      const blob = await res.blob();
      const objUrl = URL.createObjectURL(blob);
      setPdfPreviewUrl(objUrl);
      setBcMessage("PDF signé et envoyé à Business Central.");

      try {
        await fetch("/api/salesShipments/signed", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ documentNo: salesShipmentDocumentNo, signed: true }),
        });
      } catch {
      }

      // if needed, the preview already uses the returned signed PDF; keep resolveSignedPdfUrl only as fallback.
    } catch (e: any) {
      setError(e?.message || "Erreur Business Central");
    } finally {
      setBcSigning(false);
    }
  };

  const clear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const cssW = canvas.clientWidth || 640;
    const cssH = canvas.clientHeight || 260;
    ctx.setTransform(1, 0, 0, 1, 0, 0);
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    const dpr = typeof window !== "undefined" ? window.devicePixelRatio || 1 : 1;
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);

    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, cssW, cssH);

    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0e112c";

    ctx.strokeStyle = "rgba(64,111,181,0.35)";
    ctx.beginPath();
    ctx.moveTo(16, cssH - 42);
    ctx.lineTo(cssW - 16, cssH - 42);
    ctx.stroke();

    ctx.fillStyle = "rgba(14,17,44,0.55)";
    ctx.font = "12px Segoe UI";
    ctx.fillText("Signature client", 16, cssH - 20);

    lastRef.current = null;
    setHasDrawn(false);
  };

  const onPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    canvas.setPointerCapture(e.pointerId);
    setIsDrawing(true);

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasPoint(canvas, e.nativeEvent);
    lastRef.current = { x, y };
    ctx.beginPath();
    ctx.moveTo(x, y);
  };

  const onPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    const { x, y } = getCanvasPoint(canvas, e.nativeEvent);
    const last = lastRef.current;
    if (!last) {
      lastRef.current = { x, y };
      return;
    }

    ctx.beginPath();
    ctx.moveTo(last.x, last.y);
    ctx.lineTo(x, y);
    ctx.stroke();

    if (!hasDrawn) setHasDrawn(true);

    lastRef.current = { x, y };
  };

  const onPointerUp = (e: React.PointerEvent<HTMLCanvasElement>) => {
    if (!isDrawing) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    try {
      canvas.releasePointerCapture(e.pointerId);
    } catch {
    }
    setIsDrawing(false);
    lastRef.current = null;
  };

  const save = async () => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    if (!signedBy.trim()) {
      setError("Veuillez saisir le nom du client.");
      return;
    }
    if (!hasDrawn) {
      setError("Veuillez signer avant d'enregistrer.");
      return;
    }

    setSaving(true);
    setError(null);

    try {
      const imageDataUrl = canvas.toDataURL("image/png");
      const res = await fetch("/api/pod", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentNo, signedBy, note, imageDataUrl }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Erreur enregistrement");
      setRecord(json.record || null);

      // Chain workflow: Signature -> Retours (if included) -> back to suivi via nextUrl
      if (skipReturns) {
        // Skip retours, go directly back
        if (nextUrl) router.push(nextUrl);
        else router.push('/suivi-tournees');
      } else {
        const params = new URLSearchParams();
        params.set('shipmentNo', shipmentNo);
        if (nextUrl) params.set('next', nextUrl);
        router.push(`/retours-vides?${params.toString()}`);
      }

      if (showBcSignPdfButton) {
        try {
          const bcRes = await fetch("/api/salesShipments/sign-pdf?mode=pdf", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ documentNo: salesShipmentDocumentNo, imageDataUrl, signedBy, note }),
          });

          if (!bcRes.ok) {
            const bcTxt = await bcRes.text();
            setError(
              `Signature enregistrée, mais mise à jour Business Central échouée (PDF+Signed). ${bcTxt || `HTTP ${bcRes.status}`}`
            );
          } else {
            const blob = await bcRes.blob();
            const objUrl = URL.createObjectURL(blob);
            setPdfPreviewUrl(objUrl);
            try {
              await fetch("/api/salesShipments/signed", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ documentNo: salesShipmentDocumentNo, signed: true }),
              });
            } catch {
            }
          }
        } catch (e: any) {
          setError(
            `Signature enregistrée, mais mise à jour Business Central échouée (PDF+Signed). ${e?.message || "Erreur"}`
          );
        }
      }
    } catch (e: any) {
      setError(e?.message || "Erreur enregistrement");
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="container mx-auto p-4 md:p-6 max-w-3xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="xp1 text-2xl bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, var(--logo-1), var(--logo-3))" }}>
              Signature client
            </h1>
            <div className="xp-text mt-1 text-slate-600">Expédition: <span className="font-semibold" style={{ color: "var(--logo-4)" }}>{shipmentNo || "-"}</span></div>
          </div>
          <Link href="/regions-planning" className="xp-text px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            Retour
          </Link>
        </div>

        {!shipmentNo && (
          <div className="p-4 rounded-xl border bg-white" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
            <div className="xp-text" style={{ color: "#b45309" }}>shipmentNo manquant dans l’URL</div>
          </div>
        )}

        <div className="bg-white/80 rounded-2xl border p-4" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-4">
            <div>
              <div className="xp3" style={{ color: "var(--logo-4)" }}>Signé par</div>
              <input value={signedBy} onChange={e => setSignedBy(e.target.value)} className="xp-text mt-1 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2" style={{ borderColor: signedBy.trim() ? "rgba(79,88,165,0.25)" : "#ef4444" }} placeholder="Nom du client (obligatoire)" />
              {!signedBy.trim() && <div className="text-xs text-rose-500 mt-1">Le nom du client est obligatoire</div>}
            </div>
            <div>
              <div className="xp3" style={{ color: "var(--logo-4)" }}>Note</div>
              <input value={note} onChange={e => setNote(e.target.value)} className="xp-text mt-1 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2" style={{ borderColor: "rgba(79,88,165,0.25)" }} placeholder="Commentaire..." />
            </div>
          </div>

          <div className="rounded-xl border overflow-hidden" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
            <canvas
              ref={canvasRef}
              className="w-full h-[260px] bg-white touch-none"
              onPointerDown={onPointerDown}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerCancel={onPointerUp}
            />
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <button onClick={clear} className="xp-text px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
              Effacer
            </button>
            <button disabled={!canSave} onClick={save} className="xp-text px-3 py-2 rounded-lg text-white disabled:opacity-60" style={{ backgroundColor: "var(--logo-1)" }}>
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
            {showBcSignPdfButton && (
              <button
                disabled={!shipmentNo || !hasDrawn || bcSigning}
                onClick={signPdfInBc}
                className="xp-text px-3 py-2 rounded-lg text-white disabled:opacity-60"
                style={{ backgroundColor: "var(--logo-4)" }}
              >
                {bcSigning ? "Envoi BC..." : "Signer PDF (BC)"}
              </button>
            )}
          </div>

          {error && (
            <div className="xp-text mt-3" style={{ color: "#b45309" }}>{error}</div>
          )}

          {bcMessage && (
            <div className="xp-text mt-3" style={{ color: "#166534" }}>{bcMessage}</div>
          )}

          {pdfPreviewUrl && (
            <div className="mt-4 rounded-2xl border bg-white overflow-hidden" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
              <div className="flex flex-wrap items-center justify-between gap-2 p-3 bg-slate-50 border-b" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
                <div className="xp3" style={{ color: "var(--logo-4)" }}>PDF signé</div>
                <div className="flex gap-2">
                  <a
                    href={pdfPreviewUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="xp-text inline-flex items-center justify-center px-3 py-1.5 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                  >
                    Ouvrir
                  </a>
                  <button
                    onClick={() => router.push("/sales-shipments")}
                    className="xp-text inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-white"
                    style={{ backgroundColor: "var(--logo-1)" }}
                  >
                    Retour
                  </button>
                </div>
              </div>
              <div className="bg-slate-100" style={{ height: "78vh" }}>
                <iframe title="PDF" src={pdfPreviewUrl} className="w-full h-full" />
              </div>
            </div>
          )}

          <div className="mt-4">
            <div className="xp3" style={{ color: "var(--logo-4)" }}>Dernière signature enregistrée</div>
            {loading ? (
              <div className="xp-text mt-1 text-slate-500">Chargement...</div>
            ) : record?.imagePath ? (
              <div className="mt-2">
                <div className="xp-text text-slate-600">Date: {new Date(record.createdAt).toLocaleString()}</div>
                <img src={record.imagePath} alt="Signature" className="mt-2 rounded-xl border bg-white" style={{ borderColor: "rgba(79,88,165,0.18)" }} />
                <button
                  onClick={async () => {
                    if (!confirm('Supprimer cette signature POD ?')) return;
                    try {
                      await fetch(`/api/pod?shipmentNo=${encodeURIComponent(shipmentNo)}`, { method: 'DELETE' });
                      setRecord(null);
                      setSignedBy('');
                      clear();
                    } catch {}
                  }}
                  className="xp-text mt-2 px-3 py-1.5 rounded-lg bg-white text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 text-xs"
                >Supprimer la signature</button>
              </div>
            ) : (
              <div className="xp-text mt-1 text-slate-500">Aucune signature enregistrée</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
