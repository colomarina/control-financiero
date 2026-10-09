import { getConfig } from '@/lib/db/config'
import { getTodosLosComercios, getCategorias } from '@/lib/db/comercios'
import { FormConfig } from '@/components/FormConfig'
import { CatalogoComercios } from '@/components/CatalogoComercios'
import { AltaComercio } from '@/components/AltaComercio'
import { Banner } from '@/components/ds'

export default async function ConfigPage() {
  const [config, comercios, categorias] = await Promise.all([
    getConfig(),
    getTodosLosComercios(),
    getCategorias(),
  ])

  const activos = comercios.filter((c) => c.activo).length

  return (
    <div className="gap-space-xl flex flex-col">
      <header>
        <h1 className="text-headline-lg-mobile text-on-surface">Configuración</h1>
      </header>

      <FormConfig config={config} />

      <section className="gap-space-sm flex flex-col">
        <div className="px-space-xs flex items-baseline justify-between">
          <h2 className="text-headline-md text-on-surface">Catálogo</h2>
          <span className="text-body-sm text-on-surface-variant tabular-nums">
            {activos} activos
          </span>
        </div>

        <Banner icono="category">
          De acá salen la categoría, la subcategoría y si un gasto es fijo. Los
          movimientos no copian esos datos: los heredan, así que cambiar un
          comercio reclasifica también sus movimientos viejos.
        </Banner>

        <AltaComercio categorias={categorias} />

        <CatalogoComercios comercios={comercios} categorias={categorias} />
      </section>
    </div>
  )
}
