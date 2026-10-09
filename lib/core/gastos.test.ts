import { describe, it, expect } from 'vitest'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import {
  movimientosDelMes,
  gastoTotalMes,
  gastoTarjetaMes,
  gastoEfectivoMes,
  gastoPorFormaPago,
  gastoPorComercio,
  gastoPorCategoria,
  gastoPorSubcategoria,
  gastoFijosMes,
  gastoVariablesMes,
  topComercios,
  movimientosOrdenados,
} from './gastos'

let n = 0
function mov(p: Partial<MovimientoDetalle> = {}): MovimientoDetalle {
  n += 1
  return {
    id: `00000000-0000-4000-8000-${String(n).padStart(12, '0')}`,
    fecha: '2026-09-15',
    comercioId: '00000000-0000-4000-8000-000000000001',
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
  mov({ fecha: '2026-09-01', comercio: 'Coto', categoria: 'Supermercado', importeCentavos: 500_000, formaPago: 'tarjeta_credito' }),
  mov({ fecha: '2026-09-10', comercio: 'Coto', categoria: 'Supermercado', importeCentavos: 300_000, formaPago: 'efectivo' }),
  mov({ fecha: '2026-09-20', comercio: 'Shell', categoria: 'Transporte', importeCentavos: 200_000, formaPago: 'transferencia' }),
  mov({ fecha: '2026-09-25', comercio: 'Edenor', categoria: 'Servicios', importeCentavos: 150_000, formaPago: 'transferencia', esFijo: true, subcategoria: 'Luz' }),
  // Débito automático pesa contra el tope de TARJETA, igual que en el Excel.
  mov({ fecha: '2026-09-05', comercio: 'Netflix', categoria: 'Streaming', importeCentavos: 100_000, formaPago: 'debito_automatico', esFijo: true, subcategoria: 'Netflix' }),
  // Otro mes: no tiene que contar en ningún total de septiembre.
  mov({ fecha: '2026-08-31', comercio: 'Coto', categoria: 'Supermercado', importeCentavos: 999_999, formaPago: 'tarjeta_credito' }),
]

describe('movimientosDelMes', () => {
  it('filtra por el mes derivado de la fecha', () => {
    expect(movimientosDelMes(movs, '2026-09')).toHaveLength(5)
    expect(movimientosDelMes(movs, '2026-08')).toHaveLength(1)
  })

  it('devuelve vacío para un mes sin movimientos', () => {
    expect(movimientosDelMes(movs, '2026-07')).toEqual([])
  })
})

describe('gastoTotalMes', () => {
  it('suma todo el mes sin importar la forma de pago', () => {
    expect(gastoTotalMes(movs, '2026-09')).toBe(1_250_000)
  })

  it('no mezcla meses', () => {
    expect(gastoTotalMes(movs, '2026-08')).toBe(999_999)
  })

  it('es 0 sin movimientos', () => {
    expect(gastoTotalMes([], '2026-09')).toBe(0)
  })
})

describe('gastoTarjetaMes / gastoEfectivoMes', () => {
  it('tarjeta incluye credito y debito automatico', () => {
    expect(gastoTarjetaMes(movs, '2026-09')).toBe(600_000)
  })

  it('efectivo incluye las transferencias', () => {
    // 300.000 efectivo + 200.000 + 150.000 de transferencias
    expect(gastoEfectivoMes(movs, '2026-09')).toBe(650_000)
  })

  it('los dos topes juntos dan el total del mes', () => {
    expect(gastoTarjetaMes(movs, '2026-09') + gastoEfectivoMes(movs, '2026-09'))
      .toBe(gastoTotalMes(movs, '2026-09'))
  })
})

describe('gastoPorFormaPago', () => {
  it('desglosa crudo y siempre trae todas las claves', () => {
    expect(gastoPorFormaPago(movs, '2026-09')).toEqual({
      tarjeta_credito: 500_000,
      tarjeta_debito: 0,
      debito_automatico: 100_000,
      transferencia: 350_000,
      efectivo: 300_000,
    })
  })

  it('devuelve ceros si no hubo nada', () => {
    expect(gastoPorFormaPago([], '2026-09')).toEqual({
      tarjeta_credito: 0,
      tarjeta_debito: 0,
      debito_automatico: 0,
      transferencia: 0,
      efectivo: 0,
    })
  })
})

describe('gastoPorComercio', () => {
  it('agrupa y ordena de mayor a menor', () => {
    expect([...gastoPorComercio(movs, '2026-09')]).toEqual([
      ['Coto', 800_000],
      ['Shell', 200_000],
      ['Edenor', 150_000],
      ['Netflix', 100_000],
    ])
  })
})

describe('gastoPorCategoria', () => {
  it('agrupa por categoría del comercio', () => {
    expect([...gastoPorCategoria(movs, '2026-09')]).toEqual([
      ['Supermercado', 800_000],
      ['Transporte', 200_000],
      ['Servicios', 150_000],
      ['Streaming', 100_000],
    ])
  })
})

describe('gastoPorSubcategoria', () => {
  it('junta los que no tienen subcategoría bajo una etiqueta', () => {
    expect([...gastoPorSubcategoria(movs, '2026-09')]).toEqual([
      ['Sin subcategoría', 1_000_000],
      ['Luz', 150_000],
      ['Netflix', 100_000],
    ])
  })
})

describe('gastoFijosMes / gastoVariablesMes', () => {
  it('separa fijos de variables', () => {
    expect(gastoFijosMes(movs, '2026-09')).toBe(250_000)
    expect(gastoVariablesMes(movs, '2026-09')).toBe(1_000_000)
  })

  it('fijos + variables da el total', () => {
    expect(gastoFijosMes(movs, '2026-09') + gastoVariablesMes(movs, '2026-09'))
      .toBe(gastoTotalMes(movs, '2026-09'))
  })
})

describe('topComercios', () => {
  it('devuelve los n primeros', () => {
    expect(topComercios(movs, '2026-09', 2)).toEqual([
      { comercio: 'Coto', centavos: 800_000 },
      { comercio: 'Shell', centavos: 200_000 },
    ])
  })

  it('no explota si hay menos comercios que n', () => {
    expect(topComercios(movs, '2026-09', 99)).toHaveLength(4)
  })
})

describe('movimientosOrdenados', () => {
  it('ordena por fecha descendente', () => {
    expect(movimientosOrdenados(movs, '2026-09').map((m) => m.fecha)).toEqual([
      '2026-09-25', '2026-09-20', '2026-09-10', '2026-09-05', '2026-09-01',
    ])
  })

  it('no muta el array original', () => {
    const copia = [...movs]
    movimientosOrdenados(movs, '2026-09')
    expect(movs).toEqual(copia)
  })
})
