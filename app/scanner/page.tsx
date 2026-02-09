"use client";

import React, { Suspense, useEffect, useMemo, useRef, useState } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";

type StepKey = "arrive" | "livre" | "signe" | "retours";

type StepState = {
  checked: boolean;
  at?: string;
};

type ShipmentSteps = {
  shipmentNo: string;
  city?: string;
  steps: Record<StepKey, StepState>;
  updatedAt: string;
};

type PodRecord = {
  shipmentNo: string;
  signedBy?: string;
  note?: string;
  createdAt: string;
  imagePath?: string;
};

type StepsStore = Record<string, ShipmentSteps>;

const STORAGE_KEY = "tms_scanner_steps_v1";

function nowISO() {
  return new Date().toISOString();
}

function loadStore(): StepsStore {
  try {
    const raw = localStorage.getItem(STORAGE_KEY) || "{}";
    const obj = JSON.parse(raw) as StepsStore;
    return obj && typeof obj === "object" ? obj : {};
  } catch {
    return {};
  }
}

function saveStore(store: StepsStore) {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(store));
  } catch {}
}

function defaultSteps(): Record<StepKey, StepState> {
  return {
    arrive: { checked: false },
    livre: { checked: false },
    signe: { checked: false },
    retours: { checked: false },
  };
}

function fmtDateTime(s?: string) {
  if (!s) return "-";
  const d = new Date(s);
  if (!Number.isFinite(d.getTime())) return s;
  return d.toLocaleString();
}

function ScannerInner() {
  const router = useRouter();
  const sp = useSearchParams();

  const initialShipmentNo = (sp?.get("shipmentNo") || "").trim();
  const city = (sp?.get("city") || "").trim();
  const nextUrl = (sp?.get("next") || "").trim();

  const [shipmentNo, setShipmentNo] = useState<string>(initialShipmentNo);
  const [store, setStore] = useState<StepsStore>({});
  const [error, setError] = useState<string | null>(null);
  const [pod, setPod] = useState<PodRecord | null>(null);
  const [podLoading, setPodLoading] = useState<boolean>(false);

  // Camera scanner state
  const [scanOpen, setScanOpen] = useState(false);
  const [scanSupported, setScanSupported] = useState(false);
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectorRef = useRef<any>(null);

  useEffect(() => {
    setStore(loadStore());
  }, []);

  useEffect(() => {
    const supported = typeof window !== "undefined" && (window as any).BarcodeDetector && navigator?.mediaDevices?.getUserMedia;
    setScanSupported(Boolean(supported));
  }, []);

  const current = useMemo(() => {
    const key = shipmentNo.trim();
    if (!key) return null;
    return store[key] || null;
  }, [store, shipmentNo]);

  const steps = current?.steps || defaultSteps();

  useEffect(() => {
    const no = shipmentNo.trim();
    if (!no) {
      setPod(null);
      return;
    }
    let cancelled = false;

    (async () => {
      setPodLoading(true);
      try {
        const res = await fetch(`/api/pod?shipmentNo=${encodeURIComponent(no)}`, { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) {
          setPod((json.record || null) as PodRecord | null);
        }
      } catch {
        if (!cancelled) setPod(null);
      } finally {
        if (!cancelled) setPodLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shipmentNo]);

  const signatureDone = Boolean(pod && pod.shipmentNo);

  const setStep = (k: StepKey, checked: boolean) => {
    const key = shipmentNo.trim();
    if (!key) {
      setError("Saisis d’abord un numéro d’expédition");
      return;
    }
    setError(null);

    setStore((prev) => {
      const next = { ...prev };
      const existing: ShipmentSteps = next[key] || {
        shipmentNo: key,
        city: city || undefined,
        steps: defaultSteps(),
        updatedAt: nowISO(),
      };
      const newSteps = { ...existing.steps };
      newSteps[k] = { checked, at: checked ? nowISO() : undefined };
      const updated: ShipmentSteps = {
        ...existing,
        city: city || existing.city,
        steps: newSteps,
        updatedAt: nowISO(),
      };
      next[key] = updated;
      saveStore(next);
      return next;
    });
  };

  const finish = () => {
    if (nextUrl) router.push(nextUrl);
  };

  const openSignature = () => {
    const no = shipmentNo.trim();
    if (!no) {
      setError("Saisis d’abord un numéro d’expédition");
      return;
    }
    const params = new URLSearchParams();
    params.set("shipmentNo", no);
    if (nextUrl) params.set("next", nextUrl);
    router.push(`/pod-signature?${params.toString()}`);
  };

  const openScan = async () => {
    if (!scanSupported) {
      const code = window.prompt("Scanner non disponible. Saisir le code expédition");
      const v = String(code || "").trim();
      if (v) setShipmentNo(v);
      return;
    }

    setError(null);
    setScanOpen(true);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: "environment" }, audio: false });
      streamRef.current = stream;
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        await videoRef.current.play();
      }

      detectorRef.current = new (window as any).BarcodeDetector({ formats: ["qr_code", "code_128", "ean_13", "ean_8"] });
    } catch (e: any) {
      setError(e?.message || "Impossible d’ouvrir la caméra");
      setScanOpen(false);
    }
  };

  const closeScan = () => {
    setScanOpen(false);
    try {
      streamRef.current?.getTracks()?.forEach((t) => t.stop());
    } catch {}
    streamRef.current = null;
    detectorRef.current = null;
  };

  useEffect(() => {
    if (!scanOpen) return;
    let cancelled = false;

    const tick = async () => {
      if (cancelled) return;
      const video = videoRef.current;
      const det = detectorRef.current;
      if (!video || !det) {
        requestAnimationFrame(tick);
        return;
      }

      try {
        const codes = await det.detect(video);
        const raw = Array.isArray(codes) && codes[0]?.rawValue ? String(codes[0].rawValue) : "";
        const v = raw.trim();
        if (v) {
          setShipmentNo(v);
          closeScan();
          return;
        }
      } catch {
        // ignore transient errors
      }

      requestAnimationFrame(tick);
    };

    requestAnimationFrame(tick);

    return () => {
      cancelled = true;
    };
  }, [scanOpen]);

  useEffect(() => {
    return () => {
      try {
        streamRef.current?.getTracks()?.forEach((t) => t.stop());
      } catch {}
    };
  }, []);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="container mx-auto p-4 md:p-6 max-w-2xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1
              className="xp1 text-2xl bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, var(--logo-1), var(--logo-3))" }}
            >
              Scanner / Étapes
            </h1>
            <div className="xp-text mt-1 text-slate-600">Validation mobile des étapes (arrivée, livraison, signature, retours)</div>
          </div>
          {nextUrl ? (
            <button
              type="button"
              onClick={finish}
              className="xp-text px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Retour
            </button>
          ) : (
            <Link
              href="/suivi-tournees"
              className="xp-text px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Retour
            </Link>
          )}
        </div>

        <div className="bg-white/80 rounded-2xl border p-4" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
          {error && (
            <div className="mb-3 px-3 py-2 rounded-lg bg-rose-50 text-rose-700 text-sm border border-rose-200">
              {error}
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-2 items-end">
            <div className="md:col-span-2">
              <div className="xp3" style={{ color: "var(--logo-4)" }}>Expédition</div>
              <input
                value={shipmentNo}
                onChange={(e) => setShipmentNo(e.target.value)}
                placeholder="Ex: FR-2025-004"
                className="xp-text mt-2 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                style={{ borderColor: "rgba(79,88,165,0.25)" }}
              />
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={openScan}
                className="xp-text w-full px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: "var(--logo-1)" }}
                title={scanSupported ? "Scanner via caméra" : "Saisie manuelle"}
              >
                Scanner
              </button>
              {scanOpen && (
                <button
                  type="button"
                  onClick={closeScan}
                  className="xp-text px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  Fermer
                </button>
              )}
            </div>
          </div>

          {scanOpen && (
            <div className="mt-4 rounded-xl overflow-hidden border" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
              <video ref={videoRef} className="w-full h-64 bg-black" playsInline muted />
              <div className="px-3 py-2 text-xs text-slate-600 bg-white">Pointe la caméra vers un code-barres/QR.</div>
            </div>
          )}

          <div className="mt-5">
            <div className="xp2" style={{ color: "var(--logo-4)" }}>Étapes</div>
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Arrivé chez le client</div>
                  <div className="text-xs text-slate-500">{fmtDateTime(steps.arrive.at)}</div>
                </div>
                <input type="checkbox" checked={steps.arrive.checked} onChange={(e) => setStep("arrive", e.target.checked)} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Livraison effectuée</div>
                  <div className="text-xs text-slate-500">{fmtDateTime(steps.livre.at)}</div>
                </div>
                <input type="checkbox" checked={steps.livre.checked} onChange={(e) => setStep("livre", e.target.checked)} />
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Signature client</div>
                  <div className="text-xs text-slate-500">
                    {podLoading
                      ? "Vérification POD..."
                      : signatureDone
                        ? `Signée le ${fmtDateTime(pod?.createdAt)}${pod?.signedBy ? ` • ${pod.signedBy}` : ""}`
                        : "Non signée"}
                  </div>
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="checkbox"
                    checked={signatureDone}
                    disabled
                    title={signatureDone ? "Signature POD trouvée" : "Aucune signature POD"}
                  />
                  {!signatureDone && (
                    <button
                      type="button"
                      onClick={openSignature}
                      className="xp-text px-3 py-2 rounded-lg text-white"
                      style={{ backgroundColor: "var(--logo-1)" }}
                    >
                      Faire signer
                    </button>
                  )}
                </div>
              </div>

              <div className="flex items-center justify-between p-3 rounded-xl bg-slate-50">
                <div>
                  <div className="text-sm font-semibold text-slate-900">Retours / vides saisis</div>
                  <div className="text-xs text-slate-500">{fmtDateTime(steps.retours.at)}</div>
                </div>
                <input type="checkbox" checked={steps.retours.checked} onChange={(e) => setStep("retours", e.target.checked)} />
              </div>
            </div>

            {current && (
              <div className="mt-4 text-xs text-slate-500">
                Dernière mise à jour: {fmtDateTime(current.updatedAt)}
              </div>
            )}
          </div>

          <div className="mt-5 flex flex-wrap gap-2">
            {nextUrl && (
              <button
                type="button"
                onClick={finish}
                className="xp-text px-3 py-2 rounded-lg text-white"
                style={{ backgroundColor: "var(--shape-4)" }}
              >
                Terminer
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

export default function ScannerPage() {
  return (
    <Suspense fallback={null}>
      <ScannerInner />
    </Suspense>
  );
}
