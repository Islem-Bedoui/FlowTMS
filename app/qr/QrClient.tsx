"use client";

import { useEffect, useMemo, useState } from "react";
import QRCode from "qrcode";

export default function QrClient() {
  const [dataUrl, setDataUrl] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);

  const appUrl = useMemo(() => {
    const envUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
    if (envUrl) return envUrl.replace(/\/+$/, "");
    if (typeof window === "undefined") return "";
    return window.location.origin;
  }, []);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setErr(null);
      setDataUrl(null);
      try {
        if (!appUrl) throw new Error("APP URL unavailable");
        const url = await QRCode.toDataURL(appUrl, {
          margin: 2,
          width: 320,
          errorCorrectionLevel: "M",
          color: {
            dark: "#0e112c",
            light: "#ffffff",
          },
        });
        if (!cancelled) setDataUrl(url);
      } catch (e: any) {
        if (!cancelled) setErr(e?.message || "QR generation failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [appUrl]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="container mx-auto p-4 md:p-6 max-w-3xl">
        <div className="bg-white/80 rounded-2xl border p-4" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
          <div className="xp1 text-2xl" style={{ color: "var(--logo-4)" }}>
            QR Code
          </div>
          <div className="xp-text mt-1 text-slate-600">Scanne pour ouvrir l’application</div>

          <div className="mt-4 grid grid-cols-1 md:grid-cols-2 gap-4 items-start">
            <div className="rounded-2xl border bg-white p-4 flex items-center justify-center" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
              {dataUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={dataUrl} alt="QR" className="w-[320px] h-[320px]" />
              ) : (
                <div className="xp-text text-slate-500">Génération…</div>
              )}
            </div>

            <div className="rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
              <div className="xp3" style={{ color: "var(--logo-4)" }}>
                Lien
              </div>
              <div className="xp-text mt-1 break-all text-slate-700">{appUrl || "-"}</div>

              <div className="flex flex-wrap gap-2 mt-3">
                <a
                  href={appUrl || "#"}
                  target="_blank"
                  rel="noreferrer"
                  className="xp-text inline-flex items-center justify-center px-3 py-2 rounded-lg text-white"
                  style={{ backgroundColor: "var(--logo-1)" }}
                >
                  Ouvrir
                </a>
                <button
                  onClick={async () => {
                    try {
                      await navigator.clipboard.writeText(appUrl);
                    } catch {
                    }
                  }}
                  className="xp-text inline-flex items-center justify-center px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                >
                  Copier
                </button>
              </div>

              {err && <div className="xp-text mt-3" style={{ color: "#b45309" }}>{err}</div>}

              <div className="xp-text mt-4 text-slate-500">
                Pour un QR scannable depuis un autre appareil, configure `NEXT_PUBLIC_APP_URL` (ex: https://votre-domaine.com).
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
