import { describe, it, expect } from 'vitest'
import type { GastoFijoDetalle } from '@/lib/schemas/gastoFijo'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import { checklistFijos, fijosPendientes, fijosYaPagados, contadorFijos } from './fijos'

const ID = {
  prepaga: '00000000-0000-4000-8000-000000000001',
  streaming: '00000000-0000-4000-8000-000000000002',
  luz: '00000000-0000-4000-8000-000000000003',
  coto: '00000000-0000-4000-8000-000000000009',
}

// Fixtures inventados: números redondos y nombres genéricos, para que el test
// se lea solo y no publique cuánto se paga de cada cosa.
const fijos: GastoFijoDetalle[] = [
  { id: '00000000-0000-4000-8000-0000000000f1', comercioId: ID.prepaga, comercio: 'Prepaga', estimadoCentavos: 520_000, vencimiento: 'Día 5', activo: true },
  { id: '00000000-0000-4000-8000-0000000000f2', comercioId: ID.streaming, comercio: 'Streaming', estimadoCentavos: 110_000, vencimiento: 'Día 8', activo: true },
  { id: '00000000-0000-4000-8000-0000000000f3', comercioId: ID.luz, comercio: 'Luz', estimadoCentavos: 330_000, vencimiento: 'Día 5', activo: true },
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
  // Prepaga pagado completo, con débito automático (pesa contra el tope de tarjeta).
  mov({ comercioId: ID.prepaga, comercio: 'Prepaga', importeCentavos: 520_000, formaPago: 'debito_automatico', esFijo: true }),
  // Streaming pagado a medias.
  mov({ comercioId: ID.streaming, comercio: 'Streaming', importeCentavos: 70_000, formaPago: 'debito_automatico', esFijo: true }),
  // Luz: nada este mes.
  // Un gasto suelto que no es fijo.
  mov({ comercioId: ID.coto, importeCentavos: 500_000 }),
  // Mes anterior: no cuenta.
  mov({ fecha: '2026-08-05', comercioId: ID.luz, comercio: 'Luz', importeCentavos: 330_000, esFijo: true }),
]

describe('checklistFijos', () => {
  it('deriva el estado de los movimientos del mes, sin tildes manuales', () => {
    expect(checklistFijos(fijos, movs, '2026-09').map((f) => [f.comercio, f.estado])).toEqual([
      ['Prepaga', 'pagado'],
      ['Streaming', 'parcial'],
      ['Luz', 'pendiente'],
    ])
  })

  it('trae los ids para que la UI no busque por nombre', () => {
    const [prepaga] = checklistFijos(fijos, movs, '2026-09')
    expect(prepaga.gastoFijoId).toBe(fijos[0].id)
    expect(prepaga.comercioId).toBe(ID.prepaga)
  })

  it('calcula lo pagado y lo que falta', () => {
    const [prepaga, streaming, luz] = checklistFijos(fijos, movs, '2026-09')
    expect(prepaga).toMatchObject({ pagado: 520_000, falta: 0 })
    expect(streaming).toMatchObject({ pagado: 70_000, falta: 40_000 })
    expect(luz).toMatchObject({ pagado: 0, falta: 330_000 })
  })

  it('no arrastra lo pagado en otro mes', () => {
    const luz = checklistFijos(fijos, movs, '2026-09').find((f) => f.comercio === 'Luz')
    expect(luz?.estado).toBe('pendiente')
  })

  it('falta nunca es negativo aunque pagues de más', () => {
    const dems = [...movs, mov({ comercioId: ID.luz, comercio: 'Luz', importeCentavos: 99_999_999 })]
    const luz = checklistFijos(fijos, dems, '2026-09').find((f) => f.comercio === 'Luz')
    expect(luz?.falta).toBe(0)
    expect(luz?.estado).toBe('pagado')
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
    expect(fijosPendientes(fijos, movs, '2026-09')).toBe(40_000 + 330_000)
  })

  it('sin movimientos es el total estimado', () => {
    expect(fijosPendientes(fijos, [], '2026-09'))
      .toBe(520_000 + 110_000 + 330_000)
  })
})

describe('fijosYaPagados', () => {
  it('cuenta solo lo que pesa contra el tope pedido', () => {
    // Prepaga y Streaming fueron por débito automático -> tope tarjeta
    expect(fijosYaPagados(fijos, movs, '2026-09', 'tarjeta')).toBe(520_000 + 70_000)
    expect(fijosYaPagados(fijos, movs, '2026-09', 'efectivo')).toBe(0)
  })

  it('no cuenta los movimientos de comercios que no son fijos', () => {
    // El gasto de Coto (500.000) no entra aunque sea del mismo mes y tope.
    expect(fijosYaPagados(fijos, movs, '2026-09', 'tarjeta')).not.toBe(1_090_000)
  })

  it('separa por tope: un fijo pagado por transferencia no ensucia el de tarjeta', () => {
    const conTransfer = [...movs, mov({
      comercioId: ID.luz, comercio: 'Luz',
      importeCentavos: 330_000, formaPago: 'transferencia', esFijo: true,
    })]
    expect(fijosYaPagados(fijos, conTransfer, '2026-09', 'tarjeta')).toBe(520_000 + 70_000)
    expect(fijosYaPagados(fijos, conTransfer, '2026-09', 'efectivo')).toBe(330_000)
  })
})

describe('contadorFijos', () => {
  it('cuenta cada estado', () => {
    expect(contadorFijos(fijos, movs, '2026-09'))
      .toEqual({ pagados: 1, parciales: 1, pendientes: 1 })
  })
})
