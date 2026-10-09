'use server'

import { revalidatePath } from 'next/cache'
import { nuevoComercioSchema, editarComercioSchema } from '@/lib/schemas/comercio'
import { crearComercio, editarComercio } from '@/lib/db/comercios'

export type EstadoComercio =
  | { ok: true; mensaje: string }
  | { ok: false; error: string }
  | null

function texto(fd: FormData, campo: string): string | null {
  const v = fd.get(campo)
  if (typeof v !== 'string') return null
  const limpio = v.trim()
  return limpio === '' ? null : limpio
}

export async function nuevoComercio(
  _estado: EstadoComercio,
  formData: FormData,
): Promise<EstadoComercio> {
  const parsed = nuevoComercioSchema.safeParse({
    nombre: formData.get('nombre'),
    categoria: formData.get('categoria'),
    subcategoria: texto(formData, 'subcategoria'),
    esFijo: formData.get('esFijo') === 'on',
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    await crearComercio({
      nombre: parsed.data.nombre,
      categoria: parsed.data.categoria,
      subcategoria: parsed.data.subcategoria,
      esFijo: parsed.data.esFijo,
    })
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude crearlo.' }
  }

  revalidatePath('/', 'layout')
  return { ok: true, mensaje: 'Comercio creado.' }
}

/**
 * Edita un comercio desde la fila del catálogo.
 * Es un `<form action>` sin estado: el resultado se ve en la propia lista.
 */
export async function actualizarComercio(formData: FormData): Promise<void> {
  const parsed = editarComercioSchema.safeParse({
    id: formData.get('id'),
    nombre: formData.get('nombre'),
    categoria: formData.get('categoria'),
    subcategoria: texto(formData, 'subcategoria'),
    esFijo: formData.get('esFijo') === 'on',
    activo: formData.get('activo') === 'on',
  })

  if (!parsed.success) return

  const { id, ...cambios } = parsed.data
  await editarComercio(id, cambios)
  revalidatePath('/', 'layout')
}
