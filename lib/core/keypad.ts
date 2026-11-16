/**
 * El estado del teclado numérico de la pantalla Cargar.
 *
 * Se escribe en PESOS, no en centavos: tipear 1500 es $1.500, y los centavos
 * solo aparecen si se aprieta la coma. En el Excel original casi ningún gasto
 * tenía centavos, así que el modo "cajero" (donde 1500 sería $15,00) obligaría
 * a tipear dos ceros de más casi siempre.
 *
 * Nada de floats: el valor sale a centavos con aritmética entera.
 */

export type Importe = {
  /** Dígitos de la parte entera, sin separadores. '' = todavía nada. */
  enteros: string
  /** Dígitos de centavos, o `null` si no se apretó la coma. */
  decimales: string | null
}

export const IMPORTE_VACIO: Importe = { enteros: '', decimales: null }

/** Hasta $999.999.999: más que eso no es un gasto, es un error de tipeo. */
const MAX_ENTEROS = 9

export function estaVacio(i: Importe): boolean {
  return i.enteros === '' && (i.decimales === null || i.decimales === '')
}

export function pulsarDigito(i: Importe, digito: string): Importe {
  if (!/^[0-9]$/.test(digito)) return i

  if (i.decimales !== null) {
    // Después de la coma entran dos dígitos y no más.
    if (i.decimales.length >= 2) return i
    return { ...i, decimales: i.decimales + digito }
  }

  // Un cero solo no abre la parte entera: '0' seguido de '5' es 5, no 05.
  if (i.enteros === '' && digito === '0') return i
  if (i.enteros.length >= MAX_ENTEROS) return i
  return { ...i, enteros: i.enteros + digito }
}

export function pulsarComa(i: Importe): Importe {
  if (i.decimales !== null) return i // ya estamos en los centavos
  // Apretar la coma de entrada vale como "0,…".
  return { enteros: i.enteros === '' ? '0' : i.enteros, decimales: '' }
}

/** Borra el último caracter tipeado, incluida la coma. */
export function borrar(i: Importe): Importe {
  if (i.decimales !== null) {
    if (i.decimales === '') return { ...i, decimales: null } // se come la coma
    return { ...i, decimales: i.decimales.slice(0, -1) }
  }
  return { ...i, enteros: i.enteros.slice(0, -1) }
}

/** Separador de miles, sin tocar la parte decimal. */
function conMiles(enteros: string): string {
  return enteros.replace(/\B(?=(\d{3})+(?!\d))/g, '.')
}

/**
 * Lo que se ve en pantalla mientras se tipea: '1.500', '1.500,', '1.500,50'.
 * Vacío muestra '0' para que el lugar del número nunca quede en blanco.
 */
export function mostrar(i: Importe): string {
  const enteros = i.enteros === '' ? '0' : conMiles(i.enteros)
  if (i.decimales === null) return enteros
  return `${enteros},${i.decimales}`
}

/**
 * El valor en centavos. Entero puro: los pesos se multiplican por 100 y los
 * centavos se suman aparte, así que no hay float que redondear.
 */
export function aCentavos(i: Importe): number {
  const pesos = i.enteros === '' ? 0 : Number(i.enteros)
  const centavos = i.decimales === null ? 0 : Number(i.decimales.padEnd(2, '0') || '0')
  return pesos * 100 + centavos
}

/**
 * El camino inverso: centavos -> lo que habría tipeado alguien para llegar a
 * ese número. Lo usa la edición de un gasto, que arranca con el importe ya
 * cargado.
 *
 * Si no hay centavos no deja la coma puesta: `150000` vuelve como "1.500" y no
 * como "1.500,00", que es como se habría tipeado.
 */
export function desdeCentavos(centavos: number): Importe {
  const abs = Math.abs(Math.round(centavos))
  const pesos = Math.floor(abs / 100)
  const resto = abs % 100

  return {
    enteros: pesos === 0 ? '' : String(pesos),
    decimales: resto === 0 ? null : String(resto).padStart(2, '0'),
  }
}

/**
 * Un punto seguido de 1 o 2 dígitos al final, sin coma en ningún lado:
 * '1500.50' copiado de un home banking o una calculadora en formato US.
 */
const PUNTO_DECIMAL_FINAL = /^[^,]*\.\d{1,2}$/

/**
 * Lee un texto con el formato de pantalla ('1.500,50', '$ 2500') como si se
 * hubiera tipeado: los puntos son miles y se ignoran, la primera coma abre los
 * centavos y cualquier otra cosa no cuenta. Es lo que hace pegar un importe.
 *
 * Única excepción: si no hay coma y el texto termina en un punto con 1 o 2
 * dígitos, ese punto es decimal. Sin esto, pegar '1500.50' cargaba $150.050
 * —cien veces el monto— sin ningún aviso. Con 3 dígitos ('1.500') sigue siendo
 * de miles, que es lo que muestra la pantalla.
 */
export function desdeTexto(texto: string): Importe {
  const limpio = texto.trim()
  const decimalConPunto = PUNTO_DECIMAL_FINAL.test(limpio)
  const ultimoPunto = limpio.lastIndexOf('.')

  let i = IMPORTE_VACIO
  for (let k = 0; k < limpio.length; k++) {
    const c = limpio[k]
    if (c === ',' || (decimalConPunto && k === ultimoPunto)) i = pulsarComa(i)
    else i = pulsarDigito(i, c)
  }
  return i
}

/**
 * Traduce un evento `beforeinput` del campo del importe a las mismas reglas
 * del keypad. El campo nunca deja que el navegador edite su texto: cada
 * tecla pasa por acá, así que tipear con el teclado del celular, con el de la
 * compu o pegar dan siempre el mismo resultado que el teclado propio de antes.
 *
 * Al tipear, el punto vale como coma: el teclado numérico de muchos celulares
 * solo trae punto, y los miles los pone la pantalla, nunca quien tipea.
 */
export function aplicarEntrada(i: Importe, tipo: string, datos: string | null): Importe {
  switch (tipo) {
    case 'insertText':
    case 'insertReplacementText': {
      let r = i
      for (const c of datos ?? '') {
        if (c === ',' || c === '.') r = pulsarComa(r)
        else r = pulsarDigito(r, c)
      }
      return r
    }
    case 'insertFromPaste':
    case 'insertFromDrop':
      return desdeTexto(datos ?? '')
    case 'deleteContentBackward':
    case 'deleteContentForward':
      return borrar(i)
    case 'deleteByCut':
    case 'deleteWordBackward':
    case 'deleteWordForward':
    case 'deleteSoftLineBackward':
    case 'deleteHardLineBackward':
      return IMPORTE_VACIO
    default:
      return i
  }
}
