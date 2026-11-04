'use client'

import { useState, useTransition, type ReactNode } from 'react'
import { toast } from 'sonner'
import { Icono } from '@/components/Icono'
import { botonSecundario } from '@/components/ds'
import { cn } from '@/lib/utils'

/**
 * Lo que devuelve una action de fila. Las tres (`guardarLineaDirecto`,
 * `guardarFijoDirecto`, `actualizarComercio`) tienen esta forma, así que
 * encajan por estructura sin importar sus tipos propios.
 */
export type ResultadoFila =
  | { ok: true; mensaje: string }
  | { ok: false; error: string }
  | null

/**
 * Una fila de lista que se abre para editarse.
 *
 * Son tres pantallas con la misma pieza —el plan de `/presupuesto`, el
 * checklist de `/fijos`, el catálogo de `/config`— y antes cada una la
 * resolvía por su cuenta: una abría con un "Editar plan" subrayado, otra con
 * un lápiz, la tercera sin ninguna pista. Peor: al guardar, la página se
 * revalidaba por detrás pero el editor quedaba abierto mostrando lo mismo que
 * antes, así que **guardar no se veía**.
 *
 * Acá vive esa fila una sola vez:
 *
 * - **Abrir**: toda la fila es el `<summary>`, con el lápiz en círculo a la
 *   derecha que se tiñe al abrirse. Es la única pista de que hay algo adentro.
 * - **Guardar**: la action devuelve `{ ok, mensaje }`, sale un toast y la fila
 *   **se cierra**. El cierre es la mitad del aviso: la fila vuelve a su estado
 *   de lectura y ahí se ve el número nuevo.
 * - **Si falla**: toast rojo y la fila queda abierta con lo tipeado, que es lo
 *   único que permite corregirlo.
 *
 * Es client component por el `open` controlado y el `useTransition`; los hijos
 * los sigue renderizando el server, igual que en `Seccion`.
 */
export function FilaEditable({
  resumen,
  accion,
  children,
  pie,
  textoBoton = 'Guardar',
}: {
  /** Lo que se ve con la fila cerrada. Va entero adentro del `<summary>`. */
  resumen: ReactNode
  accion: (formData: FormData) => Promise<ResultadoFila>
  /** Los campos del formulario. */
  children: ReactNode
  /**
   * Contenido **fuera** del `<form>`: una aclaración, o un segundo formulario
   * como el "Quitar de fijos", que anidado no podría existir.
   */
  pie?: ReactNode
  textoBoton?: string
}) {
  const [abierta, setAbierta] = useState(false)
  const [pendiente, startTransition] = useTransition()

  function enviar(formData: FormData) {
    startTransition(async () => {
      const r = await accion(formData)
      if (!r) return
      if (r.ok) {
        toast.success(r.mensaje)
        setAbierta(false)
      } else {
        toast.error(r.error)
      }
    })
  }

  return (
    <details
      open={abierta}
      onToggle={(e) => setAbierta(e.currentTarget.open)}
      className="group"
    >
      <summary className="hover:bg-surface-container-high cursor-pointer list-none rounded-lg transition-colors select-none">
        {/* El padding lo trae cada `resumen` (una `ItemLista`, o el bloque
            que arme la pantalla): así la fila cerrada se ve igual que antes de
            tener editor. Acá solo queda el aire que necesita el lápiz. */}
        <div className="pr-space-sm gap-space-sm flex items-center">
          <div className="min-w-0 flex-1">{resumen}</div>
          <span
            className={cn(
              'grid size-8 shrink-0 place-items-center rounded-full transition-colors',
              'bg-surface-container-highest text-on-surface-variant',
              'group-open:bg-primary/10 group-open:text-primary',
            )}
          >
            <Icono
              nombre="edit"
              className="text-[18px] transition-transform group-open:rotate-12"
            />
          </span>
          <span className="sr-only">Editar</span>
        </div>
      </summary>

      <div className="px-space-sm pb-space-sm gap-space-sm mt-space-sm border-outline-variant flex flex-col border-t pt-3">
        <form action={enviar} className="gap-space-sm flex flex-col">
          {children}
          <button
            type="submit"
            disabled={pendiente}
            className={cn(botonSecundario, 'self-start disabled:opacity-40')}
          >
            {pendiente ? 'Guardando…' : textoBoton}
          </button>
        </form>

        {pie}
      </div>
    </details>
  )
}
