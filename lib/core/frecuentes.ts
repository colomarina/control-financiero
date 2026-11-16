/**
 * Qué comercios ofrecer como atajo en la pantalla Cargar.
 *
 * La idea: en un mes típico unos pocos comercios se repiten (el super, la
 * nafta, el delivery). Los dos más usados quedan a un tap; el resto, en el
 * buscador. Lo mismo para la forma de pago.
 */
import { FORMAS_PAGO, type FormaPago, type MovimientoDetalle } from '@/lib/schemas/movimiento'
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
  n = 2,
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

/**
 * Las formas de pago más usadas, para los botones de acceso rápido.
 *
 * Mismo criterio que `comerciosFrecuentes`: cantidad de usos y, a igual uso, la
 * más reciente. Devuelve siempre `n`: si no hay uso suficiente completa con el
 * orden de `FORMAS_PAGO`, así los botones no aparecen y desaparecen según el
 * mes.
 */
export function formasDePagoFrecuentes(movs: MovimientoDetalle[], n = 2): FormaPago[] {
  const uso = new Map<FormaPago, { usos: number; ultimo: string }>()
  for (const m of movs) {
    const previo = uso.get(m.formaPago)
    if (previo) {
      previo.usos++
      if (m.fecha > previo.ultimo) previo.ultimo = m.fecha
    } else {
      uso.set(m.formaPago, { usos: 1, ultimo: m.fecha })
    }
  }

  const usadas = [...uso.entries()]
    .sort(([, a], [, b]) => {
      if (b.usos !== a.usos) return b.usos - a.usos
      return b.ultimo > a.ultimo ? 1 : b.ultimo < a.ultimo ? -1 : 0
    })
    .map(([f]) => f)

  const resto = FORMAS_PAGO.filter((f) => !usadas.includes(f))
  return [...usadas, ...resto].slice(0, n)
}

/**
 * Con qué forma se pagó cada comercio la última vez: al elegir el comercio en
 * un alta, el formulario la preselecciona (Netflix ya cae en débito
 * automático, la verdulería en efectivo). A igual fecha gana el último de la
 * lista.
 */
export function ultimaFormaPorComercio(movs: MovimientoDetalle[]): Record<string, FormaPago> {
  const ultima = new Map<string, { fecha: string; forma: FormaPago }>()
  for (const m of movs) {
    const previo = ultima.get(m.comercioId)
    if (!previo || m.fecha >= previo.fecha) {
      ultima.set(m.comercioId, { fecha: m.fecha, forma: m.formaPago })
    }
  }
  return Object.fromEntries([...ultima].map(([id, { forma }]) => [id, forma]))
}
