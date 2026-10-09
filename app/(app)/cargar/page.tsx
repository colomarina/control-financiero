import { getComercios } from '@/lib/db/comercios'
import { hoyISO } from '@/lib/core/fechas'
import { FormGasto } from '@/components/FormGasto'

export default async function CargarPage() {
  const comercios = await getComercios()

  return (
    <div className="gap-space-lg flex flex-col">
      <header>
        <h1 className="text-headline-lg-mobile text-on-surface">Cargar gasto</h1>
      </header>

      <FormGasto comercios={comercios} hoy={hoyISO()} />
    </div>
  )
}
