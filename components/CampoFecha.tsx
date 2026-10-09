'use client'

import { useState } from 'react'
import dynamic from 'next/dynamic'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Icono } from '@/components/Icono'
import { fechaCorta, hoyISO } from '@/lib/core/fechas'
import { campo } from '@/components/ds'
import { cn } from '@/lib/utils'

/**
 * El calendario pesa ~165 KB (react-day-picker) y la fecha casi siempre es hoy,
 * así que se baja recién cuando se abre el popover. El resto del formulario no
 * lo paga.
 */
const CalendarioLazy = dynamic(
  () => import('@/components/CalendarioFecha').then((m) => m.CalendarioFecha),
  {
    ssr: false,
    loading: () => (
      <div className="text-body-sm text-on-surface-variant grid h-64 place-items-center">
        Cargando…
      </div>
    ),
  },
)

/**
 * Campo de fecha con calendario.
 *
 * Reemplaza al `<input type="date">`, cuyo picker lo decide el sistema: en el
 * navegador de escritorio es un desplegable mínimo y en cada celular se ve
 * distinto. Acá el calendario es el mismo en todos lados y usa la paleta del
 * design system.
 *
 * El valor viaja en un input oculto como `"YYYY-MM-DD"`, que es lo que espera
 * la action: para el formulario no cambió nada.
 *
 * Ojo con las conversiones: `react-day-picker` trabaja con `Date` y el puente
 * va por `aFechaLocal` / `desdeFechaLocal`, nunca por `toISOString()`. Pasar
 * por UTC corre la fecha un día para atrás a partir de las 21:00 en Buenos
 * Aires, que es justo cuando uno carga los gastos del día.
 */
export function CampoFecha({
  name,
  defaultValue,
  etiqueta = 'Fecha',
}: {
  name: string
  /** Fecha inicial en formato `"YYYY-MM-DD"`. */
  defaultValue: string
  etiqueta?: string
}) {
  const [valor, setValor] = useState(defaultValue)
  const [abierto, setAbierto] = useState(false)

  const hoy = hoyISO()

  return (
    <>
      <input type="hidden" name={name} value={valor} />

      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger
          type="button"
          aria-label={`${etiqueta}: ${fechaCorta(valor)}`}
          className={cn(campo, 'gap-space-sm flex items-center justify-between text-left')}
        >
          <span className="tabular-nums">{fechaCorta(valor)}</span>
          <Icono nombre="calendar_month" className="text-on-surface-variant text-[20px]" />
        </PopoverTrigger>

        <PopoverContent className="w-auto p-0" align="start">
          <CalendarioLazy
            valor={valor}
            maximo={hoy}
            onElegir={(fecha) => {
              setValor(fecha)
              setAbierto(false)
            }}
          />

          <div className="border-outline-variant flex border-t">
            <button
              type="button"
              onClick={() => {
                setValor(hoy)
                setAbierto(false)
              }}
              className="text-body-sm text-primary p-space-sm w-full text-center"
            >
              Hoy
            </button>
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
