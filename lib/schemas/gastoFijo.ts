import { z } from 'zod'

/**
 * Un gasto fijo del mes: qué comercio, cuánto se espera pagar y cuándo cae.
 *
 * No hay campo "pagado": eso se DERIVA de si ese comercio aparece en los
 * movimientos del mes (es lo que hacía la hoja "Gastos Fijos" del Excel).
 * Ver `lib/core/fijos.ts`.
 *
 * `vencimiento` es texto libre porque en el Excel hay cosas como "Día 1 y 28".
 */
export const gastoFijoSchema = z.object({
  id: z.uuid(),
  comercioId: z.uuid(),
  estimadoCentavos: z.int().nonnegative(),
  vencimiento: z.string().trim().max(40).nullable(),
  activo: z.boolean(),
})

export type GastoFijo = z.infer<typeof gastoFijoSchema>

/** El gasto fijo con el nombre del comercio resuelto. */
export const gastoFijoDetalleSchema = gastoFijoSchema.extend({
  comercio: z.string(),
})

export type GastoFijoDetalle = z.infer<typeof gastoFijoDetalleSchema>

export const nuevoGastoFijoSchema = gastoFijoSchema.omit({ id: true, activo: true })
export type NuevoGastoFijo = z.infer<typeof nuevoGastoFijoSchema>

export const editarGastoFijoSchema = gastoFijoSchema.partial().extend({ id: z.uuid() })
export type EditarGastoFijo = z.infer<typeof editarGastoFijoSchema>
