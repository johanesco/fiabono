import "./globals.css";
import { Toaster } from "react-hot-toast";
import { AuthProvider } from "../hooks/AuthContext";

export const metadata = {
  title: "Fiabono",
  description: "Sistema de gestión y control de inventario y fiados",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="es">
      <body className="font-sans antialiased bg-slate-100 dark:bg-slate-950">
        <AuthProvider>
          {children}
        </AuthProvider>
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