'use client'

import Link from 'next/link'
import { useLinkStatus } from 'next/link'
import type { ReactNode } from 'react'

/**
 * Un `<Link>` que cambia de contenido mientras la navegación está en curso.
 *
 * El punto no es informar que carga —de eso se encargan los `loading.tsx` de
 * cada ruta— sino **acusar recibo del toque en el acto**. Entre el tap y el
 * primer frame de la pantalla nueva hay un hueco en el que no pasa nada, y en
 * el celular eso se lee como "no me registró el toque" y se toca de nuevo.
 *
 * `useLinkStatus` solo funciona adentro de un `<Link>`, por eso el contenido
 * va en un componente aparte: es el que sabe si *esta* navegación está en
 * curso. La bottom-nav hace lo mismo en `NavMobile`, tiñendo el tab.
 */
function Contenido({ children, pendiente }: { children: ReactNode; pendiente: ReactNode }) {
  const { pending } = useLinkStatus()
  return <>{pending ? pendiente : children}</>
}

export function LinkConEstado({
  href,
  className,
  children,
  pendiente,
  'aria-label': ariaLabel,
}: {
  href: string
  className?: string
  children: ReactNode
  /** Qué se ve mientras se está yendo. Normalmente el mismo ícono girando. */
  pendiente: ReactNode
  'aria-label'?: string
}) {
  return (
    <Link href={href} aria-label={ariaLabel} className={className}>
      <Contenido pendiente={pendiente}>{children}</Contenido>
    </Link>
  )
}
