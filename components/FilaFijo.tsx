import { formatoARS, aPesos } from '@/lib/core/dinero'
import type { FilaFijo as Fila, EstadoFijo } from '@/lib/core/fijos'
import { darDeBaja, guardarFijoDirecto } from '@/app/actions/gastosFijos'
import {
  Badge,
  ItemLista,
  campo,
  botonSecundario,
  etiqueta,
  type Semaforo,
} from '@/components/ds'
import { CampoSelect } from '@/components/CampoSelect'
import { Icono } from '@/components/Icono'
import { cn } from '@/lib/utils'

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

/** Cuánto se desvió del estimado, en castellano. Debajo del 1% no es noticia. */
function textoDesvio(desvioPct: number | null): string | null {
  if (desvioPct === null || Math.abs(desvioPct) < 1) return null
  const pct = Math.round(Math.abs(desvioPct))
  return `${pct}% ${desvioPct < 0 ? 'menos' : 'más'} de lo esperado`
}

/** Qué decir debajo del nombre, según en qué anda el fijo. */
function detalleDe(fila: Fila): string {
  const venc = fila.vencimiento ? ` · ${fila.vencimiento}` : ''

  if (fila.estado === 'pagado') {
    const desvio = textoDesvio(fila.desvioPct)
    return `${formatoARS(fila.pagado)}${desvio ? ` · ${desvio}` : ''}`
  }

  if (fila.estado === 'parcial') {
    return `${fila.pagosHechos} de ${fila.pagosEsperados} facturas · ${formatoARS(fila.pagado)}${venc}`
  }

  const facturas = fila.pagosEsperados > 1 ? ` · ${fila.pagosEsperados} facturas` : ''
  return `Esperado ${formatoARS(fila.estimado)}${facturas}${venc}`
}

/**
 * Una fila del checklist. El estado no se tilda: sale de cuántas facturas de
 * ese comercio aparecen en los movimientos del mes (ver `lib/core/fijos.ts`).
 *
 * Toda la fila es el `<summary>` de un `<details>`, con el lápiz al final como
 * pista de que se abre. Adentro hay un `<form>` normal que postea a la Server
 * Action; el único campo que necesita JS es el de facturas, que es un
 * `CampoSelect` y manda su valor por un input oculto.
 */
export function FilaFijo({ fila }: { fila: Fila }) {
  const { comercioId, gastoFijoId, estado } = fila
  const tono = TONO[estado]
  const faltan = fila.pagosEsperados - fila.pagosHechos

  return (
    <li>
      <details className="group">
        <summary className="hover:bg-surface-container-high cursor-pointer list-none rounded-lg transition-colors select-none">
          <ItemLista
            icono={ICONO[estado]}
            tonoIcono={tono}
            titulo={fila.comercio}
            detalle={detalleDe(fila)}
            derecha={
              <div className="gap-space-sm flex items-center">
                <div className="gap-space-xs flex flex-col items-end">
                  <Badge tono={tono}>{TEXTO[estado]}</Badge>
                  {estado === 'parcial' && (
                    <span className="text-body-sm text-tertiary">
                      falta {faltan === 1 ? '1 factura' : `${faltan} facturas`}
                    </span>
                  )}
                </div>

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
            }
          />
        </summary>

        <div className="px-space-sm pb-space-sm gap-space-sm mt-space-sm border-outline-variant flex flex-col border-t pt-3">
          <form action={guardarFijoDirecto} className="gap-space-sm flex flex-col">
            <input type="hidden" name="comercioId" value={comercioId} />

            <div className="gap-space-sm grid grid-cols-2">
              <div className="gap-space-xs flex flex-col">
                <label htmlFor={`estimado-${gastoFijoId}`} className={etiqueta}>
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
                <span className={etiqueta}>Facturas por mes</span>
                <CampoSelect
                  name="pagosEsperados"
                  titulo="Facturas por mes"
                  defaultValue={String(fila.pagosEsperados)}
                  opciones={[1, 2, 3, 4, 5, 6].map((n) => ({
                    valor: String(n),
                    etiqueta: String(n),
                  }))}
                />
              </div>
            </div>

            <div className="gap-space-xs flex flex-col">
              <label htmlFor={`venc-${gastoFijoId}`} className={etiqueta}>
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

            <button type="submit" className={`${botonSecundario} self-start`}>
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
