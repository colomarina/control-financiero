import { getMovimientosDesde } from '@/lib/db/movimientos'
import { getComprasEnCuotas } from '@/lib/db/cuotas'
import { getConfig } from '@/lib/db/config'
import { mesActual, nombreMes } from '@/lib/core/fechas'
import { cuotasEntre } from '@/lib/core/cuotas'
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
import { Seccion } from '@/components/Seccion'
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

/**
 * Historial, en secciones plegables — el mismo patrón que Configuración.
 *
 * Son cuatro bloques largos (el buscador con todo el histórico, el gráfico, la
 * tabla mes a mes y el reparto por categoría) y apilados abiertos obligaban a
 * scrollear cuatro pantallas. Plegados, la pantalla entra entera y cada cosa
 * está a un tap, con el contador adelantando qué hay adentro.
 *
 * "Mes a mes" arranca abierta porque es la columna vertebral de la pantalla; el
 * promedio queda afuera de toda sección porque es el número de portada.
 */
export default async function HistorialPage() {
  const mes = mesActual()
  const config = await getConfig()

  // Todo el histórico: son pocos cientos de filas, entra de una.
  const [movs, compras] = await Promise.all([
    getMovimientosDesde('2000-01'),
    getComprasEnCuotas(),
  ])

  // Las cuotas entran hasta `mes` y ni uno más. Sin el corte, el mes a mes
  // listaría hasta la última cuota del plan más largo y, peor, `promedioMensual`
  // promediaría esos meses futuros como CERRADOS —solo excluye el que viene
  // marcado `enCurso`—, así que el "Promedio mensual" de portada quedaría mal
  // y el gráfico de evolución dibujaría un futuro que todavía no pasó. Lo que
  // viene se mira en Fijos y cuotas, que existe justo para eso.
  const conCuotas = [...movs, ...cuotasEntre(compras, '2000-01', mes)]

  const filas = resumenMensual(conCuotas, {
    sueldoCentavos: config.sueldoCentavos,
    mesEnCurso: mes,
  })
  const promedio = promedioMensual(filas)
  const categorias = totalPorCategoria(conCuotas, mesesConDatos(conCuotas))
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
    <div className="gap-space-md flex flex-col">
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

      <Seccion titulo="Buscar" contador={`${conCuotas.length} movimientos`}>
        {/* `mesesConDatos` los da del más viejo al más nuevo; en un selector se
            busca primero el mes reciente. */}
        <BuscadorMovimientos
          movimientos={conCuotas}
          meses={[...mesesConDatos(conCuotas)].reverse()}
        />
      </Seccion>

      {/* Con un solo mes no hay evolución que dibujar. */}
      {filas.length >= 2 && (
        <Seccion titulo="Evolución" montarAlAbrir>
          <GraficoEvolucion datos={serieEvolucion(filas)} />
        </Seccion>
      )}

      <Seccion
        titulo="Mes a mes"
        contador={`${filas.length} ${filas.length === 1 ? 'mes' : 'meses'}`}
        abierta
      >
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
        <p className="text-body-sm text-on-surface-variant">
          La variación del mes en curso lo compara incompleto contra un mes entero.
        </p>
      </Seccion>

      <Seccion titulo="En qué se va" contador={`${categorias.size} categorías`}>
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
        <p className="text-body-sm text-on-surface-variant">
          Acumulado de todos los meses cargados.
        </p>
      </Seccion>
    </div>
  )
}
