import { getMovimientosDesde } from '@/lib/db/movimientos'
import { getGastosFijos } from '@/lib/db/gastosFijos'
import { getComprasEnCuotas } from '@/lib/db/cuotas'
import { getConfig } from '@/lib/db/config'
import { getTarjetas } from '@/lib/db/tarjetas'
import { metaDelMes } from '@/lib/core/meta'
import { MetaTarjeta } from '@/components/MetaTarjeta'
import { mesActual, nombreMes, diaActual, diasDelMes, sumarMeses } from '@/lib/core/fechas'
import { gastoTarjetaMes, gastoEfectivoMes, movimientosOrdenados } from '@/lib/core/gastos'
import { cuotasDelMes, cuotasEntre } from '@/lib/core/cuotas'
import { resumenTope, disponiblePorDia } from '@/lib/core/topes'
import { fijosPendientes, contadorFijos } from '@/lib/core/fijos'
import { prediccionDelTope, superaElTope, margenDisponible } from '@/lib/core/prediccion'
import { formatoARS } from '@/lib/core/dinero'
import { BarraTope } from '@/components/BarraTope'
import { MovimientosMes } from '@/components/MovimientosMes'
import { Badge, Banner, ConMontos, Monto } from '@/components/ds'
import { CardPlegable } from '@/components/CardPlegable'
import { BotonPrivado } from '@/components/BotonPrivado'

export default async function HomePage() {
  const mes = mesActual()
  const config = await getConfig()

  // Una sola consulta trae el mes actual + el histórico que necesita la predicción.
  const desde = sumarMeses(mes, -config.mesesHistorico)
  const [movs, fijos, compras, tarjetas] = await Promise.all([
    getMovimientosDesde(desde),
    getGastosFijos(),
    getComprasEnCuotas(),
    getTarjetas(),
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

  // La meta del banco: como el cierre estimado, recibe solo movimientos reales
  // y las cuotas del mes aparte (ver la tabla de cuotas en CLAUDE.md).
  const meta = metaDelMes({
    movsReales: movs,
    cuotasMes,
    fijos,
    tarjetas,
    mes,
    diaActual: hoy,
    mesesHistorico: config.mesesHistorico,
    minimo: config.metaMinimoCentavos,
    colchon: config.metaColchonCentavos,
    diaCierre: config.metaDiaCierre,
  })

  const fijosContador = contadorFijos(fijos, movs, mes)
  const delMes = movimientosOrdenados(conCuotas, mes)
  const seVaAPasar = superaElTope(prediccion, config.topeTarjetaCentavos)
  const efectivoSePasa = superaElTope(prediccionEfectivo, config.topeEfectivoCentavos)

  return (
    // `zona-privada`: acá adentro el ojito del encabezado tapa los importes.
    <div className="zona-privada gap-space-lg flex flex-col">
      <header className="gap-space-sm flex items-center">
        <div className="min-w-0 flex-1">
          <h1 className="text-headline-lg-mobile text-on-surface">{nombreMes(mes)}</h1>
          <p className="text-body-sm text-on-surface-variant">
            Día {hoy} de {dias}
          </p>
        </div>
        <BotonPrivado />
      </header>

      <div className="gap-space-sm flex flex-col">
        <BarraTope titulo="Tarjeta" resumen={tarjeta} porDia={porDiaTarjeta} />
        <BarraTope
          titulo="Efectivo y transferencias"
          resumen={efectivo}
          porDia={porDiaEfectivo}
        />
        {meta && <MetaTarjeta meta={meta} />}

        <CardPlegable
          titulo="Cierre estimado"
          badge={
            (seVaAPasar || efectivoSePasa) && <Badge tono="atencion">Ojo</Badge>
          }
          resumen={
            prediccion.status === 'temprano' ? (
              <p className="text-body-sm text-on-surface-variant">{prediccion.mensaje}</p>
            ) : (
              <div className="gap-space-xs flex flex-col">
                <div className="gap-space-sm flex items-baseline justify-between">
                  <span className="text-body-md text-on-surface-variant">Tarjeta</span>
                  <Monto tono={seVaAPasar ? 'atencion' : 'neutro'} className="text-headline-md">
                    {formatoARS(prediccion.normal)}
                  </Monto>
                </div>
                {prediccionEfectivo.status === 'proyeccion' && (
                  <div className="gap-space-sm flex items-baseline justify-between">
                    <span className="text-body-md text-on-surface-variant">
                      Efectivo y transferencias
                    </span>
                    <Monto tono={efectivoSePasa ? 'atencion' : 'neutro'}>
                      {formatoARS(prediccionEfectivo.normal)}
                    </Monto>
                  </div>
                )}
              </div>
            )
          }
        >
          {prediccion.status === 'proyeccion' && (
            <>
              <p className="text-body-sm text-on-surface-variant">
                <ConMontos>
                  {`Tarjeta entre ${formatoARS(prediccion.optimista)} y ${formatoARS(prediccion.pesimista)} · ` +
                    `quedan ${prediccion.diasRestantes} ${prediccion.diasRestantes === 1 ? 'día' : 'días'}`}
                </ConMontos>
              </p>
              <p className="text-body-sm text-on-surface-variant">
                <ConMontos>{`Ritmo ~${formatoARS(prediccion.ritmoDiario)}/día`}</ConMontos>
              </p>
              {puntualesMes.length > 0 && (
                <p className="text-body-sm text-on-surface-variant">
                  <ConMontos>
                    {'Contadas aparte: ' +
                      puntualesMes
                        .slice(0, 2)
                        .map((m) => `${m.comercio} ${formatoARS(m.importeCentavos)}`)
                        .join(' · ') +
                      (puntualesMes.length > 2 ? ` · +${puntualesMes.length - 2} más` : '')}
                  </ConMontos>
                </p>
              )}
              {prediccion.puntualesEsperados > 0 && (
                <p className="text-body-sm text-on-surface-variant">
                  <ConMontos>
                    {`Incluye ~${formatoARS(prediccion.puntualesEsperados)} de compras grandes que solés hacer`}
                  </ConMontos>
                </p>
              )}
              {seVaAPasar && (
                <p className="text-body-md text-tertiary">
                  A este ritmo te pasás del tope de tarjeta.
                </p>
              )}
            </>
          )}

          {efectivoSePasa && (
            <p className="text-body-md text-tertiary">
              A este ritmo te pasás del tope de efectivo.
            </p>
          )}

          {pendientes > 0 && (
            <Banner icono="event_repeat">
              <ConMontos>
                {`Incluye ${formatoARS(pendientes)} de fijos pendientes · ` +
                  `${fijosContador.pendientes + fijosContador.parciales} sin pagar.`}
              </ConMontos>
            </Banner>
          )}
        </CardPlegable>
      </div>

      <MovimientosMes movimientos={delMes} />
    </div>
  )
}
