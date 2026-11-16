import { describe, it, expect } from 'vitest'
import {
  IMPORTE_VACIO,
  estaVacio,
  pulsarDigito,
  pulsarComa,
  borrar,
  mostrar,
  aCentavos,
  desdeCentavos,
  aplicarEntrada,
  desdeTexto,
  type Importe,
} from './keypad'
import { parsearImporte } from './dinero'

/** Tipea una secuencia: dígitos, ',' para la coma y '<' para borrar. */
function tipear(secuencia: string): Importe {
  let i = IMPORTE_VACIO
  for (const c of secuencia) {
    if (c === ',') i = pulsarComa(i)
    else if (c === '<') i = borrar(i)
    else i = pulsarDigito(i, c)
  }
  return i
}

describe('tipeo básico', () => {
  it('escribe en pesos, no en centavos', () => {
    const i = tipear('1500')
    expect(mostrar(i)).toBe('1.500')
    expect(aCentavos(i)).toBe(150000)
  })

  it('separa los miles a medida que se tipea', () => {
    expect(mostrar(tipear('1'))).toBe('1')
    expect(mostrar(tipear('12'))).toBe('12')
    expect(mostrar(tipear('123'))).toBe('123')
    expect(mostrar(tipear('1234'))).toBe('1.234')
    expect(mostrar(tipear('1234567'))).toBe('1.234.567')
  })

  it('arranca vacío y lo muestra como 0', () => {
    expect(estaVacio(IMPORTE_VACIO)).toBe(true)
    expect(mostrar(IMPORTE_VACIO)).toBe('0')
    expect(aCentavos(IMPORTE_VACIO)).toBe(0)
  })

  it('ignora un cero a la izquierda', () => {
    expect(mostrar(tipear('0'))).toBe('0')
    expect(estaVacio(tipear('0'))).toBe(true)
    expect(mostrar(tipear('05'))).toBe('5')
  })

  it('corta la parte entera en 9 dígitos', () => {
    const i = tipear('1234567890123')
    expect(mostrar(i)).toBe('123.456.789')
    expect(aCentavos(i)).toBe(12345678900)
  })
})

describe('centavos', () => {
  it('solo aparecen si se aprieta la coma', () => {
    const i = tipear('1500,50')
    expect(mostrar(i)).toBe('1.500,50')
    expect(aCentavos(i)).toBe(150050)
  })

  it('un solo decimal son décimas, no centésimas', () => {
    const i = tipear('1500,5')
    expect(mostrar(i)).toBe('1.500,5')
    expect(aCentavos(i)).toBe(150050)
  })

  it('no acepta más de dos decimales', () => {
    const i = tipear('10,999')
    expect(mostrar(i)).toBe('10,99')
    expect(aCentavos(i)).toBe(1099)
  })

  it('la coma al principio vale como 0,…', () => {
    const i = tipear(',75')
    expect(mostrar(i)).toBe('0,75')
    expect(aCentavos(i)).toBe(75)
  })

  it('una segunda coma no hace nada', () => {
    expect(mostrar(tipear('1,2,3'))).toBe('1,23')
  })

  it('la coma sola queda a la vista mientras se tipea', () => {
    expect(mostrar(tipear('15,'))).toBe('15,')
    expect(aCentavos(tipear('15,'))).toBe(1500)
  })
})

describe('borrar', () => {
  it('saca el último dígito', () => {
    expect(mostrar(tipear('1500<'))).toBe('150')
  })

  it('se come la coma y vuelve a la parte entera', () => {
    expect(mostrar(tipear('15,<'))).toBe('15')
    expect(mostrar(tipear('15,<5'))).toBe('155')
  })

  it('borra los decimales de a uno antes de la coma', () => {
    expect(mostrar(tipear('15,75<'))).toBe('15,7')
    expect(mostrar(tipear('15,75<<'))).toBe('15,')
    expect(mostrar(tipear('15,75<<<'))).toBe('15')
  })

  it('sobre vacío no rompe', () => {
    const i = tipear('<<<')
    expect(estaVacio(i)).toBe(true)
    expect(mostrar(i)).toBe('0')
  })

  it('deja el importe vacío si se borra todo', () => {
    expect(estaVacio(tipear('150<<<'))).toBe(true)
  })
})

describe('aCentavos', () => {
  it('no arrastra error de float', () => {
    // 0,1 + 0,2 en float da 0.30000000000000004; acá son enteros.
    expect(aCentavos(tipear('0,10'))).toBe(10)
    expect(aCentavos(tipear('1234567,89'))).toBe(123456789)
  })

  it('un importe sin decimales es múltiplo de 100', () => {
    expect(aCentavos(tipear('999')) % 100).toBe(0)
  })
})

describe('contrato con la action', () => {
  // El form manda `mostrar(importe)` como texto y la action lo pasa por
  // `parsearImporte`. Si los dos lados se desincronizan, el gasto se guarda
  // con otro importe y nadie se entera: por eso el ida y vuelta se testea.
  it.each(['1500', '1500,50', '1500,5', ',75', '999999999', '1234567,89', '15,'])(
    'parsearImporte(mostrar(x)) === aCentavos(x) para "%s"',
    (secuencia) => {
      const i = tipear(secuencia)
      expect(parsearImporte(mostrar(i))).toBe(aCentavos(i))
    },
  )
})

describe('entrada inválida', () => {
  it('ignora lo que no sea un dígito', () => {
    const i = pulsarDigito(tipear('15'), 'a')
    expect(mostrar(i)).toBe('15')
  })
})

describe('desdeCentavos', () => {
  it('reconstruye lo que se habría tipeado', () => {
    expect(mostrar(desdeCentavos(150_000))).toBe('1.500')
    expect(mostrar(desdeCentavos(150_050))).toBe('1.500,50')
    expect(mostrar(desdeCentavos(75))).toBe('0,75')
  })

  it('no deja la coma si no hay centavos', () => {
    expect(desdeCentavos(150_000).decimales).toBeNull()
  })

  it('el cero queda vacío, como un keypad recién abierto', () => {
    expect(estaVacio(desdeCentavos(0))).toBe(true)
  })

  it('ida y vuelta con aCentavos', () => {
    for (const c of [1, 75, 100, 150_000, 150_050, 99_999_999]) {
      expect(aCentavos(desdeCentavos(c))).toBe(c)
    }
  })
})

describe('aplicarEntrada (teclado del sistema)', () => {
  /** Simula tipear char por char como lo manda `beforeinput`. */
  function teclear(texto: string, desde: Importe = IMPORTE_VACIO): Importe {
    let i = desde
    for (const c of texto) i = aplicarEntrada(i, 'insertText', c)
    return i
  }

  it('los dígitos entran como en el keypad: en pesos', () => {
    expect(mostrar(teclear('1500'))).toBe('1.500')
    expect(aCentavos(teclear('1500'))).toBe(150_000)
  })

  it('la coma y el punto abren los centavos', () => {
    expect(mostrar(teclear('12,5'))).toBe('12,5')
    expect(mostrar(teclear('12.5'))).toBe('12,5')
  })

  it('un insertText de varios caracteres se aplica de a uno', () => {
    expect(mostrar(aplicarEntrada(IMPORTE_VACIO, 'insertText', '1500,5'))).toBe('1.500,5')
  })

  it('borrar hacia atrás o adelante se come el último caracter', () => {
    const i = teclear('1500')
    expect(mostrar(aplicarEntrada(i, 'deleteContentBackward', null))).toBe('150')
    expect(mostrar(aplicarEntrada(i, 'deleteContentForward', null))).toBe('150')
  })

  it('cortar o borrar por palabra vacía el importe', () => {
    const i = teclear('1500')
    expect(estaVacio(aplicarEntrada(i, 'deleteByCut', null))).toBe(true)
    expect(estaVacio(aplicarEntrada(i, 'deleteWordBackward', null))).toBe(true)
  })

  it('pegar reemplaza todo y tolera el formato con miles', () => {
    const i = teclear('99')
    expect(aCentavos(aplicarEntrada(i, 'insertFromPaste', '1.500,50'))).toBe(150_050)
    expect(aCentavos(aplicarEntrada(i, 'insertFromPaste', '$ 2500'))).toBe(250_000)
  })

  it('ignora letras y lo que no reconoce', () => {
    const i = teclear('15')
    expect(aplicarEntrada(i, 'insertText', 'a')).toEqual(i)
    expect(aplicarEntrada(i, 'formatBold', null)).toEqual(i)
  })
})

describe('desdeTexto', () => {
  it('lee el formato que muestra la pantalla', () => {
    expect(aCentavos(desdeTexto('1.500'))).toBe(150_000)
    expect(aCentavos(desdeTexto('1.500,5'))).toBe(150_050)
  })

  it('texto vacío o basura da vacío', () => {
    expect(estaVacio(desdeTexto(''))).toBe(true)
    expect(estaVacio(desdeTexto('abc'))).toBe(true)
  })
})

describe('desdeTexto con punto decimal (pegado en formato US)', () => {
  it('un punto con 1 o 2 dígitos al final y sin coma es decimal', () => {
    expect(aCentavos(desdeTexto('1500.50'))).toBe(150_050)
    expect(aCentavos(desdeTexto('1500.5'))).toBe(150_050)
    expect(aCentavos(desdeTexto('$ 99.90'))).toBe(9_990)
  })

  it('con 3 dígitos después del punto sigue siendo de miles', () => {
    expect(aCentavos(desdeTexto('1.500'))).toBe(150_000)
    expect(aCentavos(desdeTexto('1.500.000'))).toBe(150_000_000)
  })

  it('si hay coma, la coma manda y los puntos son miles', () => {
    expect(aCentavos(desdeTexto('1.500,50'))).toBe(150_050)
  })

  it('pegar en formato US entra igual por aplicarEntrada', () => {
    expect(aCentavos(aplicarEntrada(IMPORTE_VACIO, 'insertFromPaste', '1500.50'))).toBe(150_050)
  })
})
