import type { FormaPago, MovimientoDetalle } from '@/lib/schemas/movimiento'
import { FORMAS_PAGO } from '@/lib/schemas/movimiento'
import {
  movimientosDelMes,
  gastoTotalMes,
  gastoTarjetaMes,
  gastoEfectivoMes,
  gastoFijosMes,
  gastoPorFormaPago,
} from './gastos'
import { sumar, porcentaje } from './dinero'
import { mesDe, type Mes } from './fechas'

/**
 * Resumen mensual e evolución. Es la hoja "Resumen Mensual" del Excel.
 *
 * Todo se deriva de los movimientos: no hay nada guardado por mes.
 */

export interface FilaMes {
  mes: Mes
  /** Contra el tope de tarjeta: crédito + débito + débito automático. */
  tarjeta: number
  /** Contra el tope de efectivo: efectivo + transferencias. */
  efectivo: number
  total: number
  fijos: number
  variables: number
  porFormaPago: Record<FormaPago, number>
  /** Sueldo menos lo gastado. Negativo = gastaste más de lo que entró. */
  sobrante: number
  /** El mes en curso está incompleto: no se puede comparar de igual a igual. */
  enCurso: boolean
  cantidad: number
}

/** Los meses que tienen al menos un movimiento, del más viejo al más nuevo. */
export function mesesConDatos(movs: MovimientoDetalle[]): Mes[] {
  return [...new Set(movs.map((m) => mesDe(m.fecha)))].sort()
}

/**
 * Una fila por mes con datos, del más nuevo al más viejo (que es como se lee
 * una tabla de historial).
 */
export function resumenMensual(
  movs: MovimientoDetalle[],
  opciones: { sueldoCentavos?: number; mesEnCurso?: Mes } = {},
): FilaMes[] {
  const { sueldoCentavos = 0, mesEnCurso } = opciones

  return mesesConDatos(movs)
    .map((mes): FilaMes => {
      const total = gastoTotalMes(movs, mes)
      const fijos = gastoFijosMes(movs, mes)

      return {
        mes,
        tarjeta: gastoTarjetaMes(movs, mes),
        efectivo: gastoEfectivoMes(movs, mes),
        total,
        fijos,
        variables: total - fijos,
        porFormaPago: gastoPorFormaPago(movs, mes),
        sobrante: sueldoCentavos - total,
        enCurso: mes === mesEnCurso,
        cantidad: movimientosDelMes(movs, mes).length,
      }
    })
    .reverse()
}

/**
 * Promedio de gasto de los meses CERRADOS.
 *
 * Excluye el mes en curso a propósito: está a medias y tiraría el promedio
 * para abajo. El Excel lo promediaba junto con el resto.
 */
export function promedioMensual(filas: FilaMes[]): number {
  const cerrados = filas.filter((f) => !f.enCurso)
  if (cerrados.length === 0) return 0
  return Math.round(sumar(...cerrados.map((f) => f.total)) / cerrados.length)
}

/**
 * Cuánto cambió un mes respecto del anterior, en porcentaje.
 * `null` si no hay mes previo con el que comparar.
 */
export function variacionContraMesAnterior(
  filas: FilaMes[],
  mes: Mes,
): number | null {
  const i = filas.findIndex((f) => f.mes === mes)
  // Las filas vienen del más nuevo al más viejo: el anterior está en i + 1.
  if (i === -1 || i + 1 >= filas.length) return null

  const anterior = filas[i + 1].total
  if (anterior === 0) return null
  return porcentaje(filas[i].total - anterior, anterior)
}

/** Totales por categoría a lo largo de varios meses, de mayor a menor. */
export function totalPorCategoria(
  movs: MovimientoDetalle[],
  meses: Mes[],
): Map<string, number> {
  const incluidos = new Set(meses)
  const acc = new Map<string, number>()

  for (const m of movs) {
    if (!incluidos.has(mesDe(m.fecha))) continue
    acc.set(m.categoria, (acc.get(m.categoria) ?? 0) + m.importeCentavos)
  }

  return new Map([...acc].sort((a, b) => b[1] - a[1]))
}

/** La serie lista para graficar: un punto por mes, del más viejo al más nuevo. */
export interface PuntoEvolucion {
  mes: Mes
  tarjeta: number
  efectivo: number
  total: number
  enCurso: boolean
}

export function serieEvolucion(filas: FilaMes[]): PuntoEvolucion[] {
  return [...filas]
    .reverse()
    .map(({ mes, tarjeta, efectivo, total, enCurso }) => ({
      mes,
      tarjeta,
      efectivo,
      total,
      enCurso,
    }))
}

/** Un desglose por forma de pago que no trae las formas que nunca usaste. */
export function formasUsadas(filas: FilaMes[]): FormaPago[] {
  return FORMAS_PAGO.filter((f) => filas.some((fila) => fila.porFormaPago[f] > 0))
}
