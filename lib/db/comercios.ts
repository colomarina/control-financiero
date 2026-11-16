import 'server-only'
import { crearCliente } from './client'
import type { Comercio } from '@/lib/schemas/comercio'
import { fallaDb } from '@/lib/db/errores'

/**
 * Repositorio de comercios. El `user_id` lo pone la base (`default auth.uid()`)
 * y el RLS filtra la lectura, así que acá no hace falta pasarlo nunca.
 */

const COLUMNAS = 'id, nombre, categoria, subcategoria, es_fijo, activo'

type FilaComercio = {
  id: string
  nombre: string
  categoria: string
  subcategoria: string | null
  es_fijo: boolean
  activo: boolean
}

function aDominio(f: FilaComercio): Comercio {
  return {
    id: f.id,
    nombre: f.nombre,
    categoria: f.categoria,
    subcategoria: f.subcategoria,
    esFijo: f.es_fijo,
    activo: f.activo,
  }
}

/** Todos los comercios activos, alfabéticos. Es lo que alimenta el autocomplete. */
export async function getComercios(): Promise<Comercio[]> {
  const supabase = await crearCliente()
  const { data, error } = await supabase
    .from('comercios')
    .select(COLUMNAS)
    .eq('activo', true)
    .order('nombre')

  if (error) fallaDb('leer los comercios', error)
  return (data as unknown as FilaComercio[]).map(aDominio)
}

/** Incluye los dados de baja. Para la pantalla de Configuración. */
export async function getTodosLosComercios(): Promise<Comercio[]> {
  const supabase = await crearCliente()
  const { data, error } = await supabase
    .from('comercios')
    .select(COLUMNAS)
    .order('nombre')

  if (error) fallaDb('leer los comercios', error)
  return (data as unknown as FilaComercio[]).map(aDominio)
}

export async function crearComercio(c: {
  nombre: string
  categoria: string
  subcategoria: string | null
  esFijo: boolean
}): Promise<Comercio> {
  const supabase = await crearCliente()
  const { data, error } = await supabase
    .from('comercios')
    .insert({
      nombre: c.nombre,
      categoria: c.categoria,
      subcategoria: c.subcategoria,
      es_fijo: c.esFijo,
    })
    .select(COLUMNAS)
    .single()

  if (error) {
    if (error.code === '23505') throw new Error(`Ya existe un comercio llamado "${c.nombre}".`)
    fallaDb('crear el comercio', error)
  }
  return aDominio(data as unknown as FilaComercio)
}

export async function editarComercio(
  id: string,
  cambios: Partial<{
    nombre: string
    categoria: string
    subcategoria: string | null
    esFijo: boolean
    activo: boolean
  }>,
): Promise<void> {
  const supabase = await crearCliente()
  const { error } = await supabase
    .from('comercios')
    .update({
      ...(cambios.nombre !== undefined && { nombre: cambios.nombre }),
      ...(cambios.categoria !== undefined && { categoria: cambios.categoria }),
      ...(cambios.subcategoria !== undefined && { subcategoria: cambios.subcategoria }),
      ...(cambios.esFijo !== undefined && { es_fijo: cambios.esFijo }),
      ...(cambios.activo !== undefined && { activo: cambios.activo }),
    })
    .eq('id', id)

  if (error) fallaDb('actualizar el comercio', error)
}

/** Las categorías que ya existen, para el desplegable. */
export async function getCategorias(): Promise<string[]> {
  const comercios = await getTodosLosComercios()
  return [...new Set(comercios.map((c) => c.categoria))].sort((a, b) => a.localeCompare(b, 'es'))
}
