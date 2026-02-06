// app/suivi-tournees/MapTours.tsx
"use client";

import { useMemo } from "react";

const cityCoords: Record<string, { lat: number; lng: number }> = {
  Paris: { lat: 48.8566, lng: 2.3522 },
  Berlin: { lat: 52.52, lng: 13.405 },
  Rome: { lat: 41.9028, lng: 12.4964 },
  Madrid: { lat: 40.4168, lng: -3.7038 },
  London: { lat: 51.5074, lng: -0.1278 },
  Brussels: { lat: 50.8503, lng: 4.3517 },
  Amsterdam: { lat: 52.3676, lng: 4.9041 },
  Lyon: { lat: 45.7640, lng: 4.8357 },
  Marseille: { lat: 43.2965, lng: 5.3698 },
  Toulouse: { lat: 43.6047, lng: 1.4442 },
  Nice: { lat: 43.7102, lng: 7.2620 },
};

const startCoords = { lat: 45.7640, lng: 4.8357 }; // Lyon

export default function MapTours({ 
  tour 
}: { 
  tour: { 
    city: string; 
    driver?: string; 
    vehicle?: string; 
    orders?: { No: string; Sell_to_City: string; Sell_to_Post_Code: string }[] 
  } 
}) {
  if (!tour?.city || tour.city.trim().toLowerCase() === "tunis") return null;

  const coords = cityCoords[tour.city];
  if (!coords) {
    return (
      <div className="w-full h-64 bg-slate-100 rounded-xl shadow relative mt-2 flex items-center justify-center">
        <span className="text-rose-500">Coordonnées inconnues pour {tour.city}</span>
      </div>
    );
  }

  const mapKey = useMemo(() => {
    const ordersKey = Array.isArray(tour?.orders)
      ? tour.orders.map((o) => o.No).join("|")
      : "";
    return `map-${tour.city}-${ordersKey}`;
  }, [tour.city, tour.orders]);

  const embedUrl = useMemo(() => {
    const pad = 0.35;
    const left = coords.lng - pad;
    const right = coords.lng + pad;
    const top = coords.lat + pad;
    const bottom = coords.lat - pad;
    const bbox = `${left}%2C${bottom}%2C${right}%2C${top}`;
    const marker = `${coords.lat}%2C${coords.lng}`;
    return `https://www.openstreetmap.org/export/embed.html?bbox=${bbox}&layer=mapnik&marker=${marker}`;
  }, [coords.lat, coords.lng]);

  const openUrl = useMemo(() => {
    return `https://www.openstreetmap.org/?mlat=${coords.lat}&mlon=${coords.lng}#map=10/${coords.lat}/${coords.lng}`;
  }, [coords.lat, coords.lng]);

  return (
    <div key={mapKey} className="w-full rounded-xl shadow mt-2 overflow-hidden border border-slate-200">
      <div className="w-full h-64 bg-white">
        <iframe
          title={`map-${tour.city}`}
          src={embedUrl}
          className="w-full h-full"
          loading="lazy"
        />
      </div>
      <div className="px-3 py-2 bg-white/90 text-xs text-slate-600 flex items-center justify-between">
        <div>
          {tour.city} • {tour.orders?.length || 0} commande(s)
        </div>
        <a href={openUrl} target="_blank" rel="noreferrer" className="text-sky-700 hover:underline">
          Ouvrir
        </a>
      </div>
    </div>
  );
}