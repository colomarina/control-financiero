import 'server-only'
import { crearCliente, usuarioRequerido } from './client'
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

  const userId = await usuarioRequerido()

  const { error } = await supabase.from('presupuesto').upsert(
    {
      user_id: userId,
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
  const userId = await usuarioRequerido()

  const { error } = await supabase.from('presupuesto').upsert(
    utiles.map((l) => ({
      user_id: userId,
      mes: l.mes,
      comercio_id: l.comercioId,
      planeado_centavos: l.planeadoCentavos,
    })),
    { onConflict: 'user_id,mes,comercio_id' },
  )

  if (error) fallaDb('copiar el plan', error)
  return utiles.length
}

/**
 * Reescribe varias líneas de un mes de una sola vez: lo usa "mover plata".
 *
 * Las dos líneas van en **un solo upsert**, que es un solo statement y por lo
 * tanto atómico: no puede quedar sacada la plata de un lado sin haber llegado
 * al otro. Después se borran las que quedaron en 0 (mismo criterio que
 * `guardarLinea`); si ese borrado fallara, lo que queda es una línea en 0,
 * que se ve como "Sin plan" y no descuadra nada.
 */
export async function reescribirLineas(
  mes: Mes,
  lineas: Array<{ comercioId: string; planeadoCentavos: number }>,
): Promise<void> {
  const supabase = await crearCliente()
  const userId = await usuarioRequerido()

  const { error } = await supabase.from('presupuesto').upsert(
    lineas.map((l) => ({
      user_id: userId,
      mes,
      comercio_id: l.comercioId,
      planeado_centavos: l.planeadoCentavos,
    })),
    { onConflict: 'user_id,mes,comercio_id' },
  )
  if (error) fallaDb('mover la plata', error)

  const vacias = lineas.filter((l) => l.planeadoCentavos === 0).map((l) => l.comercioId)
  if (vacias.length === 0) return

  const { error: errorBorrar } = await supabase
    .from('presupuesto')
    .delete()
    .eq('mes', mes)
    .in('comercio_id', vacias)
  if (errorBorrar) fallaDb('sacar la línea vacía', errorBorrar)
}
