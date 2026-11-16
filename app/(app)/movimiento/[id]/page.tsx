import { notFound } from 'next/navigation'
import { z } from 'zod'
import { getMovimiento, getMovimientosDesde } from '@/lib/db/movimientos'
import { getComercios } from '@/lib/db/comercios'
import { getConfig } from '@/lib/db/config'
import { getGastosFijos } from '@/lib/db/gastosFijos'
import { hoyISO, mesActual, mesDe, sumarMeses } from '@/lib/core/fechas'
import {
  comerciosFrecuentes,
  formasDePagoFrecuentes,
  ultimaFormaPorComercio,
} from '@/lib/core/frecuentes'
import { umbralesPuntual } from '@/lib/core/puntuales'
import { FormGasto } from '@/components/FormGasto'

/**
 * Editar un gasto ya cargado.
 *
 * Es una ruta y no un modal porque el formulario es el mismo de Cargar —largo,
 * con teclado numérico— y en el celular un modal de esa altura pelea con el
 * scroll. Además así el botón "atrás" del navegador hace lo que se espera.
 */
export default async function EditarMovimientoPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()

  const movimiento = await getMovimiento(id)
  // El RLS ya filtra por usuario: si no aparece, o no existe o no es tuyo.
  if (!movimiento) notFound()

  const mes = mesActual()
  const desde = sumarMeses(mes, -1)
  const [comercios, config, fijos] = await Promise.all([
    getComercios(),
    getConfig(),
    getGastosFijos(),
  ])
  const movs = await getMovimientosDesde(sumarMeses(mes, -config.mesesHistorico))
  const recientes = movs.filter((m) => mesDe(m.fecha) >= desde)

  return (
    <div className="gap-space-lg flex flex-col">
      <header>
        <h1 className="text-headline-lg-mobile text-on-surface">Editar gasto</h1>
        <p className="text-body-sm text-on-surface-variant">
          Los cambios se reflejan en los topes y en la predicción del mes.
        </p>
      </header>

      <FormGasto
        comercios={comercios}
        frecuentes={comerciosFrecuentes(recientes, comercios)}
        hoy={hoyISO()}
        umbrales={umbralesPuntual(movs, fijos, mes, config.mesesHistorico)}
        formasFrecuentes={formasDePagoFrecuentes(recientes)}
        ultimaForma={ultimaFormaPorComercio(movs)}
        movimiento={movimiento}
      />
    </div>
  )
}
