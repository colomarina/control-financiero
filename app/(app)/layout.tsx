import Link from 'next/link'
import { cerrarSesion } from '@/app/actions/auth'
import { NavMobile } from '@/components/NavMobile'
import { LinkConEstado } from '@/components/LinkConEstado'
import { Icono } from '@/components/Icono'

/**
 * Layout de la app logueada.
 *
 * Header fijo arriba y bottom-nav fija abajo, las dos con backdrop-blur y
 * respetando las safe areas. El contenido va en una columna `max-w-md`
 * centrada, con padding suficiente para no quedar tapado por ninguna de las dos.
 */
export default function AppLayout({ children }: LayoutProps<'/'>) {
  return (
    <div className="flex min-h-dvh flex-col">
      <header className="border-outline-variant bg-surface/80 pt-safe fixed inset-x-0 top-0 z-40 border-b backdrop-blur-xl">
        <div className="px-margin-mobile gap-space-sm mx-auto flex h-14 max-w-md items-center">
          <Link href="/" className="gap-space-sm flex min-w-0 items-center">
            <span className="bg-primary/15 text-primary grid size-8 shrink-0 place-items-center rounded-full">
              <Icono nombre="savings" className="text-[18px]" />
            </span>
            <span className="text-headline-sm truncate">Control Financiero</span>
          </Link>

          <div className="gap-space-xs ml-auto flex shrink-0 items-center">
            <LinkConEstado
              href="/historial"
              aria-label="Historial"
              className="text-on-surface-variant hover:text-on-surface grid size-9 place-items-center rounded-full"
              pendiente={
                <Icono nombre="progress_activity" className="text-primary animate-spin text-[20px]" />
              }
            >
              <Icono nombre="trending_up" className="text-[20px]" />
            </LinkConEstado>

            <form action={cerrarSesion}>
              <button
                type="submit"
                aria-label="Salir"
                className="text-on-surface-variant hover:text-on-surface grid size-9 place-items-center rounded-full"
              >
                <Icono nombre="logout" className="text-[20px]" />
              </button>
            </form>
          </div>
        </div>
      </header>

      {/* pt-20 despeja el header; pb-32 despeja la nav y el FAB. */}
      <main className="px-margin-mobile mx-auto w-full max-w-md flex-1 pt-20 pb-32">
        {children}
      </main>

      {/* FAB: la acción principal de la app, al alcance del pulgar.
          Es el único link de la pantalla que no tiene a dónde teñirse —ya es
          verde— así que el aviso de "voy en camino" es cambiar el + por un
          spinner. */}
      <LinkConEstado
        href="/cargar"
        aria-label="Cargar gasto"
        className="bg-primary-container text-on-primary mb-safe fixed bottom-3 left-1/2 z-50 grid size-14 -translate-x-1/2 place-items-center rounded-full shadow-[0_6px_20px_rgba(16,185,129,0.45)] transition-transform active:scale-95"
        pendiente={<Icono nombre="progress_activity" className="animate-spin text-[28px]" />}
      >
        <Icono nombre="add" className="text-[28px]" />
      </LinkConEstado>

      <NavMobile />
    </div>
  )
}
