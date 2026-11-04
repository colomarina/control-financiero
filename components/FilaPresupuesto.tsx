import { formatoARS, aPesos } from '@/lib/core/dinero'
import type { FilaPresupuesto as Fila, EstadoPresupuesto } from '@/lib/core/presupuesto'
import { guardarLineaDirecto } from '@/app/actions/presupuesto'
import { FilaEditable } from '@/components/FilaEditable'
import { Barra, Monto, campo, etiqueta, type Semaforo } from '@/components/ds'

/** El semáforo del design system aplicado al estado de una línea del plan. */
const TONO: Record<EstadoPresupuesto, Semaforo> = {
  ok: 'ok',
  'al-limite': 'atencion',
  excedido: 'mal',
  'sin-plan': 'neutro',
}

/**
 * Una línea del plan del mes. Toda la fila —nombre, lo que queda, la barra—
 * es el `summary` de una `FilaEditable`; el lápiz de la derecha es la pista
 * de que se abre, igual que en el checklist de fijos y en el catálogo.
 */
export function FilaPresupuesto({ fila, mes }: { fila: Fila; mes: string }) {
  const { comercioId, comercio, planeado, real, diferencia, porcentajeUsado, estado } = fila
  const tono = TONO[estado]

  return (
    <FilaEditable
      accion={guardarLineaDirecto}
      pie={
        <p className="text-body-sm text-on-surface-variant">
          Guardar en 0 saca el comercio del plan de este mes.
        </p>
      }
      resumen={
        <div className="py-space-sm pl-space-sm gap-space-sm flex flex-col">
          <div className="gap-space-sm flex items-baseline justify-between">
            <p className="text-body-md text-on-surface truncate">{comercio}</p>
            <Monto tono={tono} className="text-body-sm shrink-0">
              {estado === 'sin-plan'
                ? 'Sin plan'
                : diferencia >= 0
                  ? `Quedan ${formatoARS(diferencia)}`
                  : `Te pasaste ${formatoARS(-diferencia)}`}
            </Monto>
          </div>

          <p className="text-body-sm text-on-surface-variant tabular-nums">
            {formatoARS(real)} de {formatoARS(planeado)}
            {planeado > 0 && ` · ${Math.round(porcentajeUsado)}%`}
          </p>

          <Barra
            porcentaje={porcentajeUsado}
            tono={tono}
            etiqueta={`${comercio}: ${Math.round(porcentajeUsado)}% del plan`}
          />
        </div>
      }
    >
      <input type="hidden" name="mes" value={mes} />
      <input type="hidden" name="comercioId" value={comercioId} />

      <div className="gap-space-xs flex flex-col">
        <label htmlFor={`plan-${comercioId}`} className={etiqueta}>
          Presupuesto del mes
        </label>
        <input
          id={`plan-${comercioId}`}
          name="planeado"
          inputMode="decimal"
          defaultValue={aPesos(planeado)}
          className={`${campo} tabular-nums`}
        />
      </div>
    </FilaEditable>
  )
}
