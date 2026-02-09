import { mockOrders } from "@/types/mockOrders";

export type MockSalesShipment = {
  id: string;
  number: string;
  customerName: string;
  customerNumber: string;
  shipToName: string;
  shipToAddressLine1?: string;
  shipToAddressLine2?: string;
  shipToCity?: string;
  shipToPostCode?: string;
  shipToCountry?: string;
  postingDate?: string;
  invoiceDate?: string;
  externalDocumentNumber?: string;
  orderNumber: string;
  signed?: boolean;
  pdf?: string;
};

export type MockSalesOrder = {
  No: string;
  Sell_to_Customer_No?: string;
  Sell_to_Customer_Name?: string;
  Sell_to_Address?: string;
  Sell_to_Address_2?: string;
  Sell_to_City?: string;
  Sell_to_Post_Code?: string;
  Sell_to_Country_Region_Code?: string;
  Requested_Delivery_Date?: string;
  Shipment_Date?: string;
  PromisedDeliveryHours?: string;
  Assigned_Driver_No?: string;
  assignedTruckNo?: string;
  CompletelyShipped?: boolean;
  status?: string;
};

export type MockWhseShipment = {
  No: string;
  Source_No: string;
  Sell_to_Customer_No?: string;
  Sell_to_Customer_Name?: string;
  Ship_to_Address?: string;
  Ship_to_Address_2?: string;
  Ship_to_City?: string;
  Ship_to_Post_Code?: string;
  Ship_to_Country_Region_Code?: string;
  Shipment_Date?: string;
  Due_Date?: string;
  Status?: string;
  Location_Code?: string;
  Assigned_Driver_No?: string;
  assignedTruckNo?: string;
  DeliveryStatus?: string;
  Delivery_Status?: string;
};

export type MockWhseShipmentLine = {
  Document_No: string;
  Line_No: number;
  Source_No: string;
  Item_No: string;
  Description: string;
  Quantity: number;
  Unit_of_Measure_Code: string;
  Location_Code: string;
  Ship_to_Address?: string;
  Ship_to_Address_2?: string;
  Ship_to_City?: string;
  Ship_to_Post_Code?: string;
  Ship_to_Country_Region_Code?: string;
  Sell_to_Customer_Name?: string;
  Sell_to_Customer_No?: string;
};

export function isBcMockEnabled() {
  // Mock is enabled when:
  // - USE_BC_MOCK / NEXT_PUBLIC_USE_BC_MOCK is explicitly set to 1/true/yes
  // - OR (by default) when running in development, unless explicitly disabled
  const v = (process.env.USE_BC_MOCK || process.env.NEXT_PUBLIC_USE_BC_MOCK || "").trim().toLowerCase();
  if (v === "1" || v === "true" || v === "yes") return true;
  if (v === "0" || v === "false" || v === "no") return false;

  // Default behavior: use mock data in dev to avoid calling Business Central.
  return process.env.NODE_ENV !== "production";
}

function pickOrderDate(o: any) {
  return String(o?.Requested_Delivery_Date || o?.requestedDeliveryDate || "2026-02-06");
}

function driverNoForIndex(i: number) {
  const drivers = ["CH-03", "CH-01", "CH-02"]; // simple mock
  return drivers[i % drivers.length];
}

function truckNoForIndex(i: number) {
  const trucks = ["TRUCK-12", "TRUCK-07", "TRUCK-05"];
  return trucks[i % trucks.length];
}

export function getMockSalesOrders(): MockSalesOrder[] {
  return (mockOrders as any[]).map((o, i) => ({
    No: String(o.No),
    Sell_to_Customer_No: `CUST-${String(o.No).slice(-3)}`,
    Sell_to_Customer_Name: `Client ${String(o.Sell_to_City || "").trim() || ""}`.trim() || "Client",
    Sell_to_Address: o.Sell_to_Address,
    Sell_to_Address_2: o.Sell_to_Address_2,
    Sell_to_City: o.Sell_to_City,
    Sell_to_Post_Code: o.Sell_to_Post_Code,
    Sell_to_Country_Region_Code: o.Sell_to_Country_Region_Code,
    Requested_Delivery_Date: pickOrderDate(o),
    Shipment_Date: pickOrderDate(o),
    PromisedDeliveryHours: "08:00-10:00",
    Assigned_Driver_No: driverNoForIndex(i),
    assignedTruckNo: truckNoForIndex(i),
    CompletelyShipped: false,
    status: "Open",
  }));
}

export function getMockSalesShipments(): MockSalesShipment[] {
  const today = new Date().toISOString().slice(0, 10);
  return (mockOrders as any[]).map((o, i) => {
    const orderNo = String(o.No);
    return {
      id: `mock-${orderNo}`,
      number: `SS-${orderNo}`,
      customerName: `Client ${String(o.Sell_to_City || "").trim() || ""}`.trim() || "Client",
      customerNumber: `CUST-${String(orderNo).slice(-3)}`,
      shipToName: `ShipTo ${String(o.Sell_to_City || "").trim() || ""}`.trim() || "ShipTo",
      shipToAddressLine1: o.Sell_to_Address,
      shipToAddressLine2: o.Sell_to_Address_2,
      shipToCity: o.Sell_to_City,
      shipToPostCode: o.Sell_to_Post_Code,
      shipToCountry: o.Sell_to_Country_Region_Code,
      postingDate: today,
      invoiceDate: today,
      externalDocumentNumber: `EXT-${1000 + i}`,
      orderNumber: orderNo,
      signed: false,
      pdf: "",
    };
  });
}

export function getMockWhseShipments(statusByShipmentNo?: Record<string, string>): MockWhseShipment[] {
  const orders = getMockSalesOrders();
  return orders.map((o, i) => {
    const shipmentNo = `WHS-${o.No}`;
    const st = statusByShipmentNo?.[shipmentNo] || "Planned";
    return {
      No: shipmentNo,
      Source_No: o.No,
      Sell_to_Customer_No: o.Sell_to_Customer_No,
      Sell_to_Customer_Name: o.Sell_to_Customer_Name,
      Ship_to_Address: o.Sell_to_Address,
      Ship_to_Address_2: o.Sell_to_Address_2,
      Ship_to_City: o.Sell_to_City,
      Ship_to_Post_Code: o.Sell_to_Post_Code,
      Ship_to_Country_Region_Code: o.Sell_to_Country_Region_Code,
      Shipment_Date: o.Shipment_Date,
      Status: "Released",
      Location_Code: "DEPOT-01",
      Assigned_Driver_No: o.Assigned_Driver_No,
      assignedTruckNo: o.assignedTruckNo,
      DeliveryStatus: st,
      Delivery_Status: st,
    };
  });
}

export function getMockWhseShipmentLines(sourceNos?: string[]): MockWhseShipmentLine[] {
  const orders = getMockSalesOrders();
  const set = new Set((sourceNos || []).map((s) => String(s).trim()).filter(Boolean));

  const pick = set.size
    ? orders.filter((o) => set.has(String(o.No).trim()))
    : orders;

  const lines: MockWhseShipmentLine[] = [];
  const catalog = [
    { itemNo: "1191", desc: "Transport", uom: "PCS" },
    { itemNo: "1928-S", desc: "Lampe AMSTERDAM", uom: "PCS" },
    { itemNo: "SP-SCM1011", desc: "Airport Duo", uom: "PCS" },
    { itemNo: "1079", desc: "Bleu, Taille 32 Plaque PVC", uom: "PCS" },
    { itemNo: "1210", desc: "Article souscription demo", uom: "PCS" },
    { itemNo: "1212", desc: "Article vente souscription", uom: "PCS" },
  ];
  for (const o of pick) {
    const docNo = `WHS-${o.No}`;
    const baseIdx = 0;
    const idx1 = (Number(String(o.No).slice(-1)) || 0) % catalog.length;
    const idx2 = (idx1 + 2) % catalog.length;
    const idx3 = (idx1 + 4) % catalog.length;
    const picks = [catalog[(baseIdx + idx1) % catalog.length], catalog[(baseIdx + idx2) % catalog.length], catalog[(baseIdx + idx3) % catalog.length]];

    const qtySeed = (Number(String(o.No).replace(/\D/g, "").slice(-2)) || 10) + 5;
    const quantities = [
      Math.max(1, (qtySeed % 30) + 5),
      Math.max(1, (qtySeed % 12) + 2),
      Math.max(1, (qtySeed % 8) + 1),
    ];

    picks.forEach((it, k) => {
      lines.push({
        Document_No: docNo,
        Line_No: 10000 + k * 10000,
        Source_No: o.No,
        Item_No: it.itemNo,
        Description: it.desc,
        Quantity: quantities[k] || 1,
        Unit_of_Measure_Code: it.uom,
        Location_Code: "DEPOT-01",
        Ship_to_Address: o.Sell_to_Address,
        Ship_to_Address_2: o.Sell_to_Address_2,
        Ship_to_City: o.Sell_to_City,
        Ship_to_Post_Code: o.Sell_to_Post_Code,
        Ship_to_Country_Region_Code: o.Sell_to_Country_Region_Code,
        Sell_to_Customer_Name: o.Sell_to_Customer_Name,
        Sell_to_Customer_No: o.Sell_to_Customer_No,
      });
    });
  }
  return lines;
}
