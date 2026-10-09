import { getComercios } from '@/lib/db/comercios'
import { getMovimientosDesde } from '@/lib/db/movimientos'
import { hoyISO, mesActual, sumarMeses } from '@/lib/core/fechas'
import { comerciosFrecuentes } from '@/lib/core/frecuentes'
import { FormGasto } from '@/components/FormGasto'

export default async function CargarPage() {
  // Ventana de dos meses para los atajos: el actual más el anterior. Solo el
  // mes corriente dejaría la grilla casi vacía los primeros días.
  const desde = sumarMeses(mesActual(), -1)

  const [comercios, movs] = await Promise.all([
    getComercios(),
    getMovimientosDesde(desde),
  ])

  return (
    <div className="gap-space-lg flex flex-col">
      <header>
        <h1 className="text-headline-lg-mobile text-on-surface">Cargar gasto</h1>
      </header>

      <FormGasto
        comercios={comercios}
        frecuentes={comerciosFrecuentes(movs, comercios)}
        hoy={hoyISO()}
      />
    </div>
  )
}
