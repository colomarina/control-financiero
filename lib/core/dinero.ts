/**
 * Plata, siempre como entero de centavos.
 *
 * Regla del proyecto: todo importe se guarda y se opera como entero
 * (`150000` = $1.500,00). Se convierte a pesos SOLO para mostrar.
 * Nunca float en cálculos.
 */

/** Centavos -> pesos. Solo para presentación, nunca para operar. */
export function aPesos(centavos: number): number {
  return centavos / 100
}

/**
 * Pesos -> centavos. Redondea al centavo más cercano para absorber
 * la basura binaria de los floats que entran por un input.
 */
export function aCentavos(pesos: number): number {
  return Math.round(pesos * 100)
}

/**
 * Parsea lo que el usuario tipea en un input ("1.500,50", "1500.5", "$1.500")
 * y devuelve centavos. `null` si no es un número válido.
 *
 * Asume formato argentino: "." separa miles, "," separa decimales.
 */
export function parsearImporte(texto: string): number | null {
  const limpio = texto.replace(/[\s$]/g, '').replace(/\./g, '').replace(',', '.')
  if (limpio === '' || !/^-?\d*\.?\d*$/.test(limpio)) return null
  const n = Number(limpio)
  return Number.isFinite(n) ? aCentavos(n) : null
}

/**
 * Formato ARS para mostrar: `formatoARS(150000)` -> "$1.500".
 * Si hay centavos los muestra: `formatoARS(150050)` -> "$1.500,50".
 *
 * Se arma a mano (y no con Intl) para que el resultado sea idéntico
 * en cualquier Node/navegador, sin depender de la versión de ICU.
 */
export function formatoARS(centavos: number): string {
  const negativo = centavos < 0
  const abs = Math.abs(Math.round(centavos))
  const enteros = Math.floor(abs / 100)
  const resto = abs % 100

  const conMiles = String(enteros).replace(/\B(?=(\d{3})+(?!\d))/g, '.')
  const decimales = resto === 0 ? '' : `,${String(resto).padStart(2, '0')}`

  return `${negativo ? '-' : ''}$${conMiles}${decimales}`
}

/** Suma defensiva: mantiene todo en enteros. */
export function sumar(...centavos: number[]): number {
  return centavos.reduce((a, b) => a + b, 0)
}

/**
 * Porcentaje de `parte` sobre `total`, como número 0..n (no 0..1).
 * Si `total` es 0 devuelve 0 (evita Infinity/NaN en las barras de la UI).
 */
export function porcentaje(parte: number, total: number): number {
  if (total === 0) return 0
  return (parte / total) * 100
}
