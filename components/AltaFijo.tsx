'use client'

import { useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { guardarFijo } from '@/app/actions/gastosFijos'
import type { Comercio } from '@/lib/schemas/comercio'
import { Card, campo, botonPrimario, etiqueta } from '@/components/ds'
import { CampoSelect } from '@/components/CampoSelect'
import { Icono } from '@/components/Icono'

/** Sumar un comercio del catálogo al checklist de fijos. */
export function AltaFijo({ comercios }: { comercios: Comercio[] }) {
  const [pendiente, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  // Los dos selectores son controlados: `form.reset()` no alcanza para
  // limpiarlos —son componentes nuestros, no campos nativos— y además el
  // comercio elegido es lo que habilita el botón de Agregar.
  const [comercioId, setComercioId] = useState('')
  const [facturas, setFacturas] = useState('1')

  function enviar(formData: FormData) {
    startTransition(async () => {
      const r = await guardarFijo(null, formData)
      if (r?.ok) {
        toast.success(r.mensaje)
        formRef.current?.reset()
        setComercioId('')
        setFacturas('1')
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
            {/* Casi todos llegan en una. Personal Flow son dos, una por línea:
                de esto sale si el fijo está pago o le falta una factura. */}
            <div className="gap-space-xs flex flex-col">
              <span className={etiqueta}>Facturas por mes</span>
              <CampoSelect
                name="pagosEsperados"
                titulo="Facturas por mes"
                valor={facturas}
                onCambio={setFacturas}
                opciones={[1, 2, 3, 4, 5, 6].map((n) => ({
                  valor: String(n),
                  etiqueta: String(n),
                }))}
              />
            </div>
          </div>

          <div className="gap-space-xs flex flex-col">
            <label htmlFor="vencimiento" className={etiqueta}>Vencimiento</label>
            <input id="vencimiento" name="vencimiento" placeholder="Día 5" className={campo} />
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
