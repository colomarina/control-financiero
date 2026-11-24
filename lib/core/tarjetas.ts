/**
 * Tarjetas: con qué plástico se pagó cada gasto.
 *
 * Puro: entra la lista de movimientos y de tarjetas, sale la decisión.
 */
import type { FormaPago, MovimientoDetalle } from '@/lib/schemas/movimiento'
import type { Tarjeta } from '@/lib/schemas/tarjeta'

/**
 * Las formas de pago que pasan por una tarjeta de crédito: la compra y el
 * débito automático (Netflix, la prepaga), que se cobran en el resumen. El
 * débito de cuenta, el efectivo y la transferencia no llevan tarjeta.
 */
export const FORMAS_CON_TARJETA: readonly FormaPago[] = ['tarjeta_credito', 'debito_automatico']

export function usaTarjeta(forma: FormaPago | string): boolean {
  return (FORMAS_CON_TARJETA as readonly string[]).includes(forma)
}

/**
 * Con qué tarjeta activa se pagó cada comercio la última vez. Mismo criterio
 * que `ultimaFormaPorComercio`: a igual fecha gana el último de la lista.
 * Las tarjetas dadas de baja no cuentan: no tiene sentido preseleccionarlas.
 */
export function ultimaTarjetaPorComercio(
  movs: MovimientoDetalle[],
  tarjetas: Tarjeta[],
): Record<string, string> {
  const activas = new Set(tarjetas.filter((t) => t.activa).map((t) => t.id))
  const ultima = new Map<string, { fecha: string; tarjetaId: string }>()
  for (const m of movs) {
    if (!m.tarjetaId || !activas.has(m.tarjetaId)) continue
    const previo = ultima.get(m.comercioId)
    if (!previo || m.fecha >= previo.fecha) {
      ultima.set(m.comercioId, { fecha: m.fecha, tarjetaId: m.tarjetaId })
    }
  }
  return Object.fromEntries([...ultima].map(([id, { tarjetaId }]) => [id, tarjetaId]))
}

/**
 * La tarjeta activa más usada, para cuando el comercio no tiene historia.
 * `null` si no hay ninguna activa.
 */
export function tarjetaMasUsada(movs: MovimientoDetalle[], tarjetas: Tarjeta[]): string | null {
  const activas = tarjetas.filter((t) => t.activa)
  if (activas.length === 0) return null
  const usos = new Map<string, number>()
  for (const m of movs) {
    if (m.tarjetaId) usos.set(m.tarjetaId, (usos.get(m.tarjetaId) ?? 0) + 1)
  }
  return [...activas].sort((a, b) => (usos.get(b.id) ?? 0) - (usos.get(a.id) ?? 0))[0].id
}

/**
 * Las tarjetas que ofrece el formulario: las activas, más la del gasto que se
 * edita aunque esté dada de baja (si no, editar un gasto de julio con la
 * Galicia lo dejaría sin tarjeta sin que nadie lo pidiera).
 */
export function tarjetasParaCargar(tarjetas: Tarjeta[], actualId?: string | null): Tarjeta[] {
  return tarjetas.filter((t) => t.activa || t.id === actualId)
}
