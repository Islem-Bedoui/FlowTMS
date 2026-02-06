'use client';
import 'devextreme/dist/css/dx.light.css'; // Light theme
import React from 'react';

import Trucks from "../components/camions";
import '../globals.css'
export default function Home() {
    return (
        <main>
          
          <Trucks />
        </main>
      );
       
}