// types/mockGps.ts
export type MockGpsPoint = {
  truckNo: string;
  lat: number;
  lon: number;
  speedKmh: number;
  heading: number; // degrees
  timestamp: string; // ISO
  status: 'moving' | 'stopped' | 'idle';
  address?: string;
};

export const mockGps: MockGpsPoint[] = [
  { truckNo: 'TR001', lat: 48.8566, lon: 2.3522, speedKmh: 38, heading: 120, timestamp: '2025-12-04T10:10:00Z', status: 'moving', address: 'Paris, FR' },
  { truckNo: 'TR002', lat: 45.7640, lon: 4.8357, speedKmh: 0, heading: 0, timestamp: '2025-12-04T10:12:00Z', status: 'stopped', address: 'Lyon, FR' },
  { truckNo: 'TR003', lat: 43.6047, lon: 1.4442, speedKmh: 12, heading: 210, timestamp: '2025-12-04T10:14:00Z', status: 'idle', address: 'Toulouse, FR' },
  { truckNo: 'TR001', lat: 48.8666, lon: 2.3422, speedKmh: 42, heading: 140, timestamp: '2025-12-04T10:15:00Z', status: 'moving', address: 'Paris 2e, FR' },
];
