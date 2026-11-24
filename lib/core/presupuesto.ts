import type { LineaPresupuestoDetalle } from '@/lib/schemas/presupuesto'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import { movimientosDelMes } from './gastos'
import { sumar, porcentaje, formatoARS } from './dinero'
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

/**
 * Cuánto se puede sacar de una línea para moverlo a otra: lo que todavía no
 * se gastó. Lo gastado ya pasó y moverlo dejaría la línea excedida a
 * propósito, que no es lo que se quiere decir.
 */
export function disponibleParaMover(fila: FilaPresupuesto): number {
  return Math.max(0, fila.diferencia)
}

export type ResultadoMover =
  | {
      ok: true
      /** Las dos líneas con su plan nuevo. Un plan de 0 significa sacarla del mes. */
      lineas: [
        { comercioId: string; planeadoCentavos: number },
        { comercioId: string; planeadoCentavos: number },
      ]
    }
  | { ok: false; error: string }

/**
 * Pasa plata del plan de un comercio al de otro dentro del mismo mes.
 *
 * Es el caso "no hubo fulbito y esa plata fue a la carnicería": el plan
 * cambió a mitad de mes y se lo reescribe, sin tocar los movimientos. El
 * total planeado del mes no cambia.
 *
 * El destino puede no estar en el plan: entonces entra con lo que se mueve.
 * El origen se puede vaciar solo si no tenía nada gastado; si no, el piso es
 * lo gastado y la línea queda `completo`.
 */
export function moverPlata(
  filas: FilaPresupuesto[],
  origenId: string,
  destinoId: string,
  montoCentavos: number,
): ResultadoMover {
  if (origenId === destinoId) {
    return { ok: false, error: 'Elegí dos comercios distintos.' }
  }
  if (!Number.isInteger(montoCentavos) || montoCentavos <= 0) {
    return { ok: false, error: 'El monto tiene que ser mayor a cero.' }
  }

  const origen = filas.find((f) => f.comercioId === origenId)
  if (!origen) {
    return { ok: false, error: 'Ese comercio no está en el plan del mes.' }
  }

  const disponible = disponibleParaMover(origen)
  if (montoCentavos > disponible) {
    return {
      ok: false,
      error:
        disponible === 0
          ? `En ${origen.comercio} no queda plata sin gastar para mover.`
          : `De ${origen.comercio} podés mover hasta ${formatoARS(disponible)}, lo que no gastaste.`,
    }
  }

  const planDestino = filas.find((f) => f.comercioId === destinoId)?.planeado ?? 0

  return {
    ok: true,
    lineas: [
      { comercioId: origenId, planeadoCentavos: origen.planeado - montoCentavos },
      { comercioId: destinoId, planeadoCentavos: planDestino + montoCentavos },
    ],
  }
}
