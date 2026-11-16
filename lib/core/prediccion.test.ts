import { describe, it, expect } from 'vitest'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import type { CompraCuotasDetalle } from '@/lib/schemas/compraCuotas'
import type { GastoFijoDetalle } from '@/lib/schemas/gastoFijo'
import {
  FACTOR_ESCENARIO,
  PESO_HISTORICO_DIAS,
  DIAS_MINIMOS_SIN_HISTORICO,
  DIAS_PUNTUAL,
  prediccionCierre,
  prediccionDelTope,
  margenDisponible,
  superaElTope,
  type Prediccion,
} from './prediccion'
import type { PerfilHistorico } from './puntuales'
import { cuotasDelMes } from './cuotas'

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

// Fixture de una compra en cuotas: ids fijos, números redondos.
function compra(p: Partial<CompraCuotasDetalle> = {}): CompraCuotasDetalle {
  return {
    id: '00000000-0000-4000-8000-000000000050',
    fecha: '2026-11-03',
    comercioId: '00000000-0000-4000-8000-000000000001',
    importeCuotaCentavos: 48_500,
    cuotas: 12,
    formaPago: 'tarjeta_credito',
    banco: null,
    tarjeta: null,
    nota: null,
    comercio: 'Asistencia',
    categoria: 'Seguros',
    subcategoria: null,
    esFijo: false,
    ...p,
  }
}

function proyeccion(p: Prediccion) {
  if (p.status !== 'proyeccion') throw new Error('status inesperado')
  return p
}

describe('constantes', () => {
  it('reproduce los factores de la hoja Prediccion del Excel', () => {
    expect(FACTOR_ESCENARIO).toEqual({ optimista: 0.85, normal: 1, pesimista: 1.25 })
  })

  it('pesos y umbrales del método', () => {
    expect(PESO_HISTORICO_DIAS).toBe(7)
    expect(DIAS_MINIMOS_SIN_HISTORICO).toBe(7)
    expect(DIAS_PUNTUAL).toBe(5)
  })
})

describe('prediccionCierre', () => {
  const perfil: PerfilHistorico = {
    meses: 3, ritmoDiario: 1_000_000, puntualesPorMes: 0, umbral: 5_000_000,
  }
  const sinHistorico: PerfilHistorico = {
    meses: 0, ritmoDiario: 0, puntualesPorMes: 0, umbral: null,
  }

  it('una compra puntual no se proyecta a los días que quedan', () => {
    // día 5 de 30: $50.000 de variable normal + una TV de $400.000
    const p = prediccionCierre({ gastado: 45_000_000, fijosPendientes: 0, variableMes: 5_000_000,
      puntualesMes: 40_000_000, perfil, diaActual: 5, diasMes: 30 })
    expect(p.status === 'proyeccion' && p.normal).toBe(70_000_000) // el método viejo daba 270_000_000
  })

  it('el día 1 ya proyecta, casi todo con el histórico', () => {
    // ritmo del mes: 9.000.000 / 1 ; histórico: 1.000.000
    const p = proyeccion(prediccionCierre({ gastado: 9_000_000, fijosPendientes: 0,
      variableMes: 9_000_000, puntualesMes: 0, perfil, diaActual: 1, diasMes: 30 }))
    expect(p.ritmoDiario).toBe((7 * 1_000_000 + 1 * 9_000_000) / 8)
    expect(p.diasRestantes).toBe(29)
    expect(p.normal).toBe(9_000_000 + 2_000_000 * 29)
  })

  it('el peso del mes crece con los días', () => {
    // día 28: ritmo del mes 3.000.000, histórico 1.000.000
    const p = proyeccion(prediccionCierre({ gastado: 84_000_000, fijosPendientes: 0,
      variableMes: 84_000_000, puntualesMes: 0, perfil, diaActual: 28, diasMes: 30 }))
    expect(p.ritmoDiario).toBe((7 * 1_000_000 + 28 * 3_000_000) / 35)
    expect(Math.abs(p.ritmoDiario - 3_000_000)).toBeLessThan(Math.abs(p.ritmoDiario - 1_000_000))
  })

  it('suma los puntuales que solés hacer y todavía no hiciste', () => {
    const p = proyeccion(prediccionCierre({ gastado: 10_000_000, fijosPendientes: 0,
      variableMes: 0, puntualesMes: 0,
      perfil: { meses: 3, ritmoDiario: 0, puntualesPorMes: 30_000_000, umbral: 5_000_000 },
      diaActual: 15, diasMes: 30 }))
    expect(p.puntualesEsperados).toBe(15_000_000)
    expect(p.optimista).toBe(10_000_000)
    expect(p.normal).toBe(25_000_000)
    expect(p.pesimista).toBe(25_000_000)
  })

  it('si ya hiciste más puntuales que el promedio no espera más', () => {
    const p = proyeccion(prediccionCierre({ gastado: 40_000_000, fijosPendientes: 0,
      variableMes: 0, puntualesMes: 40_000_000,
      perfil: { meses: 3, ritmoDiario: 0, puntualesPorMes: 30_000_000, umbral: 5_000_000 },
      diaActual: 15, diasMes: 30 }))
    expect(p.puntualesEsperados).toBe(0)
    expect(p.normal).toBe(40_000_000)
  })

  it('el último día los tres escenarios son la base', () => {
    const p = proyeccion(prediccionCierre({ gastado: 50_000_000, fijosPendientes: 3_000_000,
      variableMes: 30_000_000, puntualesMes: 0,
      perfil: { meses: 3, ritmoDiario: 1_000_000, puntualesPorMes: 30_000_000, umbral: 5_000_000 },
      diaActual: 30, diasMes: 30 }))
    expect(p.diasRestantes).toBe(0)
    expect(p.base).toBe(53_000_000)
    expect([p.optimista, p.normal, p.pesimista]).toEqual([53_000_000, 53_000_000, 53_000_000])
  })

  it('optimista ≤ normal ≤ pesimista', () => {
    for (const dia of [1, 5, 10, 20, 29, 30]) {
      const p = proyeccion(prediccionCierre({ gastado: 12_345_678, fijosPendientes: 1_111_111,
        variableMes: 7_777_777, puntualesMes: 3_000_000,
        perfil: { meses: 2, ritmoDiario: 333_333.33, puntualesPorMes: 9_000_000, umbral: 1_000_000 },
        diaActual: dia, diasMes: 31 }))
      expect(p.optimista).toBeLessThanOrEqual(p.normal)
      expect(p.normal).toBeLessThanOrEqual(p.pesimista)
    }
  })

  it('devuelve enteros (centavos), no decimales', () => {
    const p = proyeccion(prediccionCierre({ gastado: 1_000_001, fijosPendientes: 0,
      variableMes: 1_000_001, puntualesMes: 0,
      perfil: { meses: 1, ritmoDiario: 33_333.33, puntualesPorMes: 1_234_567, umbral: 1 },
      diaActual: 7, diasMes: 31 }))
    for (const x of [p.optimista, p.normal, p.pesimista, p.ritmoDiario, p.puntualesEsperados]) {
      expect(Number.isInteger(x)).toBe(true)
    }
  })

  it('sin histórico y antes del día 7 es temprano', () => {
    const p = prediccionCierre({ gastado: 5_000_000, fijosPendientes: 0, variableMes: 5_000_000,
      puntualesMes: 0, perfil: sinHistorico, diaActual: 3, diasMes: 30 })
    expect(p.status).toBe('temprano')
    if (p.status !== 'temprano') throw new Error('status inesperado')
    expect(p.diasParaProyectar).toBe(4)
    expect(p.mensaje).toContain('3 días')
  })

  it('sin histórico desde el día 7 usa solo el ritmo del mes', () => {
    // 7.000.000 / 7 = 1.000.000 por día, 23 días restantes
    const p = proyeccion(prediccionCierre({ gastado: 7_000_000, fijosPendientes: 2_000_000,
      variableMes: 7_000_000, puntualesMes: 0, perfil: sinHistorico, diaActual: 7, diasMes: 30 }))
    expect(p.ritmoDiario).toBe(1_000_000)
    expect(p.puntualesEsperados).toBe(0)
    expect(p.base).toBe(9_000_000)
    expect(p.normal).toBe(9_000_000 + 23_000_000)
  })
})

describe('prediccionDelTope', () => {
  const MES = '2026-11'

  it('efectivo no suma fijos pendientes', () => {
    const fijos: GastoFijoDetalle[] = [{
      id: '00000000-0000-4000-8000-000000000060',
      comercioId: '00000000-0000-4000-8000-000000000002',
      estimadoCentavos: 9_000_000,
      pagosEsperados: 1,
      vencimiento: null,
      activo: true,
      comercio: 'Prepaga',
    }]
    const movsReales = [
      mov({ fecha: '2026-11-03', importeCentavos: 700_000, formaPago: 'efectivo' }),
      mov({ fecha: '2026-11-04', importeCentavos: 300_000, formaPago: 'tarjeta_credito' }),
    ]
    const args = { movsReales, cuotasMes: [], fijos, mes: MES, mesesHistorico: 3, diaActual: 10 }

    const efectivo = proyeccion(prediccionDelTope({ ...args, tope: 'efectivo' }).prediccion)
    expect(efectivo.base).toBe(700_000)

    const tarjeta = proyeccion(prediccionDelTope({ ...args, tope: 'tarjeta' }).prediccion)
    expect(tarjeta.base).toBe(300_000 + 9_000_000)
  })

  it('una cuota de tarjeta entra al gastado pero no al ritmo ni a puntuales', () => {
    // Histórico: agosto–octubre con $1.000 diarios de variable, para que haya umbral.
    const historico = ['2026-08', '2026-09', '2026-10'].flatMap((mes) =>
      Array.from({ length: 10 }, (_, i) =>
        mov({ fecha: `${mes}-${String(i + 1).padStart(2, '0')}`, importeCentavos: 300_000 }),
      ),
    )
    const movsReales = [...historico, mov({ fecha: '2026-11-05', importeCentavos: 200_000 })]
    const cuotasMes = cuotasDelMes(
      [compra({ fecha: '2026-11-03', importeCuotaCentavos: 50_000_000, cuotas: 6 })],
      MES,
    )
    expect(cuotasMes).toHaveLength(1)

    const args = { movsReales, fijos: [], mes: MES, tope: 'tarjeta' as const,
      mesesHistorico: 3, diaActual: 10 }
    const sin = prediccionDelTope({ ...args, cuotasMes: [] })
    const con = prediccionDelTope({ ...args, cuotasMes })

    const pSin = proyeccion(sin.prediccion)
    const pCon = proyeccion(con.prediccion)
    expect(pCon.base).toBe(pSin.base + 50_000_000)
    expect(pCon.ritmoDiario).toBe(pSin.ritmoDiario)
    expect(pCon.puntualesEsperados).toBe(pSin.puntualesEsperados)
    expect(con.puntualesMes).toEqual([])
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
  // base 1.000.000, ritmo 20.000 × 20 días → normal 1.400.000
  const p = prediccionCierre({
    gastado: 600_000, fijosPendientes: 400_000, variableMes: 200_000, puntualesMes: 0,
    perfil: { meses: 3, ritmoDiario: 20_000, puntualesPorMes: 0, umbral: null },
    diaActual: 10, diasMes: 30,
  })

  it('detecta cuando la proyección normal se pasa', () => {
    expect(superaElTope(p, 1_000_000)).toBe(true)
    expect(superaElTope(p, 2_000_000)).toBe(false)
  })

  it('sin tope configurado nunca se pasa', () => {
    expect(superaElTope(p, 0)).toBe(false)
  })

  it('mientras es temprano no afirma nada', () => {
    const temprano = prediccionCierre({
      gastado: 9_999_999, fijosPendientes: 0, variableMes: 0, puntualesMes: 0,
      perfil: { meses: 0, ritmoDiario: 0, puntualesPorMes: 0, umbral: null },
      diaActual: 1, diasMes: 30,
    })
    expect(superaElTope(temprano, 1)).toBe(false)
  })
})
