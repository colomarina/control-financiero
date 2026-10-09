import { describe, it, expect } from 'vitest'
import type { LineaPresupuestoDetalle } from '@/lib/schemas/presupuesto'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import {
  presupuestoVsReal,
  resumenPresupuesto,
  copiarPlan,
} from './presupuesto'

const ID = {
  verduleria: '00000000-0000-4000-8000-000000000001',
  gym: '00000000-0000-4000-8000-000000000002',
  milanesas: '00000000-0000-4000-8000-000000000003',
  farmacia: '00000000-0000-4000-8000-000000000004',
  coto: '00000000-0000-4000-8000-000000000009',
}

// Importes del Historial Presupuestos del Excel (octubre).
const plan: LineaPresupuestoDetalle[] = [
  { id: 'p1', mes: '2026-10', comercioId: ID.verduleria, comercio: 'Verdulería', planeadoCentavos: 15_000_000 },
  { id: 'p2', mes: '2026-10', comercioId: ID.gym, comercio: 'Gym', planeadoCentavos: 5_000_000 },
  { id: 'p3', mes: '2026-10', comercioId: ID.milanesas, comercio: 'Milanesas', planeadoCentavos: 10_000_000 },
  { id: 'p4', mes: '2026-10', comercioId: ID.farmacia, comercio: 'Farmacia', planeadoCentavos: 0 },
  // Otro mes: no tiene que aparecer en octubre.
  { id: 'p5', mes: '2026-09', comercioId: ID.gym, comercio: 'Gym', planeadoCentavos: 999_999 },
]

let n = 0
function mov(p: Partial<MovimientoDetalle> = {}): MovimientoDetalle {
  n += 1
  return {
    id: `00000000-0000-4000-8000-${String(100 + n).padStart(12, '0')}`,
    fecha: '2026-10-05',
    comercioId: ID.coto,
    importeCentavos: 100_000,
    formaPago: 'efectivo',
    banco: null,
    tarjeta: null,
    nota: null,
    comercio: 'Coto',
    categoria: 'Supermercado',
    subcategoria: null,
    esFijo: false,
    ...p,
  }
}

const movs: MovimientoDetalle[] = [
  // Verdulería: se pasó (16.000.000 sobre 15.000.000)
  mov({ comercioId: ID.verduleria, comercio: 'Verdulería', importeCentavos: 16_000_000 }),
  // Gym: al límite (4.800.000 de 5.000.000 = 96%)
  mov({ comercioId: ID.gym, comercio: 'Gym', importeCentavos: 4_800_000 }),
  // Milanesas: tranquilo (3.000.000 de 10.000.000)
  mov({ comercioId: ID.milanesas, comercio: 'Milanesas', importeCentavos: 3_000_000 }),
  // Coto: no está en el plan
  mov({ comercioId: ID.coto, importeCentavos: 7_000_000 }),
  // Otro mes
  mov({ fecha: '2026-09-15', comercioId: ID.verduleria, comercio: 'Verdulería', importeCentavos: 99_000_000 }),
]

describe('presupuestoVsReal', () => {
  it('solo toma las líneas del mes pedido', () => {
    const filas = presupuestoVsReal(plan, movs, '2026-10')
    expect(filas).toHaveLength(4)
    expect(filas.map((f) => f.comercio).sort()).toEqual([
      'Farmacia', 'Gym', 'Milanesas', 'Verdulería',
    ])
  })

  it('cruza el plan con lo realmente gastado', () => {
    const filas = presupuestoVsReal(plan, movs, '2026-10')
    const verduleria = filas.find((f) => f.comercio === 'Verdulería')!
    expect(verduleria).toMatchObject({
      planeado: 15_000_000,
      real: 16_000_000,
      diferencia: -1_000_000,
      estado: 'excedido',
    })
  })

  it('no mezcla el gasto de otro mes', () => {
    const verduleria = presupuestoVsReal(plan, movs, '2026-10')
      .find((f) => f.comercio === 'Verdulería')!
    expect(verduleria.real).toBe(16_000_000)
  })

  it('marca al-limite cuando pasa el umbral sin excederse', () => {
    const gym = presupuestoVsReal(plan, movs, '2026-10').find((f) => f.comercio === 'Gym')!
    expect(gym.estado).toBe('al-limite')
    expect(gym.porcentajeUsado).toBe(96)
  })

  it('respeta un umbral distinto', () => {
    // Con umbral 98, el gym al 96% todavía está ok.
    const gym = presupuestoVsReal(plan, movs, '2026-10', 98).find((f) => f.comercio === 'Gym')!
    expect(gym.estado).toBe('ok')
  })

  it('marca ok lo que va holgado', () => {
    const mila = presupuestoVsReal(plan, movs, '2026-10').find((f) => f.comercio === 'Milanesas')!
    expect(mila).toMatchObject({ estado: 'ok', diferencia: 7_000_000, porcentajeUsado: 30 })
  })

  it('un plan en cero es sin-plan, no excedido', () => {
    const farmacia = presupuestoVsReal(plan, movs, '2026-10')
      .find((f) => f.comercio === 'Farmacia')!
    expect(farmacia).toMatchObject({ estado: 'sin-plan', real: 0, porcentajeUsado: 0 })
  })

  it('ordena por lo que más se fue de cauce', () => {
    expect(presupuestoVsReal(plan, movs, '2026-10').map((f) => f.comercio)).toEqual([
      'Verdulería', 'Gym', 'Milanesas', 'Farmacia',
    ])
  })

  it('un mes sin plan devuelve vacío', () => {
    expect(presupuestoVsReal(plan, movs, '2026-12')).toEqual([])
  })
})

describe('resumenPresupuesto', () => {
  it('totaliza plan y real', () => {
    const r = resumenPresupuesto(presupuestoVsReal(plan, movs, '2026-10'))
    expect(r).toMatchObject({
      planeado: 30_000_000,
      real: 23_800_000,
      diferencia: 6_200_000,
      excedidos: 1,
      alLimite: 1,
    })
  })

  it('sin filas no explota', () => {
    expect(resumenPresupuesto([])).toMatchObject({
      planeado: 0,
      real: 0,
      porcentajeUsado: 0,
    })
  })
})

describe('copiarPlan', () => {
  it('arrastra las líneas de un mes al siguiente', () => {
    expect(copiarPlan(plan, '2026-10', '2026-11')).toEqual([
      { mes: '2026-11', comercioId: ID.verduleria, planeadoCentavos: 15_000_000 },
      { mes: '2026-11', comercioId: ID.gym, planeadoCentavos: 5_000_000 },
      { mes: '2026-11', comercioId: ID.milanesas, planeadoCentavos: 10_000_000 },
      { mes: '2026-11', comercioId: ID.farmacia, planeadoCentavos: 0 },
    ])
  })

  it('copiar un mes sin plan no devuelve nada', () => {
    expect(copiarPlan(plan, '2026-01', '2026-02')).toEqual([])
  })
})
