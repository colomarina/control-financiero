import Link from 'next/link'
import { getMovimientosDesde } from '@/lib/db/movimientos'
import { getGastosFijos } from '@/lib/db/gastosFijos'
import { getConfig } from '@/lib/db/config'
import { mesActual, nombreMes, diaActual, diasDelMes, sumarMeses } from '@/lib/core/fechas'
import { gastoTarjetaMes, gastoEfectivoMes, movimientosOrdenados } from '@/lib/core/gastos'
import { resumenTope } from '@/lib/core/topes'
import { fijosPendientes, fijosYaPagados, contadorFijos } from '@/lib/core/fijos'
import {
  tasaVariableDiaria,
  promedioHistoricoDiario,
  tasaDiariaAplicable,
  prediccionCierre,
  superaElTope,
} from '@/lib/core/prediccion'
import { formatoARS } from '@/lib/core/dinero'
import { BarraTope } from '@/components/BarraTope'
import { ListaMovimientos } from '@/components/ListaMovimientos'
import { Card, TituloCard, MontoHero, Badge, Banner } from '@/components/ds'

export default async function HomePage() {
  const mes = mesActual()
  const config = await getConfig()

  // Una sola consulta trae el mes actual + el histórico que necesita la predicción.
  const desde = sumarMeses(mes, -config.mesesHistorico)
  const [movs, fijos] = await Promise.all([getMovimientosDesde(desde), getGastosFijos()])

  const hoy = diaActual()
  const dias = diasDelMes(mes)

  const tarjeta = resumenTope(
    gastoTarjetaMes(movs, mes),
    config.topeTarjetaCentavos,
    config.umbralCercaPct,
  )
  const efectivo = resumenTope(
    gastoEfectivoMes(movs, mes),
    config.topeEfectivoCentavos,
    config.umbralCercaPct,
  )

  // La predicción es sobre el tope de tarjeta, como en la hoja del Excel.
  const pendientes = fijosPendientes(fijos, movs, mes)
  const prediccion = prediccionCierre({
    gastadoReal: tarjeta.gastado,
    fijosPendientes: pendientes,
    tasaDiaria: tasaDiariaAplicable({
      tasaMesActual: tasaVariableDiaria({
        gastadoReal: tarjeta.gastado,
        fijosYaPagados: fijosYaPagados(fijos, movs, mes, 'tarjeta'),
        diaActual: hoy,
      }),
      promHistorico: promedioHistoricoDiario(movs, mes, config.mesesHistorico, 'tarjeta'),
      diaActual: hoy,
      umbralDia: config.umbralDia,
    }),
    diaActual: hoy,
    diasMes: dias,
    umbralDia: config.umbralDia,
  })

  const fijosContador = contadorFijos(fijos, movs, mes)
  const delMes = movimientosOrdenados(movs, mes)
  const seVaAPasar = superaElTope(prediccion, config.topeTarjetaCentavos)

  return (
    <div className="gap-space-lg flex flex-col">
      <header>
        <h1 className="text-headline-lg-mobile text-on-surface">{nombreMes(mes)}</h1>
        <p className="text-body-sm text-on-surface-variant">
          Día {hoy} de {dias}
        </p>
      </header>

      <div className="gap-space-sm flex flex-col">
        <BarraTope titulo="Tarjeta" resumen={tarjeta} />
        <BarraTope titulo="Efectivo y transferencias" resumen={efectivo} />
      </div>

      <Card>
        <div className="gap-space-sm flex items-center justify-between">
          <TituloCard>Cierre estimado</TituloCard>
          {prediccion.status === 'proyeccion' && seVaAPasar && (
            <Badge tono="atencion">Ojo</Badge>
          )}
        </div>

        {prediccion.status === 'temprano' ? (
          <p className="text-body-md text-on-surface-variant">{prediccion.mensaje}</p>
        ) : (
          <>
            <MontoHero tono={seVaAPasar ? 'atencion' : 'neutro'}>
              {formatoARS(prediccion.normal)}
            </MontoHero>
            <p className="text-body-sm text-on-surface-variant tabular-nums">
              Entre {formatoARS(prediccion.optimista)} y {formatoARS(prediccion.pesimista)}
              {' · '}
              quedan {prediccion.diasRestantes}{' '}
              {prediccion.diasRestantes === 1 ? 'día' : 'días'}
            </p>
            {seVaAPasar && (
              <p className="text-body-md text-tertiary">
                A este ritmo te pasás del tope de tarjeta.
              </p>
            )}
          </>
        )}

        {pendientes > 0 && (
          <Banner icono="event_repeat">
            Incluye {formatoARS(pendientes)} de fijos pendientes ·{' '}
            {fijosContador.pendientes + fijosContador.parciales} sin pagar.
          </Banner>
        )}
      </Card>

      <section className="gap-space-sm flex flex-col">
        <div className="px-space-xs flex items-baseline justify-between">
          <h2 className="text-headline-md text-on-surface">Movimientos</h2>
          <span className="text-body-sm text-on-surface-variant tabular-nums">
            {delMes.length}
          </span>
        </div>

        {delMes.length === 0 ? (
          <Card>
            <p className="text-body-md text-on-surface-variant text-center">
              Todavía no cargaste nada este mes.{' '}
              <Link href="/cargar" className="text-primary underline underline-offset-4">
                Cargar un gasto
              </Link>
            </p>
          </Card>
        ) : (
          <ListaMovimientos movimientos={delMes} />
        )}
      </section>
    </div>
  )
}
