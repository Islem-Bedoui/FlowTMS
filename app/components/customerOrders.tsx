'use client';
import { useEffect, useState } from 'react';
import DataGrid, { Column } from 'devextreme-react/data-grid';

const columns = [
  { dataField: 'No', caption: 'Numéro de commande' },
  { dataField: 'Requested_Delivery_Date', caption: 'Date de livraison' },
  { dataField: 'PromisedDeliveryHours', caption: 'Délai de livraison' },
  /* { dataField: 'Sell_to_Customer_Name', caption: 'Nom du client ' },
  { dataField: 'Sell_to_Address', caption: 'Adresse ' },
  { dataField: 'Sell_to_City', caption: 'Ville ' },
  { dataField: 'Sell_to_Post_Code', caption: 'Code postal ' },
  { dataField: 'Sell_to_Contact', caption: 'Contact' }, 
  { dataField: 'Due_Date', caption: 'Échéance' },
  { dataField: 'Payment_Terms_Code', caption: 'Code des conditions de paiement' },
  /* { dataField: 'Shipping_Agent_Code', caption: 'Code de l’agent maritime' },
  { dataField: 'Package_Tracking_No', caption: 'Suivi des colis ' }, */
  { dataField: 'Shipment_Date', caption: 'date d’expédition' },
  { dataField: 'Ship_to_Address', caption: 'Expédier à l’adresse' },
  { dataField: 'Shipping_Advice', caption: 'Conseils d’expédition' }, 
  { dataField: 'Assigned_Driver_No', caption: 'Chauffeur' },
];

const CustomerOrders = () => {
  const [orders, setOrders] = useState<any[] | null>(null);
  const [filteredOrders, setFilteredOrders] = useState<any[] | null>(null);

  useEffect(() => {
    const fetchOrders = async () => {
      try {
        const response = await fetch('/api/salesOrders');
        const data = await response.json();
        setOrders(data.value || []);
      } catch (err) {
        console.error('Error fetching orders:', err);
      }
    };
    fetchOrders();
  }, []);

  useEffect(() => {
    const storedIdentifier = localStorage.getItem('userIdentifier');
    if (orders) {
      const filtered = orders.filter((order) => {
        const matchesUser =
          !storedIdentifier || order.Sell_to_Contact === storedIdentifier;
        const CompletelyShipped = order.CompletelyShipped == false;
        return matchesUser && CompletelyShipped;
      });
      setFilteredOrders(filtered);
    }
  }, [orders]);
  

  if (!filteredOrders) return <p>Chargement...</p>;

  return (
    <div className="flex">
      <div className="flex-1 p-6 overflow-auto">
        <div className="p-4 shadow-md bg-white animate-fade-in-up">
          <DataGrid
            dataSource={filteredOrders}
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

export default CustomerOrders;