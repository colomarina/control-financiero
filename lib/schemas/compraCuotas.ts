import { z } from 'zod'
import { formaPagoSchema } from './movimiento'

/**
 * Una compra en cuotas tal como vive en la base: hechos y nada más.
 *
 * Lo que se guarda es **el importe de la cuota y cuántas son**
 * (`importeCuotaCentavos`, `cuotas`), nunca el total: es lo que el usuario sabe
 * con certeza ("12 cuotas de $48.500"), y con interés el total ÷ 12 no coincide
 * con la cuota que te cobran. El total, cuando hace falta mostrarlo, se deriva.
 */
export const compraCuotasSchema = z.object({
  id: z.uuid(),
  fecha: z.iso.date(),
  comercioId: z.uuid('Elegí un comercio'),
  importeCuotaCentavos: z.int().positive('El importe de la cuota tiene que ser mayor a cero'),
  cuotas: z.int().min(2, 'Una compra en cuotas tiene al menos 2').max(48, 'Máximo 48 cuotas'),
  formaPago: formaPagoSchema,
  banco: z.string().trim().max(60).nullable(),
  tarjeta: z.string().trim().max(60).nullable(),
  nota: z.string().trim().max(200).nullable(),
})

export type CompraCuotas = z.infer<typeof compraCuotasSchema>

/**
 * La compra con los datos del comercio resueltos (la vista equivalente a
 * `movimientos_detalle`, pero para compras en cuotas).
 */
export const compraCuotasDetalleSchema = compraCuotasSchema.extend({
  comercio: z.string(),
  categoria: z.string(),
  subcategoria: z.string().nullable(),
  esFijo: z.boolean(),
})

export type CompraCuotasDetalle = z.infer<typeof compraCuotasDetalleSchema>

/** Lo que llega del formulario de alta. Se valida en la Server Action. */
export const nuevaCompraCuotasSchema = compraCuotasSchema.omit({ id: true }).extend({
  banco: z.string().trim().max(60).nullable().default(null),
  tarjeta: z.string().trim().max(60).nullable().default(null),
  nota: z.string().trim().max(200).nullable().default(null),
})

export type NuevaCompraCuotas = z.input<typeof nuevaCompraCuotasSchema>
