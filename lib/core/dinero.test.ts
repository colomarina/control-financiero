import { describe, it, expect } from 'vitest'
import {
  aPesos,
  aCentavos,
  parsearImporte,
  formatoARS,
  sumar,
  porcentaje,
} from './dinero'

describe('aPesos / aCentavos', () => {
  it('convierte ida y vuelta', () => {
    expect(aPesos(150000)).toBe(1500)
    expect(aCentavos(1500)).toBe(150000)
  })

  it('redondea la basura de float al pasar a centavos', () => {
    expect(aCentavos(0.1 + 0.2)).toBe(30)
    expect(aCentavos(1234.565)).toBe(123457)
  })

  it('maneja el cero y los negativos', () => {
    expect(aCentavos(0)).toBe(0)
    expect(aCentavos(-12.34)).toBe(-1234)
  })
})

describe('parsearImporte', () => {
  it('acepta formato argentino con miles y decimales', () => {
    expect(parsearImporte('1.500,50')).toBe(150050)
    expect(parsearImporte('1.234.567,89')).toBe(123456789)
  })

  it('acepta números pelados y con signo peso', () => {
    expect(parsearImporte('1500')).toBe(150000)
    expect(parsearImporte('$1.500')).toBe(150000)
    expect(parsearImporte(' 250 ')).toBe(25000)
  })

  it('devuelve null para basura', () => {
    expect(parsearImporte('')).toBeNull()
    expect(parsearImporte('abc')).toBeNull()
    expect(parsearImporte('12,34,56')).toBeNull()
  })
})

describe('formatoARS', () => {
  it('omite los decimales cuando el importe es redondo', () => {
    expect(formatoARS(150000)).toBe('$1.500')
    expect(formatoARS(100)).toBe('$1')
    expect(formatoARS(0)).toBe('$0')
  })

  it('muestra los centavos cuando los hay', () => {
    expect(formatoARS(150050)).toBe('$1.500,50')
    expect(formatoARS(105)).toBe('$1,05')
  })

  it('agrupa los miles', () => {
    expect(formatoARS(123456789)).toBe('$1.234.567,89')
    expect(formatoARS(100000000)).toBe('$1.000.000')
  })

  it('maneja negativos', () => {
    expect(formatoARS(-150000)).toBe('-$1.500')
  })
})

describe('sumar', () => {
  it('suma en enteros sin perder precisión', () => {
    expect(sumar(10, 20, 30)).toBe(60)
    expect(sumar()).toBe(0)
  })
})

describe('porcentaje', () => {
  it('calcula el porcentaje', () => {
    expect(porcentaje(50, 200)).toBe(25)
  })

  it('devuelve 0 si el total es 0 (no Infinity)', () => {
    expect(porcentaje(100, 0)).toBe(0)
  })
})
