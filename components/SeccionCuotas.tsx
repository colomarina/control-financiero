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
  // `planes` solo mira el mes actual, pero una compra fechada a futuro
  // (la base no le pone piso a `fecha`) no tiene cuota activa todavía y
  // puede seguir apareciendo en `meses`. Si se cortara acá por `planes`
  // solo, el día que algo rompa el límite del calendario de alta la
  // pantalla escondería justo el dato que existe para mostrar: con qué
  // arranca el mes que viene.
  const hayAlgoQueViene = meses.some((m) => m.planes > 0)

  if (planes.length === 0 && !hayAlgoQueViene) {
    return (
      <p className="text-body-md text-on-surface-variant text-center">
        No tenés ninguna compra en cuotas.
      </p>
    )
  }

  return (
    <div className="gap-space-md flex flex-col">
      {planes.length === 0 ? (
        // Distinto del vacío total: acá sí hay algo que mostrar, solo que no
        // pesa este mes. El texto empalma con "Lo que viene" en vez de
        // disculparse por no tener nada que listar arriba.
        <p className="text-body-md text-on-surface-variant text-center">
          Ninguna cuota activa este mes, pero hay compromisos a la vista:
        </p>
      ) : (
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
      )}

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
