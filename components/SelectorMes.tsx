'use client'

import { useRouter, usePathname } from 'next/navigation'
import { Icono } from '@/components/Icono'
import { sumarMeses, nombreMes } from '@/lib/core/fechas'

/**
 * Navegación mes a mes. El mes vive en la URL (`?mes=2026-10`), así que
 * compartir o recargar la página te deja donde estabas.
 */
export function SelectorMes({ mes }: { mes: string }) {
  const router = useRouter()
  const pathname = usePathname()

  const ir = (destino: string) => router.push(`${pathname}?mes=${destino}`)

  const flecha =
    'text-on-surface-variant hover:text-on-surface hover:bg-surface-container-high ' +
    'grid size-10 place-items-center rounded-full transition-colors'

  return (
    <div className="bg-surface-container rounded-xl p-space-xs flex items-center justify-between">
      <button type="button" onClick={() => ir(sumarMeses(mes, -1))} aria-label="Mes anterior" className={flecha}>
        <Icono nombre="chevron_left" className="text-[22px]" />
      </button>

      <p className="text-headline-sm text-on-surface" aria-live="polite">
        {nombreMes(mes)}
      </p>

      <button type="button" onClick={() => ir(sumarMeses(mes, 1))} aria-label="Mes siguiente" className={flecha}>
        <Icono nombre="chevron_right" className="text-[22px]" />
      </button>
    </div>
  )
}
