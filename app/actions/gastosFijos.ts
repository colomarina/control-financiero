'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { parsearImporte } from '@/lib/core/dinero'
import { guardarGastoFijo, darDeBajaGastoFijo } from '@/lib/db/gastosFijos'

export type EstadoFijoForm =
  | { ok: true; mensaje: string }
  | { ok: false; error: string }
  | null

const schema = z.object({
  comercioId: z.uuid('Elegí un comercio'),
  estimadoCentavos: z.int().nonnegative('El monto no puede ser negativo'),
  pagosEsperados: z.coerce
    .number()
    .int('Las facturas por mes son un número entero')
    .min(1, 'Un fijo llega al menos en una factura')
    .max(12, 'Como mucho una factura por mes'),
  vencimiento: z.string().trim().max(40).nullable(),
})

export async function guardarFijo(
  _estado: EstadoFijoForm,
  formData: FormData,
): Promise<EstadoFijoForm> {
  const estimadoCentavos = parsearImporte(String(formData.get('estimado') ?? ''))
  if (estimadoCentavos === null) {
    return { ok: false, error: 'El monto esperado no es un número válido.' }
  }

  const vencimientoCrudo = String(formData.get('vencimiento') ?? '').trim()

  const parsed = schema.safeParse({
    comercioId: formData.get('comercioId'),
    estimadoCentavos,
    pagosEsperados: formData.get('pagosEsperados') ?? 1,
    vencimiento: vencimientoCrudo === '' ? null : vencimientoCrudo,
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    await guardarGastoFijo(parsed.data)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude guardarlo.' }
  }

  revalidatePath('/fijos')
  revalidatePath('/')
  return { ok: true, mensaje: 'Gasto fijo guardado.' }
}

/**
 * Igual que `guardarFijo` pero para un `<form action>` sin `useActionState`.
 * Lo usa la fila del checklist.
 *
 * Antes **tiraba**: sin estado propio donde mostrar el error, devolverlo era
 * tragárselo y el usuario veía la fila volver intacta como si hubiera
 * guardado. Ahora la fila es una `FilaEditable`, que tiene dónde mostrarlo: un
 * monto mal tipeado es un toast rojo con la fila abierta, y no una pantalla de
 * error que se lleva puesto todo el checklist.
 */
export async function guardarFijoDirecto(formData: FormData): Promise<EstadoFijoForm> {
  return guardarFijo(null, formData)
}

export async function darDeBaja(formData: FormData): Promise<void> {
  const id = String(formData.get('id') ?? '')
  if (!id) return
  await darDeBajaGastoFijo(id)
  revalidatePath('/fijos')
  revalidatePath('/')
}
