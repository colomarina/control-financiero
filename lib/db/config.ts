import 'server-only'
import { crearCliente, usuarioRequerido } from './client'
import { fallaDb } from '@/lib/db/errores'

/**
 * Repositorio de configuración. Una sola fila por usuario.
 */

export interface Config {
  topeTarjetaCentavos: number
  topeEfectivoCentavos: number
  sueldoCentavos: number
  objetivoGastoMensualCentavos: number
  objetivoAhorroUsd: number
  cotizacionUsdCentavos: number
  umbralCercaPct: number
  umbralDia: number
  mesesHistorico: number
}

/** Los defaults del schema, por si todavía no hay fila. */
export const CONFIG_POR_DEFECTO: Config = {
  topeTarjetaCentavos: 0,
  topeEfectivoCentavos: 0,
  sueldoCentavos: 0,
  objetivoGastoMensualCentavos: 0,
  objetivoAhorroUsd: 0,
  cotizacionUsdCentavos: 0,
  umbralCercaPct: 85,
  umbralDia: 10,
  mesesHistorico: 3,
}

const COLUMNAS =
  'tope_tarjeta_centavos, tope_efectivo_centavos, sueldo_centavos, ' +
  'objetivo_gasto_mensual_centavos, objetivo_ahorro_usd, cotizacion_usd_centavos, ' +
  'umbral_cerca_pct, umbral_dia, meses_historico'

type FilaConfig = {
  tope_tarjeta_centavos: number
  tope_efectivo_centavos: number
  sueldo_centavos: number
  objetivo_gasto_mensual_centavos: number
  objetivo_ahorro_usd: number
  cotizacion_usd_centavos: number
  umbral_cerca_pct: number
  umbral_dia: number
  meses_historico: number
}

/** La config del usuario. Si todavía no cargó ninguna, devuelve los defaults. */
export async function getConfig(): Promise<Config> {
  const supabase = await crearCliente()
  const { data, error } = await supabase.from('config').select(COLUMNAS).maybeSingle()

  if (error) fallaDb('leer la configuración', error)
  if (!data) return CONFIG_POR_DEFECTO

  const f = data as unknown as FilaConfig
  return {
    topeTarjetaCentavos: Number(f.tope_tarjeta_centavos),
    topeEfectivoCentavos: Number(f.tope_efectivo_centavos),
    sueldoCentavos: Number(f.sueldo_centavos),
    objetivoGastoMensualCentavos: Number(f.objetivo_gasto_mensual_centavos),
    objetivoAhorroUsd: Number(f.objetivo_ahorro_usd),
    cotizacionUsdCentavos: Number(f.cotizacion_usd_centavos),
    umbralCercaPct: Number(f.umbral_cerca_pct),
    umbralDia: Number(f.umbral_dia),
    mesesHistorico: Number(f.meses_historico),
  }
}

export async function guardarConfig(c: Partial<Config>): Promise<void> {
  const supabase = await crearCliente()
  const userId = await usuarioRequerido()

  const { error } = await supabase.from('config').upsert(
    {
      user_id: userId,
      ...(c.topeTarjetaCentavos !== undefined && { tope_tarjeta_centavos: c.topeTarjetaCentavos }),
      ...(c.topeEfectivoCentavos !== undefined && { tope_efectivo_centavos: c.topeEfectivoCentavos }),
      ...(c.sueldoCentavos !== undefined && { sueldo_centavos: c.sueldoCentavos }),
      ...(c.objetivoGastoMensualCentavos !== undefined && {
        objetivo_gasto_mensual_centavos: c.objetivoGastoMensualCentavos,
      }),
      ...(c.objetivoAhorroUsd !== undefined && { objetivo_ahorro_usd: c.objetivoAhorroUsd }),
      ...(c.cotizacionUsdCentavos !== undefined && { cotizacion_usd_centavos: c.cotizacionUsdCentavos }),
      ...(c.umbralCercaPct !== undefined && { umbral_cerca_pct: c.umbralCercaPct }),
      ...(c.umbralDia !== undefined && { umbral_dia: c.umbralDia }),
      ...(c.mesesHistorico !== undefined && { meses_historico: c.mesesHistorico }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) fallaDb('guardar la configuración', error)
}
