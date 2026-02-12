"use client";
import React, { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import Image from "next/image";
import { useRouter, usePathname } from "next/navigation";
import QRCode from "qrcode";
import {
  faMapMarkedAlt,
  faTruck,
  faChartBar,
  faBoxes,
  faBars,
  faSignOutAlt,
  faTruckMoving,
  faUserFriends,
  faClipboardList,
  faClock,
  faGasPump,
  faTools,
  faSatelliteDish,
  faSignature,
  faQrcode,
  faUndoAlt,
  faHistory,
} from "@fortawesome/free-solid-svg-icons";
import { FontAwesomeIcon } from "@fortawesome/react-fontawesome";
import "./globals.css";
import { ToastProvider, ToastViewport } from "./components/ToastProvider";
import { mockOrders } from "@/types/mockOrders";

type CityTour = {
  driver?: string;
  vehicle?: string;
  selectedOrders?: string[];
  closed?: boolean;
  includeReturns?: boolean;
  execClosed?: boolean;
};

type CityStatus = Record<string /*city*/, Record<string /*orderNo*/, string>>;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
  const [globalWarnings, setGlobalWarnings] = useState<string[]>([]);
  const [globalWarningsVisible, setGlobalWarningsVisible] = useState<boolean>(true);
  const [qrOpen, setQrOpen] = useState(false);
  const [qrDataUrl, setQrDataUrl] = useState<string | null>(null);
  const [qrError, setQrError] = useState<string | null>(null);
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    const storedName = localStorage.getItem("userIdentifier");
    const storedRole = localStorage.getItem("userRole");
    setUserName(storedName);
    setUserRole(storedRole);
    
  }, [pathname, router]);

  const hasProofKey = useCallback((set: Set<string>, orderNo: string): boolean => {
    const no = String(orderNo || '').trim();
    if (!no) return false;
    // Vérifier d'abord le flag localStorage immédiat
    if (typeof window !== 'undefined') {
      if (localStorage.getItem(`signature_${no}`) === 'true') return true;
      if (localStorage.getItem(`signature_WHS-${no}`) === 'true') return true;
      if (localStorage.getItem(`returns_${no}`) === 'true') return true;
      if (localStorage.getItem(`returns_WHS-${no}`) === 'true') return true;
    }
    // Ensuite, vérifier dans le set (fichiers)
    if (set.has(no)) return true;
    const whs = `WHS-${no}`;
    if (set.has(whs)) return true;
    if (no.toUpperCase().startsWith('WHS-') && set.has(no.slice(4))) return true;
    return false;
  }, []);

  useEffect(() => {
    if (typeof window === 'undefined') return;
    const role = (localStorage.getItem('userRole') || '').trim().toLowerCase();
    if (!role) return;
    if (pathname === '/') return;

    setGlobalWarnings([]);

    const norm = (s: string) => String(s || '').trim().toLowerCase().replace(/\s+/g, '');
    const driverNo = (localStorage.getItem('driverNo') || '').trim();

    const matchesLoggedDriver = (tourDriver?: string | null): boolean => {
      const isDriver = role === 'driver' || role === 'chauffeur';
      if (!isDriver) return true;
      if (!driverNo) return true;
      if (!tourDriver) return false;
      return norm(tourDriver).includes(norm(driverNo));
    };

    const loadJson = <T,>(key: string, fallback: T): T => {
      try {
        const raw = localStorage.getItem(key);
        if (!raw) return fallback;
        return JSON.parse(raw) as T;
      } catch {
        return fallback;
      }
    };

    const assignments = loadJson<Record<string, CityTour>>('regions_planning_assignments_v1', {});
    const statuses = loadJson<CityStatus>('regions_planning_status_v1', {} as CityStatus);

    let cancelled = false;

    (async () => {
      try {
        const [podRes, retRes] = await Promise.all([
          fetch(`/api/pod?_t=${Date.now()}`, { cache: 'no-store' }),
          fetch(`/api/returns?_t=${Date.now()}`, { cache: 'no-store' }),
        ]);
        const podJson = await podRes.json();
        const retJson = await retRes.json();
        const pods = Array.isArray(podJson?.records) ? podJson.records : [];
        const returns = Array.isArray(retJson?.records) ? retJson.records : [];
        const orders = Array.isArray(mockOrders) ? mockOrders : [];

        const podSet = new Set<string>();
        for (const r of pods) {
          const k = String(r?.shipmentNo || '').trim();
          if (k) podSet.add(k);
        }

        const returnsSet = new Set<string>();
        for (const r of returns) {
          const k = String(r?.shipmentNo || '').trim();
          if (k) returnsSet.add(k);
        }

        const missingPOD: string[] = [];
        const missingReturns: string[] = [];

        // Sur Vercel, attendre un peu avant de calculer les warnings pour laisser les fichiers s'écrire
        if (process.env.VERCEL) {
          await new Promise(r => setTimeout(r, 400));
        }

        for (const [city, tour] of Object.entries(assignments)) {
          const selectedNos = new Set(tour.selectedOrders || []);
          const cityOrders = orders.filter((o: any) => (o.Sell_to_City || "Autres").trim() === city && selectedNos.has(o.No));
          const st = statuses[city] || {};
          const includeRet = tour.includeReturns !== false;

          for (const o of cityOrders) {
            const delivered = st[o.No] === 'livre';
            if (!delivered) continue;
            if (!hasProofKey(podSet, o.No)) missingPOD.push(o.No);
            if (includeRet && !hasProofKey(returnsSet, o.No)) missingReturns.push(o.No);
          }
        }

        const byDriver: Record<string, { podMissing: Set<string>; returnsMissing: Set<string> }> = {};
        for (const [city, tour] of Object.entries(assignments)) {
          const plannedNos = new Set(tour.selectedOrders || []);
          const stCity = statuses?.[city] || {};
          const includeReturns = tour?.includeReturns !== false;
          const driverLabel = String(tour?.driver || 'Chauffeur inconnu').trim() || 'Chauffeur inconnu';
          if (!byDriver[driverLabel]) byDriver[driverLabel] = { podMissing: new Set(), returnsMissing: new Set() };

          for (const no of plannedNos) {
            const status = String(stCity?.[no] || '').trim().toLowerCase();
            if (status !== 'livre') continue;
            if (!hasProofKey(podSet, no)) byDriver[driverLabel].podMissing.add(no);
            if (includeReturns && !hasProofKey(returnsSet, no)) byDriver[driverLabel].returnsMissing.add(no);
          }
        }

        const driverEntries = Object.entries(byDriver).filter(([, v]) => v.podMissing.size > 0 || v.returnsMissing.size > 0);
        if (driverEntries.length === 0) return;

        const maxToShow = 6;
        const headerMessages: string[] = [];
        driverEntries.slice(0, 3).forEach(([driver, v]) => {
          const podList = Array.from(v.podMissing).slice(0, maxToShow).join(', ');
          const retList = Array.from(v.returnsMissing).slice(0, maxToShow).join(', ');
          const parts: string[] = [];
          if (v.podMissing.size > 0) parts.push(`Signature manquante: ${podList}${v.podMissing.size > maxToShow ? '…' : ''}`);
          if (v.returnsMissing.size > 0) parts.push(`Retours manquants: ${retList}${v.returnsMissing.size > maxToShow ? '…' : ''}`);
          const prefix = role === 'admin' ? `${driver} — ` : '';
          headerMessages.push(`${prefix}${parts.join(' | ')}`);
        });

        if (role === 'admin' && driverEntries.length > 3) {
          headerMessages.push(`Autres alertes: ${driverEntries.length - 3} chauffeur(s) avec manques`);
        }

        setGlobalWarnings(headerMessages);
        if (headerMessages.length > 0) {
          setGlobalWarningsVisible(true);
        }
      } catch {
        if (!cancelled) {
          setGlobalWarnings([]);
          setGlobalWarningsVisible(false);
        }
      }
    })();
  }, [pathname]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pathname || pathname === "/") return;

    const role = (localStorage.getItem("userRole") || "").trim().toLowerCase();
    if (!role) {
      router.push("/");
      return;
    }

    const driverNo = (localStorage.getItem("driverNo") || "").trim();
    const userName = (localStorage.getItem("userName") || "").trim() || (role === "admin" ? "Admin" : driverNo ? `Chauffeur ${driverNo}` : "Utilisateur");
    setUserRole(role);
    setUserName(userName);

    // Écouter l'événement custom de mise à jour des preuves
    const handleProofUpdate = () => {
      // Forcer le rechargement immédiat des warnings
      setGlobalWarnings([]);
      setTimeout(() => {
        window.dispatchEvent(new Event('storage'));
      }, 100);
    };

    window.addEventListener('proofUpdated', handleProofUpdate);

    return () => {
      window.removeEventListener('proofUpdated', handleProofUpdate);
    };
  }, [pathname, router]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (process.env.NODE_ENV !== "production") return;
    if (!("serviceWorker" in navigator)) return;
    navigator.serviceWorker.register("/sw.js").catch(() => {
    });
  }, []);

  useEffect(() => {
    if (!qrOpen) return;
    let cancelled = false;
    (async () => {
      setQrError(null);
      setQrDataUrl(null);
      try {
        const envUrl = (process.env.NEXT_PUBLIC_APP_URL || "").trim();
        const appUrl = (envUrl || window.location.origin).replace(/\/+$/, "");
        const url = await QRCode.toDataURL(appUrl, {
          margin: 2,
          width: 320,
          errorCorrectionLevel: "M",
          color: {
            dark: "#0e112c",
            light: "#ffffff",
          },
        });
        if (!cancelled) setQrDataUrl(url);
      } catch (e: any) {
        if (!cancelled) setQrError(e?.message || "QR generation failed");
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [qrOpen]);

  const handleLogout = () => {
    localStorage.removeItem("userIdentifier");
    localStorage.removeItem("userRole");
    router.push("/");
  };

  // ➔ Different nav items based on role
  const navItems = userRole === "admin"
    ? [
        { href: "/dashboard", label: "Tableau de bord", icon: faChartBar },
        { href: "/expeditions", label: "Expéditions", icon: faBoxes },

       // { href: "/planning", label: "Planification & Optimisation", icon: faTruckMoving },
        { href: "/regions-planning", label: "Tournées", icon: faMapMarkedAlt },
        { href: "/suivi-tournees", label: "Suivi des Tournées", icon: faClipboardList },

        //{ href: "/whse-shipments-kanban", label: "Kanban Entrepôt", icon: faClipboardList },

       
        { href: "/suivi", label: "Suivi en Temps Réel", icon: faClock },
         { href: "/historique", label: "Historique", icon: faHistory },
        //{ href: "/camions-simple", label: "Camions", icon: faTruck },
       // { href: "/chauffeurs", label: "Liste des Chauffeurs", icon: faUserFriends },
      //  { href: "/fuel", label: "Journal du Camion", icon: faTruck },  
      //  { href: "/gps", label: "IoT GPS", icon: faSatelliteDish }
      ]
    : userRole === "driver" || userRole === "chauffeur"
    ? [
      //  { href: "/expeditions", label: "Expéditions", icon: faBoxes },
        { href: "/regions-planning", label: "Tournées", icon: faMapMarkedAlt },
        { href: "/suivi-tournees", label: "Suivi des Tournées", icon: faClipboardList },

      //  { href: "/whse-shipments-kanban", label: "Kanban Entrepôt", icon: faClipboardList },
      //  { href: "/suivi", label: "Suivi en Temps Réel", icon: faClock },
         { href: "/historique", label: "Historique", icon: faHistory },
      ]
    : userRole === "customer"
    ? [
       
      //  { href: "/camions-simple", label: "Camions", icon: faTruck },
       // { href: "/planning", label: "Planification & Optimisation", icon: faTruckMoving },
        { href: "/expeditions", label: "Expéditions", icon: faBoxes },
        { href: "/regions-planning", label: " Tournées", icon: faMapMarkedAlt },
        { href: "/suivi-tournees", label: "Suivi des Tournées", icon: faClipboardList },
       
        { href: "/suivi", label: "Suivi en Temps Réel", icon: faClock },
         { href: "/historique", label: "Historique", icon: faHistory },
      //  { href: "/fuel", label: "Journal du Camion", icon: faTruck },  
       // { href: "/gps", label: "IoT GPS", icon: faSatelliteDish },
       // { href: "/repair", label: "Réparation", icon: faTools }
      ]
      : [
       // { href: "/planning", label: "Planification & Optimisation", icon: faTruckMoving },
        { href: "/expeditions", label: "Expéditions", icon: faBoxes },
        { href: "/regions-planning", label: "Tournées", icon: faMapMarkedAlt },
         { href: "/suivi-tournees", label: "Suivi des Tournées", icon: faClipboardList },
        
        { href: "/suivi", label: "Suivi en Temps Réel", icon: faClock },
        { href: "/historique", label: "Historique", icon: faHistory },
       // { href: "/camions-simple", label: "Camions ", icon: faTruck },
       // { href: "/carte", label: "Carte géographique", icon: faMapMarkedAlt },
        //{ href: "/etat", label: "État de Livraison", icon: faClipboardList },
       
       // { href: "/fuel", label: "Journal du Camion", icon: faTruck },  // Changé ici
       // { href: "/gps", label: "IoT GPS", icon: faSatelliteDish },
        //{ href: "/repair", label: "Réparation", icon: faTools },
      ];
    

  const isLoginPage = pathname === "/";

   const getPageName = () => {
    const currentNavItem = navItems.find((item) => item.href === pathname);
    if (currentNavItem) return currentNavItem.label;
    const last = (pathname || "")
      .split("?")[0]
      .split("#")[0]
      .split("/")
      .filter(Boolean)
      .pop();
    if (!last) return "";
    const label = decodeURIComponent(last)
      .replace(/[-_]+/g, " ")
      .replace(/\b\w/g, (c) => c.toUpperCase());
    return label;
  }; 

  return (
    <html lang="fr">
      <body className="min-h-screen">
        {isLoginPage ? (
          children
        ) : (
          <ToastProvider>
            <ToastViewport />
            <div className="flex min-h-screen relative">
              {/* Mobile backdrop */}
              {mobileOpen && (
                <div
                  className="fixed inset-0 z-40 bg-black/50 md:hidden"
                  onClick={() => setMobileOpen(false)}
                />
              )}
              {/* Sidebar */}
              <aside className={`bg-gray-800 text-white h-screen transition-all duration-300 flex flex-col justify-between fixed md:sticky top-0 z-50 ${mobileOpen ? 'translate-x-0' : '-translate-x-full'} md:translate-x-0 ${isCollapsed ? "w-20" : "w-64"}`}>
                <div>
                  <div className="flex items-center justify-center px-4 py-4 border-b border-gray-700">
                    <div className="flex items-center gap-2">
                      <Image src="/Logo AlmaTrack Blanc PNG.png" alt="Logo" width={isCollapsed ? 40 : 80} height={isCollapsed ? 28 : 40} priority />
                    </div>
                  </div>

                  <nav className="flex flex-col mt-4 space-y-2 px-2">
                    {navItems.map((item) => (
                      <Link
                        key={item.href}
                        href={item.href}
                        onClick={() => setMobileOpen(false)}
                        className={`flex items-center gap-3 px-4 py-2 rounded-md transition ${pathname === item.href ? "bg-blue-600" : "hover:bg-gray-700"}`}
                      >
                        <FontAwesomeIcon icon={item.icon} />
                        {!isCollapsed && <span>{item.label}</span>}
                      </Link>
                    ))}
                  </nav>
                </div>

                <div className="px-4 py-4 border-t border-gray-700">
                  {!isCollapsed && userName && (
                    <div className="text-sm text-gray-300 mb-2">
                      Connecté en tant que : <strong>{userName}</strong>
                    </div>
                  )}
                  <button
                    onClick={handleLogout}
                    className="flex items-center gap-3 w-full text-left text-sm px-4 py-2 rounded-md hover:bg-red-600 transition"
                  >
                    <FontAwesomeIcon icon={faSignOutAlt} />
                    {!isCollapsed && <span>Déconnexion</span>}
                  </button>
                </div>
              </aside>

              {/* Main content */}
              <main className="flex-1 h-screen p-3 md:p-6 bg-gray-100 overflow-auto flex flex-col">
                <div className="flex items-center mb-4">
                  <button
                    onClick={() => {
                      if (window.innerWidth < 768) {
                        setMobileOpen(!mobileOpen);
                      } else {
                        setIsCollapsed(!isCollapsed);
                      }
                    }}
                    className="text-gray-700 text-lg mr-2"
                  >
                    <FontAwesomeIcon icon={faBars} />
                  </button>
                  <div className="flex items-center justify-between w-full gap-3">
                    <h1 className="text-xl font-semibold">{getPageName()}</h1>
                    <button
                      onClick={() => setQrOpen(true)}
                      className="xp-text inline-flex items-center justify-center px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                      title="QR pour installer l’application"
                    >
                      <FontAwesomeIcon icon={faQrcode} />
                    </button>
                  </div>
                </div>

                {globalWarningsVisible && globalWarnings.length > 0 && (
                  <div className="mb-4 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-amber-900">
                    <div className="flex items-start justify-between gap-3">
                      <div className="text-sm font-semibold">Avertissements</div>
                      <button
                        type="button"
                        onClick={() => setGlobalWarningsVisible(false)}
                        className="text-xs px-2 py-1 rounded-lg border border-amber-200 bg-white hover:bg-amber-100"
                      >
                        Fermer
                      </button>
                    </div>
                    <div className="mt-1 grid gap-1">
                      {globalWarnings.slice(0, 6).map((m, idx) => (
                        <div key={idx} className="text-xs">
                          {m}
                        </div>
                      ))}
                      {globalWarnings.length > 6 && (
                        <div className="text-xs">+{globalWarnings.length - 6} autre(s)…</div>
                      )}
                    </div>
                  </div>
                )}

                {qrOpen && (
                  <div
                    className="fixed inset-0 z-50 flex items-center justify-center p-4"
                    style={{ backgroundColor: "rgba(2,6,23,0.55)" }}
                    onClick={() => setQrOpen(false)}
                  >
                    <div
                      className="w-full max-w-lg rounded-2xl bg-white overflow-hidden"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
                        <div>
                          <div className="xp3" style={{ color: "var(--logo-4)" }}>Installer l’application</div>
                          <div className="xp-text text-slate-600">Scanne le QR avec ton téléphone</div>
                        </div>
                        <button
                          onClick={() => setQrOpen(false)}
                          className="xp-text px-3 py-2 rounded-lg bg-white text-slate-700 ring-1 ring-slate-200 hover:bg-slate-50"
                        >
                          Fermer
                        </button>
                      </div>

                      <div className="p-4">
                        <div className="flex flex-col items-center justify-center rounded-2xl border bg-white p-4" style={{ borderColor: "rgba(79,88,165,0.18)" }}>
                          {qrDataUrl ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img src={qrDataUrl} alt="QR" className="w-[320px] h-[320px]" />
                          ) : (
                            <div className="xp-text text-slate-500">Génération…</div>
                          )}
                        </div>

                        {qrError && (
                          <div className="xp-text mt-3" style={{ color: "#b45309" }}>{qrError}</div>
                        )}

                        <div className="xp-text mt-4 text-slate-500">
                          Si tu scannes depuis un autre appareil, configure `NEXT_PUBLIC_APP_URL` .
                        </div>
                        <div className="xp-text mt-2">
                          <Link href="/qr" className="text-blue-700 underline" onClick={() => setQrOpen(false)}>
                            Ouvrir la page QR
                          </Link>
                        </div>
                      </div>
                    </div>
                  </div>
                )}

                {children}
              </main>
            </div>
          </ToastProvider>
        )}
      </body>
    </html>
  );
}







