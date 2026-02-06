'use client';
import { useEffect, useState } from 'react';
import DataGrid, { Column } from 'devextreme-react/data-grid';

const columns = [
  { dataField: 'No', caption: 'No' },
  { dataField: 'Description', caption: 'Description' },
  { dataField: 'Make', caption: 'Make' },
  { dataField: 'Model', caption: 'Model' },
  { dataField: 'Year', caption: 'Year' },
  { dataField: 'License_Plate', caption: 'License Plate' },
  { dataField: 'Status', caption: 'Status' },
  { dataField: 'Resource_No', caption: 'Resource No' },
  { dataField: 'VIN', caption: 'VIN' },
];

const TruckList = () => {
  const [trucks, setTrucks] = useState<any[] | null>(null);
  const [filteredTrucks, setFilteredTrucks] = useState<any[] | null>(null);

  useEffect(() => {
    const fetchTrucks = async () => {
      try {
        const response = await fetch('/api/listeCamions');
        const data = await response.json();
        setTrucks(data.value || []);
      } catch (err) {
        console.error(err);
      }
    };
    fetchTrucks();
  }, []);

  useEffect(() => {
    const storedIdentifier = localStorage.getItem('userIdentifier');
    if (trucks) {
      const filtered = storedIdentifier
        ? trucks.filter((truck) => truck.Resource_No === storedIdentifier)
        : trucks;
      setFilteredTrucks(filtered);
    }
  }, [trucks]);

  if (!filteredTrucks) return <p>Chargement...</p>;

  return (
    <div className="flex">
  <div className="flex-1 p-6 overflow-auto">
    <div className="p-4 shadow-md bg-white animate-fade-in-up">
      <DataGrid
        dataSource={filteredTrucks}
        keyExpr="No"
        columnAutoWidth={true}
        rowAlternationEnabled={true}
        showBorders={false}
        className="custom-datagrid transition-all duration-500"
        onContentReady={(e) => {
          e.component.updateDimensions();
        }}
      >
        {columns.map((col, index) => (
          <Column
            key={index}
            dataField={col.dataField}
            caption={col.caption}
          />
        ))}
      </DataGrid>
    </div>
  </div>
</div>


  );
};

export default TruckList;




