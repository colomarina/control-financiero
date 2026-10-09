'use client'

import Link from 'next/link'
import { usePathname } from 'next/navigation'
import { Icono } from '@/components/Icono'
import { cn } from '@/lib/utils'

/**
 * Bottom-nav fija con cuatro tabs y el hueco central para el FAB.
 * El FAB lo pone el layout, no este componente.
 */
const TABS = [
  { href: '/', etiqueta: 'Este mes', icono: 'dashboard' },
  { href: '/presupuesto', etiqueta: 'Presupuesto', icono: 'account_balance_wallet' },
  { href: '/fijos', etiqueta: 'Fijos', icono: 'event_repeat' },
  { href: '/config', etiqueta: 'Config', icono: 'settings' },
] as const

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
      <Link
        href={href}
        aria-current={activo ? 'page' : undefined}
        className={cn(
          'gap-space-xs px-space-xs py-space-sm flex flex-col items-center transition-colors',
          activo ? 'text-primary' : 'text-on-surface-variant',
        )}
      >
        <Icono nombre={icono} relleno={activo} className="text-[22px]" />
        <span className="text-label-caps">{etiqueta}</span>
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
