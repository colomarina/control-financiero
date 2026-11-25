'use client'

import Link, { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { useFormStatus } from 'react-dom'
import { cerrarSesion } from '@/app/actions/auth'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Icono } from '@/components/Icono'
import { Separador } from '@/components/ds'
import { cn } from '@/lib/utils'

/**
 * Lo que se usa poco va en el menú del encabezado; lo de todos los días, en la
 * bottom-nav. Config se toca un par de veces por año y el simulador es una
 * consulta puntual: los dos quedan a dos toques desde cualquier pantalla.
 */
const OPCIONES = [
  { href: '/simular', etiqueta: 'Simulador', icono: 'calculate' },
  { href: '/config', etiqueta: 'Configuración', icono: 'settings' },
] as const

const claseOpcion = cn(
  'px-space-sm gap-space-sm text-body-md flex min-h-11 w-full items-center rounded-lg py-2',
  'text-left outline-none transition-colors',
  'hover:bg-surface-container-highest focus-visible:bg-surface-container-highest',
  'active:bg-surface-container-highest',
)

/**
 * El contenido de una opción. Va aparte porque `useLinkStatus` solo funciona
 * adentro de un `<Link>`: mientras navega, el ícono pasa a spinner. Es el
 * mismo acuse que la bottom-nav y `LinkConEstado`.
 */
function ContenidoOpcion({
  etiqueta,
  icono,
  activa,
}: {
  etiqueta: string
  icono: string
  activa: boolean
}) {
  const { pending } = useLinkStatus()
  return (
    <span className={cn(claseOpcion, activa || pending ? 'text-primary' : 'text-on-surface')}>
      <Icono
        nombre={pending ? 'progress_activity' : icono}
        className={cn('text-[20px]', pending && 'animate-spin')}
      />
      {etiqueta}
    </span>
  )
}

/** Cerrar sesión es un form (la action borra la cookie); acusa con su propio spinner. */
function BotonSalir() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={cn(claseOpcion, 'text-on-surface-variant')}>
      <Icono
        nombre={pending ? 'progress_activity' : 'logout'}
        className={cn('text-[20px]', pending && 'animate-spin')}
      />
      {pending ? 'Saliendo…' : 'Cerrar sesión'}
    </button>
  )
}

/**
 * El menú desplegable del encabezado.
 *
 * No se cierra al tocar una opción: así se ve el spinner mientras llega la
 * pantalla. Se cierra solo al cambiar de ruta, porque el `key={pathname}`
 * remonta el `Popover` (sin estado ni efectos que sincronizar).
 */
export function MenuEncabezado() {
  const pathname = usePathname()

  return (
    <Popover key={pathname}>
      <PopoverTrigger
        aria-label="Menú"
        className={cn(
          'text-on-surface-variant hover:text-on-surface grid size-9 place-items-center rounded-full',
          'data-[state=open]:bg-surface-container-high data-[state=open]:text-on-surface',
        )}
      >
        <Icono nombre="menu" className="text-[22px]" />
      </PopoverTrigger>

      <PopoverContent align="end" sideOffset={8} className="w-56 gap-0 p-1">
        <nav aria-label="Más opciones">
          {OPCIONES.map((o) => (
            <Link
              key={o.href}
              href={o.href}
              aria-current={pathname === o.href ? 'page' : undefined}
              className="block"
            >
              <ContenidoOpcion etiqueta={o.etiqueta} icono={o.icono} activa={pathname === o.href} />
            </Link>
          ))}
        </nav>

        {/* Separado del resto: que no se toque sin querer. */}
        <Separador />
        <form action={cerrarSesion}>
          <BotonSalir />
        </form>
      </PopoverContent>
    </Popover>
  )
}
