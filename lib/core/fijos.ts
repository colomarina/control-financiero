import type { GastoFijoDetalle } from '@/lib/schemas/gastoFijo'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import { movimientosDelMes, TOPE_DE_FORMA_PAGO } from './gastos'
import { esCuota } from './cuotas'
import { sumar } from './dinero'
import type { Mes } from './fechas'

/**
 * Checklist de gastos fijos del mes.
 *
 * Igual que en el Excel: nada se tilda a mano. Un fijo está "pagado" si su
 * comercio aparece en los movimientos del mes. El hecho es el movimiento;
 * el tilde se deriva.
 *
 * **El estado se cuenta en facturas, no en plata.** La pregunta de un fijo es
 * "¿ya llegó y lo pagué?", no "¿pagué exactamente lo estimado?": el monto lo
 * decide el proveedor y el estimado es apenas una expectativa. Comparando
 * plata contra plata, la luz a $85.000 cuando se esperaban $90.000 figuraba
 * `parcial` con un "falta $5.000" que no existe. Por eso cada fijo declara
 * `pagosEsperados` (cuántas facturas llegan por mes: Personal Flow son dos,
 * una por línea) y el estado sale de cuántas se pagaron.
 *
 * El monto sigue importando para la predicción: `falta` estima lo que todavía
 * va a salir este mes, prorrateando el estimado por las facturas pendientes.
 */

export type EstadoFijo = 'pagado' | 'parcial' | 'pendiente'

export interface FilaFijo {
  /** El id del gasto fijo, para que la UI no tenga que buscarlo por nombre. */
  gastoFijoId: string
  comercioId: string
  comercio: string
  /** Lo que se espera pagar en el mes, sumando todas las facturas. */
  estimado: number
  /** Lo que efectivamente se cargó este mes para ese comercio. */
  pagado: number
  /** Cuántas facturas llegan por mes. Siempre 1 o más. */
  pagosEsperados: number
  /** Cuántos movimientos de ese comercio hay en el mes. */
  pagosHechos: number
  /**
   * Lo que se estima que todavía va a salir: el estimado prorrateado por las
   * facturas que faltan. Con todas las facturas pagas es 0, cueste lo que
   * haya costado. Nunca negativo.
   */
  falta: number
  /**
   * Cuánto se desvió lo pagado del estimado, en %. Solo tiene sentido con el
   * fijo ya cerrado: es `null` si falta alguna factura o no hay estimado.
   */
  desvioPct: number | null
  estado: EstadoFijo
  vencimiento: string | null
}

/** Un fijo nunca espera menos de una factura. */
function facturasDe(f: GastoFijoDetalle): number {
  return Math.max(1, Math.trunc(f.pagosEsperados))
}

/**
 * Acá nunca entra una cuota derivada: un fijo se mide en **facturas que
 * llegaron**, y una cuota no es una factura. Si una compra en cuotas fuera de
 * un comercio marcado `es_fijo`, la cuota de este mes se contaría como la
 * factura del mes y el fijo figuraría pagado sin que llegara nada. No rompe
 * nada: miente en silencio, que es peor.
 *
 * El diseño original dejaba esta regla en manos de las páginas —pasarle solo
 * movimientos reales— por miedo al doble descuento en la predicción. Se
 * revisó y se decidió al revés: filtrar **acá adentro** es justo lo que lo
 * evita. Con el filtro, lo que cuenta `fijos.ts` y lo que suma
 * `gastoContraTope(cuotasDelMes, ...)` son conjuntos **disjuntos**, así que la
 * suma de los dos en el Home nunca puede contar una cuota dos veces, le pasen
 * la lista que le pasen. De convención que hay que recordar pasó a ser
 * imposible de violar.
 *
 * La objeción de pureza no aplica: `esCuota` es una función pura de este mismo
 * `lib/core` —`prediccion.ts` ya la importa igual—.
 */
function soloReales(movs: MovimientoDetalle[]): MovimientoDetalle[] {
  return movs.filter((m) => !esCuota(m))
}

/**
 * El checklist del mes, en el orden en que vienen los fijos.
 *
 * `estado` es `parcial` cuando llegó alguna factura pero no todas — el Excel
 * solo distinguía pagado/pendiente y marcaba "pagado" con que hubiera un peso
 * cargado, lo que escondía los pagos a medias.
 */
export function checklistFijos(
  fijos: GastoFijoDetalle[],
  movs: MovimientoDetalle[],
  mes: Mes,
): FilaFijo[] {
  const delMes = movimientosDelMes(soloReales(movs), mes)

  return fijos
    .filter((f) => f.activo)
    .map((f) => {
      const propios = delMes.filter((m) => m.comercioId === f.comercioId)
      const pagado = sumar(...propios.map((m) => m.importeCentavos))

      const pagosEsperados = facturasDe(f)
      const pagosHechos = propios.length
      const faltantes = Math.max(0, pagosEsperados - pagosHechos)

      const estado: EstadoFijo =
        pagosHechos === 0 ? 'pendiente' : faltantes > 0 ? 'parcial' : 'pagado'

      return {
        gastoFijoId: f.id,
        comercioId: f.comercioId,
        comercio: f.comercio,
        estimado: f.estimadoCentavos,
        pagado,
        pagosEsperados,
        pagosHechos,
        falta: Math.round((f.estimadoCentavos * faltantes) / pagosEsperados),
        desvioPct:
          estado === 'pagado' && f.estimadoCentavos > 0
            ? ((pagado - f.estimadoCentavos) / f.estimadoCentavos) * 100
            : null,
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
    ...movimientosDelMes(soloReales(movs), mes)
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
