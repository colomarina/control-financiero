import { describe, it, expect } from 'vitest'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import {
  mesesConDatos,
  resumenMensual,
  promedioMensual,
  variacionContraMesAnterior,
  totalPorCategoria,
  serieEvolucion,
  formasUsadas,
} from './historial'

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
  // Julio: 1.000.000 tarjeta
  mov({ fecha: '2026-07-10', importeCentavos: 1_000_000 }),
  // Agosto: 600.000 tarjeta + 400.000 efectivo = 1.000.000
  mov({ fecha: '2026-08-10', importeCentavos: 600_000 }),
  mov({ fecha: '2026-08-20', importeCentavos: 400_000, formaPago: 'efectivo', categoria: 'Nutricion' }),
  // Septiembre (en curso): 300.000 débito automático, fijo
  mov({ fecha: '2026-09-05', importeCentavos: 300_000, formaPago: 'debito_automatico', esFijo: true, categoria: 'Servicios' }),
]

const SUELDO = 3_000_000

describe('mesesConDatos', () => {
  it('lista los meses con movimientos, del más viejo al más nuevo', () => {
    expect(mesesConDatos(movs)).toEqual(['2026-07', '2026-08', '2026-09'])
  })

  it('sin movimientos devuelve vacío', () => {
    expect(mesesConDatos([])).toEqual([])
  })
})

describe('resumenMensual', () => {
  const filas = resumenMensual(movs, { sueldoCentavos: SUELDO, mesEnCurso: '2026-09' })

  it('devuelve una fila por mes, del más nuevo al más viejo', () => {
    expect(filas.map((f) => f.mes)).toEqual(['2026-09', '2026-08', '2026-07'])
  })

  it('separa los dos topes', () => {
    const agosto = filas.find((f) => f.mes === '2026-08')!
    expect(agosto).toMatchObject({ tarjeta: 600_000, efectivo: 400_000, total: 1_000_000 })
  })

  it('manda el débito automático al tope de tarjeta', () => {
    const sept = filas.find((f) => f.mes === '2026-09')!
    expect(sept).toMatchObject({ tarjeta: 300_000, efectivo: 0 })
  })

  it('separa fijos de variables', () => {
    const sept = filas.find((f) => f.mes === '2026-09')!
    expect(sept).toMatchObject({ fijos: 300_000, variables: 0 })
  })

  it('calcula el sobrante contra el sueldo', () => {
    const julio = filas.find((f) => f.mes === '2026-07')!
    expect(julio.sobrante).toBe(SUELDO - 1_000_000)
  })

  it('el sobrante da negativo si gastaste más que el sueldo', () => {
    const caros = [mov({ fecha: '2026-07-01', importeCentavos: 5_000_000 })]
    const [fila] = resumenMensual(caros, { sueldoCentavos: SUELDO })
    expect(fila.sobrante).toBe(-2_000_000)
  })

  it('marca cuál es el mes en curso', () => {
    expect(filas.find((f) => f.mes === '2026-09')!.enCurso).toBe(true)
    expect(filas.find((f) => f.mes === '2026-08')!.enCurso).toBe(false)
  })

  it('cuenta los movimientos del mes', () => {
    expect(filas.find((f) => f.mes === '2026-08')!.cantidad).toBe(2)
  })

  it('sin sueldo configurado el sobrante es el gasto en negativo', () => {
    const [fila] = resumenMensual([mov({ fecha: '2026-07-01', importeCentavos: 500 })])
    expect(fila.sobrante).toBe(-500)
  })
})

describe('promedioMensual', () => {
  it('promedia solo los meses cerrados', () => {
    const filas = resumenMensual(movs, { mesEnCurso: '2026-09' })
    // Julio 1.000.000 y agosto 1.000.000; septiembre está en curso.
    expect(promedioMensual(filas)).toBe(1_000_000)
  })

  it('si no marcás mes en curso los promedia a todos', () => {
    const filas = resumenMensual(movs)
    expect(promedioMensual(filas)).toBe(Math.round(2_300_000 / 3))
  })

  it('es 0 si todos los meses están en curso', () => {
    const filas = resumenMensual(
      [mov({ fecha: '2026-09-01' })],
      { mesEnCurso: '2026-09' },
    )
    expect(promedioMensual(filas)).toBe(0)
  })
})

describe('variacionContraMesAnterior', () => {
  const filas = resumenMensual(movs, { mesEnCurso: '2026-09' })

  it('calcula la caída respecto del mes previo', () => {
    // Septiembre 300.000 contra agosto 1.000.000 => -70%
    expect(variacionContraMesAnterior(filas, '2026-09')).toBe(-70)
  })

  it('es 0 cuando no cambió', () => {
    expect(variacionContraMesAnterior(filas, '2026-08')).toBe(0)
  })

  it('devuelve null para el mes más viejo', () => {
    expect(variacionContraMesAnterior(filas, '2026-07')).toBeNull()
  })

  it('devuelve null para un mes que no está', () => {
    expect(variacionContraMesAnterior(filas, '2026-01')).toBeNull()
  })
})

describe('totalPorCategoria', () => {
  it('suma por categoría a lo largo de varios meses, de mayor a menor', () => {
    expect([...totalPorCategoria(movs, ['2026-07', '2026-08'])]).toEqual([
      ['Supermercado', 1_600_000],
      ['Nutricion', 400_000],
    ])
  })

  it('ignora los meses que no pediste', () => {
    expect([...totalPorCategoria(movs, ['2026-09'])]).toEqual([['Servicios', 300_000]])
  })
})

describe('serieEvolucion', () => {
  it('invierte el orden para graficar de izquierda a derecha', () => {
    const filas = resumenMensual(movs, { mesEnCurso: '2026-09' })
    expect(serieEvolucion(filas).map((p) => p.mes)).toEqual([
      '2026-07', '2026-08', '2026-09',
    ])
  })

  it('no muta las filas originales', () => {
    const filas = resumenMensual(movs, { mesEnCurso: '2026-09' })
    const antes = filas.map((f) => f.mes)
    serieEvolucion(filas)
    expect(filas.map((f) => f.mes)).toEqual(antes)
  })
})

describe('formasUsadas', () => {
  it('deja afuera las formas de pago que nunca usaste', () => {
    const filas = resumenMensual(movs)
    expect(formasUsadas(filas)).toEqual([
      'tarjeta_credito', 'debito_automatico', 'efectivo',
    ])
  })
})
