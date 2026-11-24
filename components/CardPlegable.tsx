'use client'

import { useState, type ReactNode } from 'react'
import { Icono } from '@/components/Icono'
import { TituloCard } from '@/components/ds'

/**
 * Card del Home con versión corta y expandible.
 *
 * Cerrada muestra lo que se mira de un vistazo —título, estado, el número y
 * la barra—, así las cuatro cards entran juntas en la pantalla. Tocándola se
 * abre el detalle (cuánto queda por día, el rango del cierre, el consejo de
 * la meta). Arranca cerrada: el detalle es lo que se busca a veces.
 *
 * Mismo `<details>` que `Seccion`, pero con la piel de `Card` y un resumen
 * con contenido, no solo un título. Los hijos los sigue renderizando el server.
 */
export function CardPlegable({
  titulo,
  badge,
  resumen,
  children,
}: {
  titulo: string
  /** El estado al lado del título (un `Badge`). */
  badge?: ReactNode
  /** Lo que se ve cerrada, debajo del título. */
  resumen: ReactNode
  /** El detalle, que aparece al abrirla. */
  children: ReactNode
}) {
  const [abierta, setAbierta] = useState(false)

  return (
    <details
      open={abierta}
      onToggle={(e) => setAbierta(e.currentTarget.open)}
      className="bg-surface-container group rounded-xl shadow-md"
    >
      <summary className="p-space-md gap-space-sm flex cursor-pointer list-none flex-col select-none">
        <div className="gap-space-sm flex items-center">
          <TituloCard className="flex-1">{titulo}</TituloCard>
          {badge}
          <Icono
            nombre="expand_more"
            className="text-on-surface-variant text-[20px] transition-transform group-open:rotate-180"
          />
        </div>
        {resumen}
      </summary>

      <div className="mx-space-md mb-space-md gap-space-sm border-outline-variant flex flex-col border-t pt-3">
        {children}
      </div>
    </details>
  )
}
