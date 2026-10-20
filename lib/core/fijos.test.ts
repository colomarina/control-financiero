import { describe, it, expect } from 'vitest'
import type { GastoFijoDetalle } from '@/lib/schemas/gastoFijo'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import { checklistFijos, fijosPendientes, fijosYaPagados, contadorFijos } from './fijos'

const ID = {
  prepaga: '00000000-0000-4000-8000-000000000001',
  internet: '00000000-0000-4000-8000-000000000002',
  luz: '00000000-0000-4000-8000-000000000003',
  coto: '00000000-0000-4000-8000-000000000009',
}

// Fixtures inventados: números redondos y nombres genéricos, para que el test
// se lea solo y no publique cuánto se paga de cada cosa.
//
// Internet es el caso de las dos facturas (una línea por persona): no está
// pago hasta que llegan las dos, aunque la primera alcance el estimado.
const fijos: GastoFijoDetalle[] = [
  { id: '00000000-0000-4000-8000-0000000000f1', comercioId: ID.prepaga, comercio: 'Prepaga', estimadoCentavos: 520_000, pagosEsperados: 1, vencimiento: 'Día 5', activo: true },
  { id: '00000000-0000-4000-8000-0000000000f2', comercioId: ID.internet, comercio: 'Internet', estimadoCentavos: 120_000, pagosEsperados: 2, vencimiento: 'Día 8', activo: true },
  { id: '00000000-0000-4000-8000-0000000000f3', comercioId: ID.luz, comercio: 'Luz', estimadoCentavos: 330_000, pagosEsperados: 1, vencimiento: 'Día 5', activo: true },
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
  // Prepaga pagada: su única factura ya llegó.
  mov({ comercioId: ID.prepaga, comercio: 'Prepaga', importeCentavos: 520_000, formaPago: 'debito_automatico', esFijo: true }),
  // Internet: llegó una de las dos facturas.
  mov({ comercioId: ID.internet, comercio: 'Internet', importeCentavos: 55_000, formaPago: 'debito_automatico', esFijo: true }),
  // Luz: nada este mes.
  // Un gasto suelto que no es fijo.
  mov({ comercioId: ID.coto, importeCentavos: 500_000 }),
  // Mes anterior: no cuenta.
  mov({ fecha: '2026-08-05', comercioId: ID.luz, comercio: 'Luz', importeCentavos: 330_000, esFijo: true }),
]

/** El mismo mes, con la factura de luz cargada por el importe que se quiera. */
function conLuz(importeCentavos: number, veces = 1) {
  return [
    ...movs,
    ...Array.from({ length: veces }, () =>
      mov({ comercioId: ID.luz, comercio: 'Luz', importeCentavos, esFijo: true }),
    ),
  ]
}

const luzDe = (ms: MovimientoDetalle[]) =>
  checklistFijos(fijos, ms, '2026-09').find((f) => f.comercio === 'Luz')!

describe('checklistFijos', () => {
  it('deriva el estado de los movimientos del mes, sin tildes manuales', () => {
    expect(checklistFijos(fijos, movs, '2026-09').map((f) => [f.comercio, f.estado])).toEqual([
      ['Prepaga', 'pagado'],
      ['Internet', 'parcial'],
      ['Luz', 'pendiente'],
    ])
  })

  it('trae los ids para que la UI no busque por nombre', () => {
    const [prepaga] = checklistFijos(fijos, movs, '2026-09')
    expect(prepaga.gastoFijoId).toBe(fijos[0].id)
    expect(prepaga.comercioId).toBe(ID.prepaga)
  })

  it('cuenta las facturas que llegaron', () => {
    const [prepaga, internet, luz] = checklistFijos(fijos, movs, '2026-09')
    expect(prepaga).toMatchObject({ pagosEsperados: 1, pagosHechos: 1 })
    expect(internet).toMatchObject({ pagosEsperados: 2, pagosHechos: 1 })
    expect(luz).toMatchObject({ pagosEsperados: 1, pagosHechos: 0 })
  })

  it('calcula lo pagado y prorratea lo que falta por facturas pendientes', () => {
    const [prepaga, internet, luz] = checklistFijos(fijos, movs, '2026-09')
    expect(prepaga).toMatchObject({ pagado: 520_000, falta: 0 })
    // Falta una de las dos facturas: se estima la mitad del esperado, sin
    // importar cuánto vino en la primera.
    expect(internet).toMatchObject({ pagado: 55_000, falta: 60_000 })
    expect(luz).toMatchObject({ pagado: 0, falta: 330_000 })
  })

  // El bug que esto cierra: la luz varía todos los meses, así que comparar
  // plata contra plata dejaba un "falta $20.000" que no existía.
  it('un fijo que salió más barato que lo esperado está pagado, no a medias', () => {
    const luz = luzDe(conLuz(310_000))
    expect(luz.estado).toBe('pagado')
    expect(luz.falta).toBe(0)
    expect(luz.desvioPct).toBeCloseTo(-6.06, 1)
  })

  it('y uno que salió más caro también, con el desvío en positivo', () => {
    const luz = luzDe(conLuz(400_000))
    expect(luz.estado).toBe('pagado')
    expect(luz.falta).toBe(0)
    expect(luz.desvioPct).toBeCloseTo(21.21, 1)
  })

  it('con dos facturas esperadas hacen falta las dos, aunque la primera cubra el total', () => {
    const dos = [
      ...movs,
      mov({ comercioId: ID.internet, comercio: 'Internet', importeCentavos: 65_000, esFijo: true }),
    ]
    const internet = checklistFijos(fijos, dos, '2026-09').find((f) => f.comercio === 'Internet')!
    expect(internet).toMatchObject({ pagosHechos: 2, estado: 'pagado', falta: 0 })
  })

  it('el desvío es null mientras falte una factura: todavía no hay con qué comparar', () => {
    const [prepaga, internet, luz] = checklistFijos(fijos, movs, '2026-09')
    expect(prepaga.desvioPct).toBeCloseTo(0, 5)
    expect(internet.desvioPct).toBeNull()
    expect(luz.desvioPct).toBeNull()
  })

  it('sin estimado no hay desvío que mostrar', () => {
    const sinEstimado = [{ ...fijos[2], estimadoCentavos: 0 }]
    expect(checklistFijos(sinEstimado, conLuz(310_000), '2026-09')[0])
      .toMatchObject({ estado: 'pagado', falta: 0, desvioPct: null })
  })

  it('no arrastra lo pagado en otro mes', () => {
    expect(luzDe(movs).estado).toBe('pendiente')
  })

  it('una fila vieja sin facturas declaradas cuenta como una', () => {
    const viejo = [{ ...fijos[2], pagosEsperados: 0 }]
    const [luz] = checklistFijos(viejo, conLuz(330_000), '2026-09')
    expect(luz).toMatchObject({ pagosEsperados: 1, estado: 'pagado', falta: 0 })
  })

  it('ignora los fijos dados de baja', () => {
    const conBaja = [...fijos, {
      id: '00000000-0000-4000-8000-000000000099', comercioId: ID.coto, comercio: 'Viejo',
      estimadoCentavos: 500_000, pagosEsperados: 1, vencimiento: null, activo: false,
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
    expect(fijosPendientes(fijos, movs, '2026-09')).toBe(60_000 + 330_000)
  })

  it('sin movimientos es el total estimado', () => {
    expect(fijosPendientes(fijos, [], '2026-09')).toBe(520_000 + 120_000 + 330_000)
  })

  it('un fijo más barato de lo esperado no deja saldo pendiente', () => {
    expect(fijosPendientes(fijos, conLuz(310_000), '2026-09')).toBe(60_000)
  })
})

describe('fijosYaPagados', () => {
  it('cuenta solo lo que pesa contra el tope pedido', () => {
    // Prepaga e Internet fueron por débito automático -> tope tarjeta
    expect(fijosYaPagados(fijos, movs, '2026-09', 'tarjeta')).toBe(520_000 + 55_000)
    expect(fijosYaPagados(fijos, movs, '2026-09', 'efectivo')).toBe(0)
  })

  it('no cuenta los movimientos de comercios que no son fijos', () => {
    // El gasto de Coto (500.000) no entra aunque sea del mismo mes y tope.
    expect(fijosYaPagados(fijos, movs, '2026-09', 'tarjeta')).not.toBe(1_075_000)
  })

  it('separa por tope: un fijo pagado por transferencia no ensucia el de tarjeta', () => {
    const conTransfer = [...movs, mov({
      comercioId: ID.luz, comercio: 'Luz',
      importeCentavos: 330_000, formaPago: 'transferencia', esFijo: true,
    })]
    expect(fijosYaPagados(fijos, conTransfer, '2026-09', 'tarjeta')).toBe(520_000 + 55_000)
    expect(fijosYaPagados(fijos, conTransfer, '2026-09', 'efectivo')).toBe(330_000)
  })
})

describe('contadorFijos', () => {
  it('cuenta cada estado', () => {
    expect(contadorFijos(fijos, movs, '2026-09'))
      .toEqual({ pagados: 1, parciales: 1, pendientes: 1 })
  })
})
