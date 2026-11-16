import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import type { GastoFijoDetalle } from '@/lib/schemas/gastoFijo'
import { diasDelMes, type Mes } from './fechas'
import { gastoContraTope } from './gastos'
import { fijosPendientes as fijosPendientesDelMes } from './fijos'
import type { Cuota } from './cuotas'
import {
  comerciosConFijo,
  desgloseMes,
  perfilHistorico,
  type PerfilHistorico,
  type Tope,
} from './puntuales'

export { DIAS_PUNTUAL } from './puntuales'

/**
 * CIERRE ESTIMADO DEL MES — base + ritmo mezclado + puntuales esperados.
 *
 * Parte de la hoja "Prediccion" del Excel (B + E), con dos arreglos: las
 * compras puntuales van aparte y el ritmo se mezcla con el histórico.
 *
 * Qué es cada cosa (todo contra un mismo tope, todo en centavos):
 *
 *   variable(m) = movimiento REAL del tope que no es cuota, ni de un comercio
 *                 `es_fijo`, ni de un comercio con gasto fijo activo
 *   puntual(m)  = m.puntual ?? (importe > umbral)     ← la marca manual manda
 *   umbral      = DIAS_PUNTUAL × mediana de los ritmos diarios brutos de los
 *                 meses históricos (ver `puntuales.ts`)
 *
 *   ritmoHist     = promedio en el histórico de (variable − puntuales) / días del mes
 *   puntualesHist = promedio mensual de puntuales en el histórico
 *   ritmoMes      = (variable − puntuales) del mes / día actual
 *   ritmo         = (PESO_HISTORICO_DIAS·ritmoHist + día·ritmoMes) / (PESO_HISTORICO_DIAS + día)
 *
 *   restantes = días del mes − día actual
 *   esperados = max(0, puntualesHist − puntuales del mes) × restantes / días del mes
 *   base      = gastado del tope (todo: fijos, cuotas, puntuales) + fijos pendientes
 *
 *   optimista = base + ritmo·restantes·0,85
 *   normal    = base + ritmo·restantes      + esperados
 *   pesimista = base + ritmo·restantes·1,25 + esperados
 *
 * Por qué así:
 *
 * - Una compra puntual (la tele, el pasaje) es plata de una sola vez. Metida
 *   en el ritmo convierte un pico de un día en "todos los días gastás así":
 *   una TV el día 5 multiplicaba por cuatro la proyección. Ya está en el
 *   `gastado`; lo que se proyecta es solo lo que se repite.
 * - Pero los meses sí suelen traer alguna puntual. `esperados` suma la parte
 *   proporcional a los días que quedan de lo que *solés* gastar en puntuales y
 *   todavía no gastaste. El escenario optimista supone que no llega ninguna.
 * - El ritmo del mes con pocos días es ruido. En vez de esperar a un día fijo,
 *   el histórico vale como `PESO_HISTORICO_DIAS` días de datos: el día 1 manda
 *   casi todo el histórico y a fin de mes, casi todo el mes. Sin histórico no
 *   hay con qué mezclar, así que antes de `DIAS_MINIMOS_SIN_HISTORICO` la
 *   respuesta es `temprano`.
 * - Las cuotas y los fijos son plata comprometida, no ritmo: entran a la base
 *   (las cuotas por el `gastado`, los fijos que faltan como pendientes) y
 *   nunca al ritmo. La clasificación —variable, puntual, histórico— corre
 *   solo sobre movimientos reales.
 * - Los fijos pendientes pesan solo contra tarjeta: son débitos automáticos.
 *
 * El rango optimista–pesimista se angosta solo a medida que pasa el mes: el
 * factor del escenario aplica únicamente al tramo proyectado.
 */

/** Los tres escenarios de cierre, como multiplicadores del tramo variable. */
export const FACTOR_ESCENARIO = {
  optimista: 0.85,
  normal: 1,
  pesimista: 1.25,
} as const

export type Escenario = keyof typeof FACTOR_ESCENARIO

/** Cuántos días de datos "vale" el ritmo histórico al mezclarlo con el del mes. */
export const PESO_HISTORICO_DIAS = 7

/** Sin histórico, desde qué día el ritmo del mes alcanza para proyectar. */
export const DIAS_MINIMOS_SIN_HISTORICO = 7

export type Prediccion =
  | {
      status: 'temprano'
      mensaje: string
      /** Cuántos días faltan para que la proyección se considere confiable. */
      diasParaProyectar: number
    }
  | {
      status: 'proyeccion'
      /** Gastado del tope + fijos pendientes. No depende del escenario. */
      base: number
      optimista: number
      normal: number
      pesimista: number
      /** Ritmo variable mezclado, redondeado para mostrar. */
      ritmoDiario: number
      /** Puntuales que se esperan en los días que quedan, redondeado para mostrar. */
      puntualesEsperados: number
      diasRestantes: number
    }

/**
 * El cierre estimado del mes a partir de los números ya clasificados.
 *
 * `variableMes` es el variable del mes **sin** puntuales; `puntualesMes`, el
 * total de las puntuales. Los escenarios se calculan con los valores sin
 * redondear y se redondean al final; `ritmoDiario` y `puntualesEsperados` se
 * devuelven redondeados solo para mostrarlos.
 */
export function prediccionCierre(args: {
  gastado: number
  fijosPendientes: number
  variableMes: number
  puntualesMes: number
  perfil: PerfilHistorico
  diaActual: number
  diasMes: number
}): Prediccion {
  const { gastado, fijosPendientes, variableMes, puntualesMes, perfil, diaActual, diasMes } =
    args
  const conHistorico = perfil.meses > 0

  if (!conHistorico && diaActual < DIAS_MINIMOS_SIN_HISTORICO) {
    const faltan = DIAS_MINIMOS_SIN_HISTORICO - diaActual
    return {
      status: 'temprano',
      diasParaProyectar: faltan,
      mensaje:
        `Es temprano en el mes: van ${diaActual} ${diaActual === 1 ? 'día' : 'días'}. ` +
        `En ${faltan} ${faltan === 1 ? 'día' : 'días'} más la proyección tiene sentido.`,
    }
  }

  const dia = Math.max(0, diaActual)
  const ritmoMes = dia > 0 ? variableMes / dia : 0
  const ritmo = conHistorico
    ? (PESO_HISTORICO_DIAS * perfil.ritmoDiario + dia * ritmoMes) / (PESO_HISTORICO_DIAS + dia)
    : ritmoMes

  const diasRestantes = Math.max(0, diasMes - dia)
  const esperados =
    diasMes > 0
      ? (Math.max(0, perfil.puntualesPorMes - puntualesMes) * diasRestantes) / diasMes
      : 0
  const base = gastado + fijosPendientes
  const tramo = ritmo * diasRestantes

  return {
    status: 'proyeccion',
    base,
    optimista: Math.round(base + tramo * FACTOR_ESCENARIO.optimista),
    normal: Math.round(base + tramo * FACTOR_ESCENARIO.normal + esperados),
    pesimista: Math.round(base + tramo * FACTOR_ESCENARIO.pesimista + esperados),
    ritmoDiario: Math.round(ritmo),
    puntualesEsperados: Math.round(esperados),
    diasRestantes,
  }
}

export interface PrediccionTope {
  prediccion: Prediccion
  /** Las compras puntuales del mes en este tope, para listarlas aparte. */
  puntualesMes: MovimientoDetalle[]
}

/**
 * La predicción de un tope armada desde los datos crudos, tal como la corre
 * la página: vive acá para que el test pruebe la composición real.
 *
 * `movsReales` son solo movimientos (incluye el histórico); las cuotas del mes
 * entran únicamente al `gastado`. Los fijos pendientes pesan solo contra
 * tarjeta.
 */
export function prediccionDelTope(args: {
  movsReales: MovimientoDetalle[]
  cuotasMes: Cuota[]
  fijos: GastoFijoDetalle[]
  mes: Mes
  tope: Tope
  mesesHistorico: number
  diaActual: number
}): PrediccionTope {
  const { movsReales, cuotasMes, fijos, mes, tope, mesesHistorico, diaActual } = args
  const conFijo = comerciosConFijo(fijos)
  const perfil = perfilHistorico(movsReales, mes, mesesHistorico, tope, conFijo)
  const desglose = desgloseMes(movsReales, mes, tope, conFijo, perfil.umbral)

  const prediccion = prediccionCierre({
    gastado: gastoContraTope([...movsReales, ...cuotasMes], mes, tope),
    fijosPendientes: tope === 'tarjeta' ? fijosPendientesDelMes(fijos, movsReales, mes) : 0,
    variableMes: desglose.variable,
    puntualesMes: desglose.totalPuntuales,
    perfil,
    diaActual,
    diasMes: diasDelMes(mes),
  })

  return { prediccion, puntualesMes: desglose.puntuales }
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
