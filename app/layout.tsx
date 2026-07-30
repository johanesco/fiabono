import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Fiabono | Control de Créditos",
  description: "Plataforma de gestión de fiados y abonos para comerciantes",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className="bg-gray-50 text-gray-900 antialiased">
        
        {/* Barra de Navegación */}
        <nav className="bg-white shadow-sm border-b border-gray-200 p-4">
          <div className="max-w-5xl mx-auto flex justify-between items-center">
            <span className="text-2xl font-black text-blue-600 tracking-tight">
              Fiabono.
            </span>
            <div className="space-x-6 text-sm font-semibold text-gray-600">
              <a href="#" className="hover:text-blue-600 transition-colors">Inicio</a>
              <a href="#" className="hover:text-blue-600 transition-colors">Clientes</a>
            </div>
          </div>
        </nav>

        {/* Contenedor donde cargarán las páginas */}
        <div className="max-w-5xl mx-auto p-4 mt-4">
          {children}
        </div>

      </body>
    </html>
  );
}