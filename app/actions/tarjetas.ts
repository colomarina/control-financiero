'use server'

import { revalidatePath } from 'next/cache'
import { guardarTarjetaSchema } from '@/lib/schemas/tarjeta'
import { guardarTarjeta } from '@/lib/db/tarjetas'

export type EstadoTarjeta =
  | { ok: true; mensaje: string }
  | { ok: false; error: string }
  | null

/**
 * Alta (sin `id`) o edición (con `id`) de una tarjeta. Devuelve el resultado
 * para que `FilaEditable` —o el alta— lo muestre en un toast.
 */
export async function guardarTarjetaDirecto(formData: FormData): Promise<EstadoTarjeta> {
  const id = formData.get('id')
  const parsed = guardarTarjetaSchema.safeParse({
    id: typeof id === 'string' && id !== '' ? id : undefined,
    nombre: formData.get('nombre'),
    banco: formData.get('banco'),
    red: formData.get('red') || null,
    sumaMeta: formData.get('sumaMeta') === 'on',
    activa: formData.get('activa') === 'on',
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    await guardarTarjeta(parsed.data)
  } catch (e) {
    const msg = e instanceof Error ? e.message : ''
    return {
      ok: false,
      error: /duplicate|unique/i.test(msg) ? 'Ya hay una tarjeta con ese nombre.' : msg || 'No pude guardarla.',
    }
  }

  // Una tarjeta que cambia de `sumaMeta` mueve la meta del Home.
  revalidatePath('/', 'layout')
  return { ok: true, mensaje: parsed.data.id ? 'Tarjeta guardada.' : 'Tarjeta agregada.' }
}
