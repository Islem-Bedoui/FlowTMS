"use client";
import { useEffect, useState } from "react";
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

export default function RootLayout({ children }: { children: React.ReactNode }) {
  const [isCollapsed, setIsCollapsed] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const [userName, setUserName] = useState<string | null>(null);
  const [userRole, setUserRole] = useState<string | null>(null);
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

  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!pathname || pathname === "/") return;

    const role = (localStorage.getItem("userRole") || "").trim().toLowerCase();
    if (!role) {
      router.push("/");
      return;
    }

    if (role === "admin") return;

    const driverAllowed = new Set([
      "/regions-planning",
      "/suivi-tournees",
      "/sales-shipments",
      "/pod-signature",
      "/retours-vides",
      "/suivi",
      "/whse-shipments-kanban",
    ]);

    const isAllowed = driverAllowed.has(pathname);
    if ((role === "driver" || role === "chauffeur") && !isAllowed) {
      router.push("/regions-planning");
    }
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

       // { href: "/planning", label: "Planification & Optimisation", icon: faTruckMoving },
        { href: "/regions-planning", label: "Tournées", icon: faMapMarkedAlt },
        { href: "/suivi-tournees", label: "Suivi des Tournées", icon: faClipboardList },

        { href: "/whse-shipments-kanban", label: "Kanban Entrepôt", icon: faClipboardList },

        { href: "/historique", label: "Historique", icon: faHistory },
        { href: "/suivi", label: "Suivi en Temps Réel", icon: faClock },
        
        //{ href: "/camions-simple", label: "Camions", icon: faTruck },
        { href: "/chauffeurs", label: "Liste des Chauffeurs", icon: faUserFriends },
      //  { href: "/fuel", label: "Journal du Camion", icon: faTruck },  
      //  { href: "/gps", label: "IoT GPS", icon: faSatelliteDish }
      ]
    : userRole === "driver" || userRole === "chauffeur"
    ? [
        { href: "/regions-planning", label: "Tournées", icon: faMapMarkedAlt },
        { href: "/suivi-tournees", label: "Suivi des Tournées", icon: faClipboardList },

        { href: "/whse-shipments-kanban", label: "Kanban Entrepôt", icon: faClipboardList },
        { href: "/suivi", label: "Suivi en Temps Réel", icon: faClock },
      ]
    : userRole === "customer"
    ? [
       
      //  { href: "/camions-simple", label: "Camions", icon: faTruck },
       // { href: "/planning", label: "Planification & Optimisation", icon: faTruckMoving },
        { href: "/regions-planning", label: " Tournées", icon: faMapMarkedAlt },
        { href: "/suivi-tournees", label: "Suivi des Tournées", icon: faClipboardList },
        { href: "/historique", label: "Historique", icon: faHistory },
        { href: "/suivi", label: "Suivi en Temps Réel", icon: faClock },
      //  { href: "/fuel", label: "Journal du Camion", icon: faTruck },  
       // { href: "/gps", label: "IoT GPS", icon: faSatelliteDish },
       // { href: "/repair", label: "Réparation", icon: faTools }
      ]
      : [
       // { href: "/planning", label: "Planification & Optimisation", icon: faTruckMoving },
        { href: "/regions-planning", label: "Tournées", icon: faMapMarkedAlt },
         { href: "/suivi-tournees", label: "Suivi des Tournées", icon: faClipboardList },
        { href: "/historique", label: "Historique", icon: faHistory },
        { href: "/suivi", label: "Suivi en Temps Réel", icon: faClock },
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
                          Si tu scannes depuis un autre appareil, configure `NEXT_PUBLIC_APP_URL` (ex: https://votre-domaine.com).
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







