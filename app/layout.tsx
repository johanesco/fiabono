import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import { Toaster } from "react-hot-toast"; // <-- Importamos el sistema de alertas

const inter = Inter({ subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Fiabono",
  description: "La app de los negocios locales",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="es">
      <body className={inter.className}>
        {/* Aquí vive toda tu aplicación */}
        {children}
        
        {/* Aquí agregamos el lanzador global de alertas elegantes */}
        <Toaster 
          position="top-center" 
          toastOptions={{
            duration: 4000,
            style: {
              fontWeight: 'bold',
              borderRadius: '1rem',
            },
          }} 
        />
      </body>
    </html>
  );
}