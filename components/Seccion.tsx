'use client'

import { useState, type ReactNode } from 'react'
import { Icono } from '@/components/Icono'
import { cn } from '@/lib/utils'

/**
 * Sección plegable. Es una card cuyo contenido se abre y se cierra.
 *
 * Nace de la pantalla de Configuración: apiladas, sus cinco secciones obligaban
 * a scrollear tres pantallas para llegar al catálogo. Plegadas, la pantalla
 * entra entera y cada cosa está a un tap. El Historial usa lo mismo.
 *
 * Usa `<details>` nativo: funciona sin JavaScript, el navegador se encarga de
 * la accesibilidad (rol, foco, teclado) y —clave para los formularios— los
 * campos de una sección cerrada **siguen en el DOM y se envían igual**.
 *
 * Es client component solo por `montarAlAbrir`. El `open` va controlado por
 * estado y sincronizado con `onToggle`: React y el navegador no se pelean
 * porque siempre coinciden. Los hijos los puede seguir renderizando el server.
 */
export function Seccion({
  titulo,
  contador,
  abierta = false,
  montarAlAbrir = false,
  children,
}: {
  titulo: string
  /** Dato al margen del título, como cuántos ítems hay adentro. */
  contador?: ReactNode
  abierta?: boolean
  /**
   * No dibujar el contenido hasta que se abra.
   *
   * Es para lo que no tolera medir 0×0: un gráfico de Recharts adentro de un
   * `<details>` cerrado nace sin tamaño. **Ojo**: al cerrarse se desmonta, así
   * que no va en nada que tenga estado que valga la pena conservar —un
   * buscador con filtros puestos, por ejemplo—.
   */
  montarAlAbrir?: boolean
  children: ReactNode
}) {
  const [abierto, setAbierto] = useState(abierta)

  return (
    <details
      open={abierto}
      onToggle={(e) => setAbierto(e.currentTarget.open)}
      className="bg-surface-container group rounded-xl shadow-md"
    >
      <summary
        className={cn(
          'p-space-md gap-space-sm flex cursor-pointer list-none items-center',
          // El summary es el área táctil de toda la sección: que no se
          // seleccione el texto al tocarlo dos veces seguidas.
          'select-none',
        )}
      >
        <h2 className="text-headline-sm text-on-surface flex-1">{titulo}</h2>
        {contador !== undefined && (
          <span className="text-body-sm text-on-surface-variant tabular-nums">{contador}</span>
        )}
        <Icono
          nombre="expand_more"
          className="text-on-surface-variant text-[22px] transition-transform group-open:rotate-180"
        />
      </summary>

      <div className="px-space-md pb-space-md gap-space-md flex flex-col">
        {montarAlAbrir && !abierto ? null : children}
      </div>
    </details>
  )
}
