import 'server-only'
import { crearCliente } from './client'
import type { LineaPresupuestoDetalle } from '@/lib/schemas/presupuesto'
import type { Mes } from '@/lib/core/fechas'
import { fallaDb } from '@/lib/db/errores'

/**
 * Repositorio del presupuesto: el PLAN por comercio y mes.
 * La comparación contra lo real la hace `lib/core/presupuesto.ts`.
 */

type FilaPlan = {
  id: string
  mes: string
  comercio_id: string
  planeado_centavos: number
  comercios: { nombre: string } | null
}

const SELECT = 'id, mes, comercio_id, planeado_centavos, comercios(nombre)'

function aDominio(f: FilaPlan): LineaPresupuestoDetalle {
  return {
    id: f.id,
    mes: f.mes,
    comercioId: f.comercio_id,
    planeadoCentavos: Number(f.planeado_centavos),
    comercio: f.comercios?.nombre ?? '(sin comercio)',
  }
}

/** El plan de un mes. */
export async function getPlanDelMes(mes: Mes): Promise<LineaPresupuestoDetalle[]> {
  const supabase = await crearCliente()
  const { data, error } = await supabase.from('presupuesto').select(SELECT).eq('mes', mes)

  if (error) fallaDb('leer el presupuesto', error)
  return (data as unknown as FilaPlan[]).map(aDominio)
}

/** Los meses que tienen plan cargado, del más nuevo al más viejo. */
export async function getMesesConPlan(): Promise<Mes[]> {
  const supabase = await crearCliente()
  const { data, error } = await supabase
    .from('presupuesto')
    .select('mes')
    .order('mes', { ascending: false })

  if (error) fallaDb('leer los meses del presupuesto', error)
  return [...new Set((data as unknown as { mes: string }[]).map((f) => f.mes))]
}

/**
 * Guarda (o pisa) una línea del plan.
 * Un planeado de 0 borra la línea: no tiene sentido guardar "planeo gastar nada".
 */
export async function guardarLinea(l: {
  mes: Mes
  comercioId: string
  planeadoCentavos: number
}): Promise<void> {
  const supabase = await crearCliente()

  if (l.planeadoCentavos === 0) {
    const { error } = await supabase
      .from('presupuesto')
      .delete()
      .eq('mes', l.mes)
      .eq('comercio_id', l.comercioId)
    if (error) fallaDb('borrar la línea', error)
    return
  }

  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('No hay sesión activa.')

  const { error } = await supabase.from('presupuesto').upsert(
    {
      user_id: user.user.id,
      mes: l.mes,
      comercio_id: l.comercioId,
      planeado_centavos: l.planeadoCentavos,
    },
    { onConflict: 'user_id,mes,comercio_id' },
  )

  if (error) fallaDb('guardar la línea', error)
}

/** Inserta varias líneas de una (lo usa "copiar el plan del mes anterior"). */
export async function guardarLineas(
  lineas: Array<{ mes: Mes; comercioId: string; planeadoCentavos: number }>,
): Promise<number> {
  const utiles = lineas.filter((l) => l.planeadoCentavos > 0)
  if (utiles.length === 0) return 0

  const supabase = await crearCliente()
  const { data: user } = await supabase.auth.getUser()
  if (!user.user) throw new Error('No hay sesión activa.')

  const { error } = await supabase.from('presupuesto').upsert(
    utiles.map((l) => ({
      user_id: user.user!.id,
      mes: l.mes,
      comercio_id: l.comercioId,
      planeado_centavos: l.planeadoCentavos,
    })),
    { onConflict: 'user_id,mes,comercio_id' },
  )

  if (error) fallaDb('copiar el plan', error)
  return utiles.length
}
