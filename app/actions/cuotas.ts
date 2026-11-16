'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'

import { nuevaCompraCuotasSchema } from '@/lib/schemas/compraCuotas'
import { crearCompra, getCompraEnCuotas, actualizarCompra, borrarCompra } from '@/lib/db/cuotas'
import { parsearImporte } from '@/lib/core/dinero'
import { puedeReducirA, cuotasTranscurridas } from '@/lib/core/cuotas'
import { mesActual } from '@/lib/core/fechas'
import { texto } from '@/lib/formData'
import type { EstadoForm } from '@/app/actions/movimientos'

/**
 * Da de alta una compra en cuotas. Espejo de `guardarMovimiento`: mismo
 * parseo de importe (acá es el importe de **cada** cuota) antes de validar.
 */
export async function guardarCompraEnCuotas(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const importeCuotaCentavos = parsearImporte(String(formData.get('importe') ?? ''))
  if (importeCuotaCentavos === null) {
    return { ok: false, error: 'El importe no es un número válido.' }
  }

  const parsed = nuevaCompraCuotasSchema.safeParse({
    fecha: formData.get('fecha'),
    comercioId: formData.get('comercioId'),
    importeCuotaCentavos,
    cuotas: Number(formData.get('cuotas')),
    formaPago: formData.get('formaPago'),
    banco: texto(formData, 'banco'),
    tarjeta: texto(formData, 'tarjeta'),
    nota: texto(formData, 'nota'),
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    await crearCompra(parsed.data)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude guardarla.' }
  }

  // Una compra mueve topes, predicción, fijos e historial de muchos meses a
  // la vez: no alcanza con revalidar el Home, como en el alta de un gasto suelto.
  revalidatePath('/', 'layout')
  return { ok: true, mensaje: 'Compra en cuotas cargada.' }
}

/**
 * Edita una compra en cuotas existente.
 *
 * Valida con el mismo schema que el alta —mismo motivo que `editarMovimiento`
 * reusa el del alta—: una compra editada tiene que cumplir las mismas reglas
 * que una nueva. Después de esa validación va la regla de dominio que el
 * schema no conoce: no se puede bajar el plan por debajo de las cuotas que ya
 * transcurrieron. El `min` del input es solo una ayuda visual —se puede
 * saltear desde las devtools— así que acá, y solo acá, se manda de verdad.
 *
 * **Hasta dónde llega esa garantía.** El piso se calcula contra la compra
 * **guardada**, pero lo que se escribe es la `fecha` **enviada**: corriendo la
 * fecha de compra hacia adelante y bajando las cuotas en la misma edición, las
 * transcurridas se recalculan y el piso cede. Es la consecuencia aceptada de
 * que la fecha sea editable (es un dato que uno carga mal y corrige) y de que
 * el piso sea una regla de dominio y no una invariante de la tabla. Vale
 * saberlo porque el mensaje de error de abajo promete más de lo que el sistema
 * sostiene: frena bajar el número de cuotas, no reescribir el plan entero.
 */
export async function editarCompraEnCuotas(
  _estado: EstadoForm,
  formData: FormData,
): Promise<EstadoForm> {
  const idValido = z.uuid().safeParse(formData.get('id'))
  if (!idValido.success) {
    return { ok: false, error: 'Esa compra no existe.' }
  }
  const id = idValido.data

  const importeCuotaCentavos = parsearImporte(String(formData.get('importe') ?? ''))
  if (importeCuotaCentavos === null) {
    return { ok: false, error: 'El importe no es un número válido.' }
  }

  const parsed = nuevaCompraCuotasSchema.safeParse({
    fecha: formData.get('fecha'),
    comercioId: formData.get('comercioId'),
    importeCuotaCentavos,
    cuotas: Number(formData.get('cuotas')),
    formaPago: formData.get('formaPago'),
    banco: texto(formData, 'banco'),
    tarjeta: texto(formData, 'tarjeta'),
    nota: texto(formData, 'nota'),
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const guardada = await getCompraEnCuotas(id)
  if (!guardada) {
    return { ok: false, error: 'No encontré esa compra.' }
  }

  const mes = mesActual()
  if (!puedeReducirA(guardada, parsed.data.cuotas, mes)) {
    return {
      ok: false,
      error: `Ya pasaron ${cuotasTranscurridas(guardada, mes)} cuotas de este plan. No podés bajarlo por debajo de eso: las que pagaste quedan.`,
    }
  }

  try {
    await actualizarCompra(id, parsed.data)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude guardarla.' }
  }

  // Igual que el alta: una compra editada puede mover topes, predicción,
  // fijos e historial de varios meses a la vez.
  revalidatePath('/', 'layout')
  return { ok: true, mensaje: 'Compra actualizada.' }
}

/**
 * Borra una compra en cuotas entera: la que se cargó, no la que se canceló.
 * Bajar el número de cuotas (`editarCompraEnCuotas`) es la otra operación, y
 * es la que corresponde a una baja o devolución real.
 */
export async function eliminarCompraEnCuotas(id: unknown): Promise<EstadoForm> {
  const idValido = z.uuid().safeParse(id)
  if (!idValido.success) return { ok: false, error: 'Esa compra no existe.' }

  try {
    await borrarCompra(idValido.data)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude borrarla.' }
  }

  revalidatePath('/', 'layout')
  return { ok: true, mensaje: 'Compra borrada.' }
}
