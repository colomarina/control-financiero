/**
 * Service worker mínimo.
 *
 * Existe por dos razones: un navegador no ofrece instalar la app si no hay uno
 * registrado con un handler de `fetch`, y cachear los assets estáticos hace que
 * abrir desde el ícono sea instantáneo.
 *
 * Regla que NO se rompe: acá solo se cachea `/_next/static/*`, que Next sirve
 * con hash en el nombre (un deploy nuevo cambia la URL, así que nunca queda
 * viejo). Todo lo demás —páginas, Server Actions, payloads de RSC— va siempre
 * a la red: son datos financieros y tienen que llegar frescos.
 */
const CACHE = 'cf-estatico-v1'

self.addEventListener('install', (event) => {
  // Tomar el control sin esperar a que se cierren las pestañas viejas.
  self.skipWaiting()
  event.waitUntil(caches.open(CACHE))
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // Limpiar versiones anteriores del cache.
      const nombres = await caches.keys()
      await Promise.all(nombres.filter((n) => n !== CACHE).map((n) => caches.delete(n)))
      await self.clients.claim()
    })(),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  const url = new URL(req.url)

  const esEstatico =
    req.method === 'GET' &&
    url.origin === self.location.origin &&
    url.pathname.startsWith('/_next/static/')

  if (!esEstatico) return // Sin respondWith: lo maneja el navegador, red directa.

  event.respondWith(
    (async () => {
      const cacheado = await caches.match(req)
      if (cacheado) return cacheado

      const respuesta = await fetch(req)
      if (respuesta.ok) {
        const cache = await caches.open(CACHE)
        cache.put(req, respuesta.clone())
      }
      return respuesta
    })(),
  )
})
