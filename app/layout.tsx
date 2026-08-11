import "./globals.css";
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
      </body>
    </html>
  );
}