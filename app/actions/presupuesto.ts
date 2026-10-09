'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { parsearImporte } from '@/lib/core/dinero'
import { sumarMeses } from '@/lib/core/fechas'
import { copiarPlan } from '@/lib/core/presupuesto'
import { getPlanDelMes, guardarLinea, guardarLineas } from '@/lib/db/presupuesto'

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

/** Para los `<form action>` de las filas, que no muestran estado propio. */
export async function guardarLineaDirecto(formData: FormData): Promise<void> {
  await guardarLineaPlan(null, formData)
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
