import { notFound } from 'next/navigation'
import { z } from 'zod'
import { getCompraEnCuotas } from '@/lib/db/cuotas'
import { getComercios } from '@/lib/db/comercios'
import { getMovimientosDesde } from '@/lib/db/movimientos'
import {
  hoyISO,
  mesActual,
  nombreMes,
  fechaLarga,
  sumarMeses,
  mesDe,
  mesesEntre,
  type Mes,
} from '@/lib/core/fechas'
import { numeroDeCuota, cuotasTranscurridas, totalPlan, mesFinal } from '@/lib/core/cuotas'
import { comerciosFrecuentes } from '@/lib/core/frecuentes'
import { formatoARS } from '@/lib/core/dinero'
import { Card, TituloCard, MontoHero, Barra, ItemLista, Separador, Monto, type Semaforo } from '@/components/ds'
import { getTarjetas } from '@/lib/db/tarjetas'
import { tarjetasParaCargar } from '@/lib/core/tarjetas'
import { FormGasto } from '@/components/FormGasto'

type EstadoCuota = 'pagada' | 'actual' | 'pendiente'

const ICONO_ESTADO: Record<EstadoCuota, string> = {
  pagada: 'check_circle',
  actual: 'today',
  pendiente: 'schedule',
}

const TONO_ESTADO: Record<EstadoCuota, Semaforo> = {
  pagada: 'ok',
  actual: 'atencion',
  pendiente: 'neutro',
}

/** Cuántas filas del mes a mes se muestran antes de resumir el medio. */
const BORDES_SIN_RESUMIR = 3

/**
 * Detalle de una compra en cuotas: la cuota de este mes, el plan mes a mes, y
 * el mismo `FormGasto` para editarla o borrarla.
 *
 * Es una ruta y no un modal por el mismo motivo que `/movimiento/[id]`: el
 * formulario es largo y el botón "atrás" tiene que hacer lo esperado.
 */
export default async function CompraEnCuotasPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  if (!z.uuid().safeParse(id).success) notFound()

  const compra = await getCompraEnCuotas(id)
  // El RLS ya filtra por usuario: si no aparece, o no existe o no es tuya.
  if (!compra) notFound()

  const [comercios, movs, tarjetas] = await Promise.all([
    getComercios(),
    getMovimientosDesde(sumarMeses(mesActual(), -1)),
    getTarjetas(),
  ])

  const mes = mesActual()
  // `numeroDeCuota` da `null` fuera del rango del plan (no empezó, o ya
  // terminó): `cuotasTranscurridas` sirve igual de piso, clavada en 0 o en
  // el total según corresponda, así el resto de la cuenta no necesita casos
  // especiales.
  const transcurridas = cuotasTranscurridas(compra, mes)
  const numero = numeroDeCuota(compra, mes) ?? transcurridas
  const restantes = compra.cuotas - transcurridas
  const faltaPagar = restantes * compra.importeCuotaCentavos
  const total = totalPlan(compra)
  const ultimoMes = mesFinal(compra)
  const porcentaje = (numero / compra.cuotas) * 100

  // El mes a mes del plan entero. Con 48 cuotas no entran 48 filas en una
  // pantalla de celular ni nadie las lee todas: se muestran las primeras y
  // las últimas, con un resumen en el medio.
  const inicio = mesDe(compra.fecha)
  const filas = Array.from({ length: compra.cuotas }, (_, i) => {
    const mesDeLaCuota: Mes = sumarMeses(inicio, i)
    const diferencia = mesesEntre(mesDeLaCuota, mes)
    const estado: EstadoCuota = diferencia > 0 ? 'pagada' : diferencia === 0 ? 'actual' : 'pendiente'
    return { numero: i + 1, mes: mesDeLaCuota, estado }
  })

  const resumir = filas.length > BORDES_SIN_RESUMIR * 2
  const primeras = resumir ? filas.slice(0, BORDES_SIN_RESUMIR) : filas
  const ultimas = resumir ? filas.slice(-BORDES_SIN_RESUMIR) : []
  const ocultas = filas.length - primeras.length - ultimas.length

  return (
    <div className="gap-space-lg flex flex-col">
      <header>
        <h1 className="text-headline-lg-mobile text-on-surface truncate">{compra.comercio}</h1>
        <p className="text-body-sm text-on-surface-variant">
          Comprado el {fechaLarga(compra.fecha)}
        </p>
      </header>

      <Card>
        <TituloCard>Cuota de este mes</TituloCard>
        <MontoHero>{formatoARS(compra.importeCuotaCentavos)}</MontoHero>
        <Barra porcentaje={porcentaje} etiqueta={`Cuota ${numero} de ${compra.cuotas}`} />
        <p className="text-body-sm text-on-surface-variant tabular-nums">
          Cuota {numero} de {compra.cuotas} · quedan {restantes}{' '}
          {restantes === 1 ? 'cuota' : 'cuotas'} · falta pagar {formatoARS(faltaPagar)}
        </p>
        <p className="text-body-sm text-on-surface-variant tabular-nums">
          Total del plan {formatoARS(total)} · última en {nombreMes(ultimoMes)}
        </p>
      </Card>

      <Card>
        <TituloCard>Mes a mes</TituloCard>
        <div className="flex flex-col">
          {primeras.map((fila, i) => (
            <div key={fila.mes}>
              {i > 0 && <Separador />}
              <ItemLista
                icono={ICONO_ESTADO[fila.estado]}
                tonoIcono={TONO_ESTADO[fila.estado]}
                titulo={`Cuota ${fila.numero}`}
                detalle={nombreMes(fila.mes)}
                derecha={<Monto>{formatoARS(compra.importeCuotaCentavos)}</Monto>}
              />
            </div>
          ))}

          {resumir && (
            <>
              <Separador />
              <p className="text-body-sm text-on-surface-variant py-space-sm text-center">
                {ocultas} {ocultas === 1 ? 'cuota más' : 'cuotas más'}
              </p>
              <Separador />
            </>
          )}

          {ultimas.map((fila, i) => (
            <div key={fila.mes}>
              {i > 0 && <Separador />}
              <ItemLista
                icono={ICONO_ESTADO[fila.estado]}
                tonoIcono={TONO_ESTADO[fila.estado]}
                titulo={`Cuota ${fila.numero}`}
                detalle={nombreMes(fila.mes)}
                derecha={<Monto>{formatoARS(compra.importeCuotaCentavos)}</Monto>}
              />
            </div>
          ))}
        </div>
      </Card>

      <FormGasto
        comercios={comercios}
        frecuentes={comerciosFrecuentes(movs, comercios)}
        hoy={hoyISO()}
        compra={compra}
        tarjetas={tarjetasParaCargar(tarjetas, compra.tarjetaId)}
        // Una compra del mes en curso tiene 1 cuota transcurrida, pero
        // `compraCuotasSchema` exige 2 (una sola cuota es un gasto común, no
        // un plan). Sin el piso en 2, el stepper ofrecía un escalón que la
        // action siempre iba a rechazar.
        minimoCuotas={Math.max(2, transcurridas)}
      />
    </div>
  )
}
