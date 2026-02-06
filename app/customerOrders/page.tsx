'use client';
import 'devextreme/dist/css/dx.light.css'; // Light theme
import React from 'react';

import CustomerOrders from "../components/customerOrders";
import '../globals.css'
export default function Home() {
    return (
        <main>
          
          <CustomerOrders />
        </main>
      );
       
}