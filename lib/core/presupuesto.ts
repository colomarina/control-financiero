import type { LineaPresupuestoDetalle } from '@/lib/schemas/presupuesto'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import { movimientosDelMes } from './gastos'
import { sumar, porcentaje } from './dinero'
import { UMBRAL_CERCA } from './topes'
import type { Mes } from './fechas'

/**
 * Plan vs real, por comercio y por mes. Es la hoja "Presupuesto" del Excel.
 *
 * El plan sale de `presupuesto`; el real se suma de los movimientos del mes.
 * Nada se persiste: la comparación se calcula cada vez.
 *
 * Como en el Excel, el "real" suma TODO lo gastado en ese comercio, sin
 * importar la forma de pago. (La hoja se titulaba "efectivo/transferencia"
 * pero su fórmula nunca filtraba por eso.)
 */

/**
 * `completo`: se gastó exactamente lo planeado. No es una alerta sino lo
 * contrario —el plan se cumplió—; antes caía en `al-limite` (100% > 85%) y
 * aparecía arriba de todo en ámbar.
 */
export type EstadoPresupuesto = 'sin-plan' | 'ok' | 'al-limite' | 'excedido' | 'completo'

export interface FilaPresupuesto {
  comercioId: string
  comercio: string
  planeado: number
  real: number
  /** Positivo = te sobra; negativo = te pasaste. */
  diferencia: number
  /** Puede pasar de 100 si te excediste. */
  porcentajeUsado: number
  estado: EstadoPresupuesto
}

/**
 * Compara el plan del mes contra lo realmente gastado.
 *
 * Devuelve una fila por línea del plan, ordenadas por lo que más se te fue de
 * cauce: primero lo excedido, después lo que está al límite. Lo completo va
 * al fondo: ya no pide nada, y arriba tiene que quedar lo que todavía tiene
 * plata por gastar.
 */
export function presupuestoVsReal(
  plan: LineaPresupuestoDetalle[],
  movs: MovimientoDetalle[],
  mes: Mes,
  umbralCerca: number = UMBRAL_CERCA,
): FilaPresupuesto[] {
  const delMes = movimientosDelMes(movs, mes)

  const gastoPorComercioId = new Map<string, number>()
  for (const m of delMes) {
    gastoPorComercioId.set(
      m.comercioId,
      (gastoPorComercioId.get(m.comercioId) ?? 0) + m.importeCentavos,
    )
  }

  const filas = plan
    .filter((l) => l.mes === mes)
    .map((l): FilaPresupuesto => {
      const real = gastoPorComercioId.get(l.comercioId) ?? 0
      const planeado = l.planeadoCentavos
      const pct = porcentaje(real, planeado)

      const estado: EstadoPresupuesto =
        planeado === 0
          ? 'sin-plan'
          : real > planeado
            ? 'excedido'
            : real === planeado
              ? 'completo'
              : pct > umbralCerca
              ? 'al-limite'
              : 'ok'

      return {
        comercioId: l.comercioId,
        comercio: l.comercio,
        planeado,
        real,
        diferencia: planeado - real,
        porcentajeUsado: pct,
        estado,
      }
    })

  const ORDEN: Record<EstadoPresupuesto, number> = {
    excedido: 0,
    'al-limite': 1,
    ok: 2,
    'sin-plan': 3,
    completo: 4,
  }

  return filas.sort(
    (a, b) =>
      ORDEN[a.estado] - ORDEN[b.estado] ||
      b.porcentajeUsado - a.porcentajeUsado ||
      a.comercio.localeCompare(b.comercio, 'es'),
  )
}

export interface ResumenPresupuesto {
  planeado: number
  real: number
  diferencia: number
  porcentajeUsado: number
  excedidos: number
  alLimite: number
}

/** Los totales del plan del mes. */
export function resumenPresupuesto(filas: FilaPresupuesto[]): ResumenPresupuesto {
  const planeado = sumar(...filas.map((f) => f.planeado))
  const real = sumar(...filas.map((f) => f.real))

  return {
    planeado,
    real,
    diferencia: planeado - real,
    porcentajeUsado: porcentaje(real, planeado),
    excedidos: filas.filter((f) => f.estado === 'excedido').length,
    alLimite: filas.filter((f) => f.estado === 'al-limite').length,
  }
}

/**
 * Arrastra el plan de un mes a otro: devuelve las líneas del mes origen
 * reapuntadas al mes destino. Sirve para no recargar todo cada mes.
 */
export function copiarPlan(
  plan: LineaPresupuestoDetalle[],
  desde: Mes,
  hacia: Mes,
): Array<{ mes: Mes; comercioId: string; planeadoCentavos: number }> {
  return plan
    .filter((l) => l.mes === desde)
    .map((l) => ({
      mes: hacia,
      comercioId: l.comercioId,
      planeadoCentavos: l.planeadoCentavos,
    }))
}
