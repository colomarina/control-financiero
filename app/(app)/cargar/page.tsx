import { getComercios } from '@/lib/db/comercios'
import { getMovimientosDesde } from '@/lib/db/movimientos'
import { getConfig } from '@/lib/db/config'
import { getGastosFijos } from '@/lib/db/gastosFijos'
import { hoyISO, mesActual, mesDe, sumarMeses } from '@/lib/core/fechas'
import { comerciosFrecuentes } from '@/lib/core/frecuentes'
import { umbralesPuntual } from '@/lib/core/puntuales'
import { FormGasto } from '@/components/FormGasto'

export default async function CargarPage() {
  // Ventana de dos meses para los atajos: el actual más el anterior. Solo el
  // mes corriente dejaría la grilla casi vacía los primeros días.
  const mes = mesActual()
  const desde = sumarMeses(mes, -1)

  const [comercios, config, fijos] = await Promise.all([
    getComercios(),
    getConfig(),
    getGastosFijos(),
  ])
  // El umbral de "compra puntual" mira más meses que los atajos: se trae el
  // histórico completo y los atajos se recortan a los dos últimos meses.
  const movs = await getMovimientosDesde(sumarMeses(mes, -config.mesesHistorico))
  const recientes = movs.filter((m) => mesDe(m.fecha) >= desde)

  return (
    <div className="gap-space-lg flex flex-col">
      <header>
        <h1 className="text-headline-lg-mobile text-on-surface">Cargar gasto</h1>
      </header>

      <FormGasto
        comercios={comercios}
        frecuentes={comerciosFrecuentes(recientes, comercios)}
        hoy={hoyISO()}
        umbrales={umbralesPuntual(movs, fijos, mes, config.mesesHistorico)}
      />
    </div>
  )
}
