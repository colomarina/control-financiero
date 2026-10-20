import 'server-only'
import { crearCliente } from './client'
import type { GastoFijoDetalle } from '@/lib/schemas/gastoFijo'

/**
 * Repositorio de gastos fijos.
 *
 * Ojo: acá solo vive el PLAN (qué fijo, cuánto se espera, cuándo vence).
 * Si está pagado o no se deriva de los movimientos del mes, en
 * `lib/core/fijos.ts`. No hay nada que tildar en la base.
 */

type FilaFijo = {
  id: string
  comercio_id: string
  importe_estimado_centavos: number
  pagos_esperados: number | null
  vencimiento: string | null
  activo: boolean
  comercios: { nombre: string } | null
}

export async function getGastosFijos(): Promise<GastoFijoDetalle[]> {
  const supabase = await crearCliente()
  const { data, error } = await supabase
    .from('gastos_fijos')
    .select(
      'id, comercio_id, importe_estimado_centavos, pagos_esperados, vencimiento, activo, comercios(nombre)',
    )
    .eq('activo', true)

  if (error) throw new Error(`No pude leer los gastos fijos: ${error.message}`)

  return (data as unknown as FilaFijo[])
    .map((f) => ({
      id: f.id,
      comercioId: f.comercio_id,
      estimadoCentavos: Number(f.importe_estimado_centavos),
      // Una base sin la columna todavía migrada no rompe el checklist.
      pagosEsperados: Number(f.pagos_esperados ?? 1),
      vencimiento: f.vencimiento,
      activo: f.activo,
      comercio: f.comercios?.nombre ?? '(sin comercio)',
    }))
    .sort((a, b) => a.comercio.localeCompare(b.comercio, 'es'))
}

export async function guardarGastoFijo(g: {
  comercioId: string
  estimadoCentavos: number
  pagosEsperados: number
  vencimiento: string | null
}): Promise<void> {
  const supabase = await crearCliente()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('No hay sesión activa.')

  const { error } = await supabase.from('gastos_fijos').upsert(
    {
      user_id: user.user.id,
      comercio_id: g.comercioId,
      importe_estimado_centavos: g.estimadoCentavos,
      pagos_esperados: g.pagosEsperados,
      vencimiento: g.vencimiento,
    },
    { onConflict: 'user_id,comercio_id' },
  )

  if (error) throw new Error(`No pude guardar el gasto fijo: ${error.message}`)
}

export async function darDeBajaGastoFijo(id: string): Promise<void> {
  const supabase = await crearCliente()
  const { error } = await supabase.from('gastos_fijos').update({ activo: false }).eq('id', id)
  if (error) throw new Error(`No pude dar de baja el gasto fijo: ${error.message}`)
}
