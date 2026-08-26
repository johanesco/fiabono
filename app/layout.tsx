import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "../hooks/AuthContext";
import ServiceWorkerRegistrar from "@/components/ServiceWorkerRegistrar";
import InstallPrompt from "@/components/InstallPrompt";

export const metadata = {
  title: "Fiabono",
  description: "Sistema de gestión y control de inventario y fiados",
  manifest: "/manifest.json",
  icons: {
    icon: "/icon-512.jpg",
    apple: "/icon-512.jpg",
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
    <html lang="es">
      <body className="font-sans antialiased bg-slate-100 dark:bg-slate-950">
        <ServiceWorkerRegistrar />
        <AuthProvider>
          {children}
        </AuthProvider>
        <InstallPrompt />
        <Toaster
          position="top-right"
          toastOptions={{
            duration: 3500,
            style: {
              borderRadius: "18px",
              padding: "0",
              background: "rgba(255,255,255,0.96)",
              border: "1px solid rgba(148, 163, 184, 0.24)",
              boxShadow: "0 20px 45px -18px rgba(15, 23, 42, 0.35)",
              maxWidth: "420px",
              color: "#0f172a",
            },
          }}
        />
      </body>
    </html>
  );
}