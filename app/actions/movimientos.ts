'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { nuevoMovimientoSchema } from '@/lib/schemas/movimiento'
import { crearMovimiento, borrarMovimiento, actualizarMovimiento } from '@/lib/db/movimientos'
import { parsearImporte } from '@/lib/core/dinero'
import { texto, triestado, tarjetaDelForm } from '@/lib/formData'

export type EstadoForm =
  | { ok: true; mensaje: string }
  | { ok: false; error: string }
  | null

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
    tarjetaId: tarjetaDelForm(formData),
    nota: texto(formData, 'nota'),
    puntual: triestado(formData, 'puntual'),
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
  const idValido = z.uuid().safeParse(formData.get('id'))
  if (!idValido.success) {
    return { ok: false, error: 'Ese gasto no existe.' }
  }
  const id = idValido.data

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
    tarjetaId: tarjetaDelForm(formData),
    nota: texto(formData, 'nota'),
    puntual: triestado(formData, 'puntual'),
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

export async function eliminarMovimiento(id: unknown): Promise<EstadoForm> {
  const idValido = z.uuid().safeParse(id)
  if (!idValido.success) return { ok: false, error: 'Ese gasto no existe.' }

  try {
    await borrarMovimiento(idValido.data)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude borrarlo.' }
  }

  revalidatePath('/', 'layout')
  return { ok: true, mensaje: 'Gasto borrado.' }
}
