/**
 * Navegación de una lista de opciones con el teclado.
 *
 * Es lo que hay que escribir cuando el desplegable deja de ser un `<select>`
 * nativo: el navegador ya no mueve el foco ni busca por lo que tipeás. Todo
 * acá adentro es puro —entran las etiquetas y la tecla, sale un índice—, así
 * que el componente solo pone el foco donde esto le dice.
 */
import { normalizar } from './filtros'

/**
 * El índice siguiente, dando la vuelta en los extremos: de la última opción
 * se pasa a la primera, como en un `<select>` de verdad.
 *
 * Un `actual` de -1 significa "no hay nada enfocado": bajando arranca en la
 * primera y subiendo en la última.
 */
export function siguienteIndice(actual: number, total: number, delta: number): number {
  if (total <= 0) return -1
  const desde = actual < 0 ? (delta > 0 ? -1 : 0) : actual
  return (((desde + delta) % total) + total) % total
}

/**
 * El índice de la primera opción que empieza con lo tipeado, buscando a partir
 * de `desde` (exclusivo) y dando la vuelta. `null` si no coincide ninguna.
 *
 * Dos detalles que lo hacen sentirse nativo:
 *
 * - Compara con `normalizar`, así que tipear "nutricion" encuentra "Nutrición".
 * - **Repetir la misma tecla cicla.** Apretar "s" tres veces no busca "sss":
 *   busca "s" tres veces, y como cada búsqueda arranca después de la anterior,
 *   recorre Salud → Seguros → Servicios. Es lo que hace el select del sistema.
 */
export function buscarPorTexto(
  etiquetas: string[],
  buffer: string,
  desde = -1,
): number | null {
  const repetida = buffer.length > 1 && [...buffer].every((c) => c === buffer[0])
  const busca = normalizar(repetida ? buffer[0] : buffer)
  if (busca === '') return null

  const total = etiquetas.length
  for (let i = 1; i <= total; i++) {
    const idx = (((desde + i) % total) + total) % total
    if (normalizar(etiquetas[idx]).startsWith(busca)) return idx
  }
  return null
}
