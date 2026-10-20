'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { guardarLineaPlan } from '@/app/actions/presupuesto'
import type { Comercio } from '@/lib/schemas/comercio'
import { Card, campo, botonPrimario, etiqueta } from '@/components/ds'
import { CampoSelect } from '@/components/CampoSelect'
import { Icono } from '@/components/Icono'

/** Sumar un comercio al plan del mes que estás mirando. */
export function AltaLineaPlan({ comercios, mes }: { comercios: Comercio[]; mes: string }) {
  const [pendiente, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  // Controlado: `form.reset()` no limpia un componente nuestro, y el comercio
  // elegido es lo que habilita el botón de Agregar.
  const [comercioId, setComercioId] = useState('')

  function enviar(formData: FormData) {
    startTransition(async () => {
      const r = await guardarLineaPlan(null, formData)
      if (r?.ok) {
        toast.success(r.mensaje)
        formRef.current?.reset()
        setComercioId('')
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
            <span className={etiqueta}>Comercio</span>
            <CampoSelect
              name="comercioId"
              titulo="Comercio"
              placeholder="Elegí uno"
              valor={comercioId}
              onCambio={setComercioId}
              opciones={comercios.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
            />
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

          {/* Sin `<select required>` el navegador ya no frena el submit: lo
              frena el botón, y la action igual valida con Zod. */}
          <button
            type="submit"
            disabled={pendiente || comercioId === ''}
            className={botonPrimario}
          >
            {pendiente ? 'Guardando…' : 'Agregar'}
          </button>
        </form>
      </details>
    </Card>
  )
}
