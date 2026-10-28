import Script from "next/script";
import "./globals.css";
import AppToaster from "@/components/AppToaster";
import { AuthProvider } from "../hooks/AuthContext";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata = {
  metadataBase: new URL("https://www.fiabono.com"),
  title: "Fiabono | Software POS para Almacenes y Tiendas de Barrio, Control de Fiados y Plan Separe",
  description: "El sistema POS más fácil de Colombia para almacenes, tiendas de barrio y minimarkets. Controla ventas, inventario, cobro de fiados por WhatsApp y Plan Separe desde tu celular o computador.",
  keywords: [
    "sistema pos colombia",
    "software para almacenes",
    "software pos almacenes de ropa",
    "software para tienda de barrio",
    "control de fiados",
    "plan separe ropa y calzado",
    "software pos gratis",
    "programa para tienda y almacen",
    "facturas por whatsapp",
    "control de inventario facil"
  ],
  openGraph: {
    title: "Fiabono | Software POS para Almacenes y Tiendas de Barrio, Control de Fiados y Plan Separe",
    description: "El sistema POS más fácil de Colombia para almacenes, tiendas de barrio y minimarkets. Controla ventas, inventario, cobro de fiados por WhatsApp y Plan Separe desde tu celular o computador.",
    url: "https://www.fiabono.com",
    siteName: "Fiabono",
    locale: "es_CO",
    type: "website",
    images: [
      {
        url: "/logo-verde-linea-blanca-grande.png",
        width: 512,
        height: 512,
        alt: "Fiabono - Software POS para Almacenes y Tiendas",
      },
    ],
  },
  twitter: {
    card: "summary",
    title: "Fiabono | Software POS para Almacenes y Tiendas de Barrio, Control de Fiados y Plan Separe",
    description: "El sistema POS más fácil de Colombia para almacenes, tiendas de barrio y minimarkets. Controla ventas, inventario, cobro de fiados por WhatsApp y Plan Separe desde tu celular o computador.",
    images: ["/logo-verde-linea-blanca-grande.png"],
  },
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/icon-192.png", type: "image/png", sizes: "192x192" },
      { url: "/icon-512.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: [
      { url: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  },
  appleWebApp: {
    capable: true,
    statusBarStyle: "default",
    title: "Fiabono",
  },
  formatDetection: {
    telephone: false,
  },
};

export const viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#10b981",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <body className="font-sans antialiased bg-slate-100 dark:bg-slate-950">
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('temaFiabono')||localStorage.getItem('tema');if(t==='oscura'||(t==='auto'&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})()`,
          }}
        />

        <ServiceWorkerRegistrar />
        <AuthProvider>
          {children}
        </AuthProvider>
        <InstallPrompt />
        <AppToaster />
      </body>
    </html>
  );
}
