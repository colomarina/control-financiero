import 'server-only'
import { crearCliente } from './client'
import type { FormaPago, MovimientoDetalle } from '@/lib/schemas/movimiento'
import { diasDelMes, type Mes } from '@/lib/core/fechas'

/**
 * Repositorio de movimientos.
 *
 * Lee de la vista `movimientos_detalle`, que ya resuelve el join con comercios.
 * La vista NO agrega nada: los totales los calcula `/lib/core/gastos.ts`.
 */

const COLUMNAS =
  'id, fecha, comercio_id, importe_centavos, forma_pago, banco, tarjeta, nota, ' +
  'comercio, categoria, subcategoria, es_fijo'

type FilaDetalle = {
  id: string
  fecha: string
  comercio_id: string
  importe_centavos: number
  forma_pago: FormaPago
  banco: string | null
  tarjeta: string | null
  nota: string | null
  comercio: string
  categoria: string
  subcategoria: string | null
  es_fijo: boolean
}

function aDominio(f: FilaDetalle): MovimientoDetalle {
  return {
    id: f.id,
    fecha: f.fecha,
    comercioId: f.comercio_id,
    importeCentavos: Number(f.importe_centavos),
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

/** El primer y el último día de un mes, como fechas ISO. */
function rangoDelMes(mes: Mes): [string, string] {
  return [`${mes}-01`, `${mes}-${String(diasDelMes(mes)).padStart(2, '0')}`]
}

/**
 * Los movimientos de un mes. Filtra por rango de fechas (no por `to_char`)
 * para que use el índice `movimientos_user_fecha_ix`.
 */
export async function getMovimientosDelMes(mes: Mes): Promise<MovimientoDetalle[]> {
  const [desde, hasta] = rangoDelMes(mes)
  const supabase = await crearCliente()
  const { data, error } = await supabase
    .from('movimientos_detalle')
    .select(COLUMNAS)
    .gte('fecha', desde)
    .lte('fecha', hasta)
    .order('fecha', { ascending: false })

  if (error) throw new Error(`No pude leer los movimientos: ${error.message}`)
  return (data as unknown as FilaDetalle[]).map(aDominio)
}

/**
 * Los movimientos desde un mes en adelante. Lo usa la predicción, que necesita
 * el mes actual más los meses de histórico en una sola consulta.
 */
export async function getMovimientosDesde(mes: Mes): Promise<MovimientoDetalle[]> {
  const supabase = await crearCliente()
  const { data, error } = await supabase
    .from('movimientos_detalle')
    .select(COLUMNAS)
    .gte('fecha', `${mes}-01`)
    .order('fecha', { ascending: false })

  if (error) throw new Error(`No pude leer los movimientos: ${error.message}`)
  return (data as unknown as FilaDetalle[]).map(aDominio)
}

/** Los meses que tienen al menos un movimiento, del más nuevo al más viejo. */
export async function getMesesConMovimientos(): Promise<Mes[]> {
  const supabase = await crearCliente()
  const { data, error } = await supabase
    .from('movimientos_detalle')
    .select('mes')
    .order('mes', { ascending: false })

  if (error) throw new Error(`No pude leer los meses: ${error.message}`)
  return [...new Set((data as unknown as { mes: string }[]).map((f) => f.mes))]
}

export async function crearMovimiento(m: {
  fecha: string
  comercioId: string
  importeCentavos: number
  formaPago: FormaPago
  banco: string | null
  tarjeta: string | null
  nota: string | null
}): Promise<void> {
  const supabase = await crearCliente()
  const { error } = await supabase.from('movimientos').insert({
    fecha: m.fecha,
    comercio_id: m.comercioId,
    importe_centavos: m.importeCentavos,
    forma_pago: m.formaPago,
    banco: m.banco,
    tarjeta: m.tarjeta,
    nota: m.nota,
  })

  if (error) throw new Error(`No pude guardar el movimiento: ${error.message}`)
}

export async function borrarMovimiento(id: string): Promise<void> {
  const supabase = await crearCliente()
  const { error } = await supabase.from('movimientos').delete().eq('id', id)
  if (error) throw new Error(`No pude borrar el movimiento: ${error.message}`)
}

/** Un movimiento por id, o `null` si no existe (o no es de este usuario: lo filtra el RLS). */
export async function getMovimiento(id: string): Promise<MovimientoDetalle | null> {
  const supabase = await crearCliente()
  const { data, error } = await supabase
    .from('movimientos_detalle')
    .select(COLUMNAS)
    .eq('id', id)
    .maybeSingle()

  if (error) throw new Error(`No pude leer el movimiento: ${error.message}`)
  return data ? aDominio(data as unknown as FilaDetalle) : null
}

export async function actualizarMovimiento(
  id: string,
  m: {
    fecha: string
    comercioId: string
    importeCentavos: number
    formaPago: FormaPago
    banco: string | null
    tarjeta: string | null
    nota: string | null
  },
): Promise<void> {
  const supabase = await crearCliente()
  const { error } = await supabase
    .from('movimientos')
    .update({
      fecha: m.fecha,
      comercio_id: m.comercioId,
      importe_centavos: m.importeCentavos,
      forma_pago: m.formaPago,
      banco: m.banco,
      tarjeta: m.tarjeta,
      nota: m.nota,
    })
    .eq('id', id)

  if (error) throw new Error(`No pude actualizar el movimiento: ${error.message}`)
}
