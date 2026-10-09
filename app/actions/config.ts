'use server'

import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { parsearImporte } from '@/lib/core/dinero'
import { guardarConfig } from '@/lib/db/config'

export type EstadoConfig =
  | { ok: true; mensaje: string }
  | { ok: false; error: string }
  | null

const schema = z.object({
  topeTarjetaCentavos: z.int().nonnegative(),
  topeEfectivoCentavos: z.int().nonnegative(),
  sueldoCentavos: z.int().nonnegative(),
  objetivoGastoMensualCentavos: z.int().nonnegative(),
  cotizacionUsdCentavos: z.int().nonnegative(),
  objetivoAhorroUsd: z.coerce
    .number()
    .int('El ahorro en USD tiene que ser un número entero')
    .nonnegative('El ahorro en USD no puede ser negativo'),
  umbralCercaPct: z.coerce
    .number()
    .int()
    .min(1, 'El umbral va entre 1 y 100')
    .max(100, 'El umbral va entre 1 y 100'),
  umbralDia: z.coerce
    .number()
    .int()
    .min(1, 'El día del umbral va entre 1 y 28')
    .max(28, 'El día del umbral va entre 1 y 28'),
  mesesHistorico: z.coerce
    .number()
    .int()
    .min(1, 'El histórico va entre 1 y 24 meses')
    .max(24, 'El histórico va entre 1 y 24 meses'),
})

/** Los campos que llegan como plata: texto -> centavos. */
const CAMPOS_PLATA = [
  ['topeTarjeta', 'topeTarjetaCentavos'],
  ['topeEfectivo', 'topeEfectivoCentavos'],
  ['sueldo', 'sueldoCentavos'],
  ['objetivoGasto', 'objetivoGastoMensualCentavos'],
  ['cotizacionUsd', 'cotizacionUsdCentavos'],
] as const

export async function guardarParametros(
  _estado: EstadoConfig,
  formData: FormData,
): Promise<EstadoConfig> {
  const plata: Record<string, number> = {}

  for (const [campo, clave] of CAMPOS_PLATA) {
    const crudo = String(formData.get(campo) ?? '').trim()
    const centavos = crudo === '' ? 0 : parsearImporte(crudo)
    if (centavos === null) {
      return { ok: false, error: `El valor de "${campo}" no es un número válido.` }
    }
    if (centavos < 0) {
      return { ok: false, error: 'Los importes no pueden ser negativos.' }
    }
    plata[clave] = centavos
  }

  const parsed = schema.safeParse({
    ...plata,
    objetivoAhorroUsd: formData.get('objetivoAhorroUsd'),
    umbralCercaPct: formData.get('umbralCercaPct'),
    umbralDia: formData.get('umbralDia'),
    mesesHistorico: formData.get('mesesHistorico'),
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  try {
    await guardarConfig(parsed.data)
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'No pude guardarlo.' }
  }

  // Los topes y el umbral alimentan el Home, la predicción y los fijos.
  revalidatePath('/', 'layout')
  return { ok: true, mensaje: 'Configuración guardada.' }
}
