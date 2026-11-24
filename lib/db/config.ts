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
  mesesHistorico: number
  /** Meta mínima de consumo con las tarjetas `sumaMeta`. 0 = sin meta. */
  metaMinimoCentavos: number
  /** Lo que se suma al mínimo para darlo por cumplido con seguridad. */
  metaColchonCentavos: number
  /** Día más temprano en que suele cerrar el resumen. */
  metaDiaCierre: number
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
  mesesHistorico: 3,
  metaMinimoCentavos: 0,
  metaColchonCentavos: 0,
  metaDiaCierre: 24,
}

const COLUMNAS =
  'tope_tarjeta_centavos, tope_efectivo_centavos, sueldo_centavos, ' +
  'objetivo_gasto_mensual_centavos, objetivo_ahorro_usd, cotizacion_usd_centavos, ' +
  'umbral_cerca_pct, meses_historico, meta_minimo_centavos, meta_colchon_centavos, meta_dia_cierre'

type FilaConfig = {
  tope_tarjeta_centavos: number
  tope_efectivo_centavos: number
  sueldo_centavos: number
  objetivo_gasto_mensual_centavos: number
  objetivo_ahorro_usd: number
  cotizacion_usd_centavos: number
  umbral_cerca_pct: number
  meses_historico: number
  meta_minimo_centavos: number
  meta_colchon_centavos: number
  meta_dia_cierre: number
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
    mesesHistorico: Number(f.meses_historico),
    metaMinimoCentavos: Number(f.meta_minimo_centavos),
    metaColchonCentavos: Number(f.meta_colchon_centavos),
    metaDiaCierre: Number(f.meta_dia_cierre),
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
      ...(c.mesesHistorico !== undefined && { meses_historico: c.mesesHistorico }),
      ...(c.metaMinimoCentavos !== undefined && { meta_minimo_centavos: c.metaMinimoCentavos }),
      ...(c.metaColchonCentavos !== undefined && { meta_colchon_centavos: c.metaColchonCentavos }),
      ...(c.metaDiaCierre !== undefined && { meta_dia_cierre: c.metaDiaCierre }),
      updated_at: new Date().toISOString(),
    },
    { onConflict: 'user_id' },
  )

  if (error) fallaDb('guardar la configuración', error)
}
