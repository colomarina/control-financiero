'use client'

import { useEffect } from 'react'

/**
 * Registra `public/sw.js`, que es lo que habilita instalar la app.
 *
 * Solo en producción: en `next dev` un service worker se queda con assets
 * viejos y pelea con el hot reload.
 */
export function RegistrarSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== 'production') return
    if (!('serviceWorker' in navigator)) return

    // Después del load para no competir por ancho de banda con la primera pintura.
    const registrar = () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {
        // Si falla, la app anda igual: solo se pierde la instalación.
      })
    }

    if (document.readyState === 'complete') registrar()
    else {
      window.addEventListener('load', registrar)
      return () => window.removeEventListener('load', registrar)
    }
  }, [])

  return null
}
