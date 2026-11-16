import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import type { GastoFijoDetalle } from '@/lib/schemas/gastoFijo'
import { esCuota } from './cuotas'
import { TOPE_DE_FORMA_PAGO, movimientosDelMes } from './gastos'
import { diasDelMes, mesesAnteriores, type Mes } from './fechas'

/**
 * Una compra es puntual si pesa más que esta cantidad de días del ritmo
 * diario bruto mediano. Vive acá (y `prediccion.ts` la re-exporta) para que
 * `prediccion.ts` importe de este archivo y no al revés.
 */
export const DIAS_PUNTUAL = 5

export type Tope = 'tarjeta' | 'efectivo'

/** Comercios con al menos un gasto fijo activo. */
export function comerciosConFijo(fijos: GastoFijoDetalle[]): Set<string> {
  return new Set(fijos.filter((f) => f.activo).map((f) => f.comercioId))
}

/**
 * Gasto variable del tope: ni cuota, ni comercio fijo, ni comercio con gasto
 * fijo activo, y que pese contra ese tope.
 */
export function esVariable(
  m: MovimientoDetalle,
  conFijo: ReadonlySet<string>,
  tope: Tope,
): boolean {
  return (
    !esCuota(m) &&
    !m.esFijo &&
    !conFijo.has(m.comercioId) &&
    TOPE_DE_FORMA_PAGO[m.formaPago] === tope
  )
}

/** La marca manual manda; sin marca, decide el umbral. */
export function esPuntual(m: MovimientoDetalle, umbral: number | null): boolean {
  return m.puntual ?? (umbral !== null && m.importeCentavos > umbral)
}

export interface PerfilHistorico {
  meses: number
  ritmoDiario: number
  puntualesPorMes: number
  umbral: number | null
}

function suma(movs: MovimientoDetalle[]): number {
  return movs.reduce((a, m) => a + m.importeCentavos, 0)
}

function promedio(xs: number[]): number {
  return xs.reduce((a, x) => a + x, 0) / xs.length
}

function mediana(xs: number[]): number {
  const s = [...xs].sort((a, b) => a - b)
  const mid = s.length >> 1
  return s.length % 2 ? s[mid] : (s[mid - 1] + s[mid]) / 2
}

/**
 * Ritmo variable y puntuales de los `nMeses` meses anteriores al actual.
 * El umbral sale de la mediana del ritmo bruto mensual, así una compra
 * gigante en un solo mes no lo corre.
 */
export function perfilHistorico(
  movsReales: MovimientoDetalle[],
  mesActual: Mes,
  nMeses: number,
  tope: Tope,
  conFijo: ReadonlySet<string>,
): PerfilHistorico {
  const porMes = mesesAnteriores(mesActual, nMeses)
    .map((mes) => ({
      mes,
      variables: movimientosDelMes(movsReales, mes).filter((m) =>
        esVariable(m, conFijo, tope),
      ),
    }))
    .filter((x) => x.variables.length > 0)

  if (porMes.length === 0) {
    return { meses: 0, ritmoDiario: 0, puntualesPorMes: 0, umbral: null }
  }

  const brutos = porMes.map((x) => suma(x.variables) / diasDelMes(x.mes))
  const med = mediana(brutos)
  const umbral = med > 0 ? DIAS_PUNTUAL * med : null

  const puntuales = porMes.map((x) =>
    suma(x.variables.filter((m) => esPuntual(m, umbral))),
  )
  const ritmos = porMes.map(
    (x, i) => (suma(x.variables) - puntuales[i]) / diasDelMes(x.mes),
  )

  return {
    meses: porMes.length,
    ritmoDiario: promedio(ritmos),
    puntualesPorMes: promedio(puntuales),
    umbral,
  }
}

export interface DesgloseMes {
  variable: number
  puntuales: MovimientoDetalle[]
  totalPuntuales: number
}

/** Variable del mes (sin puntuales) y la lista de puntuales aparte. */
export function desgloseMes(
  movsReales: MovimientoDetalle[],
  mes: Mes,
  tope: Tope,
  conFijo: ReadonlySet<string>,
  umbral: number | null,
): DesgloseMes {
  const variables = movimientosDelMes(movsReales, mes).filter((m) =>
    esVariable(m, conFijo, tope),
  )
  const puntuales = variables.filter((m) => esPuntual(m, umbral))
  const totalPuntuales = suma(puntuales)
  return {
    variable: suma(variables) - totalPuntuales,
    puntuales,
    totalPuntuales,
  }
}

/** Umbral de puntual de cada tope; `null` si no hay histórico. */
export function umbralesPuntual(
  movsReales: MovimientoDetalle[],
  fijos: GastoFijoDetalle[],
  mesActual: Mes,
  nMeses: number,
): Record<Tope, number | null> {
  const conFijo = comerciosConFijo(fijos)
  return {
    tarjeta: perfilHistorico(movsReales, mesActual, nMeses, 'tarjeta', conFijo).umbral,
    efectivo: perfilHistorico(movsReales, mesActual, nMeses, 'efectivo', conFijo).umbral,
  }
}
