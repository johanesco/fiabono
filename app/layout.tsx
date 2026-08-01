import './globals.css'

export const metadata = {
  title: 'Fiabono - Gestión Inteligente',
  description: 'Software de gestión de cartera, fiados y abonos.',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="es">
      <body className="bg-gray-100 text-gray-900 antialiased selection:bg-blue-200">
        {children}
      </body>
    </html>
  )
}