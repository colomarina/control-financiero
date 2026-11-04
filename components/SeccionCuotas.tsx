import Link from 'next/link'
import type { PlanActivo, MesComprometido } from '@/lib/core/cuotas'
import { nombreMes } from '@/lib/core/fechas'
import { porcentaje, formatoARS } from '@/lib/core/dinero'
import { Badge, Barra, ItemLista, Separador, Monto } from '@/components/ds'

/**
 * Contenido de la `Seccion` "Cuotas" en `/fijos`.
 *
 * Sin `Card` propia: la `Seccion` que la envuelve ya pone el fondo
 * `surface-container`. "Lo que viene" se despega con `surface-container-high`,
 * como `AltaComercio` o `FiltrosMovimientos`.
 */
export function SeccionCuotas({
  planes,
  meses,
}: {
  planes: PlanActivo[]
  meses: MesComprometido[]
}) {
  if (planes.length === 0) {
    return (
      <p className="text-body-md text-on-surface-variant text-center">
        No tenés ninguna compra en cuotas activa este mes.
      </p>
    )
  }

  return (
    <div className="gap-space-md flex flex-col">
      <ul className="gap-space-sm flex flex-col">
        {planes.map((p) => (
          <li key={p.compra.id}>
            <Link
              href={`/compra/${p.compra.id}`}
              // `active:` y no solo `hover:`: en el celular no hay hover, y el
              // destello al tocar es lo único que confirma el toque antes de
              // que aparezca el esqueleto de la otra pantalla.
              className="hover:bg-surface-container-high active:bg-surface-container-highest p-space-sm gap-space-xs flex flex-col rounded-lg transition-colors"
            >
              <div className="gap-space-sm flex items-center justify-between">
                <span className="gap-space-xs flex min-w-0 items-center">
                  <Badge tono={p.numero === p.compra.cuotas ? 'atencion' : 'neutro'}>
                    {p.numero}/{p.compra.cuotas}
                  </Badge>
                  <span className="text-body-md text-on-surface truncate">{p.compra.comercio}</span>
                </span>
                <Monto className="shrink-0">{formatoARS(p.importe)}</Monto>
              </div>
              <Barra
                porcentaje={porcentaje(p.numero, p.compra.cuotas)}
                etiqueta={`Cuota ${p.numero} de ${p.compra.cuotas}`}
              />
            </Link>
          </li>
        ))}
      </ul>

      <div className="bg-surface-container-high p-space-sm rounded-lg">
        <h3 className="text-label-caps text-on-surface-variant px-space-sm pb-space-xs uppercase">
          Lo que viene
        </h3>
        <ul>
          {meses.map((m, i) => (
            <li key={m.mes}>
              {i > 0 && <Separador />}
              <ItemLista
                icono="calendar_month"
                tonoIcono="neutro"
                titulo={nombreMes(m.mes)}
                detalle={`${m.planes} ${m.planes === 1 ? 'plan' : 'planes'}`}
                derecha={<Monto>{formatoARS(m.total)}</Monto>}
              />
            </li>
          ))}
        </ul>
      </div>
    </div>
  )
}
