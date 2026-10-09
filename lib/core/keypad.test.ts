import { describe, it, expect } from 'vitest'
import {
  IMPORTE_VACIO,
  estaVacio,
  pulsarDigito,
  pulsarComa,
  borrar,
  mostrar,
  aCentavos,
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
