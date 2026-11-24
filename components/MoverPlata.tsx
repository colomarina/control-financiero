'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { moverPlataPlan } from '@/app/actions/presupuesto'
import { formatoARS } from '@/lib/core/dinero'
import { disponibleParaMover, type FilaPresupuesto } from '@/lib/core/presupuesto'
import type { Comercio } from '@/lib/schemas/comercio'
import { Card, campo, botonPrimario, etiqueta } from '@/components/ds'
import { CampoSelect } from '@/components/CampoSelect'
import { Icono } from '@/components/Icono'

/** El monto como lo tipearía el usuario: sin el signo, que el campo no lleva. */
const sinSigno = (centavos: number) => formatoARS(centavos).replace('$', '')

/**
 * Pasar plata del plan de un comercio a otro, dentro del mes que se mira.
 *
 * Es para cuando el plan cambia en el camino ("no hubo fulbito, esa plata fue
 * a la carnicería"). Sin esto había dos salidas y las dos estaban mal: cargar
 * el gasto de la carnicería como fulbito ensucia los hechos, y editar las dos
 * líneas a mano es hacer la cuenta y que no se note qué pasó.
 *
 * Al elegir el origen, el monto se completa con todo lo que le queda: es lo
 * que se quiere casi siempre, y si no, se corrige.
 */
export function MoverPlata({
  filas,
  fueraDelPlan,
  mes,
}: {
  filas: FilaPresupuesto[]
  /** Comercios que no están en el plan del mes: también pueden recibir. */
  fueraDelPlan: Comercio[]
  mes: string
}) {
  const [pendiente, startTransition] = useTransition()
  const [abierto, setAbierto] = useState(false)
  const [origenId, setOrigenId] = useState('')
  const [destinoId, setDestinoId] = useState('')
  const [monto, setMonto] = useState('')

  const origenes = filas.filter((f) => disponibleParaMover(f) > 0)
  if (origenes.length === 0) return null

  const destinos = [
    ...filas.map((f) => ({ valor: f.comercioId, etiqueta: f.comercio })),
    ...fueraDelPlan.map((c) => ({ valor: c.id, etiqueta: `${c.nombre} (nuevo en el plan)` })),
  ].filter((d) => d.valor !== origenId)

  function elegirOrigen(id: string) {
    setOrigenId(id)
    if (id === destinoId) setDestinoId('')
    const fila = filas.find((f) => f.comercioId === id)
    setMonto(fila ? sinSigno(disponibleParaMover(fila)) : '')
  }

  function enviar(formData: FormData) {
    startTransition(async () => {
      const r = await moverPlataPlan(null, formData)
      if (r?.ok) {
        toast.success(r.mensaje)
        setOrigenId('')
        setDestinoId('')
        setMonto('')
        setAbierto(false)
      } else if (r) {
        toast.error(r.error)
      }
    })
  }

  return (
    <Card>
      <details open={abierto} onToggle={(e) => setAbierto(e.currentTarget.open)}>
        <summary className="text-body-md text-on-surface gap-space-sm flex cursor-pointer list-none items-center">
          <Icono nombre="swap_horiz" className="text-primary text-[20px]" />
          Mover plata entre comercios
        </summary>

        <form action={enviar} className="gap-space-md mt-space-md flex flex-col">
          <p className="text-body-sm text-on-surface-variant">
            Lo que no gastaste en uno pasa al plan de otro. El total del mes no cambia.
          </p>

          <input type="hidden" name="mes" value={mes} />

          <div className="gap-space-xs flex flex-col">
            <span className={etiqueta}>Desde</span>
            <CampoSelect
              name="origenId"
              titulo="Desde"
              placeholder="De qué comercio sale"
              valor={origenId}
              onCambio={elegirOrigen}
              opciones={origenes.map((f) => ({
                valor: f.comercioId,
                etiqueta: `${f.comercio} · quedan ${formatoARS(disponibleParaMover(f))}`,
              }))}
            />
          </div>

          <div className="gap-space-xs flex flex-col">
            <span className={etiqueta}>Hacia</span>
            <CampoSelect
              name="destinoId"
              titulo="Hacia"
              placeholder="A qué comercio va"
              valor={destinoId}
              onCambio={setDestinoId}
              opciones={destinos}
            />
          </div>

          <div className="gap-space-xs flex flex-col">
            <label htmlFor="mover-monto" className={etiqueta}>Monto</label>
            <input
              id="mover-monto"
              name="monto"
              inputMode="decimal"
              placeholder="0"
              autoComplete="off"
              value={monto}
              onChange={(e) => setMonto(e.target.value)}
              className={`${campo} tabular-nums`}
            />
          </div>

          <button
            type="submit"
            disabled={pendiente || origenId === '' || destinoId === '' || monto.trim() === ''}
            className={botonPrimario}
          >
            {pendiente ? 'Moviendo…' : 'Mover'}
          </button>
        </form>
      </details>
    </Card>
  )
}
