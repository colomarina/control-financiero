/**
 * Helper de `FormData` compartido por las Server Actions.
 *
 * Vive acá y no en `app/actions/movimientos.ts` (de donde salió) porque un
 * archivo `'use server'` solo puede exportar funciones async: son Server
 * Actions, y esta es una función sync de apoyo. Tampoco es `/lib/core`: no es
 * lógica de dominio, es un detalle de cómo se lee un formulario.
 */

import { usaTarjeta } from '@/lib/core/tarjetas'

/** Un campo de texto del form, recortado; `null` si no vino o quedó vacío. */
export function texto(fd: FormData, campo: string): string | null {
  const v = fd.get(campo)
  if (typeof v !== 'string') return null
  const limpio = v.trim()
  return limpio === '' ? null : limpio
}

/**
 * Un campo de tres estados: `'si'` es `true`, `'no'` es `false` y cualquier otra
 * cosa (vacío, ausente) es `null` = "no forzar, que decida la app".
 */
export function triestado(fd: FormData, campo: string): boolean | null {
  const v = fd.get(campo)
  if (v === 'si') return true
  if (v === 'no') return false
  return null
}

/**
 * La tarjeta del form, solo si la forma de pago pasa por una tarjeta. Si el
 * usuario eligió una tarjeta y después cambió a efectivo, el input oculto
 * puede seguir mandándola: acá se descarta, para que un gasto en efectivo
 * nunca sume a la meta del banco.
 */
export function tarjetaDelForm(fd: FormData): string | null {
  const forma = fd.get('formaPago')
  if (typeof forma !== 'string' || !usaTarjeta(forma)) return null
  return texto(fd, 'tarjetaId')
}
