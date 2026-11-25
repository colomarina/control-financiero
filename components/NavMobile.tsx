'use client'

import Link from 'next/link'
import { useLinkStatus } from 'next/link'
import { usePathname } from 'next/navigation'
import { Icono } from '@/components/Icono'
import { cn } from '@/lib/utils'

/**
 * Bottom-nav fija con cuatro tabs y el hueco central para el FAB.
 * El FAB lo pone el layout, no este componente.
 *
 * Son las pantallas de todos los días. Config y cerrar sesión, que se tocan
 * poco, viven en el menú del encabezado (`MenuEncabezado`).
 */
const TABS = [
  { href: '/', etiqueta: 'Este mes', icono: 'dashboard' },
  { href: '/presupuesto', etiqueta: 'Presupuesto', icono: 'account_balance_wallet' },
  { href: '/fijos', etiqueta: 'Fijos', icono: 'event_repeat' },
  { href: '/historial', etiqueta: 'Historial', icono: 'trending_up' },
] as const

/**
 * El contenido del tab, separado porque `useLinkStatus` solo funciona dentro
 * de un `<Link>`: es el que sabe si *esa* navegación está en curso.
 *
 * Sin esto, entre el tap y la respuesta del server no pasa nada en pantalla y
 * parece que el toque no registró. El punto no es informar que carga —de eso
 * se encargan los `loading.tsx`— sino acusar recibo en el acto.
 */
function ContenidoTab({
  etiqueta,
  icono,
  activo,
}: {
  etiqueta: string
  icono: string
  activo: boolean
}) {
  const { pending } = useLinkStatus()

  return (
    <span
      className={cn(
        'gap-space-xs px-space-xs py-space-sm flex flex-col items-center transition-colors',
        activo || pending ? 'text-primary' : 'text-on-surface-variant',
      )}
    >
      <Icono
        nombre={icono}
        relleno={activo}
        className={cn('text-[22px]', pending && !activo && 'animate-pulse')}
      />
      <span className="text-label-caps">{etiqueta}</span>
    </span>
  )
}

function Tab({
  href,
  etiqueta,
  icono,
  activo,
}: {
  href: string
  etiqueta: string
  icono: string
  activo: boolean
}) {
  return (
    <li className="flex-1">
      <Link href={href} aria-current={activo ? 'page' : undefined} className="block">
        <ContenidoTab etiqueta={etiqueta} icono={icono} activo={activo} />
      </Link>
    </li>
  )
}

export function NavMobile() {
  const pathname = usePathname()
  const esActivo = (href: string) => pathname === href

  return (
    <nav className="border-outline-variant bg-surface/80 pb-safe fixed inset-x-0 bottom-0 z-40 border-t backdrop-blur-xl">
      <ul className="mx-auto flex max-w-md items-stretch">
        {TABS.slice(0, 2).map((t) => (
          <Tab key={t.href} {...t} activo={esActivo(t.href)} />
        ))}

        {/* El hueco del FAB, que vive encima en el layout. */}
        <li className="w-16 shrink-0" aria-hidden />

        {TABS.slice(2).map((t) => (
          <Tab key={t.href} {...t} activo={esActivo(t.href)} />
        ))}
      </ul>
    </nav>
  )
}
