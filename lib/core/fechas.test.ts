import { describe, it, expect } from 'vitest'
import {
  fechaEnZona,
  hoyISO,
  mesDe,
  mesActual,
  diasDelMes,
  diaActual,
  diaDe,
  sumarMeses,
  mesesAnteriores,
  nombreMes,
} from './fechas'

describe('fechaEnZona', () => {
  it('baja un instante a la fecha calendaria de Buenos Aires', () => {
    // 30/09 23:00 en BA es 01/10 02:00 UTC: sigue siendo 30/09 acá.
    expect(fechaEnZona(new Date('2026-10-01T02:00:00Z'))).toBe('2026-09-30')
  })

  it('no se corre al día anterior a la medianoche de BA', () => {
    expect(fechaEnZona(new Date('2026-09-30T03:00:00Z'))).toBe('2026-09-30')
  })

  it('padea mes y día a dos dígitos', () => {
    expect(fechaEnZona(new Date('2026-01-05T15:00:00Z'))).toBe('2026-01-05')
  })
})

describe('mesDe', () => {
  it('saca el mes de una fecha del dominio', () => {
    expect(mesDe('2026-09-30')).toBe('2026-09')
    expect(mesDe('2026-01-01')).toBe('2026-01')
  })

  it('acepta un Date y lo resuelve en zona BA', () => {
    expect(mesDe(new Date('2026-10-01T02:00:00Z'))).toBe('2026-09')
  })

  it('rechaza una fecha mal formada', () => {
    expect(() => mesDe('30/09/2026')).toThrow()
  })
})

describe('diasDelMes', () => {
  it('cuenta los días de cada mes', () => {
    expect(diasDelMes('2026-01')).toBe(31)
    expect(diasDelMes('2026-04')).toBe(30)
    expect(diasDelMes('2026-02')).toBe(28)
  })

  it('maneja febrero bisiesto', () => {
    expect(diasDelMes('2028-02')).toBe(29)
    expect(diasDelMes('2000-02')).toBe(29)
    expect(diasDelMes('1900-02')).toBe(28)
  })

  it('rechaza un mes inválido', () => {
    expect(() => diasDelMes('2026-13')).toThrow()
    expect(() => diasDelMes('2026-9')).toThrow()
  })
})

describe('diaActual / hoyISO / mesActual', () => {
  it('usa la zona de Buenos Aires, no UTC', () => {
    const instante = new Date('2026-10-01T02:00:00Z')
    expect(hoyISO(instante)).toBe('2026-09-30')
    expect(diaActual(instante)).toBe(30)
    expect(mesActual(instante)).toBe('2026-09')
  })
})

describe('diaDe', () => {
  it('saca el día del mes', () => {
    expect(diaDe('2026-09-07')).toBe(7)
  })
})

describe('sumarMeses', () => {
  it('avanza y retrocede dentro del año', () => {
    expect(sumarMeses('2026-03', 2)).toBe('2026-05')
    expect(sumarMeses('2026-05', -2)).toBe('2026-03')
  })

  it('cruza el fin de año', () => {
    expect(sumarMeses('2026-01', -1)).toBe('2025-12')
    expect(sumarMeses('2026-12', 1)).toBe('2027-01')
    expect(sumarMeses('2026-01', -13)).toBe('2024-12')
  })

  it('es identidad con 0', () => {
    expect(sumarMeses('2026-07', 0)).toBe('2026-07')
  })
})

describe('mesesAnteriores', () => {
  it('devuelve los n meses previos, del más viejo al más nuevo', () => {
    expect(mesesAnteriores('2026-03', 3)).toEqual(['2025-12', '2026-01', '2026-02'])
  })

  it('no incluye el mes de referencia', () => {
    expect(mesesAnteriores('2026-03', 1)).toEqual(['2026-02'])
    expect(mesesAnteriores('2026-03', 0)).toEqual([])
  })
})

describe('nombreMes', () => {
  it('arma el nombre legible', () => {
    expect(nombreMes('2026-09')).toBe('Septiembre 2026')
    expect(nombreMes('2026-01')).toBe('Enero 2026')
    expect(nombreMes('2026-12')).toBe('Diciembre 2026')
  })
})
