import { getMovimientosDesde } from '@/lib/db/movimientos'
import { getGastosFijos } from '@/lib/db/gastosFijos'
import { getComprasEnCuotas } from '@/lib/db/cuotas'
import { getConfig } from '@/lib/db/config'
import { mesActual, nombreMes, diaActual, diasDelMes, sumarMeses } from '@/lib/core/fechas'
import { gastoTarjetaMes, gastoEfectivoMes, movimientosOrdenados } from '@/lib/core/gastos'
import { cuotasDelMes, cuotasEntre } from '@/lib/core/cuotas'
import { resumenTope } from '@/lib/core/topes'
import { fijosPendientes, contadorFijos } from '@/lib/core/fijos'
import {
  gastoNoVariable,
  tasaVariableDiaria,
  promedioHistoricoDiario,
  tasaDiariaAplicable,
  prediccionCierre,
  superaElTope,
} from '@/lib/core/prediccion'
import { formatoARS } from '@/lib/core/dinero'
import { BarraTope } from '@/components/BarraTope'
import { MovimientosMes } from '@/components/MovimientosMes'
import { Card, TituloCard, MontoHero, Badge, Banner } from '@/components/ds'

export default async function HomePage() {
  const mes = mesActual()
  const config = await getConfig()

  // Una sola consulta trae el mes actual + el histórico que necesita la predicción.
  const desde = sumarMeses(mes, -config.mesesHistorico)
  const [movs, fijos, compras] = await Promise.all([
    getMovimientosDesde(desde),
    getGastosFijos(),
    getComprasEnCuotas(),
  ])

  // `movs` son los movimientos reales y no se tocan: los fijos se derivan
  // contando movimientos por comercio, y una cuota de un comercio fijo haría
  // que el fijo lea como pagado sin que llegara nada. `conCuotas` es la lista
  // mezclada para todo lo que sí tiene que ver la cuota (topes, lista, ritmo).
  const cuotasMes = cuotasDelMes(compras, mes)
  const conCuotas = [...movs, ...cuotasEntre(compras, desde, mes)]

  const hoy = diaActual()
  const dias = diasDelMes(mes)

  const tarjeta = resumenTope(
    gastoTarjetaMes(conCuotas, mes),
    config.topeTarjetaCentavos,
    config.umbralCercaPct,
  )
  const efectivo = resumenTope(
    gastoEfectivoMes(conCuotas, mes),
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
        // La unión de fijos ya pagados y cuotas del mes. La cuenta vive en
        // `lib/core` y no acá, con su test: es la que no puede contar dos
        // veces la cuota de un comercio fijo.
        fijosYaPagados: gastoNoVariable(fijos, movs, cuotasMes, mes, 'tarjeta'),
        diaActual: hoy,
      }),
      promHistorico: promedioHistoricoDiario(conCuotas, mes, config.mesesHistorico, 'tarjeta'),
      diaActual: hoy,
      umbralDia: config.umbralDia,
    }),
    diaActual: hoy,
    diasMes: dias,
    umbralDia: config.umbralDia,
  })

  const fijosContador = contadorFijos(fijos, movs, mes)
  const delMes = movimientosOrdenados(conCuotas, mes)
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

      <MovimientosMes movimientos={delMes} />
    </div>
  )
}
