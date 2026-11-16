import { getMovimientosDesde } from '@/lib/db/movimientos'
import { getGastosFijos } from '@/lib/db/gastosFijos'
import { getComprasEnCuotas } from '@/lib/db/cuotas'
import { getConfig } from '@/lib/db/config'
import { mesActual, nombreMes, diaActual, diasDelMes, sumarMeses } from '@/lib/core/fechas'
import { gastoTarjetaMes, gastoEfectivoMes, movimientosOrdenados } from '@/lib/core/gastos'
import { cuotasDelMes, cuotasEntre } from '@/lib/core/cuotas'
import { resumenTope, disponiblePorDia } from '@/lib/core/topes'
import { fijosPendientes, contadorFijos } from '@/lib/core/fijos'
import { prediccionDelTope, superaElTope, margenDisponible } from '@/lib/core/prediccion'
import { formatoARS } from '@/lib/core/dinero'
import { BarraTope } from '@/components/BarraTope'
import { MovimientosMes } from '@/components/MovimientosMes'
import { Card, TituloCard, MontoHero, Badge, Banner, Monto, Separador } from '@/components/ds'

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
  // mezclada para todo lo que sí tiene que ver la cuota (topes, lista).
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

  // Cada tope tiene su propio cierre. Los fijos pesan solo contra tarjeta.
  const pendientes = fijosPendientes(fijos, movs, mes)
  const cierre = (tope: 'tarjeta' | 'efectivo') =>
    prediccionDelTope({
      movsReales: movs,
      cuotasMes,
      fijos,
      mes,
      tope,
      mesesHistorico: config.mesesHistorico,
      diaActual: hoy,
    })
  const { prediccion, puntualesMes } = cierre('tarjeta')
  const { prediccion: prediccionEfectivo } = cierre('efectivo')

  // Cuánto podés gastar por día: el margen del tope repartido entre los días
  // que quedan, contando hoy.
  const diasConHoy = dias - hoy + 1
  const porDiaTarjeta = disponiblePorDia(
    margenDisponible({
      tope: config.topeTarjetaCentavos,
      gastadoReal: tarjeta.gastado,
      fijosPendientes: pendientes,
    }),
    diasConHoy,
  )
  const porDiaEfectivo = disponiblePorDia(
    margenDisponible({
      tope: config.topeEfectivoCentavos,
      gastadoReal: efectivo.gastado,
      fijosPendientes: 0,
    }),
    diasConHoy,
  )

  const fijosContador = contadorFijos(fijos, movs, mes)
  const delMes = movimientosOrdenados(conCuotas, mes)
  const seVaAPasar = superaElTope(prediccion, config.topeTarjetaCentavos)
  const efectivoSePasa = superaElTope(prediccionEfectivo, config.topeEfectivoCentavos)

  return (
    <div className="gap-space-lg flex flex-col">
      <header>
        <h1 className="text-headline-lg-mobile text-on-surface">{nombreMes(mes)}</h1>
        <p className="text-body-sm text-on-surface-variant">
          Día {hoy} de {dias}
        </p>
      </header>

      <div className="gap-space-sm flex flex-col">
        <BarraTope titulo="Tarjeta" resumen={tarjeta} porDia={porDiaTarjeta} />
        <BarraTope
          titulo="Efectivo y transferencias"
          resumen={efectivo}
          porDia={porDiaEfectivo}
        />
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
            <p className="text-body-sm text-on-surface-variant tabular-nums">
              Ritmo ~{formatoARS(prediccion.ritmoDiario)}/día
            </p>
            {puntualesMes.length > 0 && (
              <p className="text-body-sm text-on-surface-variant tabular-nums">
                Contadas aparte:{' '}
                {puntualesMes
                  .slice(0, 2)
                  .map((m) => `${m.comercio} ${formatoARS(m.importeCentavos)}`)
                  .join(' · ')}
                {puntualesMes.length > 2 && ` · +${puntualesMes.length - 2} más`}
              </p>
            )}
            {prediccion.puntualesEsperados > 0 && (
              <p className="text-body-sm text-on-surface-variant tabular-nums">
                Incluye ~{formatoARS(prediccion.puntualesEsperados)} de compras grandes que
                solés hacer
              </p>
            )}
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

        {prediccionEfectivo.status === 'proyeccion' && (
          <>
            <Separador />
            <div className="gap-space-sm flex items-center justify-between">
              <span className="text-body-md text-on-surface-variant">
                Efectivo y transferencias
              </span>
              <span className="gap-space-sm flex items-center">
                {efectivoSePasa && <Badge tono="atencion">Ojo</Badge>}
                <Monto tono={efectivoSePasa ? 'atencion' : 'neutro'}>
                  {formatoARS(prediccionEfectivo.normal)}
                </Monto>
              </span>
            </div>
          </>
        )}
      </Card>

      <MovimientosMes movimientos={delMes} />
    </div>
  )
}
