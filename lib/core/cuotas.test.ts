import { describe, it, expect } from 'vitest'
import type { CompraCuotasDetalle } from '@/lib/schemas/compraCuotas'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import {
  esCuota,
  numeroDeCuota,
  totalPlan,
  mesFinal,
  cuotasTranscurridas,
  puedeReducirA,
  fechaDeCuota,
  cuotasEntre,
  cuotasDelMes,
  planesActivos,
  proximosMeses,
  resumenPlan,
  rutaDeMovimiento,
} from './cuotas'

const ID = {
  a: '00000000-0000-4000-8000-000000000001',
  b: '00000000-0000-4000-8000-000000000002',
  comercio: '00000000-0000-4000-8000-000000000010',
  coto: '00000000-0000-4000-8000-000000000020',
}

// Fixtures inventados: ids fijos, números redondos, nombres genéricos.
function compra(p: Partial<CompraCuotasDetalle> = {}): CompraCuotasDetalle {
  return {
    id: ID.a,
    fecha: '2026-11-03',
    comercioId: ID.comercio,
    importeCuotaCentavos: 48_500,
    cuotas: 12,
    formaPago: 'tarjeta_credito',
    banco: null,
    tarjeta: null,
    nota: null,
    comercio: 'Asistencia',
    categoria: 'Seguros',
    subcategoria: null,
    esFijo: false,
    ...p,
  }
}

function mov(p: Partial<MovimientoDetalle> = {}): MovimientoDetalle {
  return {
    id: '00000000-0000-4000-8000-000000000099',
    fecha: '2026-11-05',
    comercioId: ID.coto,
    importeCentavos: 100_000,
    formaPago: 'tarjeta_credito',
    banco: 'Galicia',
    tarjeta: 'Visa',
    nota: null,
    comercio: 'Coto',
    categoria: 'Supermercado',
    subcategoria: null,
    esFijo: false,
    ...p,
  }
}

describe('numeroDeCuota', () => {
  it('la cuota 1 es la del mes de la compra', () => {
    expect(numeroDeCuota(compra(), '2026-11')).toBe(1)
  })
  it('avanza un número por mes y llega hasta la última', () => {
    expect(numeroDeCuota(compra(), '2027-06')).toBe(8)
    expect(numeroDeCuota(compra(), '2027-10')).toBe(12)
  })
  it('no hay cuota antes del mes de la compra', () => {
    expect(numeroDeCuota(compra(), '2026-10')).toBeNull()
    expect(numeroDeCuota(compra(), '2020-01')).toBeNull()
  })
  it('no hay cuota después de la última', () => {
    expect(numeroDeCuota(compra(), '2027-11')).toBeNull()
  })
})

describe('fechaDeCuota', () => {
  it('mantiene el día de la compra', () => {
    expect(fechaDeCuota(compra(), '2027-06')).toBe('2027-06-03')
  })
  it('recorta el día a los que tiene el mes destino', () => {
    const c = compra({ fecha: '2026-01-31', cuotas: 3 })
    expect(fechaDeCuota(c, '2026-02')).toBe('2026-02-28')
    expect(fechaDeCuota(c, '2026-03')).toBe('2026-03-31')
  })
})

describe('cuotasDelMes', () => {
  it('materializa la cuota como un movimiento con la marca', () => {
    const [c] = cuotasDelMes([compra()], '2027-06')
    expect(c.importeCentavos).toBe(48_500)
    expect(c.comercio).toBe('Asistencia') // viene del comercio de la compra
    expect(c.formaPago).toBe('tarjeta_credito')
    expect(c.cuota).toEqual({ compraId: c.cuota.compraId, numero: 8, total: 12 })
    expect(esCuota(c)).toBe(true)
  })
  it('da ids distintos a dos compras del mismo comercio en el mismo mes', () => {
    const dos = cuotasDelMes([compra({ id: ID.a }), compra({ id: ID.b })], '2026-11')
    expect(new Set(dos.map((c) => c.id)).size).toBe(2)
  })
  it('una lista vacía de compras no produce cuotas', () => {
    expect(cuotasDelMes([], '2026-11')).toEqual([])
  })
})

describe('cuotasEntre', () => {
  it('trae una cuota por mes del rango, y nada fuera', () => {
    const cs = cuotasEntre([compra()], '2026-09', '2027-01')
    expect(cs.map((c) => c.cuota.numero)).toEqual([1, 2, 3])
  })
  it('un plan terminado sigue dando sus cuotas pasadas y ninguna después', () => {
    const viejo = compra({ fecha: '2025-01-10', cuotas: 6 })
    expect(cuotasEntre([viejo], '2025-01', '2026-11')).toHaveLength(6)
    expect(cuotasDelMes([viejo], '2026-11')).toEqual([])
  })
})

describe('cuotasTranscurridas', () => {
  it('cuenta el mes actual como transcurrido', () => {
    expect(cuotasTranscurridas(compra(), '2026-11')).toBe(1)
    expect(cuotasTranscurridas(compra(), '2027-03')).toBe(5)
  })
  it('es 0 antes de la compra y nunca pasa del total', () => {
    expect(cuotasTranscurridas(compra(), '2026-10')).toBe(0)
    expect(cuotasTranscurridas(compra(), '2030-01')).toBe(12)
  })
})

describe('puedeReducirA', () => {
  it('deja bajar hasta las cuotas ya transcurridas, no por debajo', () => {
    const c = compra({ fecha: '2026-11-03', cuotas: 12 })
    expect(cuotasTranscurridas(c, '2027-03')).toBe(5)
    expect(puedeReducirA(c, 5, '2027-03')).toBe(true)
    expect(puedeReducirA(c, 4, '2027-03')).toBe(false) // borraría dos meses cerrados
  })
  it('deja subirlas siempre', () => {
    expect(puedeReducirA(compra(), 18, '2027-03')).toBe(true)
  })
})

describe('planesActivos', () => {
  it('deja afuera los planes terminados y trae lo que falta de los vivos', () => {
    const vivo = compra()
    const terminado = compra({ id: ID.b, fecha: '2025-01-10', cuotas: 6 })
    const [p] = planesActivos([vivo, terminado], '2026-11')
    expect(p.compra.id).toBe(vivo.id)
    expect(p).toMatchObject({ numero: 1, importe: 48_500, restantes: 11, faltaPagar: 533_500, mesFinal: '2027-10' })
  })
})

describe('proximosMeses', () => {
  it('suma lo comprometido mes a mes e incluye el mes de arranque', () => {
    const a = compra() // 12 × 48.500 desde 2026-11
    const b = compra({ id: ID.b, fecha: '2026-11-20', cuotas: 2, importeCuotaCentavos: 100_000 })
    expect(proximosMeses([a, b], '2026-11', 3)).toEqual([
      { mes: '2026-11', total: 148_500, planes: 2 },
      { mes: '2026-12', total: 148_500, planes: 2 },
      { mes: '2027-01', total: 48_500, planes: 1 },
    ])
  })
  it('devuelve los meses igual cuando no hay nada comprometido', () => {
    expect(proximosMeses([], '2026-11', 2)).toEqual([
      { mes: '2026-11', total: 0, planes: 0 },
      { mes: '2026-12', total: 0, planes: 0 },
    ])
  })
})

describe('resumenPlan', () => {
  it('es lo que el formulario muestra antes de guardar', () => {
    expect(resumenPlan(48_500, 12, '2026-11-03')).toEqual({
      total: 582_000, desde: '2026-11', hasta: '2027-10',
    })
  })
})

describe('totalPlan y mesFinal', () => {
  it('derivan el total y el último mes de la cuota y la cantidad', () => {
    expect(totalPlan(compra())).toBe(582_000)
    expect(mesFinal(compra())).toBe('2027-10')
  })
})

describe('esCuota', () => {
  it('un movimiento real no es una cuota', () => {
    expect(esCuota(mov())).toBe(false)
  })
})

describe('rutaDeMovimiento', () => {
  it('un movimiento real navega a su propia pantalla', () => {
    const m = mov()
    expect(rutaDeMovimiento(m)).toBe(`/movimiento/${m.id}`)
  })
  it('una cuota navega a la compra que la generó, no a /movimiento/[id]', () => {
    const [c] = cuotasDelMes([compra()], '2026-11')
    expect(rutaDeMovimiento(c)).toBe(`/compra/${ID.a}`)
  })
})
