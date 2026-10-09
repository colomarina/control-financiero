import { getMovimientosDesde } from '@/lib/db/movimientos'
import { getConfig } from '@/lib/db/config'
import { mesActual, nombreMes } from '@/lib/core/fechas'
import {
  resumenMensual,
  promedioMensual,
  variacionContraMesAnterior,
  totalPorCategoria,
  serieEvolucion,
  mesesConDatos,
} from '@/lib/core/historial'
import { formatoARS, porcentaje } from '@/lib/core/dinero'
import { GraficoEvolucion } from '@/components/GraficoEvolucion'
import { BuscadorMovimientos } from '@/components/BuscadorMovimientos'
import {
  Card,
  TituloCard,
  MontoHero,
  Barra,
  Monto,
  ItemLista,
  Separador,
} from '@/components/ds'
import { cn } from '@/lib/utils'

export default async function HistorialPage() {
  const mes = mesActual()
  const config = await getConfig()

  // Todo el histórico: son pocos cientos de filas, entra de una.
  const movs = await getMovimientosDesde('2000-01')

  const filas = resumenMensual(movs, {
    sueldoCentavos: config.sueldoCentavos,
    mesEnCurso: mes,
  })
  const promedio = promedioMensual(filas)
  const categorias = totalPorCategoria(movs, mesesConDatos(movs))
  const totalCategorias = [...categorias.values()].reduce((a, b) => a + b, 0)

  if (filas.length === 0) {
    return (
      <div className="gap-space-lg flex flex-col">
        <h1 className="text-headline-lg-mobile text-on-surface">Historial</h1>
        <Card>
          <p className="text-body-md text-on-surface-variant text-center">
            Todavía no hay movimientos cargados.
          </p>
        </Card>
      </div>
    )
  }

  return (
    <div className="gap-space-lg flex flex-col">
      <header>
        <h1 className="text-headline-lg-mobile text-on-surface">Historial</h1>
        <p className="text-body-sm text-on-surface-variant">
          {filas.length} {filas.length === 1 ? 'mes' : 'meses'} con movimientos
        </p>
      </header>

      {promedio > 0 && (
        <Card>
          <TituloCard>Promedio mensual</TituloCard>
          <MontoHero>{formatoARS(promedio)}</MontoHero>
          <p className="text-body-sm text-on-surface-variant">
            Sobre los meses cerrados. {nombreMes(mes)} está en curso y no entra.
          </p>
        </Card>
      )}

      <section className="gap-space-sm flex flex-col">
        <h2 className="text-headline-md text-on-surface px-space-xs">Buscar</h2>
        {/* `mesesConDatos` los da del más viejo al más nuevo; en un selector se
            busca primero el mes reciente. */}
        <BuscadorMovimientos movimientos={movs} meses={[...mesesConDatos(movs)].reverse()} />
      </section>

      <section className="gap-space-sm flex flex-col">
        <h2 className="text-headline-md text-on-surface px-space-xs">Evolución</h2>
        <Card>
          <GraficoEvolucion datos={serieEvolucion(filas)} />
        </Card>
      </section>

      <section className="gap-space-sm flex flex-col">
        <h2 className="text-headline-md text-on-surface px-space-xs">Mes a mes</h2>
        <Card className="p-space-sm gap-0">
          <ul>
            {filas.map((f, i) => {
              const variacion = variacionContraMesAnterior(filas, f.mes)
              return (
                <li key={f.mes}>
                  {i > 0 && <Separador />}
                  <ItemLista
                    icono={f.enCurso ? 'pending' : 'calendar_month'}
                    tonoIcono={f.enCurso ? 'neutro' : 'ok'}
                    titulo={
                      <>
                        {nombreMes(f.mes)}
                        {f.enCurso && (
                          <span className="text-on-surface-variant"> · en curso</span>
                        )}
                      </>
                    }
                    detalle={
                      <>
                        Tarjeta {formatoARS(f.tarjeta)} · Efec. {formatoARS(f.efectivo)}
                      </>
                    }
                    derecha={
                      <div className="gap-space-xs flex flex-col items-end">
                        <Monto>{formatoARS(f.total)}</Monto>
                        <span
                          className={cn(
                            'text-body-sm tabular-nums',
                            variacion === null
                              ? 'text-on-surface-variant'
                              : variacion > 0
                                ? 'text-error'
                                : 'text-primary',
                          )}
                        >
                          {variacion === null
                            ? '—'
                            : `${variacion > 0 ? '+' : ''}${Math.round(variacion)}%`}
                        </span>
                      </div>
                    }
                  />
                </li>
              )
            })}
          </ul>
        </Card>
        <p className="text-body-sm text-on-surface-variant px-space-xs">
          La variación del mes en curso lo compara incompleto contra un mes entero.
        </p>
      </section>

      <section className="gap-space-sm flex flex-col">
        <h2 className="text-headline-md text-on-surface px-space-xs">En qué se va</h2>
        <Card className="gap-space-md">
          {[...categorias].slice(0, 10).map(([categoria, centavos]) => (
            <div key={categoria} className="gap-space-xs flex flex-col">
              <div className="gap-space-sm flex items-baseline justify-between">
                <span className="text-body-md text-on-surface truncate">{categoria}</span>
                <Monto className="shrink-0">{formatoARS(centavos)}</Monto>
              </div>
              <Barra
                porcentaje={porcentaje(centavos, totalCategorias)}
                tono="ok"
                etiqueta={`${categoria}: ${Math.round(porcentaje(centavos, totalCategorias))}% del total`}
              />
            </div>
          ))}
        </Card>
        <p className="text-body-sm text-on-surface-variant px-space-xs">
          Acumulado de todos los meses cargados.
        </p>
      </section>
    </div>
  )
}
