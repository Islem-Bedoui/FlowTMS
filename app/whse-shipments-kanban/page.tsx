"use client";

import React, { useEffect, useMemo, useState } from "react";
import Link from "next/link";

type WhseShipment = Record<string, any>;

type CityTour = {
  city: string;
  driver?: string;
  vehicle?: string;
  selectedOrders: string[];
  closed?: boolean;
  includeReturns?: boolean;
  execClosed?: boolean;
};

type ColumnKey = "Planned" | "InProgress" | "Delivered";

const BC_STATUS_PLANNED = process.env.NEXT_PUBLIC_BC_WHSE_SHIPMENT_STATUS_PLANNED || "Planned";
const BC_STATUS_INPROGRESS = process.env.NEXT_PUBLIC_BC_WHSE_SHIPMENT_STATUS_INPROGRESS || "InProgress";
const BC_STATUS_DELIVERED = process.env.NEXT_PUBLIC_BC_WHSE_SHIPMENT_STATUS_DELIVERED || "Delivered";

const COLUMNS: Array<{ key: ColumnKey; title: string; bcValue: string }> = [
  { key: "Planned", title: "Planned", bcValue: BC_STATUS_PLANNED },
  { key: "InProgress", title: "En cours", bcValue: BC_STATUS_INPROGRESS },
  { key: "Delivered", title: "Delivered", bcValue: BC_STATUS_DELIVERED },
];

function getColumnTheme(key: ColumnKey) {
  if (key === "Planned") {
    return {
      headerColor: "#0f172a",
      badgeBg: "rgba(59,130,246,0.14)",
      badgeColor: "#1d4ed8",
      colBg: "linear-gradient(180deg, rgba(59,130,246,0.08), rgba(255,255,255,0.70))",
      accent: "#3b82f6",
      border: "rgba(59,130,246,0.22)",
    };
  }
  if (key === "InProgress") {
    return {
      headerColor: "#0f172a",
      badgeBg: "rgba(245,158,11,0.18)",
      badgeColor: "#b45309",
      colBg: "linear-gradient(180deg, rgba(245,158,11,0.10), rgba(255,255,255,0.70))",
      accent: "#f59e0b",
      border: "rgba(245,158,11,0.28)",
    };
  }
  return {
    headerColor: "#0f172a",
    badgeBg: "rgba(34,197,94,0.16)",
    badgeColor: "#15803d",
    colBg: "linear-gradient(180deg, rgba(34,197,94,0.10), rgba(255,255,255,0.70))",
    accent: "#22c55e",
    border: "rgba(34,197,94,0.26)",
  };
}

function normalizeStatus(raw: any): ColumnKey {
  const s0 = String(raw ?? "").trim().toLowerCase();
  const s = s0.replace(/[^a-z\s]/g, "").trim();
  if (!s) return "Planned";
  if (s === "planned" || s === "planified" || s === "planifie" || s === "planifiée" || s === "planifiee") return "Planned";
  if (s === "inprogress" || s === "in progress" || s === "en cours" || s === "encours") return "InProgress";
  if (s === "delivered" || s === "livre" || s === "livré" || s === "livree" || s === "livrée" || s === "posted") return "Delivered";
  return "Planned";
}

function getDeliveryStatusValue(s: WhseShipment) {
  if (!s || typeof s !== "object") return undefined;
  const direct =
    (s as any).DeliveryStatus ??
    (s as any).Delivery_Status ??
    (s as any)["Delivery Status"] ??
    (s as any).ALM_Delivery_Status ??
    (s as any).alm_delivery_status;
  if (direct !== undefined) return direct;
  for (const k of Object.keys(s)) {
    if (/deliverystatus/i.test(k) || /delivery\s*_?status/i.test(k) || /delivery.*status/i.test(k)) return (s as any)[k];
  }
  return undefined;
}

function getNo(s: WhseShipment) {
  return String((s as any)?.No ?? (s as any)?.no ?? (s as any)?.NO ?? "").trim();
}

function getCustomerName(s: WhseShipment) {
  return (
    String((s as any)?.Sell_to_Customer_Name ?? (s as any)?.SellToCustomerName ?? "").trim() ||
    String((s as any)?.Sell_to_Name ?? "").trim()
  );
}

function getCity(s: WhseShipment) {
  return (
    String(
      (s as any)?.Ship_to_City ??
        (s as any)?.Sell_to_City ??
        (s as any)?.ShipToCity ??
        (s as any)?.shipToCity ??
        ""
    ).trim() ||
    "-"
  );
}

function getSourceNo(s: WhseShipment) {
  return String(
    (s as any)?.Source_No ??
      (s as any)?.SourceNo ??
      (s as any)?.sourceNo ??
      (s as any)?.source_No ??
      ""
  ).trim();
}

function getDeliveryStatusText(s: WhseShipment) {
  const v = getDeliveryStatusValue(s);
  return v === undefined || v === null ? "-" : String(v).trim() || "-";
}

function getAssignedDriverNo(s: WhseShipment) {
  if (!s || typeof s !== "object") return "";
  const direct =
    String(
      (s as any)?.Assigned_Driver_No ??
        (s as any)?.AssignedDriverNo ??
        (s as any)?.assignedDriverNo ??
        (s as any)?.Assigned_Driver ??
        (s as any)?.driverNo ??
        ""
    ).trim();
  if (direct) return direct;
  for (const k of Object.keys(s)) {
    if (/assigned.*driver/i.test(k) || /^driver(no)?$/i.test(k)) {
      const v = (s as any)[k];
      if (typeof v === "string" && v.trim()) return v.trim();
    }
  }
  return "";
}

function loadAssignments(): Record<string, CityTour> {
  try {
    const raw = localStorage.getItem("regions_planning_assignments_v1") || "{}";
    return JSON.parse(raw);
  } catch {
    return {};
  }
}

export default function WhseShipmentsKanbanPage() {
  const [items, setItems] = useState<WhseShipment[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [movingNo, setMovingNo] = useState<string | null>(null);

  const [showOnlyMine, setShowOnlyMine] = useState(true);

  const role = useMemo(() => {
    try {
      return (localStorage.getItem("userRole") || "").trim().toLowerCase();
    } catch {
      return "";
    }
  }, []);

  const driverNo = useMemo(() => {
    try {
      const d = (localStorage.getItem("driverNo") || "").trim();
      const ident = (localStorage.getItem("userIdentifier") || "").trim();
      return d || ident;
    } catch {
      return "";
    }
  }, []);

  function matchesLoggedDriver(tourDriver?: string | null): boolean {
    const isDriver = role === "driver" || role === "chauffeur";
    if (!isDriver) return true;
    const dno = String(driverNo || "").trim();
    if (!dno) return true;
    if (!tourDriver) return false;
    const norm = (s: string) => String(s).trim().toLowerCase().replace(/\s+/g, "");
    return norm(tourDriver).includes(norm(dno));
  }

  const load = async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch("/api/warehouseShipment", { cache: "no-store" });
      const json = await res.json();
      if (!res.ok) throw new Error(json?.message || json?.error || `HTTP ${res.status}`);
      const list: any[] = Array.isArray(json?.value) ? json.value : Array.isArray(json) ? json : [];
      console.log("[warehouseShipment]", list);
      if (list.length > 0) console.log("[warehouseShipment:first]", list[0]);
      setItems(list);
    } catch (e: any) {
      setItems([]);
      setError(e?.message || "Erreur chargement");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [showOnlyMine]);

  const visibleItems = useMemo(() => {
    const isDriver = role === "driver" || role === "chauffeur";
    if (!isDriver || !showOnlyMine) return items;
    const target = String(driverNo || "").trim().toLowerCase();
    if (!target) return items;
    // Build the set of Source_No (order no) for tours assigned to this driver
    let allowedSourceNos = new Set<string>();
    try {
      const assignments = loadAssignments();
      for (const city of Object.keys(assignments || {})) {
        const t = assignments[city];
        if (!t) continue;
        if (!matchesLoggedDriver(t.driver)) continue;
        for (const no of Array.isArray(t.selectedOrders) ? t.selectedOrders : []) {
          const v = String(no || "").trim();
          if (v) allowedSourceNos.add(v.toLowerCase());
        }
      }
    } catch {
      allowedSourceNos = new Set<string>();
    }

    return items.filter((s) => {
      // Preferred: shipments explicitly tagged with Assigned_Driver_No
      const drv = String(getAssignedDriverNo(s) || "").trim().toLowerCase();
      if (drv && drv === target) return true;

      // Fallback: shipment belongs to a sales order that's in the driver's tours
      const sourceNo = String(getSourceNo(s) || "").trim().toLowerCase();
      if (sourceNo && allowedSourceNos.has(sourceNo)) return true;

      // Another fallback for mocks: WHS-<OrderNo>
      const shipNo = String(getNo(s) || "").trim();
      if (shipNo && shipNo.toLowerCase().startsWith("whs-") && allowedSourceNos.has(shipNo.slice(4).toLowerCase())) return true;
      return false;
    });
  }, [items, role, showOnlyMine, driverNo]);

  const grouped = useMemo(() => {
    const map: Record<ColumnKey, WhseShipment[]> = {
      Planned: [],
      InProgress: [],
      Delivered: [],
    };

    for (const s of visibleItems) {
      const col = normalizeStatus(getDeliveryStatusValue(s));
      map[col].push(s);
    }

    for (const k of Object.keys(map) as ColumnKey[]) {
      map[k].sort((a, b) => {
        const an = getNo(a);
        const bn = getNo(b);
        return an.localeCompare(bn);
      });
    }

    return map;
  }, [visibleItems]);

  const onDragStart = (e: React.DragEvent, shipmentNo: string) => {
    e.dataTransfer.setData("text/plain", shipmentNo);
    e.dataTransfer.effectAllowed = "move";
  };

  const onDropToColumn = async (e: React.DragEvent, col: (typeof COLUMNS)[number]) => {
    e.preventDefault();
    const shipmentNo = String(e.dataTransfer.getData("text/plain") || "").trim();
    if (!shipmentNo) return;

    setMovingNo(shipmentNo);
    try {
      const res = await fetch("/api/whseShipments/status", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ shipmentNo, newStatus: col.bcValue }),
      });

      const text = await res.text();
      let json: any = null;
      try {
        json = text ? JSON.parse(text) : null;
      } catch {
        json = null;
      }

      if (!res.ok) {
        const details = json?.error || json?.message || text || `HTTP ${res.status}`;
        console.error(
          "/api/whseShipments/status failed",
          "status=",
          res.status,
          "shipmentNo=",
          shipmentNo,
          "newStatus=",
          col.bcValue,
          "responseText=",
          text
        );
        throw new Error(
          typeof details === "string" ? details : text || `HTTP ${res.status}`
        );
      }

      setItems((prev) =>
        prev.map((s) => {
          const no = getNo(s);
          if (no !== shipmentNo) return s;
          return { ...s, Delivery_Status: col.bcValue, DeliveryStatus: col.bcValue, "Delivery Status": col.bcValue };
        })
      );
    } catch (e: any) {
      alert(e?.message || "Échec mise à jour statut");
    } finally {
      setMovingNo(null);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-50 via-white to-sky-50">
      <div className="container mx-auto p-4 md:p-6 max-w-7xl">
        <div className="flex items-start justify-between gap-3 mb-4">
          <div>
            <h1
              className="xp1 text-2xl bg-clip-text text-transparent"
              style={{ backgroundImage: "linear-gradient(90deg, var(--logo-1), var(--logo-3))" }}
            >
              WHSE Shipments (Kanban)
            </h1>
            <div className="xp-text mt-1 text-slate-600">Drag & drop pour changer le statut (BC)</div>
          </div>
          <div className="flex items-center gap-2">
            <Link
              href="/regions-planning"
              className="xp-text px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
            >
              Retour
            </Link>
            <button
              onClick={() => void load()}
              className="xp-text px-3 py-2 rounded-lg text-white"
              style={{ backgroundColor: "var(--logo-1)" }}
              disabled={loading}
            >
              {loading ? "Chargement..." : "Rafraîchir"}
            </button>
          </div>
        </div>

        <div className="bg-white/80 rounded-2xl border p-4" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-2 mb-4">
            <div className="xp-text text-slate-700">
              Total: <span className="font-semibold">{visibleItems.length}</span>
              {movingNo ? (
                <span className="text-slate-400"> • Mise à jour: {movingNo}</span>
              ) : null}
            </div>

            {(role === "driver" || role === "chauffeur") && (
              <label className="xp-text flex items-center gap-2 text-slate-700">
                <input
                  type="checkbox"
                  checked={showOnlyMine}
                  onChange={(e) => setShowOnlyMine(e.target.checked)}
                />
                Mes expéditions uniquement
              </label>
            )}
          </div>

          {error && <div className="xp-text" style={{ color: "#b45309" }}>{error}</div>}

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {COLUMNS.map((col) => (
              (() => {
                const theme = getColumnTheme(col.key);
                return (
              <div
                key={col.key}
                className="rounded-2xl border bg-white/70 p-3 shadow-sm"
                style={{ borderColor: theme.border, backgroundImage: theme.colBg }}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => void onDropToColumn(e, col)}
              >
                <div className="flex items-center justify-between mb-2">
                  <div className="flex items-center gap-2">
                    <div className="xp2" style={{ color: theme.headerColor }}>{col.title}</div>
                    <span
                      className="xp-text text-xs px-2 py-0.5 rounded-full"
                      style={{ backgroundColor: theme.badgeBg, color: theme.badgeColor }}
                    >
                      {grouped[col.key].length}
                    </span>
                  </div>
                  <div className="xp-text text-slate-500 text-xs">Drop ici</div>
                </div>

                <div className="space-y-2">
                  {grouped[col.key].map((s) => {
                    const no = getNo(s);
                    const customer = getCustomerName(s);
                    const city = getCity(s);
                    const sourceNo = getSourceNo(s);
                    const statusText = getDeliveryStatusText(s);

                    return (
                      <div
                        key={no || Math.random()}
                        draggable={Boolean(no) && !movingNo}
                        onDragStart={(e) => onDragStart(e, no)}
                        className="rounded-xl border bg-white p-3 cursor-move shadow-sm hover:shadow transition-shadow"
                        style={{ borderColor: "rgba(2,6,23,0.10)", boxShadow: "0 1px 0 rgba(2,6,23,0.04)" }}
                        title={no}
                      >
                        <div className="flex items-stretch justify-between gap-2">
                          <div
                            className="w-1 rounded-full mr-2"
                            style={{ backgroundColor: theme.accent }}
                          />
                          <div>
                            <div className="xp3" style={{ color: "var(--logo-4)" }}>{no || "-"}</div>
                            <div className="xp-text text-slate-700 mt-1">{customer || "-"}</div>
                            <div className="xp-text text-slate-500 text-xs">Ville: {city}</div>
                            <div className="xp-text text-slate-500 text-xs">Source: {sourceNo || "-"}</div>
                            <div className="xp-text text-slate-500 text-xs">Status: {statusText}</div>
                          </div>
                          <Link
                            href={`/pod-signature?shipmentNo=${encodeURIComponent(no)}`}
                            className="xp-text px-2 py-1 rounded-lg text-white"
                            style={{ backgroundColor: "var(--logo-1)" }}
                          >
                            Ouvrir
                          </Link>
                        </div>
                      </div>
                    );
                  })}

                  {grouped[col.key].length === 0 ? (
                    <div className="xp-text text-slate-500">Aucun</div>
                  ) : null}
                </div>
              </div>
                );
              })()
            ))}
          </div>

          <div className="xp-text text-slate-500 text-xs mt-4">
            Astuce: si BC refuse un statut, vérifie que les valeurs envoyées ({COLUMNS.map(c => c.bcValue).join(", ")}) correspondent exactement à l’Enum BC `Whse Shipment Delivery Status`.
          </div>
        </div>
      </div>
    </div>
  );
}
