import { z } from 'zod'

/** Las redes con logo (`assets/redes/*.svg`). */
export const REDES = ['visa', 'mastercard', 'amex'] as const
export const redSchema = z.enum(REDES)
export type Red = z.infer<typeof redSchema>

export const ETIQUETA_RED: Record<Red, string> = {
  visa: 'Visa',
  mastercard: 'Mastercard',
  amex: 'American Express',
}

/**
 * Un plástico con el que se paga (tabla `tarjetas`).
 *
 * `sumaMeta`: su consumo cuenta para la meta mínima del banco (config.meta_*).
 * `activa = false`: se dio de baja; sigue nombrando movimientos viejos pero no
 * se ofrece al cargar.
 */
export const tarjetaSchema = z.object({
  id: z.uuid(),
  nombre: z.string().trim().min(1, 'Ponele un nombre').max(60),
  banco: z.string().trim().min(1, 'Falta el banco').max(60),
  red: redSchema.nullable(),
  sumaMeta: z.boolean(),
  activa: z.boolean(),
})

export type Tarjeta = z.infer<typeof tarjetaSchema>

export const guardarTarjetaSchema = tarjetaSchema.omit({ id: true }).extend({
  id: z.uuid().optional(),
})
