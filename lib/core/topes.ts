import { porcentaje } from './dinero'

/**
 * Estado de una barra de tope.
 * - `ok`: vas bien.
 * - `cerca`: pasaste el 85% del tope pero todavía no lo excediste.
 * - `excedido`: te pasaste.
 */
export type EstadoTope = 'ok' | 'cerca' | 'excedido'

/**
 * A partir de qué % del tope la barra pasa a "cerca".
 *
 * El Excel tenía tres umbrales distintos conviviendo (0,80 en Configuracion,
 * 0,85 fijo en Objetivos, 0,90 para el rojo). Acá hay uno solo, con este
 * default, y se puede pisar desde la config.
 */
export const UMBRAL_CERCA = 85

/**
 * En qué estado está el tope. Todo en centavos.
 *
 * Un `tope` de 0 (o negativo) significa "sin tope configurado": siempre `ok`,
 * así una config recién creada no muestra todo en rojo.
 */
export function estadoTope(
  gastado: number,
  tope: number,
  umbralCerca: number = UMBRAL_CERCA,
): EstadoTope {
  if (tope <= 0) return 'ok'
  if (gastado > tope) return 'excedido'
  if (porcentaje(gastado, tope) > umbralCerca) return 'cerca'
  return 'ok'
}

/**
 * Cuánto te queda del tope. Puede dar negativo: eso es lo que te pasaste.
 * Sin tope configurado devuelve 0.
 */
export function restanteTope(gastado: number, tope: number): number {
  if (tope <= 0) return 0
  return tope - gastado
}

/**
 * Qué porcentaje del tope llevás, recortado a 100 para que la barra de la UI
 * no se desborde. Para el número "real" (que puede pasar 100) usá `porcentaje()`.
 */
export function porcentajeBarra(gastado: number, tope: number): number {
  if (tope <= 0) return 0
  return Math.min(porcentaje(gastado, tope), 100)
}

/** Todo lo que una barra de tope necesita para dibujarse. */
export interface ResumenTope {
  gastado: number
  tope: number
  restante: number
  estado: EstadoTope
  porcentajeBarra: number
}

export function resumenTope(
  gastado: number,
  tope: number,
  umbralCerca: number = UMBRAL_CERCA,
): ResumenTope {
  return {
    gastado,
    tope,
    restante: restanteTope(gastado, tope),
    estado: estadoTope(gastado, tope, umbralCerca),
    porcentajeBarra: porcentajeBarra(gastado, tope),
  }
}

/**
 * Cuánto podés gastar por día sin pasarte del tope: el margen repartido entre
 * los días que quedan, contando hoy. Nunca divide por 0.
 */
export function disponiblePorDia(margen: number, diasRestantesConHoy: number): number {
  return Math.floor(margen / Math.max(1, diasRestantesConHoy))
}
