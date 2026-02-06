import { NextResponse } from 'next/server';
import { InsurancePolicy } from '@/types';

const base: InsurancePolicy[] = Array.from({length:5}).map((_,i)=>({
  id: `INS-${i+1}`,
  vehicle_id: `TRK-${1000+i}`,
  provider: ['AXA','Allianz','MAIF','Generali','Groupama'][i%5],
  policy_number: `POL-${(i+1)*12345}`,
  start_date: '2025-01-01',
  end_date: '2025-12-31',
  coverage: (['tiers','intermediaire','tous_risques'][i%3]) as InsurancePolicy['coverage'],
  status: (['active','expiring_soon','expired'][i%3]) as InsurancePolicy['status'],
}));

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const data = id ? base.filter(p=>p.vehicle_id===id) : base;
  await new Promise(r=>setTimeout(r,150));
  return NextResponse.json(data);
}
