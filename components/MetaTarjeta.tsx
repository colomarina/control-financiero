import type { EstadoMeta, Meta } from '@/lib/core/meta'
import { formatoARS, porcentaje } from '@/lib/core/dinero'
import { Barra, Badge, ConMontos, Monto, type Semaforo } from '@/components/ds'
import { CardPlegable } from '@/components/CardPlegable'

/**
 * El semáforo de la meta. Rojo solo para "cierra y no llegás": es el único
 * caso en que se pierde la bonificación si no se hace algo ya.
 */
const TONO: Record<EstadoMeta, Semaforo> = {
  cumplida: 'ok',
  cubierta: 'ok',
  urgente: 'mal',
  temprano: 'neutro',
  'en-camino': 'neutro',
  'no-llega': 'atencion',
}

const BADGE: Record<EstadoMeta, string> = {
  cumplida: 'Cumplida',
  cubierta: 'Cubierta',
  urgente: 'Urgente',
  temprano: 'Temprano',
  'en-camino': 'En camino',
  'no-llega': 'No llega',
}

/**
 * La meta mínima de consumo con tarjeta, en el Home. La lógica entera vive en
 * `metaDelMes` (`lib/core/meta.ts`); acá solo se pinta. La barra mide lo
 * comprometido —gastado más los débitos que faltan— contra el mínimo.
 *
 * Cerrada muestra el titular del consejo ("Cierra en 2 días y faltan $X"),
 * que es lo que no se puede perder; abierta, el porqué y qué hacer.
 */
export function MetaTarjeta({ meta }: { meta: Meta }) {
  const tono = TONO[meta.estado]
  const pct = porcentaje(meta.comprometido, meta.minimo)

  return (
    <CardPlegable
      titulo={`Meta ${meta.banco}`}
      badge={<Badge tono={tono}>{BADGE[meta.estado]}</Badge>}
      resumen={
        <>
          <p className="gap-space-xs text-body-sm text-on-surface-variant flex items-baseline">
            <Monto tono={tono} className="text-headline-md">
              {formatoARS(meta.gastado)}
            </Monto>
            <ConMontos>{`de ${formatoARS(meta.minimo)}`}</ConMontos>
          </p>
          <Barra
            porcentaje={pct}
            tono={tono}
            etiqueta={`Meta ${meta.banco}: ${Math.round(pct)}% del mínimo`}
          />
          <p className="text-body-md text-on-surface">
            <ConMontos>{meta.titulo}</ConMontos>
          </p>
        </>
      }
    >
      <p className="text-body-sm text-on-surface-variant">
        <ConMontos>{meta.detalle}</ConMontos>
      </p>
      {meta.comprometido > meta.gastado && (
        <p className="text-body-sm text-on-surface-variant">
          <ConMontos>
            {`Incluye ${formatoARS(meta.comprometido - meta.gastado)} de débitos automáticos por llegar.`}
          </ConMontos>
        </p>
      )}
    </CardPlegable>
  )
}
