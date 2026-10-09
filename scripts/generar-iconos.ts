/**
 * Genera los íconos de la PWA en `public/`.
 *
 *   node scripts/generar-iconos.ts
 *
 * No usa dependencias: un PNG es un par de chunks con CRC32 y los píxeles
 * comprimidos con `zlib`, igual que `migrar-excel.ts` lee un .xlsx a mano.
 *
 * El dibujo son tres barras ascendentes: el mismo gesto que la `BarraTope` del
 * Home, que es el elemento visual central de la app. Los colores salen del
 * `@theme` de `app/globals.css`; si cambian ahí, cambiarlos acá y re-correr.
 */
import { deflateSync, crc32 } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const SURFACE = [0x0f, 0x13, 0x1c] as const // --color-surface
const PRIMARY = [0x4e, 0xde, 0xa3] as const // --color-primary

type RGB = readonly [number, number, number]

/** Mezcla un color sobre el fondo. `a` va de 0 a 1. */
function mezclar(frente: RGB, fondo: RGB, a: number): RGB {
  return [
    Math.round(frente[0] * a + fondo[0] * (1 - a)),
    Math.round(frente[1] * a + fondo[1] * (1 - a)),
    Math.round(frente[2] * a + fondo[2] * (1 - a)),
  ]
}

// ---------------------------------------------------------------------------
// PNG
// ---------------------------------------------------------------------------
function chunk(tipo: string, datos: Buffer): Buffer {
  const largo = Buffer.alloc(4)
  largo.writeUInt32BE(datos.length)
  const cuerpo = Buffer.concat([Buffer.from(tipo, 'latin1'), datos])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(cuerpo))
  return Buffer.concat([largo, cuerpo, crc])
}

/** `pixeles` es RGB sin alpha: 3 bytes por píxel, `lado * lado` píxeles. */
function png(lado: number, pixeles: Buffer): Buffer {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(lado, 0)
  ihdr.writeUInt32BE(lado, 4)
  ihdr[8] = 8 // bits por canal
  ihdr[9] = 2 // color type 2 = RGB
  // 10, 11, 12 = compresión / filtro / entrelazado, todos 0.

  // Cada scanline arranca con su byte de filtro (0 = sin filtro).
  const crudo = Buffer.alloc(lado * (1 + lado * 3))
  for (let y = 0; y < lado; y++) {
    const destino = y * (1 + lado * 3)
    crudo[destino] = 0
    pixeles.copy(crudo, destino + 1, y * lado * 3, (y + 1) * lado * 3)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(crudo, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

// ---------------------------------------------------------------------------
// Dibujo
// ---------------------------------------------------------------------------
type Barra = { x0: number; y0: number; x1: number; y1: number; color: RGB }

/** Cuánto de un rectángulo redondeado cubre el punto (en 0..1, con 3x3 de muestreo). */
function cobertura(b: Barra, r: number, px: number, py: number): number {
  let dentro = 0
  for (let sy = 0; sy < 3; sy++) {
    for (let sx = 0; sx < 3; sx++) {
      const x = px + (sx + 0.5) / 3
      const y = py + (sy + 0.5) / 3
      if (x < b.x0 || x > b.x1 || y < b.y0 || y > b.y1) continue
      // Distancia al rectángulo interior (el que queda al achicar por el radio).
      const dx = Math.max(b.x0 + r - x, 0, x - (b.x1 - r))
      const dy = Math.max(b.y0 + r - y, 0, y - (b.y1 - r))
      if (dx * dx + dy * dy <= r * r) dentro++
    }
  }
  return dentro / 9
}

/**
 * @param escala  Cuánto ocupa el dibujo sobre el lado. Los íconos `maskable`
 *                usan menos para entrar en el círculo que recorta Android.
 */
function dibujar(lado: number, escala: number): Buffer {
  const S = lado * escala
  const margen = (lado - S) / 2

  // Tres barras: ancho, separación y alturas en fracciones del dibujo.
  const ancho = 0.16 * S
  const hueco = 0.1 * S
  const alturas = [0.34, 0.52, 0.72].map((h) => h * S)
  const base = margen + 0.84 * S
  const izquierda = margen + (S - (3 * ancho + 2 * hueco)) / 2

  const barras: Barra[] = alturas.map((alto, i) => ({
    x0: izquierda + i * (ancho + hueco),
    x1: izquierda + i * (ancho + hueco) + ancho,
    y0: base - alto,
    y1: base,
    // La barra más alta a pleno; las otras apagadas, como una barra de tope
    // que todavía no llegó.
    color: mezclar(PRIMARY, SURFACE, [0.45, 0.7, 1][i]),
  }))

  const radio = ancho / 2
  const pixeles = Buffer.alloc(lado * lado * 3)

  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      let color: RGB = SURFACE
      for (const b of barras) {
        const c = cobertura(b, radio, x, y)
        if (c > 0) color = mezclar(b.color, color, c)
      }
      const p = (y * lado + x) * 3
      pixeles[p] = color[0]
      pixeles[p + 1] = color[1]
      pixeles[p + 2] = color[2]
    }
  }

  return pixeles
}

// ---------------------------------------------------------------------------
const SALIDAS = [
  // [archivo, lado, escala del dibujo]
  //
  // Los de `public/` los referencia `app/manifest.ts` por ruta fija.
  ['public/icon-192.png', 192, 0.76],
  ['public/icon-512.png', 512, 0.76],
  // Maskable: Android recorta en círculo y solo garantiza el 80% central.
  ['public/icon-maskable-512.png', 512, 0.56],
  //
  // Los de `app/` son convención de Next: emite los <link> del <head> solo.
  // iOS no lee el manifest, así que el ícono de la pantalla de inicio sale de
  // apple-icon; no aplica máscara, pero sí redondea.
  ['app/apple-icon.png', 180, 0.72],
  // Favicon de la pestaña. Reemplaza al favicon.ico de create-next-app.
  ['app/icon.png', 256, 0.76],
] as const

for (const [archivo, lado, escala] of SALIDAS) {
  writeFileSync(archivo, png(lado, dibujar(lado, escala)))
  console.log(`${archivo}  ${lado}x${lado}`)
}
