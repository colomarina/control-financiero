import { describe, it, expect } from 'vitest'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import type { GastoFijoDetalle } from '@/lib/schemas/gastoFijo'
import type { Tarjeta } from '@/lib/schemas/tarjeta'
import type { Cuota } from './cuotas'
import { metaDelMes, comerciosParaPasar } from './meta'

const T = {
  visa: '00000000-0000-4000-8000-0000000000a1',
  amex: '00000000-0000-4000-8000-0000000000a2',
  mp: '00000000-0000-4000-8000-0000000000a3',
}
const tarjetas: Tarjeta[] = [
  { id: T.visa, nombre: 'Santander Visa', banco: 'Santander', red: null, sumaMeta: true, activa: true },
  { id: T.amex, nombre: 'Santander Amex', banco: 'Santander', red: null, sumaMeta: true, activa: true },
  { id: T.mp, nombre: 'Mercado Pago Crédito', banco: 'Mercado Pago', red: null, sumaMeta: false, activa: true },
]
const C = {
  coto: '00000000-0000-4000-8000-000000000001',
  carniceria: '00000000-0000-4000-8000-000000000002',
  netflix: '00000000-0000-4000-8000-000000000003',
}

let n = 0
function mov(p: Partial<MovimientoDetalle> = {}): MovimientoDetalle {
  n += 1
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    fecha: '2026-11-05',
    comercioId: C.coto,
    importeCentavos: 100_000,
    formaPago: 'tarjeta_credito',
    banco: null,
    tarjeta: null,
    nota: null,
    comercio: 'Coto',
    categoria: 'Supermercado',
    subcategoria: null,
    esFijo: false,
    tarjetaId: T.visa,
    ...p,
  }
}

/** Diez compras de $3.000 con Visa en cada mes del histórico (ago–oct). */
const historico = ['2026-08', '2026-09', '2026-10'].flatMap((m) =>
  Array.from({ length: 10 }, (_, i) =>
    mov({ fecha: `${m}-${String(i * 2 + 1).padStart(2, '0')}`, importeCentavos: 300_000 }),
  ),
)
/** Diez compras de $1.000 con Visa en los primeros diez días de noviembre. */
const noviembre = Array.from({ length: 10 }, (_, i) =>
  mov({ fecha: `2026-11-${String(i + 1).padStart(2, '0')}` }),
)

const base = {
  movsReales: [...historico, ...noviembre],
  cuotasMes: [] as Cuota[],
  fijos: [] as GastoFijoDetalle[],
  tarjetas,
  mes: '2026-11',
  diaActual: 10,
  mesesHistorico: 3,
  minimo: 2_000_000,
  colchon: 0,
  diaCierre: 24,
}

describe('metaDelMes', () => {
  it('sin mínimo o sin tarjetas que sumen, no hay meta', () => {
    expect(metaDelMes({ ...base, minimo: 0 })).toBeNull()
    expect(metaDelMes({ ...base, tarjetas: [tarjetas[2]] })).toBeNull()
  })

  it('suman solo las tarjetas de la meta: ni Mercado Pago ni el efectivo', () => {
    const meta = metaDelMes({
      ...base,
      movsReales: [
        ...noviembre,
        mov({ importeCentavos: 5_000_000, tarjetaId: T.mp }),
        mov({ importeCentavos: 5_000_000, formaPago: 'efectivo', tarjetaId: null }),
        mov({ importeCentavos: 50_000, tarjetaId: T.amex }),
      ],
    })!
    expect(meta.gastado).toBe(1_050_000)
  })

  it('las cuotas de la tarjeta suman', () => {
    const cuota = {
      ...mov({ importeCentavos: 400_000 }),
      cuota: { compraId: 'x', numero: 1, total: 6 },
    } as Cuota
    expect(metaDelMes({ ...base, cuotasMes: [cuota] })!.gastado).toBe(1_400_000)
  })

  it('cumplida cuando lo gastado alcanza mínimo + colchón', () => {
    const meta = metaDelMes({ ...base, minimo: 900_000, colchon: 100_000 })!
    expect(meta.estado).toBe('cumplida')
    expect(meta.objetivo).toBe(1_000_000)
  })

  it('el colchón corre la vara: sin él estaría cumplida, con él no', () => {
    expect(metaDelMes({ ...base, minimo: 1_000_000 })!.estado).toBe('cumplida')
    expect(metaDelMes({ ...base, minimo: 1_000_000, colchon: 50_000 })!.estado).not.toBe('cumplida')
  })

  it('cubierta cuando los débitos automáticos que faltan completan el mínimo', () => {
    const fijo: GastoFijoDetalle = {
      id: '00000000-0000-4000-8000-000000000099',
      comercioId: C.netflix,
      estimadoCentavos: 1_200_000,
      pagosEsperados: 1,
      vencimiento: null,
      activo: true,
      comercio: 'Netflix',
    }
    // Netflix se pagó con Visa en octubre: el de noviembre va a caer ahí.
    const netflixOct = mov({
      fecha: '2026-10-10', comercioId: C.netflix, comercio: 'Netflix',
      formaPago: 'debito_automatico', importeCentavos: 1_200_000,
    })
    const meta = metaDelMes({
      ...base,
      movsReales: [...base.movsReales, netflixOct],
      fijos: [fijo],
    })!
    expect(meta.comprometido).toBe(2_200_000)
    expect(meta.estado).toBe('cubierta')
  })

  it('un fijo que se paga con otra tarjeta no suma a la meta', () => {
    const fijo: GastoFijoDetalle = {
      id: '00000000-0000-4000-8000-000000000098', comercioId: C.netflix,
      estimadoCentavos: 1_200_000, pagosEsperados: 1, vencimiento: null, activo: true,
      comercio: 'Netflix',
    }
    const netflixMp = mov({
      fecha: '2026-10-10', comercioId: C.netflix, comercio: 'Netflix',
      formaPago: 'debito_automatico', tarjetaId: T.mp,
    })
    const meta = metaDelMes({ ...base, movsReales: [...base.movsReales, netflixMp], fijos: [fijo] })!
    expect(meta.comprometido).toBe(1_000_000)
  })

  it('urgente a pocos días del cierre si no se llega', () => {
    const meta = metaDelMes({ ...base, minimo: 5_000_000, diaActual: 22 })!
    expect(meta.estado).toBe('urgente')
    expect(meta.diasAlCierre).toBe(2)
    expect(meta.titulo).toBe('Cierra en 2 días y faltan $40.000')
    expect(meta.detalle).toBe('Lo que pagues estos días, pagalo con Santander.')
  })

  it('temprano: sin histórico y a principio de mes no se proyecta', () => {
    const meta = metaDelMes({
      ...base,
      movsReales: noviembre.slice(0, 3),
      diaActual: 3,
    })!
    expect(meta.estado).toBe('temprano')
    expect(meta.cierreEstimado).toBeNull()
  })

  it('en camino cuando al ritmo actual se llega', () => {
    // Ritmo ~$1.000/día: cierra en ~$3.000 y el mínimo es $2.000.
    const meta = metaDelMes(base)!
    expect(meta.estado).toBe('en-camino')
    expect(meta.cierreEstimado).toBeGreaterThan(2_000_000)
  })

  it('no llega: sugiere pasar a la tarjeta lo que se paga en efectivo', () => {
    const carne = ['2026-08', '2026-09', '2026-10'].map((m) =>
      mov({
        fecha: `${m}-15`, comercioId: C.carniceria, comercio: 'Carnicería',
        formaPago: 'efectivo', tarjetaId: null, importeCentavos: 6_000_000,
      }),
    )
    const meta = metaDelMes({
      ...base,
      movsReales: [...base.movsReales, ...carne],
      minimo: 5_000_000,
    })!
    expect(meta.estado).toBe('no-llega')
    expect(meta.sugerencias).toEqual([{ comercio: 'Carnicería', promedioMensual: 6_000_000 }])
    expect(meta.detalle).toContain('Pasá a Santander lo que solés pagar en efectivo: Carnicería (~$60.000)')
    // Nunca sugiere otra tarjeta ni comprar algo nuevo.
    expect(meta.detalle).not.toMatch(/Mercado Pago|comprá/i)
  })
})

describe('comerciosParaPasar', () => {
  it('promedia por mes lo pagado en efectivo o transferencia, de mayor a menor', () => {
    const movs = [
      mov({ fecha: '2026-09-01', comercio: 'Verdulería', formaPago: 'transferencia', importeCentavos: 300 }),
      mov({ fecha: '2026-10-01', comercio: 'Carnicería', formaPago: 'efectivo', importeCentavos: 900 }),
      mov({ fecha: '2026-10-02', comercio: 'Coto', importeCentavos: 99_999 }),
    ]
    expect(comerciosParaPasar(movs, '2026-11', 3)).toEqual([
      { comercio: 'Carnicería', promedioMensual: 300 },
      { comercio: 'Verdulería', promedioMensual: 100 },
    ])
  })
})
