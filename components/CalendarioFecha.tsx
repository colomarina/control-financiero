'use client'

import { es } from 'date-fns/locale'
import { Calendar } from '@/components/ui/calendar'
import { aFechaLocal, desdeFechaLocal } from '@/lib/core/fechas'

/**
 * El calendario propiamente dicho, en su propio módulo para que
 * `next/dynamic` lo pueda separar del bundle. Lo monta `CampoFecha` cuando se
 * abre el popover.
 *
 * Las conversiones van por `aFechaLocal` / `desdeFechaLocal`: `react-day-picker`
 * habla en `Date` y pasar por UTC correría la fecha un día para atrás después
 * de las 21:00 en Buenos Aires.
 */
export function CalendarioFecha({
  valor,
  maximo,
  onElegir,
}: {
  valor: string
  /** Último día seleccionable, en `"YYYY-MM-DD"`. */
  maximo: string
  onElegir: (fecha: string) => void
}) {
  return (
    <Calendar
      mode="single"
      locale={es}
      defaultMonth={aFechaLocal(valor)}
      selected={aFechaLocal(valor)}
      // Un gasto es algo que ya pasó: no tiene sentido cargarlo a futuro.
      disabled={{ after: aFechaLocal(maximo) }}
      onSelect={(d) => {
        if (d) onElegir(desdeFechaLocal(d))
      }}
      autoFocus
    />
  )
}
