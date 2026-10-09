import { describe, it, expect } from 'vitest'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import { filtrarMovimientos, normalizar, categoriasDe, totalDe } from './filtros'

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

const MOVS: MovimientoDetalle[] = [
  mov({ comercio: 'Coto', categoria: 'Supermercado', fecha: '2026-09-01', importeCentavos: 500_000 }),
  mov({ comercio: 'Shell', categoria: 'Auto', subcategoria: 'Combustible', fecha: '2026-09-10', formaPago: 'efectivo', importeCentavos: 300_000 }),
  mov({ comercio: 'Prepaga', categoria: 'Salud', subcategoria: 'Prepaga', fecha: '2026-08-05', formaPago: 'debito_automatico', esFijo: true, importeCentavos: 700_000 }),
  mov({ comercio: 'Farmacia', categoria: 'Salud', fecha: '2026-10-02', nota: 'Remedios de mamá', importeCentavos: 150_000 }),
]

describe('normalizar', () => {
  it('saca acentos y pasa a minúsculas', () => {
    expect(normalizar('Nutrición')).toBe('nutricion')
    expect(normalizar('  ÁÉÍÓÚ ñ  ')).toBe('aeiou n')
  })
})

describe('sin criterios', () => {
  it('devuelve todo', () => {
    expect(filtrarMovimientos(MOVS)).toHaveLength(4)
    expect(filtrarMovimientos(MOVS, {})).toHaveLength(4)
    expect(filtrarMovimientos(MOVS, { texto: '   ' })).toHaveLength(4)
  })
})

describe('búsqueda por texto', () => {
  it('encuentra por comercio, sin importar mayúsculas', () => {
    expect(filtrarMovimientos(MOVS, { texto: 'coto' }).map((m) => m.comercio)).toEqual(['Coto'])
  })

  it('encuentra por categoría y subcategoría', () => {
    expect(filtrarMovimientos(MOVS, { texto: 'salud' })).toHaveLength(2)
    expect(filtrarMovimientos(MOVS, { texto: 'combustible' }).map((m) => m.comercio)).toEqual([
      'Shell',
    ])
  })

  it('encuentra por nota, ignorando acentos', () => {
    expect(filtrarMovimientos(MOVS, { texto: 'mama' }).map((m) => m.comercio)).toEqual([
      'Farmacia',
    ])
  })

  it('encuentra por banco y tarjeta', () => {
    expect(filtrarMovimientos(MOVS, { texto: 'visa' })).toHaveLength(4)
  })

  it('exige todas las palabras, aunque estén en campos distintos', () => {
    expect(filtrarMovimientos(MOVS, { texto: 'shell combustible' })).toHaveLength(1)
    expect(filtrarMovimientos(MOVS, { texto: 'shell prepaga' })).toHaveLength(0)
  })

  it('no le importa el orden de las palabras', () => {
    const a = filtrarMovimientos(MOVS, { texto: 'auto shell' })
    const b = filtrarMovimientos(MOVS, { texto: 'shell auto' })
    expect(a).toEqual(b)
    expect(a).toHaveLength(1)
  })

  it('sin resultados devuelve lista vacía', () => {
    expect(filtrarMovimientos(MOVS, { texto: 'zzzz' })).toEqual([])
  })
})

describe('filtros exactos', () => {
  it('por categoría', () => {
    expect(filtrarMovimientos(MOVS, { categoria: 'Salud' })).toHaveLength(2)
  })

  it('por forma de pago', () => {
    expect(filtrarMovimientos(MOVS, { formaPago: 'efectivo' }).map((m) => m.comercio)).toEqual([
      'Shell',
    ])
  })

  it('null y undefined no filtran', () => {
    expect(filtrarMovimientos(MOVS, { categoria: null, formaPago: null })).toHaveLength(4)
    expect(filtrarMovimientos(MOVS, { categoria: undefined })).toHaveLength(4)
  })
})

describe('rango de fechas', () => {
  it('es inclusivo en los dos extremos', () => {
    expect(filtrarMovimientos(MOVS, { desde: '2026-09-01', hasta: '2026-09-10' })).toHaveLength(2)
  })

  it('acepta solo un extremo', () => {
    expect(filtrarMovimientos(MOVS, { desde: '2026-09-11' })).toHaveLength(1)
    expect(filtrarMovimientos(MOVS, { hasta: '2026-08-31' })).toHaveLength(1)
  })

  it('un mes se filtra con su primer y último día', () => {
    const septiembre = filtrarMovimientos(MOVS, { desde: '2026-09-01', hasta: '2026-09-30' })
    expect(septiembre.map((m) => m.comercio)).toEqual(['Coto', 'Shell'])
  })
})

describe('criterios combinados', () => {
  it('se aplican todos a la vez', () => {
    expect(
      filtrarMovimientos(MOVS, { texto: 'salud', desde: '2026-10-01' }).map((m) => m.comercio),
    ).toEqual(['Farmacia'])

    expect(
      filtrarMovimientos(MOVS, { categoria: 'Salud', formaPago: 'debito_automatico' }).map(
        (m) => m.comercio,
      ),
    ).toEqual(['Prepaga'])
  })

  it('criterios que se contradicen dan vacío', () => {
    expect(filtrarMovimientos(MOVS, { categoria: 'Salud', texto: 'coto' })).toEqual([])
  })
})

describe('no muta ni reordena', () => {
  it('deja la lista original intacta', () => {
    const copia = [...MOVS]
    filtrarMovimientos(MOVS, { texto: 'coto' })
    expect(MOVS).toEqual(copia)
  })

  it('respeta el orden de entrada', () => {
    expect(filtrarMovimientos(MOVS, { texto: 'visa' }).map((m) => m.comercio)).toEqual([
      'Coto',
      'Shell',
      'Prepaga',
      'Farmacia',
    ])
  })
})

describe('categoriasDe', () => {
  it('devuelve las presentes, sin repetir y ordenadas', () => {
    expect(categoriasDe(MOVS)).toEqual(['Auto', 'Salud', 'Supermercado'])
  })

  it('sin movimientos devuelve vacío', () => {
    expect(categoriasDe([])).toEqual([])
  })
})

describe('totalDe', () => {
  it('suma en centavos', () => {
    expect(totalDe(MOVS)).toBe(1_650_000)
    expect(totalDe(filtrarMovimientos(MOVS, { categoria: 'Salud' }))).toBe(850_000)
  })

  it('lista vacía suma cero', () => {
    expect(totalDe([])).toBe(0)
  })
})
