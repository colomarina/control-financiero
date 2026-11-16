import { formatoARS } from '@/lib/core/dinero'
import type { ResumenTope, EstadoTope } from '@/lib/core/topes'
import { Card, TituloCard, MontoHero, Badge, Barra, type Semaforo } from '@/components/ds'

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

/** Una de las dos barras del Home: cuánto llevás contra el tope del mes. */
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
    <Card>
      <div className="gap-space-sm flex items-center justify-between">
        <TituloCard>{titulo}</TituloCard>
        {!sinTope && <Badge tono={tono}>{LEYENDA[estado]}</Badge>}
      </div>

      <MontoHero tono={sinTope ? 'neutro' : tono}>{formatoARS(gastado)}</MontoHero>

      {sinTope ? (
        <p className="text-body-sm text-on-surface-variant">Sin tope configurado.</p>
      ) : (
        <>
          <Barra
            porcentaje={porcentajeBarra}
            tono={tono}
            etiqueta={`${titulo}: ${Math.round(porcentajeBarra)}% del tope`}
          />
          <p className="text-body-sm text-on-surface-variant tabular-nums">
            {restante >= 0
              ? `Quedan ${formatoARS(restante)} de ${formatoARS(tope)}`
              : `Te pasaste ${formatoARS(-restante)} de ${formatoARS(tope)}`}
          </p>
          {porDia != null && estado !== 'excedido' && (
            <p className="text-body-sm text-on-surface-variant tabular-nums">
              Podés gastar {formatoARS(porDia)} por día
            </p>
          )}
        </>
      )}
    </Card>
  )
}
