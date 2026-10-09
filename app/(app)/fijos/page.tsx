import { getMovimientosDelMes } from '@/lib/db/movimientos'
import { getGastosFijos } from '@/lib/db/gastosFijos'
import { getComercios } from '@/lib/db/comercios'
import { mesActual, nombreMes } from '@/lib/core/fechas'
import { checklistFijos, contadorFijos, fijosPendientes } from '@/lib/core/fijos'
import { formatoARS, sumar, porcentaje } from '@/lib/core/dinero'
import { FilaFijo } from '@/components/FilaFijo'
import { AltaFijo } from '@/components/AltaFijo'
import { Card, TituloCard, MontoHero, Barra, Banner } from '@/components/ds'

export default async function FijosPage() {
  const mes = mesActual()
  const [movs, fijos, comercios] = await Promise.all([
    getMovimientosDelMes(mes),
    getGastosFijos(),
    getComercios(),
  ])

  const filas = checklistFijos(fijos, movs, mes)
  const contador = contadorFijos(fijos, movs, mes)
  const pendiente = fijosPendientes(fijos, movs, mes)
  const esperado = sumar(...filas.map((f) => f.estimado))
  const pagado = sumar(...filas.map((f) => f.pagado))

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
        <h1 className="text-headline-lg-mobile text-on-surface">Gastos fijos</h1>
        <p className="text-body-sm text-on-surface-variant">{nombreMes(mes)}</p>
      </header>

      <Card>
        <TituloCard>{todoPago ? 'Todo pago' : 'Falta pagar'}</TituloCard>
        <MontoHero tono={todoPago ? 'ok' : 'atencion'}>
          {formatoARS(pendiente)}
        </MontoHero>
        <Barra
          porcentaje={porcentaje(pagado, esperado)}
          tono={todoPago ? 'ok' : 'atencion'}
          etiqueta={`Gastos fijos: ${Math.round(porcentaje(pagado, esperado))}% pagado`}
        />
        <p className="text-body-sm text-on-surface-variant tabular-nums">
          {formatoARS(pagado)} de {formatoARS(esperado)}
          {' · '}
          {contador.pagados} {contador.pagados === 1 ? 'pagado' : 'pagados'}
          {contador.parciales > 0 && `, ${contador.parciales} a medias`}
          {contador.pendientes > 0 && `, ${contador.pendientes} sin pagar`}
        </p>
      </Card>

      <section className="gap-space-sm flex flex-col">
        <h2 className="text-headline-md text-on-surface px-space-xs">Checklist</h2>

        {ordenadas.length === 0 ? (
          <Card>
            <p className="text-body-md text-on-surface-variant text-center">
              Todavía no marcaste ningún gasto como fijo.
            </p>
          </Card>
        ) : (
          <>
            <Banner icono="auto_awesome">
              No hay nada que tildar: un fijo figura como pagado cuando cargás un
              movimiento de ese comercio en el mes.
            </Banner>
            <Card className="p-space-sm gap-0">
              <ul>
                {ordenadas.map((fila) => (
                  <FilaFijo key={fila.gastoFijoId} fila={fila} />
                ))}
              </ul>
            </Card>
          </>
        )}
      </section>

      <AltaFijo comercios={disponibles} />
    </div>
  )
}
