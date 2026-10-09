import { describe, it, expect } from 'vitest'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import {
  FACTOR_ESCENARIO,
  tasaVariableDiaria,
  promedioHistoricoDiario,
  tasaDiariaAplicable,
  prediccionCierre,
  margenDisponible,
  superaElTope,
} from './prediccion'

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

describe('tasaVariableDiaria', () => {
  it('descuenta los fijos ya pagados antes de dividir por los días', () => {
    // (500.000 - 200.000) / 10 = 30.000 por día
    expect(tasaVariableDiaria({ gastadoReal: 500_000, fijosYaPagados: 200_000, diaActual: 10 }))
      .toBe(30_000)
  })

  it('no devuelve negativo si los fijos superan lo gastado', () => {
    expect(tasaVariableDiaria({ gastadoReal: 100_000, fijosYaPagados: 300_000, diaActual: 5 }))
      .toBe(0)
  })

  it('es 0 el día 0 (no divide por cero)', () => {
    expect(tasaVariableDiaria({ gastadoReal: 500_000, fijosYaPagados: 0, diaActual: 0 }))
      .toBe(0)
  })
})

describe('promedioHistoricoDiario', () => {
  const movs = [
    // Agosto (31 días): 310.000 variables con tarjeta -> 10.000/día
    mov({ fecha: '2026-08-10', importeCentavos: 310_000 }),
    // Julio (31 días): 620.000 variables con tarjeta -> 20.000/día
    mov({ fecha: '2026-07-10', importeCentavos: 620_000 }),
    // Un fijo: no entra en el ritmo variable.
    mov({ fecha: '2026-08-05', importeCentavos: 900_000, esFijo: true }),
    // Efectivo: no entra en el ritmo de tarjeta.
    mov({ fecha: '2026-08-06', importeCentavos: 900_000, formaPago: 'efectivo' }),
  ]

  it('promedia el ritmo variable de los meses cerrados', () => {
    expect(promedioHistoricoDiario(movs, '2026-09', 2)).toBe(15_000)
  })

  it('ignora los meses sin movimientos en vez de contarlos como cero', () => {
    // Pedimos 6 meses pero solo 2 tienen datos: el promedio no se diluye.
    expect(promedioHistoricoDiario(movs, '2026-09', 6)).toBe(15_000)
  })

  it('es 0 si no hay histórico', () => {
    expect(promedioHistoricoDiario([], '2026-09', 3)).toBe(0)
  })

  it('puede medir el ritmo del otro tope', () => {
    // 900.000 en efectivo en agosto (31 días)
    expect(promedioHistoricoDiario(movs, '2026-09', 1, 'efectivo')).toBeCloseTo(900_000 / 31, 6)
  })
})

describe('tasaDiariaAplicable', () => {
  const base = { tasaMesActual: 30_000, promHistorico: 10_000, umbralDia: 10 }

  it('usa el ritmo del mes cuando ya pasó el umbral', () => {
    expect(tasaDiariaAplicable({ ...base, diaActual: 10 })).toBe(30_000)
    expect(tasaDiariaAplicable({ ...base, diaActual: 25 })).toBe(30_000)
  })

  it('usa el histórico mientras es temprano', () => {
    expect(tasaDiariaAplicable({ ...base, diaActual: 3 })).toBe(10_000)
  })

  it('cae al ritmo del mes si no hay histórico', () => {
    expect(tasaDiariaAplicable({ ...base, promHistorico: 0, diaActual: 3 })).toBe(30_000)
  })
})

describe('prediccionCierre', () => {
  const args = {
    gastadoReal: 600_000,
    fijosPendientes: 400_000,
    tasaDiaria: 20_000,
    diaActual: 10,
    diasMes: 30,
    umbralDia: 10,
  }

  it('avisa que es temprano antes del umbral', () => {
    const p = prediccionCierre({ ...args, diaActual: 3 })
    expect(p.status).toBe('temprano')
    if (p.status !== 'temprano') throw new Error('status inesperado')
    expect(p.diasParaProyectar).toBe(7)
    expect(p.mensaje).toContain('3 días')
  })

  it('proyecta justo en el umbral', () => {
    expect(prediccionCierre(args).status).toBe('proyeccion')
  })

  it('calcula B + E para los tres escenarios', () => {
    const p = prediccionCierre(args)
    if (p.status !== 'proyeccion') throw new Error('status inesperado')
    // B = 600.000 + 400.000 = 1.000.000 ; días restantes = 20 ; E = 20.000 * 20 = 400.000
    expect(p.base).toBe(1_000_000)
    expect(p.diasRestantes).toBe(20)
    expect(p.optimista).toBe(1_000_000 + 400_000 * 0.85)
    expect(p.normal).toBe(1_400_000)
    expect(p.pesimista).toBe(1_000_000 + 400_000 * 1.25)
  })

  it('ordena los escenarios de menor a mayor', () => {
    const p = prediccionCierre(args)
    if (p.status !== 'proyeccion') throw new Error('status inesperado')
    expect(p.optimista).toBeLessThan(p.normal)
    expect(p.normal).toBeLessThan(p.pesimista)
  })

  it('el último día del mes el cierre es solo la base', () => {
    const p = prediccionCierre({ ...args, diaActual: 30 })
    if (p.status !== 'proyeccion') throw new Error('status inesperado')
    expect(p.diasRestantes).toBe(0)
    expect(p.normal).toBe(1_000_000)
    expect(p.optimista).toBe(p.pesimista)
  })

  it('devuelve enteros (centavos), no decimales', () => {
    const p = prediccionCierre({ ...args, tasaDiaria: 33_333.33 })
    if (p.status !== 'proyeccion') throw new Error('status inesperado')
    expect(Number.isInteger(p.optimista)).toBe(true)
    expect(Number.isInteger(p.normal)).toBe(true)
    expect(Number.isInteger(p.pesimista)).toBe(true)
  })

  it('sin gasto variable el cierre es la base en los tres escenarios', () => {
    const p = prediccionCierre({ ...args, tasaDiaria: 0 })
    if (p.status !== 'proyeccion') throw new Error('status inesperado')
    expect([p.optimista, p.normal, p.pesimista]).toEqual([1_000_000, 1_000_000, 1_000_000])
  })

  it('reproduce los factores de la hoja Prediccion del Excel', () => {
    expect(FACTOR_ESCENARIO).toEqual({ optimista: 0.85, normal: 1, pesimista: 1.25 })
  })
})

describe('margenDisponible', () => {
  it('descuenta lo gastado y los fijos pendientes', () => {
    // Es el caso real del Excel: tope 2.000.000, nada gastado, 1.175.910 en fijos
    expect(margenDisponible({ tope: 200_000_000, gastadoReal: 0, fijosPendientes: 117_591_000 }))
      .toBe(82_409_000)
  })

  it('no devuelve negativo', () => {
    expect(margenDisponible({ tope: 100_000, gastadoReal: 200_000, fijosPendientes: 50_000 }))
      .toBe(0)
  })
})

describe('superaElTope', () => {
  const proyeccion = prediccionCierre({
    gastadoReal: 600_000, fijosPendientes: 400_000, tasaDiaria: 20_000,
    diaActual: 10, diasMes: 30, umbralDia: 10,
  })

  it('detecta cuando la proyección normal se pasa', () => {
    expect(superaElTope(proyeccion, 1_000_000)).toBe(true)
    expect(superaElTope(proyeccion, 2_000_000)).toBe(false)
  })

  it('sin tope configurado nunca se pasa', () => {
    expect(superaElTope(proyeccion, 0)).toBe(false)
  })

  it('mientras es temprano no afirma nada', () => {
    const temprano = prediccionCierre({
      gastadoReal: 9_999_999, fijosPendientes: 0, tasaDiaria: 0,
      diaActual: 1, diasMes: 30, umbralDia: 10,
    })
    expect(superaElTope(temprano, 1)).toBe(false)
  })
})
