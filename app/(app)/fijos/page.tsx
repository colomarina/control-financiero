import { getMovimientosDelMes } from '@/lib/db/movimientos'
import { getGastosFijos } from '@/lib/db/gastosFijos'
import { getComercios } from '@/lib/db/comercios'
import { getComprasEnCuotas } from '@/lib/db/cuotas'
import { mesActual, nombreMes, sumarMeses } from '@/lib/core/fechas'
import { checklistFijos, contadorFijos, fijosPendientes } from '@/lib/core/fijos'
import { planesActivos, proximosMeses } from '@/lib/core/cuotas'
import { formatoARS, sumar, porcentaje } from '@/lib/core/dinero'
import { FilaFijo } from '@/components/FilaFijo'
import { AltaFijo } from '@/components/AltaFijo'
import { Seccion } from '@/components/Seccion'
import { SeccionCuotas } from '@/components/SeccionCuotas'
import { Card, TituloCard, MontoHero, Barra, Banner } from '@/components/ds'

export default async function FijosPage() {
  const mes = mesActual()
  // Los fijos solo cuentan movimientos reales: una cuota derivada de un
  // comercio `es_fijo` nunca entra acá. Si entrara, el checklist la leería
  // como una factura que llegó aunque nada se haya cargado ese mes.
  const [movs, fijos, comercios, compras] = await Promise.all([
    getMovimientosDelMes(mes),
    getGastosFijos(),
    getComercios(),
    getComprasEnCuotas(),
  ])

  const filas = checklistFijos(fijos, movs, mes)
  const contador = contadorFijos(fijos, movs, mes)
  const pendiente = fijosPendientes(fijos, movs, mes)
  const esperado = sumar(...filas.map((f) => f.estimado))
  const pagado = sumar(...filas.map((f) => f.pagado))

  const planes = planesActivos(compras, mes)
  const totalPlanesMes = sumar(...planes.map((p) => p.importe))
  const proximos = proximosMeses(compras, sumarMeses(mes, 1), 4)

  // La barra cuenta facturas y no plata, igual que el estado de cada fila:
  // con todas las facturas adentro llega al 100% aunque hayan salido más
  // baratas de lo esperado, que es justo cuando la card dice "Todo pago".
  const facturasEsperadas = filas.reduce((a, f) => a + f.pagosEsperados, 0)
  const facturasPagas = filas.reduce((a, f) => a + Math.min(f.pagosHechos, f.pagosEsperados), 0)

  // Los comercios que todavía no son un gasto fijo, para el alta.
  const yaFijos = new Set(fijos.map((f) => f.comercioId))
  const disponibles = comercios.filter((c) => !yaFijos.has(c.id))

  // El checklist se ordena por lo que falta hacer: primero lo pendiente.
  const ORDEN = { pendiente: 0, parcial: 1, pagado: 2 } as const
  const ordenadas = [...filas].sort(
    (a, b) => ORDEN[a.estado] - ORDEN[b.estado] || b.falta - a.falta,
  )

  const todoPago = pendiente === 0 && filas.length > 0

  return (
    <div className="gap-space-lg flex flex-col">
      <header>
        <h1 className="text-headline-lg-mobile text-on-surface">Fijos y cuotas</h1>
        <p className="text-body-sm text-on-surface-variant">{nombreMes(mes)}</p>
      </header>

      {/* Esta card es solo de gastos fijos: mide facturas, no plata (ver el
          comentario de más abajo), y una cuota no es una factura. No le sumes
          el total de cuotas acá — "Cuotas" tiene su propio resumen abajo. */}
      <Card>
        <TituloCard>{todoPago ? 'Todo pago' : 'Falta pagar'}</TituloCard>
        <MontoHero tono={todoPago ? 'ok' : 'atencion'}>
          {formatoARS(pendiente)}
        </MontoHero>
        <Barra
          // La barra cuenta facturas y no plata, igual que el estado de cada
          // fila: con todas las facturas adentro llega al 100% aunque hayan
          // salido más baratas de lo esperado, que es justo cuando la card
          // dice "Todo pago".
          porcentaje={porcentaje(facturasPagas, facturasEsperadas)}
          tono={todoPago ? 'ok' : 'atencion'}
          etiqueta={`Gastos fijos: ${facturasPagas} de ${facturasEsperadas} facturas`}
        />
        <p className="text-body-sm text-on-surface-variant tabular-nums">
          {formatoARS(pagado)} de {formatoARS(esperado)} esperados
          {' · '}
          {contador.pagados} {contador.pagados === 1 ? 'pagado' : 'pagados'}
          {contador.parciales > 0 && `, ${contador.parciales} a medias`}
          {contador.pendientes > 0 && `, ${contador.pendientes} sin pagar`}
        </p>
      </Card>

      <Seccion titulo="Gastos fijos" contador={`${facturasPagas} de ${facturasEsperadas} facturas`} abierta>
        {ordenadas.length === 0 ? (
          <p className="text-body-md text-on-surface-variant text-center">
            Todavía no marcaste ningún gasto como fijo.
          </p>
        ) : (
          <>
            <Banner icono="auto_awesome">
              No hay nada que tildar: un fijo queda pagado cuando cargás sus
              facturas del mes. Se cuentan facturas, no plata — si la luz vino
              más barata que lo esperado, igual está paga.
            </Banner>
            <ul>
              {ordenadas.map((fila) => (
                <FilaFijo key={fila.gastoFijoId} fila={fila} />
              ))}
            </ul>
          </>
        )}

        <AltaFijo comercios={disponibles} />
      </Seccion>

      <Seccion
        titulo="Cuotas"
        contador={`${planes.length} ${planes.length === 1 ? 'plan' : 'planes'} · ${formatoARS(totalPlanesMes)}`}
      >
        <SeccionCuotas planes={planes} meses={proximos} />
      </Seccion>
    </div>
  )
}
