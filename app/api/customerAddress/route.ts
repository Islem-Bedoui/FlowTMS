import { NextResponse } from "next/server";
import { mockOrders } from "@/types/mockOrders";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const revalidate = 0;

type CustomerAddress = {
  Address?: string;
  Address_2?: string;
  City?: string;
  Post_Code?: string;
  Country_Region_Code?: string;
};

function pickAddressByCustomerNo(customerNo: string): CustomerAddress {
  const list = Array.isArray(mockOrders) ? mockOrders : [];
  const digits = String(customerNo || "").replace(/\D/g, "");
  const idx = digits ? (Number(digits) - 1) % Math.max(1, list.length) : 0;
  const o: any = list[Math.max(0, idx)] || {};

  return {
    Address: o.Sell_to_Address,
    Address_2: o.Sell_to_Address_2,
    City: o.Sell_to_City,
    Post_Code: o.Sell_to_Post_Code,
    Country_Region_Code: o.Sell_to_Country_Region_Code,
  };
}

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const no = String(searchParams.get("no") || "").trim();
    if (!no) {
      return NextResponse.json({ error: "no is required" }, { status: 400 });
    }

    const addr = pickAddressByCustomerNo(no);
    return NextResponse.json({ value: [addr] });
  } catch (e: any) {
    return NextResponse.json({ error: e?.message || "Failed to get customer address" }, { status: 500 });
  }
}
