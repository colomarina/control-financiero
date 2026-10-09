import type { FormaPago, MovimientoDetalle } from '@/lib/schemas/movimiento'
import { FORMAS_PAGO } from '@/lib/schemas/movimiento'
import { mesDe, type Mes } from './fechas'
import { sumar } from './dinero'

/**
 * Contra qué tope suma cada forma de pago.
 *
 * Replica cómo agrupaba la hoja "Objetivos" del Excel:
 *   - Tope tarjeta  = Tarjeta crédito + Tarjeta débito + Débito automático
 *   - Tope efectivo = Efectivo + Transferencia
 *
 * Si alguna vez querés mover una forma de pago de un tope al otro, se cambia
 * acá y todo el resto (barras, predicción, resumen) se acomoda solo.
 */
export const TOPE_DE_FORMA_PAGO: Record<FormaPago, 'tarjeta' | 'efectivo'> = {
  tarjeta_credito: 'tarjeta',
  tarjeta_debito: 'tarjeta',
  debito_automatico: 'tarjeta',
  transferencia: 'efectivo',
  efectivo: 'efectivo',
}

/** Los movimientos que caen en un mes. El mes se deriva de la fecha. */
export function movimientosDelMes(
  movs: MovimientoDetalle[],
  mes: Mes,
): MovimientoDetalle[] {
  return movs.filter((m) => mesDe(m.fecha) === mes)
}

/** Total gastado en el mes, sin importar cómo se pagó. */
export function gastoTotalMes(movs: MovimientoDetalle[], mes: Mes): number {
  return sumar(...movimientosDelMes(movs, mes).map((m) => m.importeCentavos))
}

/** Lo que suma contra el tope de tarjeta de crédito. */
export function gastoTarjetaMes(movs: MovimientoDetalle[], mes: Mes): number {
  return gastoContraTope(movs, mes, 'tarjeta')
}

/**
 * Lo que suma contra el tope de efectivo.
 * Incluye transferencias (ver `TOPE_DE_FORMA_PAGO`).
 */
export function gastoEfectivoMes(movs: MovimientoDetalle[], mes: Mes): number {
  return gastoContraTope(movs, mes, 'efectivo')
}

/** El gasto del mes que pesa contra un tope dado. */
export function gastoContraTope(
  movs: MovimientoDetalle[],
  mes: Mes,
  tope: 'tarjeta' | 'efectivo',
): number {
  return sumar(
    ...movimientosDelMes(movs, mes)
      .filter((m) => TOPE_DE_FORMA_PAGO[m.formaPago] === tope)
      .map((m) => m.importeCentavos),
  )
}

/** El desglose crudo por forma de pago. Siempre trae todas las claves, en 0 si no hubo. */
export function gastoPorFormaPago(
  movs: MovimientoDetalle[],
  mes: Mes,
): Record<FormaPago, number> {
  const acc = Object.fromEntries(FORMAS_PAGO.map((f) => [f, 0])) as Record<FormaPago, number>
  for (const m of movimientosDelMes(movs, mes)) {
    acc[m.formaPago] += m.importeCentavos
  }
  return acc
}

/**
 * Agrupa el gasto del mes por una clave del movimiento.
 * Devuelve un Map ordenado de mayor a menor, que es como lo quiere la UI.
 */
function agruparPor(
  movs: MovimientoDetalle[],
  mes: Mes,
  clave: (m: MovimientoDetalle) => string,
): Map<string, number> {
  const acc = new Map<string, number>()
  for (const m of movimientosDelMes(movs, mes)) {
    const k = clave(m)
    acc.set(k, (acc.get(k) ?? 0) + m.importeCentavos)
  }
  return new Map([...acc].sort((a, b) => b[1] - a[1]))
}

/** Gasto del mes por comercio, de mayor a menor. La clave es el nombre del comercio. */
export function gastoPorComercio(movs: MovimientoDetalle[], mes: Mes): Map<string, number> {
  return agruparPor(movs, mes, (m) => m.comercio)
}

/** Gasto del mes por categoría, de mayor a menor. */
export function gastoPorCategoria(movs: MovimientoDetalle[], mes: Mes): Map<string, number> {
  return agruparPor(movs, mes, (m) => m.categoria)
}

/**
 * Gasto del mes por subcategoría, de mayor a menor.
 * Los movimientos sin subcategoría caen bajo `sinEtiqueta`.
 */
export function gastoPorSubcategoria(
  movs: MovimientoDetalle[],
  mes: Mes,
  sinEtiqueta = 'Sin subcategoría',
): Map<string, number> {
  return agruparPor(movs, mes, (m) => m.subcategoria ?? sinEtiqueta)
}

/** Lo gastado en comercios marcados como fijos. */
export function gastoFijosMes(movs: MovimientoDetalle[], mes: Mes): number {
  return sumar(
    ...movimientosDelMes(movs, mes)
      .filter((m) => m.esFijo)
      .map((m) => m.importeCentavos),
  )
}

/** Lo gastado en comercios NO fijos: el gasto que de verdad podés mover. */
export function gastoVariablesMes(movs: MovimientoDetalle[], mes: Mes): number {
  return gastoTotalMes(movs, mes) - gastoFijosMes(movs, mes)
}

/** Los `n` comercios donde más gastaste en el mes. */
export function topComercios(
  movs: MovimientoDetalle[],
  mes: Mes,
  n = 5,
): Array<{ comercio: string; centavos: number }> {
  return [...gastoPorComercio(movs, mes)]
    .slice(0, n)
    .map(([comercio, centavos]) => ({ comercio, centavos }))
}

/** Los movimientos del mes ordenados para la lista del Home: fecha desc, y el último cargado primero. */
export function movimientosOrdenados(
  movs: MovimientoDetalle[],
  mes: Mes,
): MovimientoDetalle[] {
  return [...movimientosDelMes(movs, mes)].sort((a, b) =>
    a.fecha === b.fecha ? 0 : a.fecha < b.fecha ? 1 : -1,
  )
}
