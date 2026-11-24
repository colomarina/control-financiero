import 'server-only'
import { crearCliente, usuarioRequerido } from './client'
import type { Red, Tarjeta } from '@/lib/schemas/tarjeta'
import { fallaDb } from '@/lib/db/errores'

/** Repositorio de tarjetas (los plásticos con que se paga). */

type FilaTarjeta = {
  id: string
  nombre: string
  banco: string
  red: Red | null
  suma_meta: boolean
  activa: boolean
}

function aDominio(f: FilaTarjeta): Tarjeta {
  return {
    id: f.id,
    nombre: f.nombre,
    banco: f.banco,
    red: f.red,
    sumaMeta: f.suma_meta,
    activa: f.activa,
  }
}

/** Todas las tarjetas, activas primero y después por nombre. */
export async function getTarjetas(): Promise<Tarjeta[]> {
  const supabase = await crearCliente()
  const { data, error } = await supabase
    .from('tarjetas')
    .select('id, nombre, banco, red, suma_meta, activa')
    .order('activa', { ascending: false })
    .order('nombre')

  if (error) fallaDb('leer las tarjetas', error)
  return (data as FilaTarjeta[]).map(aDominio)
}

/** Alta (sin `id`) o edición (con `id`). */
export async function guardarTarjeta(t: Omit<Tarjeta, 'id'> & { id?: string }): Promise<void> {
  const supabase = await crearCliente()
  const fila = {
    nombre: t.nombre,
    banco: t.banco,
    red: t.red,
    suma_meta: t.sumaMeta,
    activa: t.activa,
  }

  if (t.id) {
    const { data, error } = await supabase.from('tarjetas').update(fila).eq('id', t.id).select('id')
    if (error) fallaDb('guardar la tarjeta', error)
    if (data.length === 0) throw new Error('No encontré esa tarjeta.')
    return
  }

  const userId = await usuarioRequerido()
  const { error } = await supabase.from('tarjetas').insert({ ...fila, user_id: userId })
  if (error) fallaDb('agregar la tarjeta', error)
}
