import { describe, it, expect } from 'vitest'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import type { GastoFijoDetalle } from '@/lib/schemas/gastoFijo'
import { diasDelMes } from './fechas'
import { esCuota } from './cuotas'
import {
  DIAS_PUNTUAL,
  comerciosConFijo,
  esVariable,
  esPuntual,
  perfilHistorico,
  desgloseMes,
  umbralesPuntual,
} from './puntuales'

let n = 0
function mov(p: Partial<MovimientoDetalle> = {}): MovimientoDetalle {
  n += 1
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    fecha: '2026-09-15',
    comercioId: '00000000-0000-4000-8000-000000000001',
    importeCentavos: 1_000_000,
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

function fijo(p: Partial<GastoFijoDetalle> = {}): GastoFijoDetalle {
  return {
    id: '00000000-0000-4000-8000-0000000000f1',
    comercioId: '00000000-0000-4000-8000-0000000000aa',
    activo: true,
    ...p,
  } as GastoFijoDetalle
}

const MESES = ['2026-08', '2026-09', '2026-10']
const NINGUNO: ReadonlySet<string> = new Set()

function base(): MovimientoDetalle[] {
  return MESES.flatMap((mes) =>
    Array.from({ length: 30 }, () => mov({ fecha: `${mes}-10` })),
  )
}

const bruto = (mes: string) => 30_000_000 / diasDelMes(mes)
const mediana = () => {
  const v = MESES.map(bruto).sort((a, b) => a - b)
  return v[1]
}

describe('comerciosConFijo / esVariable', () => {
  it('solo cuenta fijos activos', () => {
    const s = comerciosConFijo([
      fijo({ comercioId: 'a' }),
      fijo({ comercioId: 'b', activo: false }),
    ])
    expect([...s]).toEqual(['a'])
  })

  it('excluye cuotas, comercios es_fijo, comercios con gasto fijo y el otro tope', () => {
    const conFijo = new Set(['00000000-0000-4000-8000-0000000000aa'])
    expect(esVariable(mov(), conFijo, 'tarjeta')).toBe(true)
    expect(esVariable(mov(), conFijo, 'efectivo')).toBe(false)
    expect(esVariable(mov({ esFijo: true }), conFijo, 'tarjeta')).toBe(false)
    expect(
      esVariable(
        mov({ comercioId: '00000000-0000-4000-8000-0000000000aa' }),
        conFijo,
        'tarjeta',
      ),
    ).toBe(false)
    const cuota = mov({ cuota: { compraId: 'x', numero: 1, total: 3 } } as never)
    expect(esCuota(cuota)).toBe(true)
    expect(esVariable(cuota, conFijo, 'tarjeta')).toBe(false)
  })
})

describe('esPuntual', () => {
  it('la marca manual manda en los dos sentidos', () => {
    expect(esPuntual(mov({ importeCentavos: 900_000_000, puntual: false }), 1000)).toBe(false)
    expect(esPuntual(mov({ importeCentavos: 10, puntual: true }), 1000)).toBe(true)
    expect(esPuntual(mov({ importeCentavos: 2000 }), 1000)).toBe(true)
    expect(esPuntual(mov({ importeCentavos: 2000 }), null)).toBe(false)
  })
})

describe('perfilHistorico', () => {
  it('el umbral es 5 días del ritmo bruto mediano', () => {
    const p = perfilHistorico(base(), '2026-11', 3, 'tarjeta', NINGUNO)
    expect(p.meses).toBe(3)
    expect(p.umbral).toBeCloseTo(DIAS_PUNTUAL * mediana(), 6)
    expect(p.puntualesPorMes).toBe(0)
  })

  it('una compra gigante en un solo mes no mueve el umbral', () => {
    const sin = perfilHistorico(base(), '2026-11', 3, 'tarjeta', NINGUNO)
    const con = perfilHistorico(
      [...base(), mov({ fecha: '2026-09-20', importeCentavos: 400_000_000 })],
      '2026-11', 3, 'tarjeta', NINGUNO,
    )
    expect(con.umbral).toBeCloseTo(sin.umbral!, 6)
  })

  it('la compra gigante va a puntualesPorMes, no al ritmo', () => {
    const sin = perfilHistorico(base(), '2026-11', 3, 'tarjeta', NINGUNO)
    const con = perfilHistorico(
      [...base(), mov({ fecha: '2026-09-20', importeCentavos: 400_000_000 })],
      '2026-11', 3, 'tarjeta', NINGUNO,
    )
    expect(con.ritmoDiario).toBeCloseTo(sin.ritmoDiario, 6)
    expect(con.puntualesPorMes).toBeCloseTo(400_000_000 / 3, 6)
  })

  it('la marca manual false sobre un monto enorme lo manda al ritmo', () => {
    const sin = perfilHistorico(base(), '2026-11', 3, 'tarjeta', NINGUNO)
    const con = perfilHistorico(
      [...base(), mov({ fecha: '2026-09-20', importeCentavos: 400_000_000, puntual: false })],
      '2026-11', 3, 'tarjeta', NINGUNO,
    )
    expect(con.puntualesPorMes).toBe(0)
    expect(con.ritmoDiario).toBeGreaterThan(sin.ritmoDiario)
  })

  it('la marca manual true sobre uno chico lo cuenta como puntual', () => {
    const p = perfilHistorico(
      [...base(), mov({ fecha: '2026-09-20', importeCentavos: 100, puntual: true })],
      '2026-11', 3, 'tarjeta', NINGUNO,
    )
    expect(p.puntualesPorMes).toBeCloseTo(100 / 3, 6)
  })

  it('un comercio con gasto fijo activo pero es_fijo=false no es puntual aunque sea grande', () => {
    const cid = '00000000-0000-4000-8000-0000000000aa'
    const conFijo = comerciosConFijo([fijo({ comercioId: cid })])
    const sin = perfilHistorico(base(), '2026-11', 3, 'tarjeta', conFijo)
    const con = perfilHistorico(
      [...base(), mov({ fecha: '2026-09-20', comercioId: cid, importeCentavos: 400_000_000, esFijo: false })],
      '2026-11', 3, 'tarjeta', conFijo,
    )
    expect(con.puntualesPorMes).toBe(0)
    expect(con.ritmoDiario).toBeCloseTo(sin.ritmoDiario, 6)
    expect(con.umbral).toBeCloseTo(sin.umbral!, 6)
  })

  it('sin meses con datos: meses 0 y umbral null', () => {
    expect(perfilHistorico([], '2026-11', 3, 'tarjeta', NINGUNO)).toEqual({
      meses: 0, ritmoDiario: 0, puntualesPorMes: 0, umbral: null,
    })
    // datos solo del otro tope
    const p = perfilHistorico(base(), '2026-11', 3, 'efectivo', NINGUNO)
    expect(p.meses).toBe(0)
    expect(p.umbral).toBeNull()
  })
})

describe('umbralesPuntual', () => {
  it('devuelve null (no Infinity) sin histórico', () => {
    const u = umbralesPuntual([], [], '2026-11', 3)
    expect(u).toEqual({ tarjeta: null, efectivo: null })
    expect(JSON.parse(JSON.stringify(u))).toEqual(u)
  })

  it('calcula un umbral por tope', () => {
    const u = umbralesPuntual(base(), [], '2026-11', 3)
    expect(u.tarjeta).toBeCloseTo(DIAS_PUNTUAL * mediana(), 6)
    expect(u.efectivo).toBeNull()
  })
})

describe('desgloseMes', () => {
  it('separa variable y puntuales del mes en curso', () => {
    const grande = mov({ fecha: '2026-11-05', importeCentavos: 50_000_000 })
    const movs = [
      mov({ fecha: '2026-11-02' }),
      mov({ fecha: '2026-11-03' }),
      grande,
      mov({ fecha: '2026-11-04', formaPago: 'efectivo' }),
      mov({ fecha: '2026-10-04' }),
    ]
    const d = desgloseMes(movs, '2026-11', 'tarjeta', NINGUNO, 10_000_000)
    expect(d.variable).toBe(2_000_000)
    expect(d.puntuales).toEqual([grande])
    expect(d.totalPuntuales).toBe(50_000_000)
  })
})
