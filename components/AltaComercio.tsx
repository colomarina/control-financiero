'use client'

import { useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { nuevoComercio } from '@/app/actions/comercios'
import { Card, campo, botonPrimario, etiqueta } from '@/components/ds'
import { Icono } from '@/components/Icono'

export function AltaComercio({ categorias }: { categorias: string[] }) {
  const [pendiente, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)
  const listaId = 'categorias-alta'

  function enviar(formData: FormData) {
    startTransition(async () => {
      const r = await nuevoComercio(null, formData)
      if (r?.ok) {
        toast.success(r.mensaje)
        formRef.current?.reset()
      } else if (r) {
        toast.error(r.error)
      }
    })
  }

  return (
    <Card>
      <details>
        <summary className="text-body-md text-on-surface gap-space-sm flex cursor-pointer list-none items-center">
          <Icono nombre="add_circle" className="text-primary text-[20px]" />
          Agregar un comercio
        </summary>

        <form ref={formRef} action={enviar} className="gap-space-md mt-space-md flex flex-col">
          <datalist id={listaId}>
            {categorias.map((c) => (
              <option key={c} value={c} />
            ))}
          </datalist>

          <div className="gap-space-xs flex flex-col">
            <label htmlFor="nombre" className={etiqueta}>
              Nombre
            </label>
            <input id="nombre" name="nombre" required autoComplete="off" className={campo} />
          </div>

          <div className="gap-space-sm grid grid-cols-2">
            <div className="gap-space-xs flex flex-col">
              <label htmlFor="categoria" className={etiqueta}>
                Categoría
              </label>
              <input
                id="categoria"
                name="categoria"
                list={listaId}
                required
                autoComplete="off"
                className={campo}
              />
            </div>
            <div className="gap-space-xs flex flex-col">
              <label htmlFor="subcategoria" className={etiqueta}>
                Subcategoría
              </label>
              <input
                id="subcategoria"
                name="subcategoria"
                placeholder="Opcional"
                autoComplete="off"
                className={campo}
              />
            </div>
          </div>

          <label className="gap-space-sm text-body-md text-on-surface flex items-center">
            <input type="checkbox" name="esFijo" className="accent-primary size-4" />
            Es un gasto fijo
          </label>

          <button type="submit" disabled={pendiente} className={botonPrimario}>
            {pendiente ? 'Guardando…' : 'Agregar'}
          </button>
        </form>
      </details>
    </Card>
  )
}
