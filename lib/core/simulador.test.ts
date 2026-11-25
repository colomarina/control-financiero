import { describe, it, expect } from 'vitest'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import type { Tarjeta } from '@/lib/schemas/tarjeta'
import type { LineaPresupuestoDetalle } from '@/lib/schemas/presupuesto'
import { simularGasto, parsearMedio, valorDeMedio, type Medio } from './simulador'

const T = {
  visa: '00000000-0000-4000-8000-0000000000a1',
  mp: '00000000-0000-4000-8000-0000000000a3',
}
const tarjetas: Tarjeta[] = [
  { id: T.visa, nombre: 'Santander Visa', banco: 'Santander', red: 'visa', sumaMeta: true, activa: true },
  { id: T.mp, nombre: 'Mercado Pago Crédito', banco: 'Mercado Pago', red: 'mastercard', sumaMeta: false, activa: true },
]
const C = {
  coto: '00000000-0000-4000-8000-000000000001',
  resto: '00000000-0000-4000-8000-000000000002',
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

/** Histórico: $3.000/mes con Visa en ago–oct. Noviembre: $1.000 en 10 días. */
const historico = ['2026-08', '2026-09', '2026-10'].flatMap((m) =>
  Array.from({ length: 10 }, (_, i) =>
    mov({ fecha: `${m}-${String(i * 2 + 1).padStart(2, '0')}`, importeCentavos: 300_000 }),
  ),
)
const noviembre = Array.from({ length: 10 }, (_, i) =>
  mov({ fecha: `2026-11-${String(i + 1).padStart(2, '0')}` }),
)

const plan: LineaPresupuestoDetalle[] = [
  { id: 'p1', mes: '2026-11', comercioId: C.resto, comercio: 'Restaurante', planeadoCentavos: 1_000_000 },
]

const visa: Medio = { tipo: 'tarjeta', tarjetaId: T.visa }
const efectivo: Medio = { tipo: 'forma', formaPago: 'efectivo' }

const base = {
  movsReales: [...historico, ...noviembre],
  cuotasMes: [],
  fijos: [],
  tarjetas,
  plan,
  mes: '2026-11',
  hoy: '2026-11-10',
  diaActual: 10,
  config: {
    topeTarjetaCentavos: 5_000_000,
    topeEfectivoCentavos: 5_000_000,
    umbralCercaPct: 85,
    mesesHistorico: 3,
    metaMinimoCentavos: 0,
    metaColchonCentavos: 0,
    metaDiaCierre: 24,
  },
}

describe('simularGasto: veredicto', () => {
  it('sí: entra en el tope y el cierre sigue debajo', () => {
    const r = simularGasto({ ...base, monto: 500_000, medio: visa })
    expect(r.veredicto).toBe('si')
    expect(r.motivos[0].texto).toMatch(/^Te quedan \$40\.000\. Después de esto, \$35\.000 para 21 días/)
  })

  it('justo: entra hoy, pero el cierre se pasa del tope', () => {
    const r = simularGasto({ ...base, monto: 2_500_000, medio: visa })
    expect(r.veredicto).toBe('justo')
  })

  it('no: el monto supera lo que queda del tope', () => {
    const r = simularGasto({ ...base, monto: 4_500_000, medio: visa })
    expect(r.veredicto).toBe('no')
    expect(r.motivos[0].texto).toBe('Te quedan $40.000: con este gasto te pasás $5.000 del tope.')
  })

  it('entra como puntual: el cierre sube lo gastado, no lo multiplica por los días', () => {
    const r = simularGasto({ ...base, monto: 1_000_000, medio: visa })
    const texto = r.motivos.find((m) => m.tema === 'Cierre estimado')!.texto
    const [antes, despues] = [...texto.matchAll(/\$([\d.]+)/g)].map((x) => Number(x[1].replace(/\./g, '')))
    expect(despues - antes).toBe(10_000)
  })

  it('el efectivo se mide contra su tope', () => {
    const r = simularGasto({ ...base, monto: 100_000, medio: efectivo })
    expect(r.motivos[0]).toMatchObject({ tema: 'Tope efectivo' })
    expect(r.motivos[0].texto).toMatch(/^Te quedan \$50\.000/)
  })
})

describe('simularGasto: presupuesto y meta', () => {
  it('presupuesto: cuánto queda en la línea del comercio', () => {
    const r = simularGasto({ ...base, monto: 500_000, medio: visa, comercioId: C.resto })
    expect(r.motivos).toContainEqual({ tono: 'ok', tema: 'Presupuesto Restaurante', texto: 'Quedan $10.000; después, $5.000.' })
  })

  it('presupuesto: avisa si la línea se pasa', () => {
    const r = simularGasto({ ...base, monto: 1_500_000, medio: visa, comercioId: C.resto })
    expect(r.motivos.find((m) => m.tema === 'Presupuesto Restaurante')!.tono).toBe('atencion')
  })

  it('meta: con Santander dice cuánto faltaría', () => {
    const r = simularGasto({ ...base, monto: 500_000, medio: visa, config: { ...base.config, metaMinimoCentavos: 2_000_000 } })
    expect(r.motivos).toContainEqual({ tono: 'ok', tema: 'Meta Santander', texto: 'Además te suma: faltarían $5.000.' })
  })

  it('meta: en efectivo y sin llegar, sugiere Santander', () => {
    const r = simularGasto({ ...base, monto: 100_000, medio: efectivo, config: { ...base.config, metaMinimoCentavos: 5_000_000 } })
    expect(r.motivos.find((m) => m.tema === 'Meta Santander')!.texto).toMatch(/^Si lo pagás con Santander/)
  })
})

describe('parsearMedio', () => {
  it('ida y vuelta, y rechaza lo desconocido', () => {
    expect(parsearMedio(valorDeMedio(visa), tarjetas)).toEqual(visa)
    expect(parsearMedio(valorDeMedio(efectivo), tarjetas)).toEqual(efectivo)
    expect(parsearMedio('tarjeta:otra', tarjetas)).toBeNull()
    expect(parsearMedio('tarjeta_credito', tarjetas)).toBeNull()
  })
})
