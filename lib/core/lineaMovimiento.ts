/**
 * La línea de detalle de un movimiento en una lista: "Supermercado ·
 * [logo] Santander Visa".
 *
 * Vive acá, y no en cada pantalla, porque la usan el Home y el Historial y
 * tienen que decir lo mismo: cuando cada una armaba la suya, una mostraba la
 * subcategoría y la otra no.
 */
import { ETIQUETA_FORMA_PAGO, type MovimientoDetalle } from '@/lib/schemas/movimiento'
import { fechaCorta } from './fechas'

/**
 * Con qué se pagó: la tarjeta si la hay ("Santander Visa"), si no la forma de
 * pago ("Efectivo"). La tarjeta reemplaza a "Tarjeta crédito", que ya va
 * implícito; el débito automático lo aclara, porque no es una compra.
 */
export function medioDePago(m: MovimientoDetalle): string {
  if (!m.tarjetaNombre) return ETIQUETA_FORMA_PAGO[m.formaPago]
  return m.formaPago === 'debito_automatico' ? `${m.tarjetaNombre} · déb. aut.` : m.tarjetaNombre
}

export interface LineaMovimiento {
  /** Lo que va antes del medio de pago: "Supermercado" o "12/11/26 · Supermercado". */
  inicio: string
  /** "Santander Visa", "Santander Visa · déb. aut." o "Efectivo". */
  medio: string
  /** La red de la tarjeta, para dibujar el logo delante del medio. */
  red: NonNullable<MovimientoDetalle['tarjetaRed']> | null
}

/**
 * Categoría y medio de pago, en partes: la pantalla dibuja el logo de la red
 * entre las dos. La subcategoría no va: con la tarjeta la línea no entraba en
 * el celular, y la categoría ya ubica el gasto. `conFecha` la antepone, para
 * listas que no agrupan por día (el buscador).
 */
export function lineaDeMovimiento(
  m: MovimientoDetalle,
  { conFecha = false } = {},
): LineaMovimiento {
  return {
    inicio: [conFecha ? fechaCorta(m.fecha) : null, m.categoria].filter((x) => x !== null).join(' · '),
    medio: medioDePago(m),
    red: m.tarjetaNombre ? (m.tarjetaRed ?? null) : null,
  }
}
