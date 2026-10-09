'use client'

import { useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { guardarLineaPlan } from '@/app/actions/presupuesto'
import type { Comercio } from '@/lib/schemas/comercio'
import { Card, campo, botonPrimario, etiqueta } from '@/components/ds'
import { Icono } from '@/components/Icono'

/** Sumar un comercio al plan del mes que estás mirando. */
export function AltaLineaPlan({ comercios, mes }: { comercios: Comercio[]; mes: string }) {
  const [pendiente, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function enviar(formData: FormData) {
    startTransition(async () => {
      const r = await guardarLineaPlan(null, formData)
      if (r?.ok) {
        toast.success(r.mensaje)
        formRef.current?.reset()
      } else if (r) {
        toast.error(r.error)
      }
    })
  }

  if (comercios.length === 0) return null

  return (
    <Card>
      <details>
        <summary className="text-body-md text-on-surface gap-space-sm flex cursor-pointer list-none items-center">
          <Icono nombre="add_circle" className="text-primary text-[20px]" />
          Agregar un comercio al plan
        </summary>

        <form ref={formRef} action={enviar} className="gap-space-md mt-space-md flex flex-col">
          <input type="hidden" name="mes" value={mes} />

          <div className="gap-space-xs flex flex-col">
            <label htmlFor="comercioId" className={etiqueta}>Comercio</label>
            <select id="comercioId" name="comercioId" required className={campo}>
              <option value="">Elegí uno</option>
              {comercios.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="gap-space-xs flex flex-col">
            <label htmlFor="planeado" className={etiqueta}>Presupuesto del mes</label>
            <input
              id="planeado"
              name="planeado"
              inputMode="decimal"
              placeholder="0"
              required
              className={`${campo} tabular-nums`}
            />
          </div>

          <button type="submit" disabled={pendiente} className={botonPrimario}>
            {pendiente ? 'Guardando…' : 'Agregar'}
          </button>
        </form>
      </details>
    </Card>
  )
}
