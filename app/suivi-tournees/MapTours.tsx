// app/suivi-tournees/MapTours.tsx
"use client";

import { useMemo } from "react";

const cityCoords: Record<string, { lat: number; lng: number }> = {
  Lausanne: { lat: 46.5197, lng: 6.6323 },
  Morges: { lat: 46.5505, lng: 6.4923 },
  Tolochenaz: { lat: 46.4838, lng: 6.4756 },
  Pully: { lat: 46.5173, lng: 6.6588 },
  Prilly: { lat: 46.5344, lng: 6.6397 },
  Renens: { lat: 46.5458, lng: 6.5958 },
  Crissier: { lat: 46.5386, lng: 6.5697 },
  Bussigny: { lat: 46.5453, lng: 6.5786 },
  Ecublens: { lat: 46.5313, lng: 6.5803 },
  Chavannes: { lat: 46.5292, lng: 6.5686 },
  Paris: { lat: 48.8566, lng: 2.3522 },
  Lyon: { lat: 45.7640, lng: 4.8357 },
  Marseille: { lat: 43.2965, lng: 5.3698 },
  Toulouse: { lat: 43.6047, lng: 1.4442 },
  Nice: { lat: 43.7102, lng: 7.2620 },
  Bordeaux: { lat: 44.8378, lng: -0.5792 },
  Lille: { lat: 50.6292, lng: 3.0573 },
  Strasbourg: { lat: 48.5734, lng: 7.7521 },
  Nantes: { lat: 47.2184, lng: -1.5536 },
  Berlin: { lat: 52.52, lng: 13.405 },
  Rome: { lat: 41.9028, lng: 12.4964 },
  Madrid: { lat: 40.4168, lng: -3.7038 },
  London: { lat: 51.5074, lng: -0.1278 },
  Brussels: { lat: 50.8503, lng: 4.3517 },
  Amsterdam: { lat: 52.3676, lng: 4.9041 },
};

const startCoords = { lat: 46.4838, lng: 6.4756 }; // Toulechenaz - votre position par défaut

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

  const cityKey = tour.city.trim();
  const coords = cityCoords[cityKey] || cityCoords[cityKey.charAt(0).toUpperCase() + cityKey.slice(1).toLowerCase()];
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
    // URL pour les directions depuis votre position (Toulechenaz) vers la destination
    return `https://www.openstreetmap.org/directions?from=${startCoords.lat},${startCoords.lng}&to=${coords.lat},${coords.lng}#map=12/${coords.lat}/${coords.lng}`;
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
          Directions depuis Toulechenaz
        </a>
      </div>
    </div>
  );
}