import type { MetadataRoute } from 'next'

/**
 * Manifest de la PWA. Next lo sirve en `/manifest.webmanifest`.
 *
 * Los íconos los genera `scripts/generar-iconos.ts`. Los colores salen del
 * `@theme` de `app/globals.css` (surface), igual que el `themeColor` del
 * viewport en `app/layout.tsx`: si cambian allá, cambiarlos acá.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    id: '/',
    name: 'Control Financiero',
    short_name: 'Finanzas',
    description: 'Control de gastos personal',
    lang: 'es-AR',
    start_url: '/',
    scope: '/',
    display: 'standalone',
    orientation: 'portrait',
    background_color: '#0f131c',
    theme_color: '#0f131c',
    icons: [
      { src: '/icon-192.png', sizes: '192x192', type: 'image/png' },
      { src: '/icon-512.png', sizes: '512x512', type: 'image/png' },
      // Android recorta el ícono con una máscara y solo garantiza el 80%
      // central, así que este va con más aire alrededor del dibujo.
      {
        src: '/icon-maskable-512.png',
        sizes: '512x512',
        type: 'image/png',
        purpose: 'maskable',
      },
    ],
    // Mantener apretado el ícono abre directo la acción principal.
    shortcuts: [
      {
        name: 'Cargar gasto',
        short_name: 'Cargar',
        url: '/cargar',
        icons: [{ src: '/icon-192.png', sizes: '192x192', type: 'image/png' }],
      },
    ],
  }
}
