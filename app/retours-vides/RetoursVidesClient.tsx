"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";

type ReturnsRecord = {
  shipmentNo: string;
  createdAt: string;
  updatedAt?: string;
  values: Record<string, number>;
  note?: string;
  hasColis?: boolean;
  hasEmballagesVides?: boolean;
  defects?: Array<{ itemNo: string; qty: number; reason?: string }>;
  images?: Array<{ id: string; url: string; name: string; uploadedAt: string }>;
};

type ShipmentItem = { itemNo: string; description?: string };

const defaultItems = [
  { key: "palettes", label: "Palettes" },
  { key: "caisses", label: "Caisses" },
  { key: "bouteilles", label: "Bouteilles" },
  { key: "futs", label: "Fûts" },
  { key: "autre", label: "Autre" },
];

export default function RetoursVidesClient({ shipmentNo, nextUrl }: { shipmentNo: string; nextUrl?: string }) {
  const router = useRouter();
  const [values, setValues] = useState<Record<string, number>>(() => {
    const init: Record<string, number> = {};
    for (const it of defaultItems) init[it.key] = 0;
    return init;
  });
  const [note, setNote] = useState("");
  const [hasColis, setHasColis] = useState<boolean>(true);
  const [hasEmballagesVides, setHasEmballagesVides] = useState<boolean>(true);
  const [items, setItems] = useState<ShipmentItem[]>([]);
  const [itemsLoading, setItemsLoading] = useState<boolean>(false);
  const [defects, setDefects] = useState<Array<{ itemNo: string; qty: number; reason: string }>>([]);
  const [newDefect, setNewDefect] = useState<{ itemNo: string; qty: number; reason: string }>({ itemNo: "", qty: 1, reason: "" });
  const [record, setRecord] = useState<ReturnsRecord | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [images, setImages] = useState<Array<{ id: string; url: string; name: string; uploadedAt: string }>>([]);
  const [uploading, setUploading] = useState(false);

  const canSave = useMemo(() => Boolean(shipmentNo) && !saving, [shipmentNo, saving]);

  useEffect(() => {
    if (!shipmentNo) return;
    let cancelled = false;

    (async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`/api/returns?shipmentNo=${encodeURIComponent(shipmentNo)}`, { cache: "no-store" });
        const json = await res.json();
        const rec = (json.record || null) as ReturnsRecord | null;
        if (!cancelled) {
          setRecord(rec);
          if (rec?.values) {
            setValues((prev) => ({ ...prev, ...rec.values }));
          }
          if (rec?.note) setNote(rec.note);
          if (typeof rec?.hasColis === 'boolean') setHasColis(rec.hasColis);
          if (typeof rec?.hasEmballagesVides === 'boolean') setHasEmballagesVides(rec.hasEmballagesVides);
          if (Array.isArray(rec?.defects)) {
            setDefects(
              rec.defects
                .map((d) => ({ itemNo: String(d?.itemNo || ''), qty: Number(d?.qty ?? 0), reason: String(d?.reason || '') }))
                .filter((d) => d.itemNo && Number.isFinite(d.qty) && d.qty > 0)
                .map((d) => ({ ...d, reason: d.reason || '' }))
            );
          }
          if (Array.isArray(rec?.images)) {
            setImages(rec.images);
          }
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

  useEffect(() => {
    if (!shipmentNo) return;
    let cancelled = false;

    (async () => {
      setItemsLoading(true);
      try {
        const res = await fetch(`/api/whseShipmentLine?sourceNo=${encodeURIComponent(shipmentNo)}`, { cache: 'no-store' });
        const json = await res.json();
        const lines: any[] = Array.isArray(json?.value) ? json.value : [];
        const uniq = new Map<string, ShipmentItem>();
        for (const l of lines) {
          const itemNo = String(l?.Item_No || l?.ItemNo || '').trim();
          if (!itemNo) continue;
          const description = String(l?.Description || l?.description || '').trim() || undefined;
          if (!uniq.has(itemNo)) uniq.set(itemNo, { itemNo, description });
        }
        const list = Array.from(uniq.values()).sort((a, b) => a.itemNo.localeCompare(b.itemNo));
        if (!cancelled) setItems(list);
      } catch {
        if (!cancelled) setItems([]);
      } finally {
        if (!cancelled) setItemsLoading(false);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [shipmentNo]);

  const canAddDefect = useMemo(() => {
    return !!newDefect.itemNo && Number.isFinite(newDefect.qty) && newDefect.qty > 0;
  }, [newDefect.itemNo, newDefect.qty]);

  const addDefect = () => {
    if (!canAddDefect) return;
    setDefects((prev) => [...prev, { itemNo: newDefect.itemNo.trim(), qty: Number(newDefect.qty), reason: (newDefect.reason || '').trim() }]);
    setNewDefect({ itemNo: "", qty: 1, reason: "" });
  };

  const removeDefect = (idx: number) => {
    setDefects((prev) => prev.filter((_, i) => i !== idx));
  };

  const scanItem = async () => {
    // Simple mock: on mobile, allow quick entry via prompt.
    // (Real camera barcode scanning can be added later with a dedicated component.)
    const code = window.prompt('Scanner / saisir code article');
    const v = String(code || '').trim();
    if (!v) return;
    setNewDefect((prev) => ({ ...prev, itemNo: v }));
  };

  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (!files.length) return;

    setUploading(true);
    setError(null);

    try {
      const uploadPromises = files.map(async (file) => {
        const formData = new FormData();
        formData.append('file', file);
        formData.append('shipmentNo', shipmentNo);

        const response = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });

        if (!response.ok) {
          throw new Error(`Upload failed for ${file.name}`);
        }

        const result = await response.json();
        return {
          id: result.id || Date.now().toString() + Math.random(),
          url: result.url || URL.createObjectURL(file),
          name: file.name,
          uploadedAt: new Date().toISOString(),
        };
      });

      const uploadedImages = await Promise.all(uploadPromises);
      setImages((prev) => [...prev, ...uploadedImages]);
    } catch (error: any) {
      setError(error.message || 'Erreur lors du téléchargement des images');
    } finally {
      setUploading(false);
      // Clear the input
      e.target.value = '';
    }
  };

  const removeImage = (imageId: string) => {
    setImages((prev) => prev.filter((img) => img.id !== imageId));
  };

  const save = async () => {
    setSaving(true);
    setError(null);
    try {
      const res = await fetch("/api/returns", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentNo, values, note, hasColis, hasEmballagesVides, defects, images }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.error || "Erreur enregistrement");
      setRecord(json.record || null);

      if (nextUrl) {
        router.push(nextUrl);
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
            <h1 className="xp1 text-2xl bg-clip-text text-transparent" style={{ backgroundImage: "linear-gradient(90deg, var(--shape-4), var(--logo-3))" }}>
              Retours / Vides
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
          <div className="xp2 mb-3" style={{ color: "var(--logo-4)" }}>Retours</div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mb-3">
            <div className="p-3 rounded-xl border bg-white" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
              <div className="xp3" style={{ color: "var(--logo-4)" }}>Colis récupérés</div>
              <div className="mt-2 flex items-center gap-3">
                <label className="xp-text flex items-center gap-2">
                  <input type="radio" name="hasColis" checked={hasColis === true} onChange={() => setHasColis(true)} />
                  Oui
                </label>
                <label className="xp-text flex items-center gap-2">
                  <input type="radio" name="hasColis" checked={hasColis === false} onChange={() => setHasColis(false)} />
                  Non
                </label>
              </div>
            </div>

            <div className="p-3 rounded-xl border bg-white" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
              <div className="xp3" style={{ color: "var(--logo-4)" }}>Emballages vides récupérés</div>
              <div className="mt-2 flex items-center gap-3">
                <label className="xp-text flex items-center gap-2">
                  <input type="radio" name="hasEmballagesVides" checked={hasEmballagesVides === true} onChange={() => setHasEmballagesVides(true)} />
                  Oui
                </label>
                <label className="xp-text flex items-center gap-2">
                  <input type="radio" name="hasEmballagesVides" checked={hasEmballagesVides === false} onChange={() => setHasEmballagesVides(false)} />
                  Non
                </label>
              </div>
            </div>
          </div>

          {hasEmballagesVides && (
            <>
              <div className="xp2 mb-3" style={{ color: "var(--logo-4)" }}>Quantités récupérées (vides)</div>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {defaultItems.map((it) => (
                  <div key={it.key} className="p-3 rounded-xl border bg-white" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
                    <div className="xp3" style={{ color: "var(--logo-4)" }}>{it.label}</div>
                    <input
                      type="number"
                      inputMode="numeric"
                      value={values[it.key] ?? 0}
                      onChange={(e) => setValues((prev) => ({ ...prev, [it.key]: Number(e.target.value) }))}
                      className="xp-text mt-2 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                      style={{ borderColor: "rgba(79,88,165,0.25)" }}
                    />
                  </div>
                ))}
              </div>
            </>
          )}

          {!hasColis && !hasEmballagesVides && (
            <div className="p-4 rounded-xl border bg-slate-50 text-sm text-slate-500 mb-3" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
              Aucun retour à saisir — ni colis ni emballages vides récupérés.
            </div>
          )}

          <div className="mt-4">
            <div className="xp3" style={{ color: "var(--logo-4)" }}>Note</div>
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              className="xp-text mt-1 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
              style={{ borderColor: "rgba(79,88,165,0.25)" }}
              placeholder="Commentaire..."
            />
          </div>

          <div className="mt-6">
            <div className="xp2 mb-3" style={{ color: "var(--logo-4)" }}>Défauts article</div>

            <div className="p-3 rounded-xl border bg-white" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                <div>
                  <div className="xp3" style={{ color: "var(--logo-4)" }}>Article</div>
                  <div className="flex gap-2 mt-2">
                    <select
                      value={newDefect.itemNo}
                      onChange={(e) => setNewDefect((p) => ({ ...p, itemNo: e.target.value }))}
                      className="xp-text w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                      style={{ borderColor: "rgba(79,88,165,0.25)" }}
                      disabled={itemsLoading}
                    >
                      <option value="">{itemsLoading ? 'Chargement...' : 'Sélectionner...'}</option>
                      {items.map((it) => (
                        <option key={it.itemNo} value={it.itemNo}>
                          {it.itemNo}{it.description ? ` — ${it.description}` : ''}
                        </option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={scanItem}
                      className="xp-text px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                      title="Scanner (mobile) / saisir code"
                    >
                      Scanner
                    </button>
                  </div>
                </div>

                <div>
                  <div className="xp3" style={{ color: "var(--logo-4)" }}>Quantité</div>
                  <input
                    type="number"
                    inputMode="numeric"
                    value={newDefect.qty}
                    onChange={(e) => setNewDefect((p) => ({ ...p, qty: Number(e.target.value) }))}
                    className="xp-text mt-2 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                    style={{ borderColor: "rgba(79,88,165,0.25)" }}
                  />
                </div>

                <div>
                  <div className="xp3" style={{ color: "var(--logo-4)" }}>Raison / défaut</div>
                  <input
                    value={newDefect.reason}
                    onChange={(e) => setNewDefect((p) => ({ ...p, reason: e.target.value }))}
                    className="xp-text mt-2 w-full px-3 py-2 border rounded-lg focus:outline-none focus:ring-2"
                    style={{ borderColor: "rgba(79,88,165,0.25)" }}
                    placeholder="Casse, manquant, abîmé..."
                  />
                </div>
              </div>

              <div className="mt-3 flex gap-2">
                <button
                  type="button"
                  onClick={addDefect}
                  disabled={!canAddDefect}
                  className="xp-text px-3 py-2 rounded-lg text-white disabled:opacity-60"
                  style={{ backgroundColor: "var(--logo-1)" }}
                >
                  Ajouter défaut
                </button>
              </div>

              {defects.length > 0 && (
                <div className="mt-3 border rounded-xl overflow-hidden" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
                  <table className="min-w-full text-sm">
                    <thead className="bg-slate-50 text-slate-600">
                      <tr>
                        <th className="text-left px-3 py-2">Article</th>
                        <th className="text-left px-3 py-2">Qté</th>
                        <th className="text-left px-3 py-2">Raison</th>
                        <th className="px-3 py-2"></th>
                      </tr>
                    </thead>
                    <tbody className="divide-y">
                      {defects.map((d, idx) => (
                        <tr key={`${d.itemNo}-${idx}`} className="bg-white">
                          <td className="px-3 py-2 text-slate-800 font-medium">{d.itemNo}</td>
                          <td className="px-3 py-2 text-slate-700">{d.qty}</td>
                          <td className="px-3 py-2 text-slate-600">{d.reason || '-'}</td>
                          <td className="px-3 py-2 text-right">
                            <button
                              type="button"
                              onClick={() => removeDefect(idx)}
                              className="xp-text px-2 py-1 rounded-lg bg-white text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50"
                            >
                              Supprimer
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </div>

          <div className="mt-6">
            <div className="xp2 mb-3" style={{ color: "var(--logo-4)" }}>Images / Photos</div>

            <div className="p-3 rounded-xl border bg-white" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
              <div className="mb-3">
                <label className="xp-text inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors"
                  style={{ backgroundColor: "var(--shape-4)", color: "white" }}
                  onMouseOver={(e) => e.currentTarget.style.opacity = "0.9"}
                  onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                  </svg>
                  {uploading ? "Téléchargement..." : "Ajouter des images"}
                  <input
                    type="file"
                    multiple
                    accept="image/*"
                    capture="environment"
                    className="hidden"
                    disabled={uploading}
                    onChange={handleImageUpload}
                  />
                </label>
                <span className="xp-text ml-3 text-slate-500 text-sm">Photos des colis, emballages, défauts...</span>
              </div>

              {images.length > 0 && (
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {images.map((img) => (
                    <div key={img.id} className="relative group rounded-lg overflow-hidden border-2" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
                      <img
                        src={img.url}
                        alt={img.name}
                        className="w-full h-32 object-cover"
                      />
                      <div className="absolute inset-0 bg-black bg-opacity-0 group-hover:bg-opacity-40 transition-opacity flex items-center justify-center opacity-0 group-hover:opacity-100">
                        <button
                          type="button"
                          onClick={() => removeImage(img.id)}
                          className="p-2 bg-red-500 text-white rounded-full hover:bg-red-600 transition-colors"
                          title="Supprimer l'image"
                        >
                          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                          </svg>
                        </button>
                      </div>
                      <div className="absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black to-transparent p-2">
                        <div className="text-white text-xs truncate">{img.name}</div>
                        <div className="text-white text-xs opacity-75">{new Date(img.uploadedAt).toLocaleTimeString()}</div>
                      </div>
                    </div>
                  ))}
                </div>
              )}

              {images.length === 0 && (
                <div className="xp-text text-center py-8 text-slate-400 border-2 border-dashed rounded-lg" style={{ borderColor: "rgba(79,88,165,0.14)" }}>
                  Aucune image ajoutée
                </div>
              )}
            </div>
          </div>

          <div className="flex flex-wrap gap-2 mt-4">
            <button
              disabled={!canSave}
              onClick={save}
              className="xp-text px-3 py-2 rounded-lg text-white disabled:opacity-60"
              style={{ backgroundColor: "var(--shape-4)" }}
            >
              {saving ? "Enregistrement..." : "Enregistrer"}
            </button>
          </div>

          {error && (
            <div className="xp-text mt-3" style={{ color: "#b45309" }}>{error}</div>
          )}

          <div className="mt-4">
            <div className="xp3" style={{ color: "var(--logo-4)" }}>Dernier enregistrement</div>
            {loading ? (
              <div className="xp-text mt-1 text-slate-500">Chargement...</div>
            ) : record ? (
              <div className="xp-text mt-1 text-slate-600">
                Créé: {new Date(record.createdAt).toLocaleString()}
                <br />
                {record.updatedAt && <>Mis à jour: {new Date(record.updatedAt).toLocaleString()}</>}
                <div className="mt-2">
                  <button
                    onClick={async () => {
                      if (!confirm('Supprimer cet enregistrement de retours ?')) return;
                      try {
                        await fetch(`/api/returns?shipmentNo=${encodeURIComponent(shipmentNo)}`, { method: 'DELETE' });
                        setRecord(null);
                        setValues(() => {
                          const init: Record<string, number> = {};
                          for (const it of defaultItems) init[it.key] = 0;
                          return init;
                        });
                        setNote('');
                        setDefects([]);
                        setHasColis(true);
                        setHasEmballagesVides(true);
                        setImages([]);
                      } catch {}
                    }}
                    className="xp-text px-3 py-1.5 rounded-lg bg-white text-rose-700 ring-1 ring-rose-200 hover:bg-rose-50 text-xs"
                  >Supprimer le retour</button>
                </div>
              </div>
            ) : (
              <div className="xp-text mt-1 text-slate-500">Aucun retour enregistré</div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
