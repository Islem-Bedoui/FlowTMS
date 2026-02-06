"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type ReturnsRecord = {
  shipmentNo: string;
  createdAt: string;
  updatedAt?: string;
  values: Record<string, number>;
  note?: string;
};

export default function HistoriqueRetoursPage() {
  const [records, setRecords] = useState<ReturnsRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [query, setQuery] = useState("");

  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const res = await fetch("/api/returns", { cache: "no-store" });
        const json = await res.json();
        if (!cancelled) setRecords((json.records || []) as ReturnsRecord[]);
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return records;
    return records.filter(r =>
      (r.shipmentNo || "").toLowerCase().includes(q) ||
      (r.note || "").toLowerCase().includes(q)
    );
  }, [records, query]);

  const fmt = (n: number | undefined) => (Number.isFinite(n as number) ? String(n) : "0");

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="container mx-auto p-4 md:p-6 max-w-5xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="xp1 text-2xl bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, var(--shape-4), var(--logo-3))" }}>
              Historique des retours
            </h1>
            <div className="xp-text mt-1 text-slate-600">Toutes les quantités de retours / vides enregistrées</div>
          </div>
          <Link href="/regions-planning" className="xp-text px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50">
            Retour
          </Link>
        </div>

        <div className="bg-white/80 rounded-2xl border p-4" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
          <div className="flex flex-col md:flex-row md:items-center gap-2 mb-4">
            <input
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher expédition / note..."
              className="xp-text px-3 py-2 border rounded-lg bg-white focus:outline-none focus:ring-2 w-full"
              style={{ borderColor: "rgba(79,88,165,0.25)" }}
            />
          </div>

          {loading ? (
            <div className="xp-text text-slate-500">Chargement...</div>
          ) : filtered.length === 0 ? (
            <div className="xp-text text-slate-500">Aucun retour</div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filtered.map((r) => (
                <div key={`${r.shipmentNo}-${r.updatedAt || r.createdAt}`} className="rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
                  <div className="flex items-start justify-between gap-2">
                    <div>
                      <div className="xp2" style={{ color: "var(--logo-4)" }}>{r.shipmentNo}</div>
                      <div className="xp-text text-slate-600 mt-1">Créé: {new Date(r.createdAt).toLocaleString()}</div>
                      {r.updatedAt && <div className="xp-text text-slate-600">MAJ: {new Date(r.updatedAt).toLocaleString()}</div>}
                      {r.note && <div className="xp-text text-slate-600">Note: {r.note}</div>}
                    </div>
                    <Link
                      href={`/retours-vides?shipmentNo=${encodeURIComponent(r.shipmentNo)}`}
                      className="xp-text px-2 py-1 rounded-lg text-white"
                      style={{ backgroundColor: "var(--shape-4)" }}
                    >
                      Ouvrir
                    </Link>
                  </div>

                  <div className="mt-3 grid grid-cols-2 gap-2">
                    {Object.entries(r.values || {}).map(([k, v]) => (
                      <div key={k} className="xp-text px-2 py-1 rounded-lg" style={{ backgroundColor: "rgba(150,194,206,0.18)", color: "var(--logo-4)" }}>
                        {k}: {fmt(v)}
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
