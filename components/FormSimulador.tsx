'use client'

import Form from 'next/form'
import { useFormStatus } from 'react-dom'
import { CampoSelect, type OpcionSelect } from '@/components/CampoSelect'
import { Card, campo, botonPrimario, etiqueta } from '@/components/ds'
import { Icono } from '@/components/Icono'

function BotonSimular() {
  const { pending } = useFormStatus()
  return (
    <button type="submit" disabled={pending} className={botonPrimario}>
      <Icono nombre={pending ? 'progress_activity' : 'calculate'} className={pending ? 'animate-spin text-[20px]' : 'text-[20px]'} />
      {pending ? 'Calculando…' : 'Simular'}
    </button>
  )
}

/**
 * El formulario del simulador. Es un GET (`next/form`): los datos viajan en la
 * URL y la página los calcula en el server, como cualquier otra lectura. No
 * guarda nada.
 */
export function FormSimulador({
  monto,
  medio,
  comercio,
  medios,
  comercios,
}: {
  monto: string
  medio: string
  comercio: string
  medios: OpcionSelect[]
  comercios: OpcionSelect[]
}) {
  return (
    <Card>
      <Form action="/simular" className="gap-space-md flex flex-col">
        <div className="gap-space-xs flex flex-col">
          <label htmlFor="sim-monto" className={etiqueta}>¿Cuánto?</label>
          <input
            id="sim-monto"
            name="monto"
            inputMode="decimal"
            placeholder="60.000"
            autoComplete="off"
            defaultValue={monto}
            required
            className={`${campo} tabular-nums`}
          />
        </div>

        <div className="gap-space-xs flex flex-col">
          <span className={etiqueta}>¿Con qué?</span>
          <CampoSelect name="medio" titulo="Con qué" defaultValue={medio} opciones={medios} />
        </div>

        <div className="gap-space-xs flex flex-col">
          <span className={etiqueta}>¿Dónde? (opcional)</span>
          <CampoSelect
            name="comercio"
            titulo="Comercio"
            vacio="Sin comercio"
            defaultValue={comercio}
            opciones={comercios}
          />
        </div>

        <BotonSimular />
      </Form>
    </Card>
  )
}
