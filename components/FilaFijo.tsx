import { formatoARS, aPesos } from '@/lib/core/dinero'
import type { FilaFijo as Fila, EstadoFijo } from '@/lib/core/fijos'
import { darDeBaja, guardarFijoDirecto } from '@/app/actions/gastosFijos'
import { Badge, ItemLista, Monto, campo, botonSecundario, etiqueta, type Semaforo } from '@/components/ds'

/** El semáforo del design system aplicado al estado de un fijo. */
const TONO: Record<EstadoFijo, Semaforo> = {
  pagado: 'ok',
  parcial: 'atencion',
  pendiente: 'neutro',
}

const TEXTO: Record<EstadoFijo, string> = {
  pagado: 'Pagado',
  parcial: 'Parcial',
  pendiente: 'Pendiente',
}

const ICONO: Record<EstadoFijo, string> = {
  pagado: 'task_alt',
  parcial: 'incomplete_circle',
  pendiente: 'schedule',
}

/**
 * Una fila del checklist. El estado no se tilda: sale de si el comercio
 * aparece en los movimientos del mes.
 *
 * Editar va adentro de un <details> con un <form> normal: anda aunque no
 * haya corrido el JS.
 */
export function FilaFijo({ fila }: { fila: Fila }) {
  const { comercioId, gastoFijoId, estado } = fila
  const tono = TONO[estado]

  return (
    <li>
      <ItemLista
        icono={ICONO[estado]}
        tonoIcono={tono}
        titulo={fila.comercio}
        detalle={
          <>
            {estado === 'pendiente'
              ? `Esperado ${formatoARS(fila.estimado)}`
              : `${formatoARS(fila.pagado)} de ${formatoARS(fila.estimado)}`}
            {fila.vencimiento ? ` · ${fila.vencimiento}` : ''}
          </>
        }
        derecha={
          <div className="gap-space-xs flex flex-col items-end">
            <Badge tono={tono}>{TEXTO[estado]}</Badge>
            {fila.falta > 0 && (
              <Monto tono="atencion" className="text-body-sm">
                falta {formatoARS(fila.falta)}
              </Monto>
            )}
          </div>
        }
      />

      <details className="px-space-sm pb-space-sm">
        <summary className="text-body-sm text-on-surface-variant hover:text-on-surface cursor-pointer list-none underline underline-offset-4">
          Editar
        </summary>

        <div className="gap-space-sm mt-space-sm border-outline-variant flex flex-col border-t pt-3">
          <form action={guardarFijoDirecto} className="gap-space-sm flex flex-col">
            <input type="hidden" name="comercioId" value={comercioId} />

            <div className="gap-space-sm grid grid-cols-2">
              <div className="gap-space-xs flex flex-col">
                <label
                  htmlFor={`estimado-${gastoFijoId}`}
                  className={etiqueta}
                >
                  Monto esperado
                </label>
                <input
                  id={`estimado-${gastoFijoId}`}
                  name="estimado"
                  inputMode="decimal"
                  defaultValue={aPesos(fila.estimado)}
                  className={`${campo} tabular-nums`}
                />
              </div>

              <div className="gap-space-xs flex flex-col">
                <label
                  htmlFor={`venc-${gastoFijoId}`}
                  className={etiqueta}
                >
                  Vencimiento
                </label>
                <input
                  id={`venc-${gastoFijoId}`}
                  name="vencimiento"
                  defaultValue={fila.vencimiento ?? ''}
                  placeholder="Día 5"
                  className={campo}
                />
              </div>
            </div>

            <button
              type="submit"
              className={`${botonSecundario} self-start`}
            >
              Guardar
            </button>
          </form>

          <form action={darDeBaja}>
            <input type="hidden" name="id" value={gastoFijoId} />
            <button type="submit" className="text-body-sm text-error underline underline-offset-4">
              Quitar de fijos
            </button>
          </form>
        </div>
      </details>
    </li>
  )
}
