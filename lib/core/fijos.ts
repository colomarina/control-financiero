import type { GastoFijoDetalle } from '@/lib/schemas/gastoFijo'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import { movimientosDelMes, TOPE_DE_FORMA_PAGO } from './gastos'
import { sumar } from './dinero'
import type { Mes } from './fechas'

/**
 * Checklist de gastos fijos del mes.
 *
 * Igual que en el Excel: nada se tilda a mano. Un fijo está "pagado" si su
 * comercio aparece en los movimientos del mes. El hecho es el movimiento;
 * el tilde se deriva.
 */

export type EstadoFijo = 'pagado' | 'parcial' | 'pendiente'

export interface FilaFijo {
  /** El id del gasto fijo, para que la UI no tenga que buscarlo por nombre. */
  gastoFijoId: string
  comercioId: string
  comercio: string
  estimado: number
  /** Lo que efectivamente se cargó este mes para ese comercio. */
  pagado: number
  /** Lo que falta para llegar al estimado. Nunca negativo. */
  falta: number
  estado: EstadoFijo
  vencimiento: string | null
}

/**
 * El checklist del mes, en el orden en que vienen los fijos.
 *
 * `estado` es `parcial` cuando se pagó algo pero menos de lo estimado — el
 * Excel solo distinguía pagado/pendiente y marcaba "pagado" con que hubiera
 * un peso cargado, lo que escondía los pagos a medias.
 */
export function checklistFijos(
  fijos: GastoFijoDetalle[],
  movs: MovimientoDetalle[],
  mes: Mes,
): FilaFijo[] {
  const delMes = movimientosDelMes(movs, mes)

  return fijos
    .filter((f) => f.activo)
    .map((f) => {
      const pagado = sumar(
        ...delMes
          .filter((m) => m.comercioId === f.comercioId)
          .map((m) => m.importeCentavos),
      )
      const falta = Math.max(0, f.estimadoCentavos - pagado)
      const estado: EstadoFijo =
        pagado <= 0 ? 'pendiente' : falta > 0 ? 'parcial' : 'pagado'

      return {
        gastoFijoId: f.id,
        comercioId: f.comercioId,
        comercio: f.comercio,
        estimado: f.estimadoCentavos,
        pagado,
        falta,
        estado,
        vencimiento: f.vencimiento,
      }
    })
}

/** Lo que falta pagar en fijos este mes. Es la "B" de la predicción. */
export function fijosPendientes(
  fijos: GastoFijoDetalle[],
  movs: MovimientoDetalle[],
  mes: Mes,
): number {
  return sumar(...checklistFijos(fijos, movs, mes).map((f) => f.falta))
}

/**
 * Lo ya pagado de fijos este mes, contando SOLO lo que pesa contra `tope`.
 *
 * Este filtro es el que le faltaba al Excel: restarle al gasto de tarjeta un
 * fijo que pagaste por transferencia hundía el ritmo diario.
 */
export function fijosYaPagados(
  fijos: GastoFijoDetalle[],
  movs: MovimientoDetalle[],
  mes: Mes,
  tope: 'tarjeta' | 'efectivo',
): number {
  const ids = new Set(fijos.filter((f) => f.activo).map((f) => f.comercioId))
  return sumar(
    ...movimientosDelMes(movs, mes)
      .filter((m) => ids.has(m.comercioId) && TOPE_DE_FORMA_PAGO[m.formaPago] === tope)
      .map((m) => m.importeCentavos),
  )
}

/** Cuántos fijos faltan y cuántos ya están, para el contador de la pantalla. */
export function contadorFijos(
  fijos: GastoFijoDetalle[],
  movs: MovimientoDetalle[],
  mes: Mes,
): { pagados: number; parciales: number; pendientes: number } {
  const filas = checklistFijos(fijos, movs, mes)
  return {
    pagados: filas.filter((f) => f.estado === 'pagado').length,
    parciales: filas.filter((f) => f.estado === 'parcial').length,
    pendientes: filas.filter((f) => f.estado === 'pendiente').length,
  }
}
