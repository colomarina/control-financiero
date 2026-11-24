import { formatoARS } from '@/lib/core/dinero'
import type { ResumenTope, EstadoTope } from '@/lib/core/topes'
import { Badge, Barra, ConMontos, Monto, type Semaforo } from '@/components/ds'
import { CardPlegable } from '@/components/CardPlegable'

/** El semáforo del design system aplicado al estado de un tope. */
const TONO: Record<EstadoTope, Semaforo> = {
  ok: 'ok',
  cerca: 'atencion',
  excedido: 'mal',
}

const LEYENDA: Record<EstadoTope, string> = {
  ok: 'Vas bien',
  cerca: 'Cerca',
  excedido: 'Excedido',
}

/**
 * Una de las dos barras del Home: cuánto llevás contra el tope del mes.
 *
 * Cerrada: lo gastado contra el tope y la barra. Abierta: cuánto queda y
 * cuánto se puede gastar por día.
 */
export function BarraTope({
  titulo,
  resumen,
  porDia = null,
}: {
  titulo: string
  resumen: ResumenTope
  /** Cuánto se puede gastar por día hasta fin de mes (centavos). */
  porDia?: number | null
}) {
  const { gastado, tope, restante, estado, porcentajeBarra } = resumen
  const sinTope = tope <= 0
  const tono = TONO[estado]

  return (
    <CardPlegable
      titulo={titulo}
      badge={!sinTope && <Badge tono={tono}>{LEYENDA[estado]}</Badge>}
      resumen={
        <>
          <p className="gap-space-xs text-body-sm text-on-surface-variant flex items-baseline">
            <Monto tono={sinTope ? 'neutro' : tono} className="text-headline-md">
              {formatoARS(gastado)}
            </Monto>
            {!sinTope && <ConMontos>{`de ${formatoARS(tope)}`}</ConMontos>}
          </p>
          {!sinTope && (
            <Barra
              porcentaje={porcentajeBarra}
              tono={tono}
              etiqueta={`${titulo}: ${Math.round(porcentajeBarra)}% del tope`}
            />
          )}
        </>
      }
    >
      {sinTope ? (
        <p className="text-body-sm text-on-surface-variant">Sin tope configurado.</p>
      ) : (
        <>
          <p className="text-body-sm text-on-surface-variant">
            <ConMontos>
              {restante >= 0
                ? `Quedan ${formatoARS(restante)} · ${Math.round(porcentajeBarra)}% usado`
                : `Te pasaste ${formatoARS(-restante)}`}
            </ConMontos>
          </p>
          {porDia != null && estado !== 'excedido' && (
            <p className="text-body-sm text-on-surface-variant">
              <ConMontos>{`Podés gastar ${formatoARS(porDia)} por día`}</ConMontos>
            </p>
          )}
        </>
      )}
    </CardPlegable>
  )
}
