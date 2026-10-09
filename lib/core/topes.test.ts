import { describe, it, expect } from 'vitest'
import { estadoTope, restanteTope, porcentajeBarra, resumenTope } from './topes'

describe('estadoTope', () => {
  it('es ok bien por debajo del tope', () => {
    expect(estadoTope(50_000, 1_000_000)).toBe('ok')
  })

  it('es ok justo en el 85% (el umbral es estricto)', () => {
    expect(estadoTope(850_000, 1_000_000)).toBe('ok')
  })

  it('es cerca apenas pasa el 85%', () => {
    expect(estadoTope(850_001, 1_000_000)).toBe('cerca')
    expect(estadoTope(999_999, 1_000_000)).toBe('cerca')
  })

  it('justo en el tope todavía no está excedido, pero sí cerca', () => {
    expect(estadoTope(1_000_000, 1_000_000)).toBe('cerca')
    expect(estadoTope(1_000_001, 1_000_000)).toBe('excedido')
  })

  it('sin tope configurado siempre es ok', () => {
    expect(estadoTope(999_999_999, 0)).toBe('ok')
    expect(estadoTope(0, 0)).toBe('ok')
  })

  it('acepta un umbral distinto al default', () => {
    // Con el 80 que tenía Configuracion en el Excel, 820.000 ya es "cerca".
    expect(estadoTope(820_000, 1_000_000, 80)).toBe('cerca')
    expect(estadoTope(820_000, 1_000_000)).toBe('ok')
  })
})

describe('restanteTope', () => {
  it('devuelve lo que queda', () => {
    expect(restanteTope(300_000, 1_000_000)).toBe(700_000)
  })

  it('devuelve negativo cuando te pasaste', () => {
    expect(restanteTope(1_200_000, 1_000_000)).toBe(-200_000)
  })

  it('devuelve 0 si no hay tope', () => {
    expect(restanteTope(500_000, 0)).toBe(0)
  })
})

describe('porcentajeBarra', () => {
  it('calcula el porcentaje', () => {
    expect(porcentajeBarra(250_000, 1_000_000)).toBe(25)
  })

  it('se recorta en 100 aunque te hayas pasado', () => {
    expect(porcentajeBarra(3_000_000, 1_000_000)).toBe(100)
  })

  it('es 0 sin tope', () => {
    expect(porcentajeBarra(500_000, 0)).toBe(0)
  })
})

describe('resumenTope', () => {
  it('arma todo lo que la barra necesita', () => {
    expect(resumenTope(900_000, 1_000_000)).toEqual({
      gastado: 900_000,
      tope: 1_000_000,
      restante: 100_000,
      estado: 'cerca',
      porcentajeBarra: 90,
    })
  })
})
