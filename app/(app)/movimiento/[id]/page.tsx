import { notFound } from 'next/navigation'
import { getMovimiento, getMovimientosDesde } from '@/lib/db/movimientos'
import { getComercios } from '@/lib/db/comercios'
import { hoyISO, mesActual, sumarMeses } from '@/lib/core/fechas'
import { comerciosFrecuentes } from '@/lib/core/frecuentes'
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

  const movimiento = await getMovimiento(id)
  // El RLS ya filtra por usuario: si no aparece, o no existe o no es tuyo.
  if (!movimiento) notFound()

  const [comercios, movs] = await Promise.all([
    getComercios(),
    getMovimientosDesde(sumarMeses(mesActual(), -1)),
  ])

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
        frecuentes={comerciosFrecuentes(movs, comercios)}
        hoy={hoyISO()}
        movimiento={movimiento}
      />
    </div>
  )
}
