import { describe, it, expect } from 'vitest'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import { lineaDeMovimiento, medioDePago } from './lineaMovimiento'

function mov(p: Partial<MovimientoDetalle> = {}): MovimientoDetalle {
  return {
    id: '00000000-0000-4000-8000-000000000001',
    fecha: '2026-11-12',
    comercioId: '00000000-0000-4000-8000-000000000002',
    importeCentavos: 100_000,
    formaPago: 'tarjeta_credito',
    banco: null,
    tarjeta: null,
    nota: null,
    comercio: 'Coto',
    categoria: 'Supermercado',
    subcategoria: 'Almacén',
    esFijo: false,
    tarjetaId: '00000000-0000-4000-8000-0000000000a1',
    tarjetaNombre: 'Santander Visa',
    tarjetaRed: 'visa',
    ...p,
  }
}

describe('medioDePago', () => {
  it('la tarjeta reemplaza a "Tarjeta crédito"', () => {
    expect(medioDePago(mov())).toBe('Santander Visa')
  })

  it('el débito automático lo aclara', () => {
    expect(medioDePago(mov({ formaPago: 'debito_automatico' }))).toBe('Santander Visa · déb. aut.')
  })

  it('sin tarjeta, la forma de pago', () => {
    expect(medioDePago(mov({ formaPago: 'efectivo', tarjetaId: null, tarjetaNombre: null }))).toBe('Efectivo')
    expect(medioDePago(mov({ tarjetaNombre: undefined }))).toBe('Tarjeta crédito')
  })
})

describe('lineaDeMovimiento', () => {
  it('categoría, medio y red, sin subcategoría', () => {
    expect(lineaDeMovimiento(mov())).toEqual({
      inicio: 'Supermercado',
      medio: 'Santander Visa',
      red: 'visa',
    })
  })

  it('con fecha adelante, para el buscador', () => {
    expect(lineaDeMovimiento(mov(), { conFecha: true }).inicio).toBe('12/11/26 · Supermercado')
  })

  it('sin tarjeta no hay logo, aunque quede una red colgada', () => {
    const efectivo = mov({ formaPago: 'efectivo', tarjetaId: null, tarjetaNombre: null })
    expect(lineaDeMovimiento(efectivo)).toEqual({ inicio: 'Supermercado', medio: 'Efectivo', red: null })
  })

  it('una tarjeta sin red se muestra sin logo', () => {
    expect(lineaDeMovimiento(mov({ tarjetaRed: null })).red).toBeNull()
  })
})
