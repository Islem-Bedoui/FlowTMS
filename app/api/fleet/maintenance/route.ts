import { NextResponse } from 'next/server';
import { MaintenanceRecord } from '@/types';

function gen(id:string): MaintenanceRecord[]{
  return [
    { id: `M-${id}-1`, vehicle_id: id, type:'revision', title:'Révision annuelle', date:'2025-02-10', status:'planned', mileage_km:110000 },
    { id: `M-${id}-2`, vehicle_id: id, type:'vidange', title:'Vidange moteur', date:'2025-01-12', status:'done', mileage_km:108500, cost_eur:180 },
    { id: `M-${id}-3`, vehicle_id: id, type:'pneus', title:'Remplacement pneus AV', date:'2025-03-05', status:'in_progress', mileage_km:111200 }
  ];
}

const all = ['TRK-1000','TRK-1001','TRK-1002','TRK-1003','TRK-1004'].flatMap(id=>gen(id));

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const data = id ? all.filter(m=>m.vehicle_id===id) : all;
  await new Promise(r=>setTimeout(r,160));
  return NextResponse.json(data);
}
