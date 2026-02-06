// types/mockFuel.ts
export type MockFuelEntry = {
  EntryNo: string;
  TruckNo: string;
  Date: string;
  FuelType: string;
  Liters: number;
  Odometer: number;
  LastOdometer: number;
};

export const mockFuel: MockFuelEntry[] = [
  { EntryNo: 'F0001', TruckNo: 'TR001', Date: '2025-12-04T08:30:00Z', FuelType: 'Diesel', Liters: 45.2, Odometer: 120345, LastOdometer: 120000 },
  { EntryNo: 'F0002', TruckNo: 'TR002', Date: '2025-12-04T10:15:00Z', FuelType: 'Diesel', Liters: 30.0, Odometer: 80340, LastOdometer: 80000 },
  { EntryNo: 'F0003', TruckNo: 'TR001', Date: '2025-12-05T09:00:00Z', FuelType: 'Diesel', Liters: 50.5, Odometer: 120900, LastOdometer: 120345 },
  { EntryNo: 'F0004', TruckNo: 'TR003', Date: '2025-12-05T11:45:00Z', FuelType: 'Essence', Liters: 25.1, Odometer: 15020, LastOdometer: 14900 },
  { EntryNo: 'F0005', TruckNo: 'TR002', Date: '2025-12-06T07:50:00Z', FuelType: 'Diesel', Liters: 60.0, Odometer: 81000, LastOdometer: 80340 },
];
