import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import { diasDelMes, mesesAnteriores, type Mes } from './fechas'
import { TOPE_DE_FORMA_PAGO, movimientosDelMes } from './gastos'
import { sumar } from './dinero'
import { esCuota } from './cuotas'

/**
 * MÉTODO B+E — cierre estimado del mes.
 *
 * Es la hoja "Prediccion" del Excel, puesta en código:
 *
 *   B (Base)  = lo que YA gastaste + los gastos fijos que todavía faltan pagar
 *   E (Extra) = tu ritmo de gasto variable por día × los días que quedan
 *
 *   cierre = B + E × factor del escenario
 *
 * El ritmo variable sale de descontarle a lo gastado los fijos ya pagados y
 * las cuotas del mes: ni unos ni otras se repiten, así que proyectarlos como
 * si fueran gasto diario infla la estimación. Una cuota en particular es
 * plata grande y de una sola vez —una compra puntual, financiada— que no
 * dice nada sobre cuánto gastás por día; dejarla en el ritmo variable
 * convierte un pico de un día en un "todos los días gastás así".
 *
 * Diferencia con el Excel (a propósito): el Excel proyecta desde el día 1, y
 * con dos días de datos el ritmo diario es ruido puro. Acá, antes de
 * `umbralDia`, la predicción devuelve `temprano` en vez de un número que no
 * se sostiene.
 */

/** Los tres escenarios de cierre, como multiplicadores del tramo variable. */
export const FACTOR_ESCENARIO = {
  optimista: 0.85,
  normal: 1,
  pesimista: 1.25,
} as const

export type Escenario = keyof typeof FACTOR_ESCENARIO

/**
 * El ritmo de gasto variable por día en lo que va del mes.
 *
 * `fijosYaPagados` tiene que venir filtrado por el MISMO tope que `gastadoReal`
 * (el Excel no lo hacía: restaba fijos pagados por transferencia del gasto de
 * tarjeta, y el ritmo salía bajo o negativo).
 *
 * A pesar del nombre, lo que se le pasa en `fijosYaPagados` es "lo ya gastado
 * que no es variable": fijos ya pagados MÁS cuotas del mes. Es la unión de
 * esos dos conjuntos de movimientos, no la suma de dos listas que pueden
 * superponerse — si un comercio es fijo y además tiene una compra en cuotas,
 * sumar `fijosYaPagados(fijos, mezclados, ...)` (con la lista que ya incluye
 * la cuota) más el total de cuotas la cuenta dos veces. Por eso `fijos.ts`
 * tiene que recibir siempre movimientos reales, nunca la lista mezclada con
 * cuotas.
 *
 * Nunca devuelve negativo: si pagaste más fijos que gasto total, el ritmo es 0.
 */
export function tasaVariableDiaria(args: {
  gastadoReal: number
  fijosYaPagados: number
  diaActual: number
}): number {
  const { gastadoReal, fijosYaPagados, diaActual } = args
  if (diaActual <= 0) return 0
  return Math.max(0, (gastadoReal - fijosYaPagados) / diaActual)
}

/**
 * El ritmo diario promedio de los `nMeses` meses cerrados anteriores.
 *
 * Sirve para el arranque del mes, cuando todavía no hay suficientes días para
 * que el ritmo propio signifique algo. Solo promedia los meses que tuvieron
 * movimientos: un mes vacío bajaría el promedio sin motivo.
 *
 * Igual que con el ritmo del mes en curso, las cuotas de esos meses viejos
 * quedan afuera: son el mismo pico puntual de siempre, solo que ya pasado.
 */
export function promedioHistoricoDiario(
  movs: MovimientoDetalle[],
  mesActual: Mes,
  nMeses = 3,
  tope: 'tarjeta' | 'efectivo' = 'tarjeta',
): number {
  const tasas: number[] = []
  for (const mes of mesesAnteriores(mesActual, nMeses)) {
    const delMes = movimientosDelMes(movs, mes)
    if (delMes.length === 0) continue
    const variable = sumar(
      ...delMes
        .filter((m) => !m.esFijo && !esCuota(m) && TOPE_DE_FORMA_PAGO[m.formaPago] === tope)
        .map((m) => m.importeCentavos),
    )
    tasas.push(variable / diasDelMes(mes))
  }
  if (tasas.length === 0) return 0
  return sumar(...tasas) / tasas.length
}

/**
 * Qué ritmo diario usar hoy: el propio del mes si ya hay suficientes días,
 * el histórico si todavía es temprano.
 */
export function tasaDiariaAplicable(args: {
  tasaMesActual: number
  promHistorico: number
  diaActual: number
  umbralDia: number
}): number {
  const { tasaMesActual, promHistorico, diaActual, umbralDia } = args
  if (diaActual >= umbralDia) return tasaMesActual
  return promHistorico > 0 ? promHistorico : tasaMesActual
}

export type Prediccion =
  | {
      status: 'temprano'
      mensaje: string
      /** Cuántos días faltan para que la proyección se considere confiable. */
      diasParaProyectar: number
    }
  | {
      status: 'proyeccion'
      /** B: gastado + fijos pendientes. No depende del escenario. */
      base: number
      optimista: number
      normal: number
      pesimista: number
      tasaDiaria: number
      diasRestantes: number
    }

/**
 * El cierre estimado del mes. Todo en centavos.
 *
 * Antes de `umbralDia` devuelve `temprano`: hay muy pocos días como para
 * proyectar un ritmo. Después devuelve los tres escenarios.
 */
export function prediccionCierre(args: {
  gastadoReal: number
  fijosPendientes: number
  tasaDiaria: number
  diaActual: number
  diasMes: number
  umbralDia: number
}): Prediccion {
  const { gastadoReal, fijosPendientes, tasaDiaria, diaActual, diasMes, umbralDia } = args

  if (diaActual < umbralDia) {
    const faltan = umbralDia - diaActual
    return {
      status: 'temprano',
      diasParaProyectar: faltan,
      mensaje:
        `Es temprano en el mes: van ${diaActual} ${diaActual === 1 ? 'día' : 'días'}. ` +
        `En ${faltan} ${faltan === 1 ? 'día' : 'días'} más la proyección tiene sentido.`,
    }
  }

  const base = gastadoReal + fijosPendientes
  const diasRestantes = Math.max(0, diasMes - diaActual)
  const proyectar = (f: number) => Math.round(base + tasaDiaria * diasRestantes * f)

  return {
    status: 'proyeccion',
    base,
    optimista: proyectar(FACTOR_ESCENARIO.optimista),
    normal: proyectar(FACTOR_ESCENARIO.normal),
    pesimista: proyectar(FACTOR_ESCENARIO.pesimista),
    tasaDiaria,
    diasRestantes,
  }
}

/**
 * Cuánto podés gastar todavía antes de tocar el tope, ya descontando los fijos
 * que faltan pagar. Nunca negativo: si ya te pasaste, es 0.
 */
export function margenDisponible(args: {
  tope: number
  gastadoReal: number
  fijosPendientes: number
}): number {
  return Math.max(0, args.tope - args.gastadoReal - args.fijosPendientes)
}

/** ¿La proyección normal se pasa del tope? */
export function superaElTope(prediccion: Prediccion, tope: number): boolean {
  if (prediccion.status === 'temprano' || tope <= 0) return false
  return prediccion.normal > tope
}
