/**
 * Qué comercios ofrecer como atajo en la pantalla Cargar.
 *
 * La idea: en un mes típico los mismos cinco o seis comercios se repiten
 * (el super, la nafta, el delivery). Si están a un tap, cargar un gasto no
 * necesita teclado en ningún momento.
 */
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import type { Comercio } from '@/lib/schemas/comercio'

/**
 * Los comercios más usados, del más al menos frecuente.
 *
 * Ordena por cantidad de movimientos y desempata por el uso más reciente: con
 * dos comercios usados tres veces cada uno, arriba va el de esta semana y no el
 * de hace un mes.
 *
 * Solo devuelve comercios que estén en `disponibles` (el catálogo activo): uno
 * dado de baja no vuelve a aparecer por haberse usado mucho antes. Si ninguno
 * tiene uso —un mes recién arrancado— devuelve la lista vacía, y la pantalla
 * cae al buscador de siempre.
 *
 * @param movs  Los movimientos de la ventana que se quiera mirar. Recortar el
 *              período es decisión de quien llama: acá entra lo que entra.
 */
export function comerciosFrecuentes(
  movs: MovimientoDetalle[],
  disponibles: Comercio[],
  n = 6,
): Comercio[] {
  const uso = new Map<string, { usos: number; ultimo: string }>()

  for (const m of movs) {
    const previo = uso.get(m.comercioId)
    if (previo) {
      previo.usos++
      if (m.fecha > previo.ultimo) previo.ultimo = m.fecha
    } else {
      uso.set(m.comercioId, { usos: 1, ultimo: m.fecha })
    }
  }

  return disponibles
    .filter((c) => uso.has(c.id))
    .sort((a, b) => {
      const ua = uso.get(a.id)!
      const ub = uso.get(b.id)!
      if (ub.usos !== ua.usos) return ub.usos - ua.usos
      if (ub.ultimo !== ua.ultimo) return ub.ultimo > ua.ultimo ? 1 : -1
      // Último desempate: alfabético simple. Comparación directa y no
      // `localeCompare`, que depende del ICU del runtime (misma razón por la
      // que `dinero.ts` formatea a mano).
      return a.nombre < b.nombre ? -1 : a.nombre > b.nombre ? 1 : 0
    })
    .slice(0, n)
}
