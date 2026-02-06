import { NextResponse } from 'next/server';
import { Vehicle } from '@/types';

const cities = [
  { name: 'Paris', lat: 48.8566, lng: 2.3522 },
  { name: 'Berlin', lat: 52.52, lng: 13.405 },
  { name: 'Madrid', lat: 40.4168, lng: -3.7038 },
  { name: 'Rome', lat: 41.9028, lng: 12.4964 },
  { name: 'Amsterdam', lat: 52.3676, lng: 4.9041 },
];

const brands = ['Volvo','Mercedes','MAN','Scania','DAF'];
const models = ['FH16','Actros','TGX','R-Series','XF'];

function genPlate(i:number){
  const letters = ['AA','BB','CC','DD','EE'];
  const nums = (100 + (i*37)%900).toString();
  return `${letters[i%letters.length]}-${nums}-${String.fromCharCode(65+(i%26))}${String.fromCharCode(65+((i+3)%26))}`;
}

export async function GET() {
  const now = Math.floor(Date.now()/1000);
  const vehicles: Vehicle[] = cities.map((c, i) => ({
    vehicle_id: `TRK-${1000+i}`,
    service_name: `${brands[i%brands.length]} ${models[i%models.length]}`,
    plate_number: genPlate(i),
    make: brands[i%brands.length],
    model: models[i%models.length],
    destination: cities[(i+2)%cities.length].name,
    speed: 60 + Math.floor(Math.random()*40),
    lat: c.lat + (Math.random()*0.3-0.15),
    lng: c.lng + (Math.random()*0.3-0.15),
    last_gps_fix: now - Math.floor(Math.random()*90),
  }));

  await new Promise(r=>setTimeout(r,200));
  return NextResponse.json(vehicles);
}
