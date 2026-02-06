"use client";

import React, { useEffect, useMemo, useState } from "react";
import dynamic from "next/dynamic";

// Types aligned with existing app
import { Suspense } from "react";
import SuiviTourneesComponent from "./SuiviTourneesComponent";

export default function SuiviTourneesPage() {
  return (
    <Suspense fallback={<div>Chargement...</div>}>
      <SuiviTourneesComponent />
    </Suspense>
  );
}
  