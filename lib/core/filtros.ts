/**
 * Filtrado y búsqueda de movimientos.
 *
 * Todo acá adentro es puro: entra la lista completa y los criterios, sale la
 * lista filtrada. La pantalla no decide nada, solo muestra.
 */
import { mesDe, type FechaISO, type Mes } from '@/lib/core/fechas'
import type { FormaPago, MovimientoDetalle } from '@/lib/schemas/movimiento'
import { TOPE_DE_FORMA_PAGO } from '@/lib/core/gastos'

/** Contra qué tope pesa una forma de pago. Sale de `TOPE_DE_FORMA_PAGO`. */
export type TopeFiltro = (typeof TOPE_DE_FORMA_PAGO)[FormaPago]

export type Criterios = {
  /** Texto libre. Busca en comercio, nota, categoría y subcategoría. */
  texto?: string
  categoria?: string | null
  formaPago?: FormaPago | null
  /**
   * Todas las formas de pago de un tope a la vez: "tarjeta" son crédito,
   * débito y débito automático. Sale de `TOPE_DE_FORMA_PAGO`, así que si una
   * forma cambia de tope el filtro la sigue solo.
   */
  tope?: TopeFiltro | null
  /** Una tarjeta puntual ("Santander Visa"), por id. */
  tarjetaId?: string | null
  /** Un mes entero ('YYYY-MM'). Atajo del rango, que es lo que pide la UI. */
  mes?: Mes | null
  /** Rango inclusivo. Las fechas son 'YYYY-MM-DD', que ordena como string. */
  desde?: FechaISO | null
  hasta?: FechaISO | null
}

/**
 * Los filtros tal como los maneja una pantalla: todo string, '' = sin filtrar.
 *
 * Existe para que un `<select>` controlado no tenga que inventar `null`s ni
 * castear a mano, y para que las dos pantallas que filtran (el Home y el
 * Historial) compartan exactamente la misma forma.
 */
export type Filtros = {
  texto: string
  categoria: string
  formaPago: string
  mes: string
}

/**
 * El valor que usa el selector de forma de pago para pedir un tope entero.
 *
 * Viaja en el mismo campo `formaPago` de `Filtros` para que la pantalla siga
 * teniendo un solo selector: "Todo tarjeta" es una opción más de la lista.
 */
export const FILTRO_TOPE: Record<TopeFiltro, string> = {
  tarjeta: 'tope:tarjeta',
  efectivo: 'tope:efectivo',
}

/**
 * Prefijo del valor que pide una tarjeta puntual. Viaja en el mismo campo
 * `formaPago` que los topes: el selector sigue siendo uno solo.
 */
export const PREFIJO_TARJETA = 'tarjeta:'

export const SIN_FILTROS: Filtros = { texto: '', categoria: '', formaPago: '', mes: '' }

/** Si hay algo puesto, para decidir si se ofrece el botón de limpiar. */
export function hayFiltro(f: Filtros): boolean {
  return f.texto.trim() !== '' || f.categoria !== '' || f.formaPago !== '' || f.mes !== ''
}

/** Traduce el estado de la pantalla a los criterios del filtro. */
export function criteriosDe(f: Filtros): Criterios {
  const tope = (Object.keys(FILTRO_TOPE) as TopeFiltro[]).find(
    (t) => FILTRO_TOPE[t] === f.formaPago,
  )
  const tarjetaId = f.formaPago.startsWith(PREFIJO_TARJETA)
    ? f.formaPago.slice(PREFIJO_TARJETA.length)
    : null
  const esForma = !tope && !tarjetaId
  return {
    texto: f.texto,
    categoria: f.categoria || null,
    formaPago: esForma ? (f.formaPago as FormaPago) || null : null,
    tope: tope ?? null,
    tarjetaId,
    mes: (f.mes as Mes) || null,
  }
}

/**
 * Minúsculas y sin acentos, para que "nutricion" encuentre "Nutrición".
 *
 * `normalize('NFD')` separa la letra de su tilde y el replace saca los
 * diacríticos. Es Unicode estándar, no depende del ICU del runtime.
 */
export function normalizar(texto: string): string {
  return texto
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
}

/**
 * Filtra por todos los criterios a la vez (es un Y, no un O). Los criterios
 * vacíos, `null` o `undefined` no filtran nada.
 *
 * El texto se parte en palabras y **todas** tienen que aparecer, aunque sea en
 * campos distintos: "coto visa" encuentra la compra en Coto pagada con Visa.
 * El orden en que se escriben no importa.
 */
export function filtrarMovimientos(
  movs: MovimientoDetalle[],
  criterios: Criterios = {},
): MovimientoDetalle[] {
  const palabras = normalizar(criterios.texto ?? '')
    .split(/\s+/)
    .filter((p) => p !== '')

  return movs.filter((m) => {
    if (criterios.categoria && m.categoria !== criterios.categoria) return false
    if (criterios.formaPago && m.formaPago !== criterios.formaPago) return false
    if (criterios.tope && TOPE_DE_FORMA_PAGO[m.formaPago] !== criterios.tope) return false
    if (criterios.tarjetaId && m.tarjetaId !== criterios.tarjetaId) return false
    if (criterios.mes && mesDe(m.fecha) !== criterios.mes) return false
    if (criterios.desde && m.fecha < criterios.desde) return false
    if (criterios.hasta && m.fecha > criterios.hasta) return false

    if (palabras.length === 0) return true

    const texto = normalizar(
      [
        m.comercio,
        m.nota ?? '',
        m.categoria,
        m.subcategoria ?? '',
        m.banco ?? '',
        m.tarjeta ?? '',
        m.tarjetaNombre ?? '',
      ]
        .join(' '),
    )
    return palabras.every((p) => texto.includes(p))
  })
}

/** Las categorías presentes, ordenadas, para armar el selector. */
export function categoriasDe(movs: MovimientoDetalle[]): string[] {
  return [...new Set(movs.map((m) => m.categoria))].sort((a, b) =>
    normalizar(a) < normalizar(b) ? -1 : normalizar(a) > normalizar(b) ? 1 : 0,
  )
}

/**
 * Las tarjetas presentes, ordenadas por nombre, para sumarlas al selector de
 * forma de pago. Salen de los movimientos y no de la tabla: así una tarjeta
 * dada de baja aparece donde todavía tiene gastos, y no donde no tiene.
 */
export function tarjetasDe(movs: MovimientoDetalle[]): Array<{ id: string; nombre: string }> {
  const vistas = new Map<string, string>()
  for (const m of movs) {
    if (m.tarjetaId && m.tarjetaNombre) vistas.set(m.tarjetaId, m.tarjetaNombre)
  }
  return [...vistas]
    .map(([id, nombre]) => ({ id, nombre }))
    .sort((a, b) => normalizar(a.nombre).localeCompare(normalizar(b.nombre)))
}

/** Cuánto suma lo que quedó filtrado. Entero, como todo importe. */
export function totalDe(movs: MovimientoDetalle[]): number {
  return movs.reduce((a, m) => a + m.importeCentavos, 0)
}
