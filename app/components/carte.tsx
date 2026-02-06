'use client';
import React, { useEffect, useState, useRef, useLayoutEffect } from 'react';
import { mockOrders } from '../../types/mockOrders';
import 'ol/ol.css';
import { Map, View, Overlay } from 'ol';
import TileLayer from 'ol/layer/Tile';
import VectorLayer from 'ol/layer/Vector';
import OSM from 'ol/source/OSM';
import VectorSource from 'ol/source/Vector';
import { Feature } from 'ol';
import { FeatureLike } from 'ol/Feature';
import { Point } from 'ol/geom';
import { fromLonLat } from 'ol/proj';
import { Style, Icon, Text, Fill, Stroke } from 'ol/style';
import Cluster from 'ol/source/Cluster';

interface Order {
  No: string;
  Assigned_Driver_No?: string;
  Sell_to_Address?: string;
  Sell_to_City?: string;
  Sell_to_Post_Code?: string;
  Sell_to_Country_Region_Code?: string;
  Sell_to_Customer_No?: string;
  Document_Type?: string;
  Requested_Delivery_Date?: string;
  PromisedDeliveryHours?: string;
  volume?: number;
  capacity?: number;
}

const OpenLayersMap = () => {
  const [orders, setOrders] = useState<Order[] | null>(null);
  const [loading, setLoading] = useState(false);
  const [filterText, setFilterText] = useState('');
  const [clusterDistance, setClusterDistance] = useState(40);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [rescheduleISO, setRescheduleISO] = useState<string>('');
  const mapRef = useRef<Map | null>(null);
  const popupRef = useRef<HTMLDivElement | null>(null);
  const overlayRef = useRef<Overlay | null>(null);
  const mapContainerRef = useRef<HTMLDivElement | null>(null);
  const vectorSourceRef = useRef<VectorSource | null>(null);
  const clusterSourceRef = useRef<Cluster | null>(null);
  const vectorLayerRef = useRef<VectorLayer<any> | null>(null);
  const userSourceRef = useRef<VectorSource | null>(null);
  const userLayerRef = useRef<VectorLayer<any> | null>(null);


  // Use mockOrders in development or if API fails
  const fetchOrders = React.useCallback(async () => {
    // If running in development, use mockOrders
    if (process.env.NODE_ENV === 'development') {
      setOrders(mockOrders);
      return;
    }
    const userIdentifier = localStorage.getItem('userIdentifier');
    try {
      const response = await fetch('/api/salesOrders', { cache: 'no-store' });
      if (!response.ok) throw new Error(`HTTP error: ${response.status}`);
      const data = await response.json();
      if (!data.value || !Array.isArray(data.value)) {
        console.error('Invalid API response: "value" is missing or not an array', data);
        setOrders(mockOrders); // fallback to mock data
        return;
      }
      const filteredOrders = data.value.filter(
        (order: any) =>
          order.Assigned_Driver_No &&
          userIdentifier &&
          order.Assigned_Driver_No.toLowerCase() === userIdentifier.toLowerCase()
      ) || [];
      const validOrders = filteredOrders.map((o: any) => ({
        No: o.No || 'Unknown',
        Assigned_Driver_No: o.Assigned_Driver_No || 'Unknown',
        Sell_to_Address: o.Sell_to_Address || '',
        Sell_to_City: o.Sell_to_City || '',
        Sell_to_Post_Code: o.Sell_to_Post_Code || '',
        Sell_to_Country_Region_Code: o.Sell_to_Country_Region_Code || '',
        Sell_to_Customer_No: o.Sell_to_Customer_No || '',
        Document_Type: o.Document_Type || '',
        Requested_Delivery_Date: o.Requested_Delivery_Date || '',
        PromisedDeliveryHours: o.PromisedDeliveryHours || '',
        volume: o.volume,
        capacity: o.capacity,
      })).filter((o: Order) => o.No && o.Assigned_Driver_No);
      // If no API orders, fallback to mockOrders
      if (validOrders.length === 0) {
        setOrders(mockOrders);
      } else {
        setOrders(validOrders);
      }
    } catch (err) {
      console.error('Error fetching orders:', err);
      setOrders(mockOrders); // fallback to mock data
    }
  }, []);

  useEffect(() => { fetchOrders(); }, [fetchOrders]);

  // Initialize map once
  useEffect(() => {
    if (!mapContainerRef.current || mapRef.current) return;

    const map = new Map({
      target: mapContainerRef.current,
      layers: [new TileLayer({ source: new OSM() })],
      view: new View({ center: fromLonLat([10, 50]), zoom: 4 }),
    });
    mapRef.current = map;

    vectorSourceRef.current = new VectorSource();
    clusterSourceRef.current = new Cluster({ distance: clusterDistance, source: vectorSourceRef.current });

    vectorLayerRef.current = new VectorLayer({
      source: clusterSourceRef.current,
      style: (feature: any) => {
        const size = feature.get('features')?.length || 1;
        if (size > 1) {
          return new Style({
            image: new Icon({
              src: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
              scale: 0.75,
              anchor: [0.5, 1],
            }),
            text: new Text({
              text: String(size),
              offsetY: -20,
              fill: new Fill({ color: '#fff' }),
              stroke: new Stroke({ color: '#111827', width: 3 }),
            }),
          });
        }
        return new Style({
          image: new Icon({
            src: 'https://raw.githubusercontent.com/pointhi/leaflet-color-markers/master/img/marker-icon-2x-red.png',
            scale: 0.75,
            anchor: [0.5, 1],
          }),
        });
      },
    });
    map.addLayer(vectorLayerRef.current);

    // user location layer
    userSourceRef.current = new VectorSource();
    userLayerRef.current = new VectorLayer({
      source: userSourceRef.current,
      style: new Style({
        image: new Icon({
          src: 'https://maps.gstatic.com/mapfiles/ms2/micons/blue-dot.png',
          scale: 1,
          anchor: [0.5, 1],
        })
      })
    });
    map.addLayer(userLayerRef.current);

    popupRef.current = document.createElement('div');
    popupRef.current.className = 'popup';
    popupRef.current.style.backgroundColor = 'white';
    popupRef.current.style.padding = '12px';
    popupRef.current.style.border = '1px solid #ccc';
    popupRef.current.style.borderRadius = '6px';
    popupRef.current.style.boxShadow = '0 2px 6px rgba(0,0,0,0.3)';
    popupRef.current.style.fontSize = '15px';
    popupRef.current.style.maxWidth = '300px';
    popupRef.current.style.lineHeight = '1.5';
    overlayRef.current = new Overlay({ element: popupRef.current, autoPan: { margin: 20 } });
    map.addOverlay(overlayRef.current);

    map.on('singleclick', (event) => {
      const featuresAtPixel = map.getFeaturesAtPixel(event.pixel);
      if (featuresAtPixel && Array.isArray(featuresAtPixel) && featuresAtPixel.length > 0 && overlayRef.current && popupRef.current) {
        const first: any = (featuresAtPixel as any[])[0];
        const clusterMembers: Feature[] = first.get('features') || [];
        if (clusterMembers.length === 1) {
          const ord = clusterMembers[0].get('order');
          if (ord) setSelectedOrder(ord);
          overlayRef.current.setPosition(undefined);
          return;
        }
        let popupContent = '<div style="min-width:240px">';
        clusterMembers.forEach((m: Feature) => {
          const orderNo = m.get('orderNo');
          const address = m.get('address');
          popupContent += `<div data-no="${orderNo}" style="cursor:pointer;padding:6px 4px;border-bottom:1px solid #e5e7eb"><strong>#${orderNo}</strong><br/><span style=\"color:#475569;font-size:12px\">${address}</span></div>`;
        });
        popupContent += '</div>';
        popupRef.current.innerHTML = popupContent;
        overlayRef.current.setPosition(event.coordinate);
      } else if (overlayRef.current) {
        overlayRef.current.setPosition(undefined);
      }
    });

    // delegate clicks inside popup to open details
    const onPopupClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      const item = target.closest('[data-no]') as HTMLElement | null;
      if (!item) return;
      const no = item.getAttribute('data-no');
      if (!no) return;
      const src = vectorSourceRef.current;
      if (!src) return;
      const feature = src.getFeatureById(no);
      const ord = feature?.get('order');
      if (ord) setSelectedOrder(ord);
      overlayRef.current?.setPosition(undefined);
    };
    popupRef.current.addEventListener('click', onPopupClick);

    return () => {
      if (mapRef.current) mapRef.current.setTarget(undefined);
      popupRef.current?.removeEventListener('click', onPopupClick);
    };
  }, []);

  // Geocode and add features when orders change
  useEffect(() => {
    const map = mapRef.current;
    const vectorSource = vectorSourceRef.current;
    if (!map || !vectorSource) return;
    if (!orders || orders.length === 0) {
      vectorSource.clear();
      map.updateSize();
      return;
    }

    setLoading(true);
    const cacheKey = 'geocode_cache_v1';
    let cache: Record<string, [number, number]> = {};
    try { cache = JSON.parse(localStorage.getItem(cacheKey) || '{}'); } catch {}

    const positionMap: { [key: string]: number } = {};
    const features: Feature[] = [];

    const geocodeOne = async (address: string): Promise<[number, number] | null> => {
      if (cache[address]) return cache[address];
      try {
        const response = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}`, {
          headers: { 'User-Agent': 'TruckPlanningApp/1.0 (contact@example.com)' },
        });
        if (!response.ok) throw new Error(`Nominatim HTTP error: ${response.status}`);
        const data = await response.json();
        if (data && data.length > 0) {
          const { lat, lon } = data[0];
          const coords: [number, number] = [parseFloat(lon), parseFloat(lat)];
          if (!isNaN(coords[0]) && !isNaN(coords[1])) {
            cache[address] = coords;
            try { localStorage.setItem(cacheKey, JSON.stringify(cache)); } catch {}
            return coords;
          }
        }
      } catch (err) {
        console.error('Geocoding error:', err);
      }
      return null;
    };

    const run = async () => {
      const visibleOrders = orders.filter(o => !filterText || o.No.toLowerCase().includes(filterText.toLowerCase()));
      for (let i = 0; i < visibleOrders.length; i += 5) {
        const batch = visibleOrders.slice(i, i + 5);
        const promises = batch.map(async (order) => {
          const address = [order.Sell_to_Address || '', order.Sell_to_City || '', order.Sell_to_Post_Code || '', order.Sell_to_Country_Region_Code || '']
            .filter(Boolean)
            .join(', ');
          let coords = await geocodeOne(address);
          if (!coords) {
            const city = (order.Sell_to_City || '').toLowerCase();
            if (city === 'lyon') coords = [4.8343, 45.7678];
            else if (city === 'tours') coords = [0.6848, 47.3941];
          }
          if (coords) {
            const projected = fromLonLat(coords);
            const coordsKey = projected.join(',');
            if (!positionMap[coordsKey]) positionMap[coordsKey] = 0;
            const offsetIndex = positionMap[coordsKey]++;
            const offset = offsetIndex * 0.0001;
            const adjusted = [projected[0] + offset, projected[1] + offset];
            const feature = new Feature({
              geometry: new Point(adjusted as [number, number] as any),
              orderNo: order.No,
              address,
              order,
            });
            feature.setId(order.No);
            features.push(feature);
          }
        });
        await Promise.all(promises);
        if (i + 5 < orders.length) await new Promise(r => setTimeout(r, 800));
      }

      vectorSource.clear();
      vectorSource.addFeatures(features);
      map.updateSize();

      if (features.length > 0) {
        const extent = vectorSource.getExtent();
        if (!extent.some(isNaN)) {
          map.getView().fit(extent, { padding: [100, 100, 100, 100], maxZoom: 12, duration: 600 });
        }
      }
      setLoading(false);
    };

    run();
  }, [orders, filterText]);

  // React to cluster distance changes
  useEffect(() => {
    if (clusterSourceRef.current) {
      // @ts-ignore - setDistance exists in OL Cluster source
      clusterSourceRef.current.setDistance(clusterDistance);
    }
  }, [clusterDistance]);

  useLayoutEffect(() => {
    if (mapRef.current && mapContainerRef.current) {
      const updateMapSize = () => {
        const width = mapContainerRef.current?.offsetWidth || 0;
        const height = mapContainerRef.current?.offsetHeight || 0;
        if (width > 0 && height > 0) mapRef.current?.updateSize();
      };
      updateMapSize();
      window.addEventListener('resize', updateMapSize);
      return () => window.removeEventListener('resize', updateMapSize);
    }
  }, [orders]);

  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', padding: '2rem', gap: '12px' }}>
      <div style={{ width: '100%', maxWidth: '1200px', display: 'flex', gap: 12, alignItems: 'center', background: '#ffffff', border: '1px solid #e5e7eb', padding: 12, borderRadius: 12, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
        <input
          value={filterText}
          onChange={(e) => setFilterText(e.target.value)}
          placeholder="Filtrer par N° commande..."
          style={{ flex: 1, border: '1px solid #e5e7eb', borderRadius: 8, padding: '8px 10px' }}
        />
        <button onClick={() => fetchOrders()} style={{ padding: '8px 12px', background: '#2563eb', color: 'white', borderRadius: 8, border: 'none' }}>Rafraîchir</button>
        <button onClick={() => {
          const map = mapRef.current; const src = vectorSourceRef.current; if (map && src && src.getFeatures().length) { const ex = src.getExtent(); if (!ex.some(isNaN)) map.getView().fit(ex, { padding: [80,80,80,80], maxZoom: 12, duration: 500 }); }
        }} style={{ padding: '8px 12px', background: '#0ea5e9', color: 'white', borderRadius: 8, border: 'none' }}>Ajuster vue</button>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: 12, color: '#334155' }}>Cluster</label>
          <input type="range" min={0} max={80} value={clusterDistance} onChange={(e) => setClusterDistance(parseInt(e.target.value))} />
        </div>
        <button onClick={() => {
          if (!navigator.geolocation) return;
          navigator.geolocation.getCurrentPosition((pos) => {
            const { longitude, latitude } = pos.coords as any;
            const center = fromLonLat([longitude, latitude]);
            const map = mapRef.current; const src = userSourceRef.current;
            if (map && src) {
              src.clear();
              src.addFeature(new Feature({ geometry: new Point(center) }));
              map.getView().setCenter(center);
              map.getView().setZoom(12);
            }
          });
        }} style={{ padding: '8px 12px', background: '#10b981', color: 'white', borderRadius: 8, border: 'none' }}>Me localiser</button>
      </div>
      <div
        ref={mapContainerRef}
        id="map"
        style={{
          width: '100%',
          maxWidth: '1200px',
          height: '600px',
          borderRadius: '20px',
          overflow: 'hidden',
          boxShadow: '0 4px 20px rgba(0, 0, 0, 0.15)',
          border: '1px solid #e0e0e0',
          backgroundColor: '#f9f9f9',
        }}
      ></div>
      {loading && (
        <div style={{ position: 'absolute', top: 24, right: 24, background: '#111827cc', color: 'white', padding: '6px 10px', borderRadius: 8, fontSize: 12 }}>
          Géocodage en cours...
        </div>
      )}
      {selectedOrder && (
        <div style={{ width: '100%', maxWidth: 1200, background: '#ffffff', border: '1px solid #e5e7eb', borderRadius: 12, padding: 16, boxShadow: '0 2px 8px rgba(0,0,0,0.06)' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <h3 style={{ margin: 0, fontSize: 16, fontWeight: 800, color: '#0f172a' }}>Détails commande #{selectedOrder.No}</h3>
            <button onClick={() => setSelectedOrder(null)} style={{ border: '1px solid #e5e7eb', background: '#f8fafc', borderRadius: 8, padding: '6px 10px' }}>Fermer</button>
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 8, color: '#0f172a', fontSize: 14 }}>
            <div><strong>Client:</strong> {selectedOrder.Sell_to_Customer_No || '-'}</div>
            <div><strong>Type:</strong> {selectedOrder.Document_Type || '-'}</div>
            <div><strong>Date demandée:</strong> {selectedOrder.Requested_Delivery_Date || '-'}</div>
            <div><strong>Heure promise:</strong> {selectedOrder.PromisedDeliveryHours || '-'}</div>
            <div><strong>Volume:</strong> {selectedOrder.volume !== undefined ? selectedOrder.volume : '-'}</div>
            <div><strong>Capacité:</strong> {selectedOrder.capacity !== undefined ? selectedOrder.capacity : '-'}</div>
            <div style={{ gridColumn: '1 / -1' }}><strong>Adresse:</strong> {[selectedOrder.Sell_to_Address, selectedOrder.Sell_to_Post_Code, selectedOrder.Sell_to_City, selectedOrder.Sell_to_Country_Region_Code].filter(Boolean).join(', ') || '-'}</div>
          </div>
          <div style={{ marginTop: 12, display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            <button
              onClick={() => { const url = `/commandes?order=${encodeURIComponent(selectedOrder.No)}`; window.open(url, '_blank'); }}
              style={{ padding: '8px 12px', background: '#2563eb', color: 'white', borderRadius: 8, border: 'none' }}
            >Ouvrir la commande</button>
            <button
              onClick={() => { const addr = [selectedOrder.Sell_to_Address, selectedOrder.Sell_to_Post_Code, selectedOrder.Sell_to_City, selectedOrder.Sell_to_Country_Region_Code].filter(Boolean).join(', '); if (!addr) return; const g = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(addr)}`; window.open(g, '_blank'); }}
              style={{ padding: '8px 12px', background: '#0ea5e9', color: 'white', borderRadius: 8, border: 'none' }}
            >Itinéraire</button>
            <button
              onClick={async () => { const addr = [selectedOrder.Sell_to_Address, selectedOrder.Sell_to_Post_Code, selectedOrder.Sell_to_City, selectedOrder.Sell_to_Country_Region_Code].filter(Boolean).join(', '); try { await navigator.clipboard.writeText(addr); } catch { /* ignore */ } }}
              style={{ padding: '8px 12px', background: '#10b981', color: 'white', borderRadius: 8, border: 'none' }}
            >Copier l'adresse</button>
          </div>
          <div style={{ marginTop: 12, display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
            <label style={{ fontSize: 13, color: '#334155' }}>Replanifier:</label>
            <input
              type="datetime-local"
              value={rescheduleISO}
              onChange={(e) => setRescheduleISO(e.target.value)}
              style={{ border: '1px solid #e5e7eb', borderRadius: 8, padding: '6px 10px' }}
            />
            <button
              onClick={async () => {
                if (!rescheduleISO || !selectedOrder) return;
                const dt = new Date(rescheduleISO);
                if (isNaN(dt.getTime())) return;
                const datePart = dt.toISOString().split('T')[0];
                const timePart = dt.toTimeString().slice(0, 8);
                try {
                  const res = await fetch('/api/updateOrder', {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ orderNo: selectedOrder.No, Requested_Delivery_Date: datePart, PromisedDeliveryHours: timePart })
                  });
                  if (!res.ok) throw new Error('HTTP ' + res.status);
                  // Optimistic local update
                  setSelectedOrder({ ...selectedOrder, Requested_Delivery_Date: datePart, PromisedDeliveryHours: timePart });
                } catch (e) {
                  alert('Échec de replanification');
                }
              }}
              style={{ padding: '8px 12px', background: '#f59e0b', color: '#111827', borderRadius: 8, border: '1px solid #f59e0b' }}
            >Appliquer</button>
          </div>
        </div>
      )}
    </div>
  );
};

export default OpenLayersMap;










