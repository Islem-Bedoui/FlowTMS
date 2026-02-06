import { NextResponse } from 'next/server';
import { DocumentInfo } from '@/types';

const docs: DocumentInfo[] = ['carte_grise','assurance','controle_technique','vignette'].flatMap((t,i)=>
  Array.from({length:5}).map((_,j)=>({
    id: `DOC-${i+1}-${j+1}`,
    vehicle_id: `TRK-${1000+j}`,
    type: t as DocumentInfo['type'],
    name: `${t} ${j+1}`,
    number: `N-${i+1}${j+1}${j+2}`,
    issue_date: '2025-01-01',
    expiry_date: '2025-12-31',
    file_url: undefined,
  }))
);

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const id = searchParams.get('id');
  const data = id ? docs.filter(d=>d.vehicle_id===id) : docs;
  await new Promise(r=>setTimeout(r,120));
  return NextResponse.json(data);
}
