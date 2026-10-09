import { z } from 'zod'

/**
 * Una línea del plan: cuánto pensás gastar en un comercio en un mes dado.
 * Es la hoja "Historial Presupuestos" del Excel (una fila por concepto y mes).
 */
export const lineaPresupuestoSchema = z.object({
  id: z.uuid(),
  mes: z.string().regex(/^\d{4}-\d{2}$/, 'El mes va como AAAA-MM'),
  comercioId: z.uuid(),
  planeadoCentavos: z.int().nonnegative('El plan no puede ser negativo'),
})

export type LineaPresupuesto = z.infer<typeof lineaPresupuestoSchema>

/** La línea con el nombre del comercio resuelto. */
export const lineaPresupuestoDetalleSchema = lineaPresupuestoSchema.extend({
  comercio: z.string(),
})

export type LineaPresupuestoDetalle = z.infer<typeof lineaPresupuestoDetalleSchema>

export const guardarLineaSchema = lineaPresupuestoSchema.omit({ id: true })
export type GuardarLinea = z.infer<typeof guardarLineaSchema>
