// app/components/MapComponent.tsx
'use client';

import { useEffect, useRef, useState } from 'react';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { Vehicle } from '@/types';

// Create a truck icon with optional rotation and speed warning
const createTruckIcon = (bearing: number = 0, isSpeeding: boolean = false, speed: number = 0) => {
  const truckColor = isSpeeding ? '#EF4444' : '#3B82F6';
  const pulseAnimation = isSpeeding ? 'pulse 1.5s infinite' : 'none';
  const speedText = Math.round(speed) + ' km/h';
  
  return L.divIcon({
    className: 'truck-marker',
    html: `
      <div style="
        position: relative;
        transform: rotate(${bearing}deg);
        transform-origin: center;
        text-align: center;
        animation: ${pulseAnimation};
      ">
        <svg width="32" height="32" viewBox="0 0 32 32">
          <!-- Truck body -->
          <rect x="6" y="12" width="20" height="10" rx="2" fill="${truckColor}" stroke="#fff" stroke-width="1.5"/>
          <!-- Truck cabin -->
          <rect x="19" y="8" width="7" height="6" rx="1" fill="${truckColor}" stroke="#fff" stroke-width="1.5"/>
          <!-- Wheels -->
          <circle cx="12" cy="24" r="3" fill="#333" stroke="#fff" stroke-width="1"/>
          <circle cx="24" cy="24" r="3" fill="#333" stroke="#fff" stroke-width="1"/>
          <!-- Speed indicator -->
          <text x="16" y="28" font-size="8" font-weight="bold" fill="white" text-anchor="middle" 
                style="filter: drop-shadow(0 0 2px #000);">${speedText}</text>
        </svg>
      </div>
      <style>
        @keyframes pulse {
          0% { filter: drop-shadow(0 0 5px rgba(239, 68, 68, 0.7)); }
          50% { filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.9)); }
          100% { filter: drop-shadow(0 0 5px rgba(239, 68, 68, 0.7)); }
        }
      </style>
    `,
    iconSize: [32, 32],
    iconAnchor: [16, 32],
    popupAnchor: [0, -32]
  });
};

interface MapComponentProps {
  vehicles?: Vehicle[];
}

const MapComponent = ({ vehicles = [] }: MapComponentProps) => {
  const mapRef = useRef<L.Map | null>(null);
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const polylineRef = useRef<L.Polyline | null>(null);
  const truckMarkersRef = useRef<{[key: string]: L.Marker}>({});
  const alertedVehicles = useRef<Set<string>>(new Set());
  const [currentPositions, setCurrentPositions] = useState<{[key: string]: [number, number]}>({});
  const [lastUpdate, setLastUpdate] = useState<Date>(new Date());

  // Calculate distance between two points in km
  const getDistance = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const R = 6371; // Radius of the earth in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a = 
      Math.sin(dLat/2) * Math.sin(dLat/2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * 
      Math.sin(dLon/2) * Math.sin(dLon/2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1-a));
    return R * c; // Distance in km
  };

  // Calculate bearing between two points
  const getBearing = (lat1: number, lon1: number, lat2: number, lon2: number) => {
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const y = Math.sin(dLon) * Math.cos(lat2 * Math.PI / 180);
    const x = Math.cos(lat1 * Math.PI / 180) * Math.sin(lat2 * Math.PI / 180) -
              Math.sin(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) * Math.cos(dLon);
    return (Math.atan2(y, x) * 180 / Math.PI + 360) % 360;
  };

  useEffect(() => {
    if (typeof window !== 'undefined' && mapContainerRef.current) {
      // Initialize map centered on Europe
      if (!mapRef.current) {
        mapRef.current = L.map(mapContainerRef.current).setView([49.8, 3.0], 6);
        
        L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
          attribution: '© OpenStreetMap contributors'
        }).addTo(mapRef.current);
      }

      const map = mapRef.current;
      
      // Clear existing truck markers
      Object.values(truckMarkersRef.current).forEach(marker => {
        if (marker && map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
      });
      truckMarkersRef.current = {};

      // Add markers for each vehicle
      const newPositions: {[key: string]: [number, number]} = {};
      
      
      vehicles.forEach(vehicle => {
        const position: [number, number] = [vehicle.lat, vehicle.lng];
        const bearing = Math.random() * 360; // Random direction for now
        const currentSpeed = vehicle.speed || 0;
        const isSpeeding = currentSpeed > 110;
        
        // Show alert if vehicle is speeding and we haven't alerted about it yet
        if (isSpeeding && !alertedVehicles.current.has(vehicle.vehicle_id)) {
          alert(`⚠️ Alerte de vitesse: ${vehicle.service_name || `Camion ${vehicle.vehicle_id}`} roule à ${Math.round(currentSpeed)} km/h !`);
          alertedVehicles.current.add(vehicle.vehicle_id);
        } else if (!isSpeeding) {
          // Remove from alerted vehicles if speed is back to normal
          alertedVehicles.current.delete(vehicle.vehicle_id);
        }
        
        const truckIcon = createTruckIcon(bearing, isSpeeding);
        const marker = L.marker(position, { 
          icon: truckIcon,
          zIndexOffset: 1000,
          title: vehicle.service_name || `Camion ${vehicle.vehicle_id}`
        });
        
        // Add popup with vehicle info and speed warning if needed
        const speedWarning = isSpeeding 
          ? '<div class="text-red-600 font-bold">⚠️ Vitesse excessive !</div>' 
          : '';
          
        marker.bindPopup(`
          <div class="p-2 min-w-[200px]">
            <h3 class="font-bold">${vehicle.service_name || `Camion ${vehicle.vehicle_id}`}</h3>
            <p>ID: ${vehicle.vehicle_id}</p>
            <p class="${isSpeeding ? 'text-red-600 font-bold' : ''}">
              Vitesse: ${Math.round(currentSpeed)} km/h
              ${isSpeeding ? '⚠️' : ''}
            </p>
            ${speedWarning}
            <p>Dernière mise à jour: ${new Date(vehicle.last_gps_fix * 1000).toLocaleTimeString()}</p>
          </div>
        `);
        
        marker.addTo(map);
        truckMarkersRef.current[vehicle.vehicle_id] = marker;
        newPositions[vehicle.vehicle_id] = position;
      });
      
      setCurrentPositions(newPositions);
    }
  }, []);
  
  // Update markers when vehicles change
  useEffect(() => {
    if (!mapRef.current) return;
    
    const map = mapRef.current;
    const newPositions: {[key: string]: [number, number]} = {};
    
    // Update existing markers and add new ones
    vehicles.forEach(vehicle => {
      if (!vehicle || !vehicle.vehicle_id) return;
      
      const position: [number, number] = [vehicle.lat, vehicle.lng];
      newPositions[vehicle.vehicle_id] = position;
      
      if (truckMarkersRef.current[vehicle.vehicle_id]) {
        // Update existing marker
        const marker = truckMarkersRef.current[vehicle.vehicle_id];
        if (marker && map.hasLayer(marker)) {
          marker.setLatLng(position);
          
          // Update popup content
          marker.setPopupContent(`
            <div class="p-3 min-w-[200px] bg-white rounded-lg shadow-lg">
              <div class="flex items-center mb-2">
                <div class="w-3 h-3 rounded-full mr-2 ${(vehicle.speed || 0) > 110 ? 'bg-red-500' : 'bg-green-500'}"></div>
                <h3 class="font-bold text-lg text-gray-800">${vehicle.service_name || `Camion ${vehicle.vehicle_id}`}</h3>
              </div>
              <div class="grid grid-cols-2 gap-2 text-sm text-gray-700">
                <div class="font-medium">ID:</div>
                <div>${vehicle.vehicle_id}</div>
                
                <div class="font-medium">Vitesse:</div>
                <div class="flex items-center">
                  <span class="inline-block w-2 h-2 rounded-full ${(vehicle.speed || 0) > 110 ? 'bg-red-500' : 'bg-green-500'} mr-1"></span>
                  ${Math.round(vehicle.speed || 0)} km/h
                </div>
                
                <div class="font-medium">Dernière mise à jour:</div>
                <div>${new Date(vehicle.last_gps_fix * 1000).toLocaleTimeString('fr-FR')}</div>
                
                ${vehicle.plate_number ? `
                  <div class="font-medium">Plaque:</div>
                  <div class="bg-gray-100 px-2 py-1 rounded font-mono">${vehicle.plate_number}</div>
                ` : ''}
              </div>
              ${(vehicle.speed || 0) > 110 ? `
                <div class="mt-2 p-2 bg-red-50 text-red-700 rounded text-xs flex items-center">
                  <svg class="w-4 h-4 mr-1" fill="currentColor" viewBox="0 0 20 20">
                    <path fill-rule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clip-rule="evenodd"/>
                  </svg>
                  Alerte: Vitesse excessive
                </div>
              ` : ''}
            </div>
          `);
        }
      } else {
        // Add new marker
        const bearing = Math.random() * 360;
        const truckIcon = createTruckIcon(bearing);
        const marker = L.marker(position, { 
          icon: truckIcon,
          zIndexOffset: 1000,
          title: vehicle.service_name || `Camion ${vehicle.vehicle_id}`
        });
        
        marker.bindPopup(`
          <div class="p-2">
            <h3 class="font-bold">${vehicle.service_name || `Camion ${vehicle.vehicle_id}`}</h3>
            <p>ID: ${vehicle.vehicle_id}</p>
            <p>Vitesse: ${Math.round(vehicle.speed || 0)} km/h</p>
            <p>Dernière mise à jour: ${new Date(vehicle.last_gps_fix * 1000).toLocaleTimeString()}</p>
          </div>
        `);
        
        marker.addTo(map);
        truckMarkersRef.current[vehicle.vehicle_id] = marker;
      }
    });
    
    // Remove markers that are no longer in the vehicles list
    Object.keys(truckMarkersRef.current).forEach(vehicleId => {
      if (!vehicles.some(v => v.vehicle_id === vehicleId)) {
        const marker = truckMarkersRef.current[vehicleId];
        if (marker && map.hasLayer(marker)) {
          map.removeLayer(marker);
        }
        delete truckMarkersRef.current[vehicleId];
      }
    });
    
    setCurrentPositions(newPositions);
    setLastUpdate(new Date());
  }, [vehicles]);
  
  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (mapRef.current) {
        // Remove all markers
        Object.values(truckMarkersRef.current).forEach(marker => {
          if (marker && mapRef.current?.hasLayer(marker)) {
            mapRef.current.removeLayer(marker);
          }
        });
        truckMarkersRef.current = {};
        
        // Remove the map
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  return (
    <div>
      <div className="relative">
        <div className="absolute top-4 right-4 z-[1000] bg-white p-2 rounded-lg shadow-md">
          <div className="text-sm font-medium">
            <div>Véhicules en ligne: <span className="font-bold">{vehicles.length}</span></div>
            {vehicles.length > 0 && (
              <div className="text-xs text-gray-600">
                Dernière mise à jour: {lastUpdate.toLocaleTimeString()}
              </div>
            )}
          </div>
        </div>
        <div 
          ref={mapContainerRef} 
          style={{ 
            height: '500px', 
            width: '100%', 
            borderRadius: '0.5rem',
            zIndex: 1
          }} 
        />
      </div>
    </div>
  );
};

export default MapComponent;