'use client'

import { useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { guardarFijo } from '@/app/actions/gastosFijos'
import type { Comercio } from '@/lib/schemas/comercio'
import { Card, campo, botonPrimario, etiqueta } from '@/components/ds'
import { Icono } from '@/components/Icono'

/** Sumar un comercio del catálogo al checklist de fijos. */
export function AltaFijo({ comercios }: { comercios: Comercio[] }) {
  const [pendiente, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function enviar(formData: FormData) {
    startTransition(async () => {
      const r = await guardarFijo(null, formData)
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
          Agregar un gasto fijo
        </summary>

        <form ref={formRef} action={enviar} className="gap-space-md mt-space-md flex flex-col">
          <div className="gap-space-xs flex flex-col">
            <label htmlFor="comercioId" className={etiqueta}>Comercio</label>
            <select id="comercioId" name="comercioId" required className={campo}>
              <option value="">Elegí uno</option>
              {comercios.map((c) => (
                <option key={c.id} value={c.id}>{c.nombre}</option>
              ))}
            </select>
          </div>

          <div className="gap-space-sm grid grid-cols-2">
            <div className="gap-space-xs flex flex-col">
              <label htmlFor="estimado" className={etiqueta}>Monto esperado</label>
              <input
                id="estimado"
                name="estimado"
                inputMode="decimal"
                placeholder="0"
                required
                className={`${campo} tabular-nums`}
              />
            </div>
            <div className="gap-space-xs flex flex-col">
              <label htmlFor="vencimiento" className={etiqueta}>Vencimiento</label>
              <input id="vencimiento" name="vencimiento" placeholder="Día 5" className={campo} />
            </div>
          </div>

          <button type="submit" disabled={pendiente} className={botonPrimario}>
            {pendiente ? 'Guardando…' : 'Agregar'}
          </button>
        </form>
      </details>
    </Card>
  )
}
