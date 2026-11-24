import { describe, it, expect } from 'vitest'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import type { Tarjeta } from '@/lib/schemas/tarjeta'
import { usaTarjeta, ultimaTarjetaPorComercio, tarjetaMasUsada, tarjetasParaCargar } from './tarjetas'

const T = {
  visa: '00000000-0000-4000-8000-0000000000a1',
  amex: '00000000-0000-4000-8000-0000000000a2',
  galicia: '00000000-0000-4000-8000-0000000000a3',
}
const tarjetas: Tarjeta[] = [
  { id: T.visa, nombre: 'Santander Visa', banco: 'Santander', red: null, sumaMeta: true, activa: true },
  { id: T.amex, nombre: 'Santander Amex', banco: 'Santander', red: null, sumaMeta: true, activa: true },
  { id: T.galicia, nombre: 'Galicia Visa', banco: 'Galicia', red: null, sumaMeta: false, activa: false },
]

let n = 0
function mov(p: Partial<MovimientoDetalle>): MovimientoDetalle {
  n += 1
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    fecha: '2026-10-01', comercioId: 'c1', importeCentavos: 100, formaPago: 'tarjeta_credito',
    banco: null, tarjeta: null, nota: null, comercio: 'X', categoria: 'Y', subcategoria: null,
    esFijo: false, tarjetaId: null, ...p,
  }
}

describe('usaTarjeta', () => {
  it('crédito y débito automático sí; débito de cuenta, efectivo y transferencia no', () => {
    expect(usaTarjeta('tarjeta_credito')).toBe(true)
    expect(usaTarjeta('debito_automatico')).toBe(true)
    expect(usaTarjeta('tarjeta_debito')).toBe(false)
    expect(usaTarjeta('efectivo')).toBe(false)
    expect(usaTarjeta('transferencia')).toBe(false)
  })
})

describe('ultimaTarjetaPorComercio', () => {
  it('se queda con la más reciente de cada comercio', () => {
    const r = ultimaTarjetaPorComercio([
      mov({ comercioId: 'c1', fecha: '2026-10-01', tarjetaId: T.visa }),
      mov({ comercioId: 'c1', fecha: '2026-10-09', tarjetaId: T.amex }),
      mov({ comercioId: 'c2', fecha: '2026-10-05', tarjetaId: T.visa }),
    ], tarjetas)
    expect(r).toEqual({ c1: T.amex, c2: T.visa })
  })

  it('ignora las tarjetas dadas de baja y los movimientos sin tarjeta', () => {
    const r = ultimaTarjetaPorComercio([
      mov({ comercioId: 'c1', fecha: '2026-07-01', tarjetaId: T.visa }),
      mov({ comercioId: 'c1', fecha: '2026-07-20', tarjetaId: T.galicia }),
      mov({ comercioId: 'c2', fecha: '2026-10-01', tarjetaId: null }),
    ], tarjetas)
    expect(r).toEqual({ c1: T.visa })
  })
})

describe('tarjetaMasUsada', () => {
  it('la activa con más movimientos', () => {
    expect(tarjetaMasUsada([
      mov({ tarjetaId: T.amex }), mov({ tarjetaId: T.amex }), mov({ tarjetaId: T.visa }),
      mov({ tarjetaId: T.galicia }), mov({ tarjetaId: T.galicia }), mov({ tarjetaId: T.galicia }),
    ], tarjetas)).toBe(T.amex)
  })

  it('sin historia devuelve la primera activa; sin activas, null', () => {
    expect(tarjetaMasUsada([], tarjetas)).toBe(T.visa)
    expect(tarjetaMasUsada([], [tarjetas[2]])).toBeNull()
  })
})

describe('tarjetasParaCargar', () => {
  it('las activas, más la del gasto que se edita aunque esté de baja', () => {
    expect(tarjetasParaCargar(tarjetas).map((t) => t.id)).toEqual([T.visa, T.amex])
    expect(tarjetasParaCargar(tarjetas, T.galicia).map((t) => t.id)).toEqual([T.visa, T.amex, T.galicia])
  })
})
