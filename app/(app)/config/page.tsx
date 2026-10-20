import { getConfig } from '@/lib/db/config'
import { getTodosLosComercios, getCategorias } from '@/lib/db/comercios'
import { usuarioActual } from '@/lib/db/client'
import { FormConfig } from '@/components/FormConfig'
import { FormPassword } from '@/components/FormPassword'
import { CatalogoComercios } from '@/components/CatalogoComercios'
import { AltaComercio } from '@/components/AltaComercio'
import { Seccion } from '@/components/Seccion'

/**
 * Configuración, en secciones plegables.
 *
 * Apiladas y abiertas, las cinco secciones obligaban a scrollear tres
 * pantallas para llegar al catálogo —que es lo que más se toca— y dejaban el
 * cambio de contraseña debajo de la lista entera de comercios. Plegadas, la
 * pantalla entra de una y cada cosa está a un tap.
 *
 * El catálogo arranca abierto porque es la sección que se usa seguido; los
 * parámetros se tocan un par de veces por año.
 */
export default async function ConfigPage() {
  const [config, comercios, categorias, usuario] = await Promise.all([
    getConfig(),
    getTodosLosComercios(),
    getCategorias(),
    usuarioActual(),
  ])

  const activos = comercios.filter((c) => c.activo).length

  return (
    <div className="gap-space-md flex flex-col">
      <header>
        <h1 className="text-headline-lg-mobile text-on-surface">Configuración</h1>
      </header>

      {/* Las tres secciones de parámetros son un solo formulario con un solo
          botón: los campos de una sección cerrada se envían igual. */}
      <FormConfig config={config} />

      <Seccion titulo="Catálogo" contador={`${activos} activos`} abierta>
        <AltaComercio categorias={categorias} />
        <CatalogoComercios comercios={comercios} categorias={categorias} />
      </Seccion>

      <Seccion titulo="Cuenta" contador={usuario?.email ?? undefined}>
        <FormPassword email={usuario?.email ?? ''} />
      </Seccion>
    </div>
  )
}
