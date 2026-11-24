'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { formatoARS, parsearImporte } from '@/lib/core/dinero'
import { sumarMeses } from '@/lib/core/fechas'
import { copiarPlan, moverPlata, presupuestoVsReal } from '@/lib/core/presupuesto'
import { getPlanDelMes, guardarLinea, guardarLineas, reescribirLineas } from '@/lib/db/presupuesto'
import { getMovimientosDelMes } from '@/lib/db/movimientos'
import { getComercios } from '@/lib/db/comercios'

export type EstadoPlan =
  | { ok: true; mensaje: string }
  | { ok: false; error: string }
  | null

const mesSchema = z.string().regex(/^\d{4}-\d{2}$/, 'El mes va como AAAA-MM')

const lineaSchema = z.object({
  mes: mesSchema,
  comercioId: z.uuid('Elegí un comercio'),
  planeadoCentavos: z.int().nonnegative('El plan no puede ser negativo'),
})

export async function guardarLineaPlan(
  _estado: EstadoPlan,
  formData: FormData,
): Promise<EstadoPlan> {
  const crudo = String(formData.get('planeado') ?? '').trim()
  const planeadoCentavos = crudo === '' ? 0 : parsearImporte(crudo)
  if (planeadoCentavos === null) {
    return { ok: false, error: 'El monto no es un número válido.' }
  }

  const parsed = lineaSchema.safeParse({
    mes: formData.get('mes'),
    comercioId: formData.get('comercioId'),
    planeadoCentavos,
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    await guardarLinea(parsed.data)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude guardarlo.' }
  }

  revalidatePath('/presupuesto')
  return {
    ok: true,
    mensaje: parsed.data.planeadoCentavos === 0 ? 'Línea quitada.' : 'Plan guardado.',
  }
}

/**
 * Para la fila del plan, que no usa `useActionState`. Devuelve el resultado
 * para que `FilaEditable` lo muestre en un toast y cierre el editor.
 */
export async function guardarLineaDirecto(formData: FormData): Promise<EstadoPlan> {
  return guardarLineaPlan(null, formData)
}

/** Arrastra el plan del mes anterior al mes que estás mirando. */
export async function copiarMesAnterior(formData: FormData): Promise<void> {
  const mes = mesSchema.safeParse(formData.get('mes'))
  if (!mes.success) return

  const anterior = sumarMeses(mes.data, -1)
  const plan = await getPlanDelMes(anterior)
  await guardarLineas(copiarPlan(plan, anterior, mes.data))

  revalidatePath('/presupuesto')
}

const moverSchema = z.object({
  mes: mesSchema,
  origenId: z.uuid('Elegí de dónde sale la plata'),
  destinoId: z.uuid('Elegí a dónde va la plata'),
  montoCentavos: z.int().positive('El monto tiene que ser mayor a cero'),
})

/**
 * Pasa plata del plan de un comercio a otro en el mismo mes ("no hubo
 * fulbito, esa plata fue a la carnicería").
 *
 * Las reglas —cuánto se puede mover, qué pasa con el destino— viven en
 * `moverPlata`. Acá se recalcula contra el plan y los movimientos **de la
 * base**, no contra lo que mostraba la pantalla: si se cargó un gasto en otra
 * pestaña, el tope de lo que se puede mover ya lo tiene en cuenta.
 *
 * Los movimientos son solo los reales, como en toda la pantalla de
 * presupuesto (ver la tabla de cuotas en CLAUDE.md).
 */
export async function moverPlataPlan(
  _estado: EstadoPlan,
  formData: FormData,
): Promise<EstadoPlan> {
  const montoCentavos = parsearImporte(String(formData.get('monto') ?? ''))
  if (montoCentavos === null) {
    return { ok: false, error: 'El monto no es un número válido.' }
  }

  const parsed = moverSchema.safeParse({
    mes: formData.get('mes'),
    origenId: formData.get('origenId'),
    destinoId: formData.get('destinoId'),
    montoCentavos,
  })
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }
  const { mes, origenId, destinoId } = parsed.data

  try {
    const [plan, movs, comercios] = await Promise.all([
      getPlanDelMes(mes),
      getMovimientosDelMes(mes),
      getComercios(),
    ])

    const r = moverPlata(presupuestoVsReal(plan, movs, mes), origenId, destinoId, montoCentavos)
    if (!r.ok) return r

    await reescribirLineas(mes, r.lineas)

    const nombre = (id: string) => comercios.find((c) => c.id === id)?.nombre ?? 'otro comercio'
    revalidatePath('/presupuesto')
    return {
      ok: true,
      mensaje: `Moviste ${formatoARS(montoCentavos)} de ${nombre(origenId)} a ${nombre(destinoId)}.`,
    }
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude mover la plata.' }
  }
}
