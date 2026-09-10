import Script from "next/script";
import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "../hooks/AuthContext";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata = {
  title: "Fiabono | Software POS para Tiendas de Barrio, Control de Fiados y Plan Separe",
  description: "El sistema POS más fácil de Colombia para tiendas de barrio, minimarkets y almacenes de ropa. Controla ventas, inventario, cobro de fiados por WhatsApp y Plan Separe desde tu celular o computador.",
  keywords: [
    "sistema pos colombia",
    "software para tienda de barrio",
    "control de fiados",
    "plan separe ropa y calzado",
    "software pos gratis",
    "programa para tienda",
    "facturas por whatsapp",
    "control de inventario facil"
  ],
  manifest: "/manifest.json",
  icons: {
    icon: [
      { url: "/favicon.ico", sizes: "any" },
      { url: "/favicon.png", type: "image/png", sizes: "32x32" },
      { url: "/logo-verde-linea-blanca-grande.png", type: "image/png", sizes: "512x512" },
    ],
    shortcut: "/favicon.ico",
    apple: "/logo-verde-linea-blanca-grande.png",
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
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#10b981" },
    { media: "(prefers-color-scheme: dark)", color: "#0f172a" },
  ],
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es" suppressHydrationWarning>
      <head>
        <Script
          id="theme-initializer"
          strategy="beforeInteractive"
          dangerouslySetInnerHTML={{
            __html: `(function(){try{var t=localStorage.getItem('temaFiabono')||localStorage.getItem('tema');if(t==='oscura'||(!t&&window.matchMedia('(prefers-color-scheme: dark)').matches)){document.documentElement.classList.add('dark')}else{document.documentElement.classList.remove('dark')}}catch(e){}})()`,
          }}
        />
      </head>

      <body className="font-sans antialiased bg-slate-100 dark:bg-slate-950">
        <ServiceWorkerRegistrar />
        <AuthProvider>
          {children}
        </AuthProvider>
        <InstallPrompt />
        <Toaster
          position="top-right"
          gutter={10}
          toastOptions={{
            duration: 3500,
            className: "border border-slate-200/80 dark:border-slate-800 bg-white/95 dark:bg-[#0f172a]/95 text-slate-800 dark:text-slate-100 shadow-xl shadow-slate-900/10 dark:shadow-slate-950/60 backdrop-blur-xl font-bold text-xs sm:text-sm rounded-2xl py-3 px-4",
            success: {
              iconTheme: {
                primary: '#10b981',
                secondary: '#ffffff',
              },
            },
            error: {
              iconTheme: {
                primary: '#f43f5e',
                secondary: '#ffffff',
              },
            },
          }}
        />
      </body>
    </html>
  );
}