'use client'

import { useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { guardarParametros } from '@/app/actions/config'
import type { Config } from '@/lib/db/config'
import { aPesos } from '@/lib/core/dinero'
import { campo, botonPrimario, etiqueta } from '@/components/ds'
import { Seccion } from '@/components/Seccion'

/** Un campo con su ayuda debajo. */
function Campo({
  id,
  rotulo,
  ayuda,
  ...props
}: {
  id: string
  rotulo: string
  ayuda?: string
} & React.ComponentProps<'input'>) {
  return (
    <div className="gap-space-xs flex flex-col">
      <label htmlFor={id} className={etiqueta}>
        {rotulo}
      </label>
      <input id={id} name={id} className={`${campo} tabular-nums`} {...props} />
      {ayuda && <p className="text-body-sm text-on-surface-variant">{ayuda}</p>}
    </div>
  )
}

export function FormConfig({ config }: { config: Config }) {
  const [pendiente, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function enviar(formData: FormData) {
    startTransition(async () => {
      const r = await guardarParametros(null, formData)
      if (r?.ok) toast.success(r.mensaje)
      else if (r) toast.error(r.error)
    })
  }

  return (
    <form ref={formRef} action={enviar} className="gap-space-md flex flex-col">
      <Seccion titulo="Topes del mes">

        <Campo
          id="topeTarjeta"
          rotulo="Tope tarjeta"
          inputMode="decimal"
          defaultValue={aPesos(config.topeTarjetaCentavos)}
          ayuda="Suma tarjeta de crédito, tarjeta de débito y débito automático."
        />

        <Campo
          id="topeEfectivo"
          rotulo="Tope efectivo y transferencias"
          inputMode="decimal"
          defaultValue={aPesos(config.topeEfectivoCentavos)}
          ayuda="Suma efectivo y transferencias."
        />

        <Campo
          id="umbralCercaPct"
          rotulo="Umbral del semáforo (%)"
          type="number"
          min={1}
          max={100}
          defaultValue={config.umbralCercaPct}
          ayuda="A partir de qué % del tope la barra pasa a ámbar. En el Excel convivían 80, 85 y 90; acá es uno solo."
        />
      </Seccion>

      <Seccion titulo="Meta de consumo con tarjeta">
        <p className="text-body-sm text-on-surface-variant">
          El mínimo que el banco pide consumir por resumen para bonificar la cuenta. Suman
          las tarjetas marcadas en Tarjetas. No es para gastar más: es para elegir con qué
          tarjeta pagás. En 0 no se muestra.
        </p>

        <Campo
          id="metaMinimo"
          rotulo="Mínimo del resumen"
          inputMode="decimal"
          defaultValue={aPesos(config.metaMinimoCentavos)}
        />

        <div className="gap-space-sm grid grid-cols-2">
          <Campo
            id="metaColchon"
            rotulo="Colchón"
            inputMode="decimal"
            defaultValue={aPesos(config.metaColchonCentavos)}
            ayuda="Se suma al mínimo, por las dudas."
          />
          <Campo
            id="metaDiaCierre"
            rotulo="Cierre aprox. (día)"
            type="number"
            min={1}
            max={31}
            defaultValue={config.metaDiaCierre}
            ayuda="El más temprano en que suele cerrar."
          />
        </div>
      </Seccion>

      <Seccion titulo="Predicción">

        <Campo
          id="mesesHistorico"
          rotulo="Meses de histórico"
          type="number"
          min={1}
          max={24}
          defaultValue={config.mesesHistorico}
          ayuda="Cuántos meses cerrados mira el promedio que se usa al arranque del mes."
        />
      </Seccion>

      <Seccion titulo="Contexto">

        <Campo
          id="sueldo"
          rotulo="Sueldo mensual"
          inputMode="decimal"
          defaultValue={aPesos(config.sueldoCentavos)}
        />

        <Campo
          id="objetivoGasto"
          rotulo="Objetivo mensual de gasto"
          inputMode="decimal"
          defaultValue={aPesos(config.objetivoGastoMensualCentavos)}
        />

        <div className="gap-space-sm grid grid-cols-2">
          <Campo
            id="objetivoAhorroUsd"
            rotulo="Ahorro USD / mes"
            type="number"
            min={0}
            defaultValue={config.objetivoAhorroUsd}
          />
          <Campo
            id="cotizacionUsd"
            rotulo="Cotización USD"
            inputMode="decimal"
            defaultValue={aPesos(config.cotizacionUsdCentavos)}
          />
        </div>
      </Seccion>

      <button type="submit" disabled={pendiente} className={botonPrimario}>
        {pendiente ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
