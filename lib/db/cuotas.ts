import 'server-only'
import { crearCliente } from './client'
import type { FormaPago } from '@/lib/schemas/movimiento'
import type { CompraCuotasDetalle } from '@/lib/schemas/compraCuotas'
import { fallaDb } from '@/lib/db/errores'

/**
 * Repositorio de compras en cuotas.
 *
 * Lee de la vista `compras_cuotas_detalle`, que ya resuelve el join con
 * comercios. Las cuotas individuales no viven acá: las deriva
 * `lib/core/cuotas.ts` a partir de cada compra.
 */

const COLUMNAS =
  'id, fecha, comercio_id, importe_cuota_centavos, cuotas, forma_pago, banco, tarjeta, nota, ' +
  'comercio, categoria, subcategoria, es_fijo'

type FilaDetalle = {
  id: string
  fecha: string
  comercio_id: string
  importe_cuota_centavos: number
  cuotas: number
  forma_pago: FormaPago
  banco: string | null
  tarjeta: string | null
  nota: string | null
  comercio: string
  categoria: string
  subcategoria: string | null
  es_fijo: boolean
}

function aDominio(f: FilaDetalle): CompraCuotasDetalle {
  return {
    id: f.id,
    fecha: f.fecha,
    comercioId: f.comercio_id,
    importeCuotaCentavos: Number(f.importe_cuota_centavos),
    cuotas: Number(f.cuotas),
    formaPago: f.forma_pago,
    banco: f.banco,
    tarjeta: f.tarjeta,
    nota: f.nota,
    comercio: f.comercio,
    categoria: f.categoria,
    subcategoria: f.subcategoria,
    esFijo: f.es_fijo,
  }
}

/**
 * Todas las compras en cuotas, sin filtro de fecha: un plan viejo sigue
 * haciendo falta para el historial de sus meses, y son decenas de filas en
 * toda la vida de la app.
 */
export async function getComprasEnCuotas(): Promise<CompraCuotasDetalle[]> {
  const supabase = await crearCliente()
  const { data, error } = await supabase
    .from('compras_cuotas_detalle')
    .select(COLUMNAS)
    .order('fecha', { ascending: false })

  if (error) fallaDb('leer las compras en cuotas', error)
  return (data as unknown as FilaDetalle[]).map(aDominio)
}

/** Una compra en cuotas por id, o `null` si no existe (o no es de este usuario: lo filtra el RLS). */
export async function getCompraEnCuotas(id: string): Promise<CompraCuotasDetalle | null> {
  const supabase = await crearCliente()
  const { data, error } = await supabase
    .from('compras_cuotas_detalle')
    .select(COLUMNAS)
    .eq('id', id)
    .maybeSingle()

  if (error) fallaDb('leer la compra en cuotas', error)
  return data ? aDominio(data as unknown as FilaDetalle) : null
}

export async function crearCompra(c: {
  fecha: string
  comercioId: string
  importeCuotaCentavos: number
  cuotas: number
  formaPago: FormaPago
  banco: string | null
  tarjeta: string | null
  nota: string | null
}): Promise<void> {
  const supabase = await crearCliente()
  const { error } = await supabase.from('compras_cuotas').insert({
    fecha: c.fecha,
    comercio_id: c.comercioId,
    importe_cuota_centavos: c.importeCuotaCentavos,
    cuotas: c.cuotas,
    forma_pago: c.formaPago,
    banco: c.banco,
    tarjeta: c.tarjeta,
    nota: c.nota,
  })

  if (error) fallaDb('guardar la compra en cuotas', error)
}

export async function actualizarCompra(
  id: string,
  c: {
    fecha: string
    comercioId: string
    importeCuotaCentavos: number
    cuotas: number
    formaPago: FormaPago
    banco: string | null
    tarjeta: string | null
    nota: string | null
  },
): Promise<void> {
  const supabase = await crearCliente()
  const { data, error } = await supabase
    .from('compras_cuotas')
    .update({
      fecha: c.fecha,
      comercio_id: c.comercioId,
      importe_cuota_centavos: c.importeCuotaCentavos,
      cuotas: c.cuotas,
      forma_pago: c.formaPago,
      banco: c.banco,
      tarjeta: c.tarjeta,
      nota: c.nota,
    })
    .eq('id', id)
    .select('id')

  if (error) fallaDb('actualizar la compra en cuotas', error)
  if (data.length === 0) throw new Error('No encontré esa compra.')
}

export async function borrarCompra(id: string): Promise<void> {
  const supabase = await crearCliente()
  const { data, error } = await supabase.from('compras_cuotas').delete().eq('id', id).select('id')
  if (error) fallaDb('borrar la compra en cuotas', error)
  if (data.length === 0) throw new Error('No encontré esa compra.')
}
