import { describe, it, expect } from 'vitest'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import type { Comercio } from '@/lib/schemas/comercio'
import { comerciosFrecuentes, formasDePagoFrecuentes, ultimaFormaPorComercio } from './frecuentes'

const ID = {
  coto: '00000000-0000-4000-8000-00000000c010',
  shell: '00000000-0000-4000-8000-00000000c020',
  pedidos: '00000000-0000-4000-8000-00000000c030',
  viejo: '00000000-0000-4000-8000-00000000c040',
}

function comercio(id: string, nombre: string, p: Partial<Comercio> = {}): Comercio {
  return {
    id,
    nombre,
    categoria: 'Varios',
    subcategoria: null,
    esFijo: false,
    activo: true,
    ...p,
  }
}

const CATALOGO: Comercio[] = [
  comercio(ID.coto, 'Coto', { categoria: 'Supermercado' }),
  comercio(ID.shell, 'Shell', { categoria: 'Auto' }),
  comercio(ID.pedidos, 'PedidosYa', { categoria: 'Delivery' }),
]

let n = 0
function mov(comercioId: string, fecha: string): MovimientoDetalle {
  n += 1
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    fecha,
    comercioId,
    importeCentavos: 100_000,
    formaPago: 'tarjeta_credito',
    banco: null,
    tarjeta: null,
    nota: null,
    comercio: 'x',
    categoria: 'x',
    subcategoria: null,
    esFijo: false,
  }
}

describe('comerciosFrecuentes', () => {
  it('ordena por cantidad de usos', () => {
    const movs = [
      mov(ID.shell, '2026-09-01'),
      mov(ID.coto, '2026-09-02'),
      mov(ID.coto, '2026-09-03'),
      mov(ID.coto, '2026-09-04'),
      mov(ID.pedidos, '2026-09-05'),
      mov(ID.pedidos, '2026-09-06'),
    ]
    expect(comerciosFrecuentes(movs, CATALOGO, 6).map((c) => c.nombre)).toEqual([
      'Coto',
      'PedidosYa',
      'Shell',
    ])
  })

  it('con los mismos usos, adelante el más reciente', () => {
    const movs = [
      mov(ID.shell, '2026-09-20'),
      mov(ID.shell, '2026-09-21'),
      mov(ID.coto, '2026-09-01'),
      mov(ID.coto, '2026-09-02'),
    ]
    expect(comerciosFrecuentes(movs, CATALOGO).map((c) => c.nombre)).toEqual(['Shell', 'Coto'])
  })

  it('deja afuera los comercios sin uso en la ventana', () => {
    const movs = [mov(ID.coto, '2026-09-01')]
    expect(comerciosFrecuentes(movs, CATALOGO).map((c) => c.nombre)).toEqual(['Coto'])
  })

  it('ignora movimientos de comercios que ya no están en el catálogo', () => {
    const movs = [
      mov(ID.viejo, '2026-09-01'),
      mov(ID.viejo, '2026-09-02'),
      mov(ID.viejo, '2026-09-03'),
      mov(ID.coto, '2026-09-04'),
    ]
    // El dado de baja usó más, pero no se puede elegir: no aparece.
    expect(comerciosFrecuentes(movs, CATALOGO).map((c) => c.nombre)).toEqual(['Coto'])
  })

  it('corta en n', () => {
    const movs = [mov(ID.coto, '2026-09-01'), mov(ID.shell, '2026-09-02'), mov(ID.pedidos, '2026-09-03')]
    expect(comerciosFrecuentes(movs, CATALOGO, 2)).toHaveLength(2)
  })

  it('sin movimientos devuelve vacío (mes recién arrancado)', () => {
    expect(comerciosFrecuentes([], CATALOGO)).toEqual([])
  })

  it('con catálogo vacío no explota', () => {
    expect(comerciosFrecuentes([mov(ID.coto, '2026-09-01')], [])).toEqual([])
  })

  it('no muta lo que recibe', () => {
    const movs = [mov(ID.shell, '2026-09-02'), mov(ID.coto, '2026-09-01')]
    const copiaMovs = [...movs]
    const copiaCatalogo = [...CATALOGO]

    comerciosFrecuentes(movs, CATALOGO)

    expect(movs).toEqual(copiaMovs)
    expect(CATALOGO).toEqual(copiaCatalogo)
  })

  it('el orden es estable con empate total', () => {
    // Mismo uso y misma fecha: desempata el nombre, así que la grilla no
    // cambia de orden entre renders.
    const movs = [mov(ID.shell, '2026-09-01'), mov(ID.coto, '2026-09-01')]
    expect(comerciosFrecuentes(movs, CATALOGO).map((c) => c.nombre)).toEqual(['Coto', 'Shell'])
  })
})

function movPago(comercioId: string, fecha: string, formaPago: MovimientoDetalle['formaPago']) {
  return { ...mov(comercioId, fecha), formaPago }
}

describe('formasDePagoFrecuentes', () => {
  it('las dos más usadas, de la más a la menos', () => {
    const movs = [
      movPago(ID.coto, '2026-09-01', 'efectivo'),
      movPago(ID.coto, '2026-09-02', 'tarjeta_debito'),
      movPago(ID.coto, '2026-09-03', 'tarjeta_debito'),
      movPago(ID.coto, '2026-09-04', 'transferencia'),
      movPago(ID.coto, '2026-09-05', 'transferencia'),
      movPago(ID.coto, '2026-09-06', 'transferencia'),
    ]
    expect(formasDePagoFrecuentes(movs)).toEqual(['transferencia', 'tarjeta_debito'])
  })

  it('a igual uso gana la más reciente', () => {
    const movs = [
      movPago(ID.coto, '2026-09-01', 'efectivo'),
      movPago(ID.coto, '2026-09-09', 'transferencia'),
    ]
    expect(formasDePagoFrecuentes(movs)).toEqual(['transferencia', 'efectivo'])
  })

  it('sin uso suficiente completa con el orden de siempre, sin repetir', () => {
    expect(formasDePagoFrecuentes([])).toEqual(['tarjeta_credito', 'tarjeta_debito'])
    expect(formasDePagoFrecuentes([movPago(ID.coto, '2026-09-01', 'efectivo')])).toEqual([
      'efectivo',
      'tarjeta_credito',
    ])
  })
})

describe('ultimaFormaPorComercio', () => {
  it('la forma del movimiento más reciente de cada comercio', () => {
    const movs = [
      movPago(ID.coto, '2026-09-10', 'efectivo'),
      movPago(ID.coto, '2026-09-01', 'tarjeta_credito'),
      movPago(ID.shell, '2026-09-05', 'tarjeta_debito'),
    ]
    expect(ultimaFormaPorComercio(movs)).toEqual({
      [ID.coto]: 'efectivo',
      [ID.shell]: 'tarjeta_debito',
    })
  })

  it('sin movimientos, vacío', () => {
    expect(ultimaFormaPorComercio([])).toEqual({})
  })
})
