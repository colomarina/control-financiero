import { getConfig } from '@/lib/db/config'
import { getMovimientosDesde } from '@/lib/db/movimientos'
import { getGastosFijos } from '@/lib/db/gastosFijos'
import { getComprasEnCuotas } from '@/lib/db/cuotas'
import { getTarjetas } from '@/lib/db/tarjetas'
import { getPlanDelMes } from '@/lib/db/presupuesto'
import { getComercios } from '@/lib/db/comercios'
import { diaActual, hoyISO, mesActual, sumarMeses } from '@/lib/core/fechas'
import { cuotasDelMes } from '@/lib/core/cuotas'
import { parsearImporte } from '@/lib/core/dinero'
import {
  FORMAS_SIN_TARJETA,
  parsearMedio,
  simularGasto,
  valorDeMedio,
  type Veredicto,
} from '@/lib/core/simulador'
import { ETIQUETA_FORMA_PAGO } from '@/lib/schemas/movimiento'
import { FormSimulador } from '@/components/FormSimulador'
import { Card, ConMontos, type Semaforo } from '@/components/ds'
import { Icono } from '@/components/Icono'
import { cn } from '@/lib/utils'

const TONO: Record<Veredicto, Semaforo> = { si: 'ok', justo: 'atencion', no: 'mal' }
const ICONO: Record<Veredicto, string> = { si: 'check_circle', justo: 'warning', no: 'block' }
const TEXTO: Record<Semaforo, string> = {
  ok: 'text-primary',
  atencion: 'text-tertiary',
  mal: 'text-error',
  neutro: 'text-on-surface-variant',
}

/**
 * Simulador: "¿puedo gastar esto?". Lee el gasto de la URL, corre
 * `simularGasto` con los datos del mes y muestra el veredicto. Lectura pura:
 * Server Component → /lib/db → /lib/core → UI, sin guardar nada.
 */
export default async function SimularPage({ searchParams }: PageProps<'/simular'>) {
  const params = await searchParams
  const leer = (k: string) => (typeof params[k] === 'string' ? (params[k] as string) : '')

  const mes = mesActual()
  const config = await getConfig()
  const [movs, fijos, compras, tarjetas, plan, comercios] = await Promise.all([
    getMovimientosDesde(sumarMeses(mes, -config.mesesHistorico)),
    getGastosFijos(),
    getComprasEnCuotas(),
    getTarjetas(),
    getPlanDelMes(mes),
    getComercios(),
  ])

  const activas = tarjetas.filter((t) => t.activa)
  const medios = [
    ...activas.map((t) => ({ valor: valorDeMedio({ tipo: 'tarjeta', tarjetaId: t.id }), etiqueta: t.nombre })),
    ...FORMAS_SIN_TARJETA.map((f) => ({ valor: f, etiqueta: ETIQUETA_FORMA_PAGO[f] })),
  ]

  const montoTexto = leer('monto')
  const medioTexto = leer('medio') || medios[0]?.valor || 'efectivo'
  const comercioId = leer('comercio')
  const monto = montoTexto ? parsearImporte(montoTexto) : null
  const medio = parsearMedio(medioTexto, tarjetas)

  const resultado =
    monto !== null && monto > 0 && medio
      ? simularGasto({
          monto,
          medio,
          comercioId: comercios.some((c) => c.id === comercioId) ? comercioId : null,
          // Como el cierre del Home: movimientos reales, cuotas del mes aparte.
          movsReales: movs,
          cuotasMes: cuotasDelMes(compras, mes),
          fijos,
          tarjetas,
          plan,
          mes,
          hoy: hoyISO(),
          diaActual: diaActual(),
          config,
        })
      : null

  return (
    <div className="gap-space-lg flex flex-col">
      <header className="gap-space-xs flex flex-col">
        <h1 className="text-headline-lg-mobile text-on-surface">Simulador</h1>
        <p className="text-body-sm text-on-surface-variant">
          ¿Puedo gastar esto? Calcula con tus números del mes. No guarda nada.
        </p>
      </header>

      <FormSimulador
        monto={montoTexto}
        medio={medioTexto}
        comercio={comercioId}
        medios={medios}
        comercios={comercios.map((c) => ({ valor: c.id, etiqueta: c.nombre }))}
      />

      {montoTexto && monto === null && (
        <p className="text-body-md text-error">El monto no es un número válido.</p>
      )}

      {resultado && (
        <Card>
          <div className={cn('gap-space-sm flex items-center', TEXTO[TONO[resultado.veredicto]])}>
            <Icono nombre={ICONO[resultado.veredicto]} relleno className="text-[28px]" />
            <p className="text-headline-md">{resultado.titulo}</p>
          </div>
          <ul className="gap-space-sm flex flex-col">
            {resultado.motivos.map((m) => (
              <li key={m.tema} className="gap-space-sm flex items-start">
                <span className={cn('mt-1.5 size-2 shrink-0 rounded-full bg-current', TEXTO[m.tono])} />
                <p className="text-body-md text-on-surface">
                  <span className="text-on-surface-variant">{m.tema}: </span>
                  <ConMontos>{m.texto}</ConMontos>
                </p>
              </li>
            ))}
          </ul>
        </Card>
      )}
    </div>
  )
}
