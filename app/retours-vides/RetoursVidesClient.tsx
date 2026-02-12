"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { mockOrders } from "@/types/mockOrders";

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

  // Fallback items si l'API ne retourne rien (évite liste vide sur Vercel)
  // Génère une liste d'items plausible pour chaque commande mock
  const displayItems = useMemo(() => {
    if (items.length > 0) return items;
    // Trouve la commande correspondante (avec ou sans WHS-)
    const order = mockOrders.find(o => o.No === shipmentNo || `WHS-${o.No}` === shipmentNo);
    const seed = Number(String(shipmentNo || '').replace(/\D/g, '').slice(-2)) || 1;
    const baseItems = [
      { itemNo: 'PAL001', description: 'Palette standard' },
      { itemNo: 'CAI002', description: 'Caisse carton' },
      { itemNo: 'BTE003', description: 'Bouteille plastique' },
      { itemNo: 'FUT004', description: 'Fut métallique' },
      { itemNo: 'SAC005', description: 'Sac de 25kg' },
      { itemNo: 'ROL006', description: 'Rouleau film' },
    ];
    // Génère 3 à 5 items uniques basés sur la commande
    const count = 3 + (seed % 3);
    const selected: typeof baseItems = [];
    const used = new Set<string>();
    while (selected.length < count && selected.length < baseItems.length) {
      const idx = (seed + selected.length) % baseItems.length;
      const it = baseItems[idx];
      if (!used.has(it.itemNo)) {
        used.add(it.itemNo);
        selected.push({ ...it, itemNo: `${it.itemNo}-${shipmentNo?.slice(-4) || '0000'}` });
      }
    }
    return selected;
  }, [items, shipmentNo]);

  const canAddDefect = useMemo(() => {
    return !!newDefect.itemNo && Number.isFinite(newDefect.qty) && newDefect.qty > 0 && displayItems.some(it => it.itemNo === newDefect.itemNo);
  }, [newDefect.itemNo, newDefect.qty, displayItems]);

  const addDefect = () => {
    if (!canAddDefect) {
      if (newDefect.itemNo && !displayItems.some(it => it.itemNo === newDefect.itemNo)) {
        setError('Cet article n\'existe pas dans la liste.');
      }
      return;
    }
    setError(null);
    setDefects((prev) => [...prev, { itemNo: newDefect.itemNo.trim(), qty: Number(newDefect.qty), reason: (newDefect.reason || '').trim() }]);
    setNewDefect({ itemNo: "", qty: 1, reason: "" });
  };

  const removeDefect = (idx: number) => {
    setDefects((prev) => prev.filter((_, i) => i !== idx));
  };

  const scanItem = async () => {
    // Try to use camera on mobile
    try {
      // Check if BarcodeDetector API is available
      if ('BarcodeDetector' in window && navigator.mediaDevices?.getUserMedia) {
        // Create a video element for scanning
        const video = document.createElement('video');
        video.playsInline = true;
        video.muted = true;
        
        // Request camera access
        const stream = await navigator.mediaDevices.getUserMedia({ 
          video: { facingMode: "environment" }, 
          audio: false 
        });
        
        video.srcObject = stream;
        await video.play();
        
        // Create barcode detector
        const detector = new (window as any).BarcodeDetector({ 
          formats: ["qr_code", "code_128", "ean_13", "ean_8", "code_39", "code_93"] 
        });
        
        // Show scanning UI
        const result = await new Promise<string>((resolve, reject) => {
          const overlay = document.createElement('div');
          overlay.style.cssText = `
            position: fixed;
            top: 0;
            left: 0;
            right: 0;
            bottom: 0;
            background: rgba(0,0,0,0.8);
            z-index: 9999;
            display: flex;
            flex-direction: column;
            align-items: center;
            justify-content: center;
            color: white;
          `;
          
          const videoEl = document.createElement('video');
          videoEl.style.cssText = `
            width: 100%;
            max-width: 400px;
            height: 300px;
            object-fit: cover;
            border: 2px solid #fff;
            border-radius: 8px;
          `;
          videoEl.srcObject = stream;
          videoEl.play();
          
          const instructions = document.createElement('div');
          instructions.textContent = 'Pointez la caméra vers un code-barres';
          instructions.style.cssText = `
            margin: 20px 0;
            text-align: center;
            font-size: 16px;
          `;
          
          const cancelBtn = document.createElement('button');
          cancelBtn.textContent = 'Annuler';
          cancelBtn.style.cssText = `
            padding: 10px 20px;
            background: #ef4444;
            color: white;
            border: none;
            border-radius: 5px;
            cursor: pointer;
            margin-top: 10px;
          `;
          
          overlay.appendChild(videoEl);
          overlay.appendChild(instructions);
          overlay.appendChild(cancelBtn);
          document.body.appendChild(overlay);
          
          cancelBtn.onclick = () => {
            stream.getTracks().forEach(track => track.stop());
            document.body.removeChild(overlay);
            reject(new Error('Cancelled'));
          };
          
          const detectCodes = async () => {
            try {
              const codes = await detector.detect(videoEl);
              if (codes && codes.length > 0) {
                const code = String(codes[0].rawValue || '').trim();
                if (code) {
                  stream.getTracks().forEach(track => track.stop());
                  document.body.removeChild(overlay);
                  resolve(code);
                  return;
                }
              }
              requestAnimationFrame(detectCodes);
            } catch (e) {
              requestAnimationFrame(detectCodes);
            }
          };
          
          detectCodes();
        });
        
        setError(null);
        setNewDefect(prev => ({ ...prev, itemNo: result }));
        
      } else {
        // Fallback to file input for camera
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = 'image/*';
        input.capture = 'environment';
        
        input.onchange = async (e) => {
          const file = (e.target as HTMLInputElement).files?.[0];
          if (!file) return;
          
          try {
            // Try to extract barcode from image
            const img = new Image();
            img.onload = async () => {
              // For now, just use filename as fallback
              const filename = file.name.replace(/\.[^/.]+$/, '');
              const possibleCode = filename.match(/\b\d{8,}\b/)?.[0] || filename;
              
              setError(null);
              setNewDefect(prev => ({ ...prev, itemNo: possibleCode }));
            };
            img.src = URL.createObjectURL(file);
          } catch (e) {
            // Final fallback to manual input
            const code = window.prompt('Code article non détecté. Saisir manuellement :');
            if (code) {
              setError(null);
              setNewDefect(prev => ({ ...prev, itemNo: code.trim() }));
            }
          }
        };
        
        input.click();
      }
    } catch (error) {
      console.error('Camera scan failed:', error);
      // Final fallback to manual input
      const code = window.prompt('Scanner / saisir code article');
      const v = String(code || '').trim();
      if (v) {
        setError(null);
        setNewDefect(prev => ({ ...prev, itemNo: v }));
      }
    }
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

        const res = await fetch('/api/upload', {
          method: 'POST',
          body: formData,
        });
        if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
        const uploaded = await res.json();
        return {
          id: uploaded.id || `img-${Date.now()}-${Math.random()}`,
          url: uploaded.url || URL.createObjectURL(file),
          name: file.name,
          uploadedAt: new Date().toISOString(),
        };
      });

      const newImages = await Promise.all(uploadPromises);
      setImages((prev) => [...prev, ...newImages]);
    } catch (err) {
      console.error('Upload error:', err);
      setError('Erreur lors du téléchargement des images');
    } finally {
      setUploading(false);
    }
  };

  const requestCameraAccess = async () => {
    try {
      // Request camera permissions first
      const stream = await navigator.mediaDevices.getUserMedia({ 
        video: { facingMode: "environment" }, 
        audio: false 
      });
      // Stop the stream immediately, we just wanted to get permission
      stream.getTracks().forEach(track => track.stop());
      return true;
    } catch (error) {
      console.error('Camera access denied:', error);
      return false;
    }
  };

  const handleCameraCapture = async () => {
    // First try to get camera permission
    const hasPermission = await requestCameraAccess();
    
    if (hasPermission) {
      // Create a camera input that will open the camera app
      const input = document.createElement('input');
      input.type = 'file';
      input.accept = 'image/*';
      input.capture = 'environment';
      input.multiple = true;
      
      input.onchange = async (e) => {
        const files = Array.from((e.target as HTMLInputElement).files || []);
        if (files.length > 0) {
          setUploading(true);
          setError(null);
          
          try {
            const uploadPromises = files.map(async (file) => {
              // Compress image for mobile if needed
              const compressedFile = await compressImageIfNeeded(file);
              
              const formData = new FormData();
              formData.append('file', compressedFile);
              formData.append('shipmentNo', shipmentNo);

              const res = await fetch('/api/upload', {
                method: 'POST',
                body: formData,
              });
              if (!res.ok) throw new Error(`Upload failed: ${res.status}`);
              const uploaded = await res.json();
              return {
                id: uploaded.id || `img-${Date.now()}-${Math.random()}`,
                url: uploaded.url || URL.createObjectURL(compressedFile),
                name: file.name,
                uploadedAt: new Date().toISOString(),
              };
            });

            const newImages = await Promise.all(uploadPromises);
            setImages((prev) => [...prev, ...newImages]);
          } catch (err) {
            console.error('Camera capture error:', err);
            setError('Erreur lors de la capture des photos');
          } finally {
            setUploading(false);
          }
        }
      };
      
      input.click();
    } else {
      // Fallback to regular file input
      const fileInput = document.querySelector('input[type="file"]') as HTMLInputElement;
      if (fileInput) {
        fileInput.click();
      }
    }
  };

  const compressImageIfNeeded = async (file: File): Promise<File> => {
    // Compress images larger than 2MB for mobile
    if (file.size <= 2 * 1024 * 1024) return file;
    
    return new Promise((resolve) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        // Calculate new dimensions (max 1200px)
        let { width, height } = img;
        const maxSize = 1200;
        
        if (width > height && width > maxSize) {
          height = (height * maxSize) / width;
          width = maxSize;
        } else if (height > maxSize) {
          width = (width * maxSize) / height;
          height = maxSize;
        }
        
        canvas.width = width;
        canvas.height = height;
        
        ctx?.drawImage(img, 0, 0, width, height);
        
        canvas.toBlob(
          (blob) => {
            if (blob) {
              const compressedFile = new File([blob], file.name, {
                type: 'image/jpeg',
                lastModified: Date.now(),
              });
              resolve(compressedFile);
            } else {
              resolve(file);
            }
          },
          'image/jpeg',
          0.8
        );
      };
      
      img.src = URL.createObjectURL(file);
    });
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

      // Flag immédiat dans localStorage pour éviter les warnings sur Vercel
      if (typeof window !== 'undefined') {
        localStorage.setItem(`returns_${shipmentNo}`, 'true');
        // Forcer le rechargement des warnings globaux immédiatement
        window.dispatchEvent(new CustomEvent('proofUpdated', { detail: { type: 'returns', shipmentNo } }));
      }

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
                      {displayItems.map((it) => (
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
                <div className="flex flex-wrap gap-2">
                  <label className="xp-text inline-flex items-center gap-2 px-4 py-2 rounded-lg cursor-pointer transition-colors"
                    style={{ backgroundColor: "var(--shape-4)", color: "white" }}
                    onMouseOver={(e) => e.currentTarget.style.opacity = "0.9"}
                    onMouseOut={(e) => e.currentTarget.style.opacity = "1"}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                    {uploading ? "Téléchargement..." : "Galerie"}
                    <input
                      type="file"
                      multiple
                      accept="image/*"
                      className="hidden"
                      disabled={uploading}
                      onChange={handleImageUpload}
                    />
                  </label>
                  
                  <button
                    type="button"
                    onClick={handleCameraCapture}
                    disabled={uploading}
                    className="xp-text inline-flex items-center gap-2 px-4 py-2 rounded-lg transition-colors bg-emerald-600 text-white hover:bg-emerald-500 disabled:opacity-50"
                    onMouseOver={(e) => !uploading && (e.currentTarget.style.backgroundColor = "#10b981")}
                    onMouseOut={(e) => !uploading && (e.currentTarget.style.backgroundColor = "#059669")}
                  >
                    <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M3 9a2 2 0 012-2h.93a2 2 0 001.664-.89l.812-1.22A2 2 0 0110.07 4h3.86a2 2 0 011.664.89l.812 1.22A2 2 0 0018.07 7H19a2 2 0 012 2v9a2 2 0 01-2 2H5a2 2 0 01-2-2V9z" />
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 13a3 3 0 11-6 0 3 3 0 016 0z" />
                    </svg>
                    {uploading ? "Capture..." : "Appareil photo"}
                  </button>
                </div>
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
