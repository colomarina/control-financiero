'use server'

import { revalidatePath } from 'next/cache'

import { nuevoMovimientoSchema } from '@/lib/schemas/movimiento'
import { crearMovimiento, borrarMovimiento, actualizarMovimiento } from '@/lib/db/movimientos'
import { parsearImporte } from '@/lib/core/dinero'

export type EstadoForm =
  | { ok: true; mensaje: string }
  | { ok: false; error: string }
  | null

function texto(fd: FormData, campo: string): string | null {
  const v = fd.get(campo)
  if (typeof v !== 'string') return null
  const limpio = v.trim()
  return limpio === '' ? null : limpio
}

export async function guardarMovimiento(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  // El importe llega como texto del input ("1.500,50"); a centavos antes de
  // validar, así el schema ya trabaja con enteros.
  const importeCentavos = parsearImporte(String(formData.get('importe') ?? ''))
  if (importeCentavos === null) {
    return { ok: false, error: 'El importe no es un número válido.' }
  }

  const parsed = nuevoMovimientoSchema.safeParse({
    fecha: formData.get('fecha'),
    comercioId: formData.get('comercioId'),
    importeCentavos,
    formaPago: formData.get('formaPago'),
    banco: texto(formData, 'banco'),
    tarjeta: texto(formData, 'tarjeta'),
    nota: texto(formData, 'nota'),
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    await crearMovimiento(parsed.data)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude guardarlo.' }
  }

  revalidatePath('/')
  revalidatePath('/cargar')
  return { ok: true, mensaje: 'Gasto cargado.' }
}

/**
 * Edita un movimiento existente.
 *
 * Valida exactamente igual que el alta —mismo parseo de importe, mismo schema—
 * porque un gasto editado tiene que cumplir las mismas reglas que uno nuevo.
 */
export async function editarMovimiento(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const id = formData.get('id')
  if (typeof id !== 'string' || id === '') {
    return { ok: false, error: 'Falta el movimiento a editar.' }
  }

  const importeCentavos = parsearImporte(String(formData.get('importe') ?? ''))
  if (importeCentavos === null) {
    return { ok: false, error: 'El importe no es un número válido.' }
  }

  const parsed = nuevoMovimientoSchema.safeParse({
    fecha: formData.get('fecha'),
    comercioId: formData.get('comercioId'),
    importeCentavos,
    formaPago: formData.get('formaPago'),
    banco: texto(formData, 'banco'),
    tarjeta: texto(formData, 'tarjeta'),
    nota: texto(formData, 'nota'),
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    await actualizarMovimiento(id, parsed.data)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude guardarlo.' }
  }

  // Un movimiento editado puede cambiar de mes, así que se refresca todo:
  // el Home, el historial, los fijos y el presupuesto leen de lo mismo.
  revalidatePath('/', 'layout')
  return { ok: true, mensaje: 'Gasto actualizado.' }
}

export async function eliminarMovimiento(id: string): Promise<EstadoForm> {
  try {
    await borrarMovimiento(id)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude borrarlo.' }
  }

  revalidatePath('/', 'layout')
  return { ok: true, mensaje: 'Gasto borrado.' }
}
