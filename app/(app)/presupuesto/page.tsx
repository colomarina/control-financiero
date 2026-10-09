import Link from 'next/link'
import { getMovimientosDelMes } from '@/lib/db/movimientos'
import { getPlanDelMes } from '@/lib/db/presupuesto'
import { getComercios } from '@/lib/db/comercios'
import { getConfig } from '@/lib/db/config'
import { mesActual, nombreMes, sumarMeses } from '@/lib/core/fechas'
import { presupuestoVsReal, resumenPresupuesto } from '@/lib/core/presupuesto'
import { formatoARS } from '@/lib/core/dinero'
import { copiarMesAnterior } from '@/app/actions/presupuesto'
import { SelectorMes } from '@/components/SelectorMes'
import { FilaPresupuesto } from '@/components/FilaPresupuesto'
import { AltaLineaPlan } from '@/components/AltaLineaPlan'
import { Icono } from '@/components/Icono'
import {
  Card,
  TituloCard,
  MontoHero,
  Barra,
  Badge,
  Separador,
  botonSecundario,
} from '@/components/ds'

const MES_VALIDO = /^\d{4}-\d{2}$/

export default async function PresupuestoPage({
  searchParams,
}: PageProps<'/presupuesto'>) {
  const params = await searchParams
  const pedido = typeof params.mes === 'string' ? params.mes : null
  const mes = pedido && MES_VALIDO.test(pedido) ? pedido : mesActual()

  const [plan, movs, comercios, config] = await Promise.all([
    getPlanDelMes(mes),
    getMovimientosDelMes(mes),
    getComercios(),
    getConfig(),
  ])

  const filas = presupuestoVsReal(plan, movs, mes, config.umbralCercaPct)
  const resumen = resumenPresupuesto(filas)

  const enElPlan = new Set(plan.map((l) => l.comercioId))
  const disponibles = comercios.filter((c) => !enElPlan.has(c.id))

  const excedido = resumen.diferencia < 0
  const mesSiguiente = sumarMeses(mes, 1)

  return (
    <div className="gap-space-lg flex flex-col">
      <header className="gap-space-sm flex flex-col">
        <div className="gap-space-xs flex flex-col">
          <h1 className="text-headline-lg-mobile text-on-surface">Presupuesto</h1>
          <p className="text-body-sm text-on-surface-variant">
            La plata que separás cada mes. Los débitos automáticos están en Fijos.
          </p>
        </div>
        <SelectorMes mes={mes} />
      </header>

      {filas.length === 0 ? (
        <Card className="items-center text-center">
          <p className="text-body-md text-on-surface-variant">
            No hay plan cargado para {nombreMes(mes)}.
          </p>
          <form action={copiarMesAnterior}>
            <input type="hidden" name="mes" value={mes} />
            <button type="submit" className={botonSecundario}>
              Copiar el plan de {nombreMes(sumarMeses(mes, -1))}
            </button>
          </form>
        </Card>
      ) : (
        <>
          <Card>
            <div className="gap-space-sm flex items-center justify-between">
              <TituloCard>
                {excedido ? 'Te pasaste del plan' : 'Te queda del plan'}
              </TituloCard>
              {(resumen.excedidos > 0 || resumen.alLimite > 0) && (
                <Badge tono={resumen.excedidos > 0 ? 'mal' : 'atencion'}>
                  {resumen.excedidos > 0
                    ? `${resumen.excedidos} excedido${resumen.excedidos === 1 ? '' : 's'}`
                    : `${resumen.alLimite} al límite`}
                </Badge>
              )}
            </div>

            <MontoHero tono={excedido ? 'mal' : 'ok'}>
              {formatoARS(Math.abs(resumen.diferencia))}
            </MontoHero>

            <Barra
              porcentaje={resumen.porcentajeUsado}
              tono={excedido ? 'mal' : 'ok'}
              etiqueta={`Presupuesto: ${Math.round(resumen.porcentajeUsado)}% usado`}
            />

            <p className="text-body-sm text-on-surface-variant tabular-nums">
              {formatoARS(resumen.real)} de {formatoARS(resumen.planeado)}
              {' · '}
              {Math.round(resumen.porcentajeUsado)}%
            </p>
          </Card>

          <section className="gap-space-sm flex flex-col">
            <h2 className="text-headline-md text-on-surface px-space-xs">
              Por comercio
            </h2>
            <Card className="p-space-sm gap-0">
              <ul>
                {filas.map((fila, i) => (
                  <li key={fila.comercioId}>
                    {i > 0 && <Separador />}
                    <FilaPresupuesto fila={fila} mes={mes} />
                  </li>
                ))}
              </ul>
            </Card>
          </section>

        </>
      )}

      <AltaLineaPlan comercios={disponibles} mes={mes} />

      {/* El ciclo real de esta pantalla es armar el mes que viene y después
          seguirlo. Lo segundo ya estaba; lo primero dependía de descubrir que
          el selector de arriba avanza a meses futuros. */}
      <Link
        href={`/presupuesto?mes=${mesSiguiente}`}
        className={`${botonSecundario} gap-space-sm flex items-center justify-center`}
      >
        <Icono nombre="event_upcoming" className="text-[20px]" />
        Planificar {nombreMes(mesSiguiente)}
      </Link>
    </div>
  )
}
