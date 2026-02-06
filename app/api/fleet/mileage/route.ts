import { NextResponse } from 'next/server';
import { MileageRecord } from '@/types';

function gen(id:string): MileageRecord[]{
  const base = 100000 + Math.floor(Math.random()*5000);
  return Array.from({length:6}).map((_,i)=>({
    id: `KM-${id}-${i}`,
    vehicle_id: id,
    date: `2025-0${(i%6)+1}-01`,
    odometer_km: base + i*1200,
    delta_km: i===0? undefined: 1200,
    source: (['iot','manual','iot','iot','manual','import'][i]) as MileageRecord['source']
  }));
}

const all = ['TRK-1000','TRK-1001','TRK-1002','TRK-1003','TRK-1004'].flatMap(id=>gen(id));

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const data = id ? all.filter(m=>m.vehicle_id===id) : all;
  await new Promise(r=>setTimeout(r,140));
  return NextResponse.json(data);
}
