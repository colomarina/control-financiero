'use client'

import { useState, useTransition } from 'react'
import { toast } from 'sonner'
import { guardarTarjetaDirecto } from '@/app/actions/tarjetas'
import { ETIQUETA_RED, REDES, type Tarjeta } from '@/lib/schemas/tarjeta'
import { FilaEditable } from '@/components/FilaEditable'
import { Badge, Separador, campo, botonPrimario, etiqueta } from '@/components/ds'
import { Icono } from '@/components/Icono'
import { LogoRed } from '@/components/LogoRed'
import { CampoSelect } from '@/components/CampoSelect'
import { cn } from '@/lib/utils'

/** Los campos de una tarjeta, iguales en el alta y en la edición. */
function Campos({ t, prefijo }: { t?: Tarjeta; prefijo: string }) {
  return (
    <>
      <div className="gap-space-sm grid grid-cols-2">
        <div className="gap-space-xs flex flex-col">
          <label htmlFor={`${prefijo}-nombre`} className={etiqueta}>Nombre</label>
          <input
            id={`${prefijo}-nombre`}
            name="nombre"
            required
            placeholder="Santander Visa"
            defaultValue={t?.nombre}
            autoComplete="off"
            className={campo}
          />
        </div>
        <div className="gap-space-xs flex flex-col">
          <label htmlFor={`${prefijo}-banco`} className={etiqueta}>Banco</label>
          <input
            id={`${prefijo}-banco`}
            name="banco"
            required
            placeholder="Santander"
            defaultValue={t?.banco}
            autoComplete="off"
            className={campo}
          />
        </div>
      </div>

      <div className="gap-space-xs flex flex-col">
        <span className={etiqueta}>Red</span>
        <CampoSelect
          name="red"
          titulo="Red"
          vacio="Sin logo"
          defaultValue={t?.red ?? ''}
          opciones={REDES.map((r) => ({ valor: r, etiqueta: ETIQUETA_RED[r] }))}
        />
      </div>

      <div className="gap-space-md flex flex-wrap">
        <label className="gap-space-sm text-body-md text-on-surface flex items-center">
          <input
            type="checkbox"
            name="sumaMeta"
            defaultChecked={t?.sumaMeta ?? false}
            className="accent-primary size-4"
          />
          Suma a la meta
        </label>
        <label className="gap-space-sm text-body-md text-on-surface flex items-center">
          <input
            type="checkbox"
            name="activa"
            defaultChecked={t?.activa ?? true}
            className="accent-primary size-4"
          />
          Activa
        </label>
      </div>
    </>
  )
}

/**
 * Las tarjetas, en `/config`. Cada fila se abre para editarse (`FilaEditable`)
 * y abajo va el alta. "Suma a la meta" es lo que define qué consumo cuenta
 * para el mínimo del banco; "Activa" apagado la saca del formulario de carga
 * sin borrar el nombre de los gastos viejos.
 */
export function Tarjetas({ tarjetas }: { tarjetas: Tarjeta[] }) {
  const [pendiente, startTransition] = useTransition()
  // `form.reset()` no limpia un `CampoSelect` (es un componente nuestro, no
  // un input): después de un alta se remonta el formulario con otra `key`.
  const [version, setVersion] = useState(0)

  function alta(formData: FormData) {
    startTransition(async () => {
      const r = await guardarTarjetaDirecto(formData)
      if (r?.ok) {
        toast.success(r.mensaje)
        setVersion((v) => v + 1)
      } else if (r) {
        toast.error(r.error)
      }
    })
  }

  return (
    <div className="gap-space-sm flex flex-col">
      <ul>
        {tarjetas.map((t, i) => (
          <li key={t.id}>
            {i > 0 && <Separador />}
            <FilaEditable
              accion={guardarTarjetaDirecto}
              resumen={
                <div className="p-space-sm gap-space-sm flex items-center">
                  {t.red ? (
                    <LogoRed red={t.red} ancho={32} className={cn(!t.activa && 'opacity-50')} />
                  ) : (
                    <Icono
                      nombre="credit_card"
                      className={cn('text-[20px]', t.activa ? 'text-primary' : 'text-on-surface-variant')}
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-body-md truncate',
                        t.activa ? 'text-on-surface' : 'text-on-surface-variant line-through',
                      )}
                    >
                      {t.nombre}
                    </p>
                    <p className="text-body-sm text-on-surface-variant truncate">{t.banco}</p>
                  </div>
                  {t.sumaMeta && <Badge tono="neutro">Meta</Badge>}
                </div>
              }
            >
              <input type="hidden" name="id" value={t.id} />
              <Campos t={t} prefijo={`tarjeta-${t.id}`} />
            </FilaEditable>
          </li>
        ))}
      </ul>

      <details className="bg-surface-container-high p-space-sm rounded-xl">
        <summary className="text-body-md text-on-surface gap-space-sm flex cursor-pointer list-none items-center">
          <Icono nombre="add_circle" className="text-primary text-[20px]" />
          Agregar una tarjeta
        </summary>
        <form key={version} action={alta} className="gap-space-md mt-space-md flex flex-col">
          <Campos prefijo="tarjeta-nueva" />
          <button type="submit" disabled={pendiente} className={botonPrimario}>
            {pendiente ? 'Guardando…' : 'Agregar'}
          </button>
        </form>
      </details>
    </div>
  )
}
