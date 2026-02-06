import { NextResponse } from 'next/server';
import { Assignment } from '@/types';

function gen(id:string, offset:number): Assignment[] {
  const baseDate = new Date('2025-02-01T08:00:00Z');
  const d1 = new Date(baseDate.getTime() + offset*24*3600*1000);
  const d2 = new Date(d1.getTime() + 8*3600*1000);
  const d3 = new Date(baseDate.getTime() + (offset+2)*24*3600*1000);
  const d4 = new Date(d3.getTime() + 10*3600*1000);
  return [
    {
      id: `ASG-${id}-1`,
      vehicle_id: id,
      assignee_type: 'driver',
      assignee_id: `DRV-${offset}`,
      title: `Tournée Matin ${offset}`,
      start: d1.toISOString(),
      end: d2.toISOString(),
      location: 'Entrepôt Nord',
      notes: 'Livraisons zone A'
    },
    {
      id: `ASG-${id}-2`,
      vehicle_id: id,
      assignee_type: 'mission',
      assignee_id: `MSN-${offset}`,
      title: `Mission Spéciale ${offset}`,
      start: d3.toISOString(),
      end: d4.toISOString(),
      location: 'Plateforme Sud',
      notes: 'Enlèvement palettes'
    }
  ];
}

const all = ['TRK-1000','TRK-1001','TRK-1002','TRK-1003','TRK-1004']
  .flatMap((id, idx)=>gen(id, idx));

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const data = id ? all.filter(a=>a.vehicle_id===id) : all;
  await new Promise(r=>setTimeout(r,130));
  return NextResponse.json(data);
}
