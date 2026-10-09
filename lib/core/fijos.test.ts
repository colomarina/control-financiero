import { describe, it, expect } from 'vitest'
import type { GastoFijoDetalle } from '@/lib/schemas/gastoFijo'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import { checklistFijos, fijosPendientes, fijosYaPagados, contadorFijos } from './fijos'

const ID = {
  osde: '00000000-0000-4000-8000-000000000001',
  netflix: '00000000-0000-4000-8000-000000000002',
  edelap: '00000000-0000-4000-8000-000000000003',
  coto: '00000000-0000-4000-8000-000000000009',
}

// Importes reales de la hoja "Gastos Fijos" del Excel.
const fijos: GastoFijoDetalle[] = [
  { id: '00000000-0000-4000-8000-0000000000f1', comercioId: ID.osde, comercio: 'OSDE', estimadoCentavos: 56_999_500, vencimiento: 'Día 5', activo: true },
  { id: '00000000-0000-4000-8000-0000000000f2', comercioId: ID.netflix, comercio: 'Netflix', estimadoCentavos: 1_680_000, vencimiento: 'Día 8', activo: true },
  { id: '00000000-0000-4000-8000-0000000000f3', comercioId: ID.edelap, comercio: 'EDELAP', estimadoCentavos: 6_958_800, vencimiento: 'Día 5', activo: true },
]

let n = 0
function mov(p: Partial<MovimientoDetalle> = {}): MovimientoDetalle {
  n += 1
  return {
    id: `00000000-0000-4000-8000-${String(100 + n).padStart(12, '0')}`,
    fecha: '2026-09-05',
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

const movs: MovimientoDetalle[] = [
  // OSDE pagado completo, con débito automático (pesa contra el tope de tarjeta).
  mov({ comercioId: ID.osde, comercio: 'OSDE', importeCentavos: 56_999_500, formaPago: 'debito_automatico', esFijo: true }),
  // Netflix pagado a medias.
  mov({ comercioId: ID.netflix, comercio: 'Netflix', importeCentavos: 1_000_000, formaPago: 'debito_automatico', esFijo: true }),
  // EDELAP: nada este mes.
  // Un gasto suelto que no es fijo.
  mov({ comercioId: ID.coto, importeCentavos: 500_000 }),
  // Mes anterior: no cuenta.
  mov({ fecha: '2026-08-05', comercioId: ID.edelap, comercio: 'EDELAP', importeCentavos: 6_958_800, esFijo: true }),
]

describe('checklistFijos', () => {
  it('deriva el estado de los movimientos del mes, sin tildes manuales', () => {
    expect(checklistFijos(fijos, movs, '2026-09').map((f) => [f.comercio, f.estado])).toEqual([
      ['OSDE', 'pagado'],
      ['Netflix', 'parcial'],
      ['EDELAP', 'pendiente'],
    ])
  })

  it('trae los ids para que la UI no busque por nombre', () => {
    const [osde] = checklistFijos(fijos, movs, '2026-09')
    expect(osde.gastoFijoId).toBe(fijos[0].id)
    expect(osde.comercioId).toBe(ID.osde)
  })

  it('calcula lo pagado y lo que falta', () => {
    const [osde, netflix, edelap] = checklistFijos(fijos, movs, '2026-09')
    expect(osde).toMatchObject({ pagado: 56_999_500, falta: 0 })
    expect(netflix).toMatchObject({ pagado: 1_000_000, falta: 680_000 })
    expect(edelap).toMatchObject({ pagado: 0, falta: 6_958_800 })
  })

  it('no arrastra lo pagado en otro mes', () => {
    const edelap = checklistFijos(fijos, movs, '2026-09').find((f) => f.comercio === 'EDELAP')
    expect(edelap?.estado).toBe('pendiente')
  })

  it('falta nunca es negativo aunque pagues de más', () => {
    const dems = [...movs, mov({ comercioId: ID.edelap, comercio: 'EDELAP', importeCentavos: 99_999_999 })]
    const edelap = checklistFijos(fijos, dems, '2026-09').find((f) => f.comercio === 'EDELAP')
    expect(edelap?.falta).toBe(0)
    expect(edelap?.estado).toBe('pagado')
  })

  it('ignora los fijos dados de baja', () => {
    const conBaja = [...fijos, {
      id: '00000000-0000-4000-8000-000000000099', comercioId: ID.coto, comercio: 'Viejo',
      estimadoCentavos: 500_000, vencimiento: null, activo: false,
    }]
    expect(checklistFijos(conBaja, movs, '2026-09')).toHaveLength(3)
  })

  it('con un mes vacío todo queda pendiente', () => {
    const filas = checklistFijos(fijos, [], '2026-09')
    expect(filas.every((f) => f.estado === 'pendiente')).toBe(true)
  })
})

describe('fijosPendientes', () => {
  it('suma lo que falta de cada fijo', () => {
    expect(fijosPendientes(fijos, movs, '2026-09')).toBe(680_000 + 6_958_800)
  })

  it('sin movimientos es el total estimado', () => {
    expect(fijosPendientes(fijos, [], '2026-09'))
      .toBe(56_999_500 + 1_680_000 + 6_958_800)
  })
})

describe('fijosYaPagados', () => {
  it('cuenta solo lo que pesa contra el tope pedido', () => {
    // OSDE y Netflix fueron por débito automático -> tope tarjeta
    expect(fijosYaPagados(fijos, movs, '2026-09', 'tarjeta')).toBe(56_999_500 + 1_000_000)
    expect(fijosYaPagados(fijos, movs, '2026-09', 'efectivo')).toBe(0)
  })

  it('no cuenta los movimientos de comercios que no son fijos', () => {
    // El gasto de Coto (500.000) no entra aunque sea del mismo mes y tope.
    expect(fijosYaPagados(fijos, movs, '2026-09', 'tarjeta')).not.toBe(58_499_500)
  })

  it('separa por tope: un fijo pagado por transferencia no ensucia el de tarjeta', () => {
    const conTransfer = [...movs, mov({
      comercioId: ID.edelap, comercio: 'EDELAP',
      importeCentavos: 6_958_800, formaPago: 'transferencia', esFijo: true,
    })]
    expect(fijosYaPagados(fijos, conTransfer, '2026-09', 'tarjeta')).toBe(56_999_500 + 1_000_000)
    expect(fijosYaPagados(fijos, conTransfer, '2026-09', 'efectivo')).toBe(6_958_800)
  })
})

describe('contadorFijos', () => {
  it('cuenta cada estado', () => {
    expect(contadorFijos(fijos, movs, '2026-09'))
      .toEqual({ pagados: 1, parciales: 1, pendientes: 1 })
  })
})
