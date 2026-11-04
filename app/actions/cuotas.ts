'use server'

import { revalidatePath } from 'next/cache'

import { nuevaCompraCuotasSchema } from '@/lib/schemas/compraCuotas'
import { crearCompra } from '@/lib/db/cuotas'
import { parsearImporte } from '@/lib/core/dinero'
import type { EstadoForm } from '@/app/actions/movimientos'

// Duplicado de `texto()` en `movimientos.ts` y no importado desde ahí: un
// archivo 'use server' solo puede exportar funciones async (son Server
// Actions), así que ese helper sync no se puede sacar de su archivo.
function texto(fd: FormData, campo: string): string | null {
  const v = fd.get(campo)
  if (typeof v !== 'string') return null
  const limpio = v.trim()
  return limpio === '' ? null : limpio
}

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
