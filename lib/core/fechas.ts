/**
 * Fechas del dominio.
 *
 * Convención: una fecha de movimiento es un string ISO `"YYYY-MM-DD"` (sin hora,
 * sin zona). En Postgres va como `date`. Así un gasto del 30/09 a las 23:00 es
 * del 30/09 siempre, sin importar si el server corre en UTC (Vercel) o en BA.
 *
 * El único punto sensible a la zona horaria es "hoy": ahí sí hay que preguntarle
 * al reloj, y se resuelve explícitamente contra `ZONA_HORARIA`.
 */

export const ZONA_HORARIA = 'America/Argentina/Buenos_Aires'

/** Un mes del dominio: `"2026-09"`. */
export type Mes = string
/** Una fecha del dominio: `"2026-09-30"`. */
export type FechaISO = string

const RE_FECHA = /^(\d{4})-(\d{2})-(\d{2})$/
const RE_MES = /^(\d{4})-(\d{2})$/

/**
 * Instante -> fecha calendaria en Buenos Aires (`"YYYY-MM-DD"`).
 * Usarla para obtener "hoy", nunca `new Date().toISOString()`.
 */
export function fechaEnZona(instante: Date, zona: string = ZONA_HORARIA): FechaISO {
  const partes = new Intl.DateTimeFormat('en-US', {
    timeZone: zona,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(instante)

  const buscar = (tipo: string) => partes.find((p) => p.type === tipo)!.value
  return `${buscar('year')}-${buscar('month')}-${buscar('day')}`
}

/** La fecha de hoy en Buenos Aires. */
export function hoyISO(hoy: Date = new Date()): FechaISO {
  return fechaEnZona(hoy)
}

/**
 * El mes al que pertenece una fecha: `"2026-09-30"` -> `"2026-09"`.
 *
 * Si recibe un `Date` lo interpreta como instante y lo baja a la fecha
 * calendaria de Buenos Aires. Preferí pasarle el string del dominio.
 */
export function mesDe(fecha: FechaISO | Date): Mes {
  const iso = typeof fecha === 'string' ? fecha : fechaEnZona(fecha)
  const m = RE_FECHA.exec(iso)
  if (!m) throw new Error(`Fecha inválida: ${iso}. Se espera "YYYY-MM-DD".`)
  return `${m[1]}-${m[2]}`
}

/** El mes corriente en Buenos Aires. */
export function mesActual(hoy: Date = new Date()): Mes {
  return mesDe(hoyISO(hoy))
}

/** Cuántos días tiene un mes. `diasDelMes("2026-02")` -> 28. */
export function diasDelMes(mes: Mes): number {
  const m = RE_MES.exec(mes)
  if (!m) throw new Error(`Mes inválido: ${mes}. Se espera "YYYY-MM".`)
  const anio = Number(m[1])
  const nroMes = Number(m[2])
  if (nroMes < 1 || nroMes > 12) throw new Error(`Mes inválido: ${mes}.`)
  // Día 0 del mes siguiente = último día de este mes. En UTC para no depender de la zona.
  return new Date(Date.UTC(anio, nroMes, 0)).getUTCDate()
}

/** Qué día del mes es hoy en Buenos Aires (1..31). */
export function diaActual(hoy: Date = new Date()): number {
  return Number(hoyISO(hoy).slice(8, 10))
}

/** El día del mes de una fecha del dominio. */
export function diaDe(fecha: FechaISO): number {
  const m = RE_FECHA.exec(fecha)
  if (!m) throw new Error(`Fecha inválida: ${fecha}. Se espera "YYYY-MM-DD".`)
  return Number(m[3])
}

/** Corre un mes `n` lugares. `sumarMeses("2026-01", -1)` -> `"2025-12"`. */
export function sumarMeses(mes: Mes, n: number): Mes {
  const m = RE_MES.exec(mes)
  if (!m) throw new Error(`Mes inválido: ${mes}. Se espera "YYYY-MM".`)
  const total = Number(m[1]) * 12 + (Number(m[2]) - 1) + n
  const anio = Math.floor(total / 12)
  const nroMes = (total % 12) + 1
  return `${String(anio).padStart(4, '0')}-${String(nroMes).padStart(2, '0')}`
}

/**
 * Los `n` meses anteriores a `mes`, del más viejo al más nuevo.
 * `mesesAnteriores("2026-03", 2)` -> `["2026-01", "2026-02"]`.
 */
export function mesesAnteriores(mes: Mes, n: number): Mes[] {
  return Array.from({ length: n }, (_, i) => sumarMeses(mes, i - n))
}

/** Nombre legible de un mes: `"2026-09"` -> `"Septiembre 2026"`. */
const NOMBRES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
]
export function nombreMes(mes: Mes): string {
  const m = RE_MES.exec(mes)
  if (!m) throw new Error(`Mes inválido: ${mes}. Se espera "YYYY-MM".`)
  return `${NOMBRES[Number(m[2]) - 1]} ${m[1]}`
}

/**
 * Fecha compacta para listas de movimientos: `"2026-09-15"` -> `"15/09/26"`.
 *
 * Con el año porque el historial mezcla años, y a dos dígitos para que no
 * empuje al importe en una pantalla de celular.
 */
export function fechaCorta(fecha: FechaISO): string {
  const m = RE_FECHA.exec(fecha)
  if (!m) throw new Error(`Fecha inválida: ${fecha}. Se espera "YYYY-MM-DD".`)
  return `${m[3]}/${m[2]}/${m[1].slice(2)}`
}

/**
 * `"2026-10-15"` -> un `Date` a medianoche **local**.
 *
 * Hace falta para los componentes de calendario, que trabajan con `Date`.
 * `new Date("2026-10-15")` NO sirve: el string ISO se parsea como UTC, así que
 * en Buenos Aires (UTC-3) cae el 14 a las 21:00 y el calendario pinta el día
 * anterior. Pasando las partes por separado, el Date es local y el día es el
 * que se pidió.
 */
export function aFechaLocal(fecha: FechaISO): Date {
  const m = RE_FECHA.exec(fecha)
  if (!m) throw new Error(`Fecha inválida: ${fecha}. Se espera "YYYY-MM-DD".`)
  return new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3]))
}

/**
 * Un `Date` -> `"YYYY-MM-DD"` leyendo sus partes **locales**.
 *
 * El complemento de `aFechaLocal`. Nunca `toISOString()`: eso pasa por UTC y
 * un 15 a las 00:00 en Buenos Aires vuelve como "2026-10-14".
 */
export function desdeFechaLocal(d: Date): FechaISO {
  const mes = String(d.getMonth() + 1).padStart(2, '0')
  const dia = String(d.getDate()).padStart(2, '0')
  return `${d.getFullYear()}-${mes}-${dia}`
}
