import type { Metadata, Viewport } from 'next'
import { Geist } from 'next/font/google'
import { Toaster } from '@/components/ui/sonner'
import { RegistrarSW } from '@/components/RegistrarSW'
import './globals.css'

const geistSans = Geist({ variable: '--font-geist-sans', subsets: ['latin'] })

// Material Symbols (los íconos del design system) no está en next/font/google,
// así que va por stylesheet. `display=block` evita que se vean los nombres de
// los íconos como texto mientras la fuente carga.
const MATERIAL_SYMBOLS =
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Outlined:opsz,wght,FILL,GRAD@20..48,100..700,0..1,-50..200&display=block'

export const metadata: Metadata = {
  title: 'Control Financiero',
  description: 'Control de gastos personal',
  manifest: '/manifest.webmanifest',
  // iOS no lee el manifest: la pantalla completa y el ícono salen de acá.
  appleWebApp: {
    capable: true,
    title: 'Finanzas',
    // `black-translucent` deja que el fondo suba hasta atrás de la barra de
    // estado; las safe areas del layout evitan que el header quede tapado.
    statusBarStyle: 'black-translucent',
  },
}

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
  // Hace falta para que `env(safe-area-inset-*)` devuelva algo en el celular.
  viewportFit: 'cover',
  themeColor: '#0f131c',
}

export default function RootLayout({ children }: LayoutProps<'/'>) {
  return (
    <html
      lang="es-AR"
      // Dark siempre: no hay tema claro ni switcher.
      className={`dark ${geistSans.variable} h-full antialiased`}
    >
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="" />
        <link rel="stylesheet" href={MATERIAL_SYMBOLS} />
      </head>
      <body className="bg-surface text-on-surface flex min-h-full flex-col">
        {children}
        <Toaster position="top-center" />
        <RegistrarSW />
      </body>
    </html>
  )
}
