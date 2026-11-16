import { z } from 'zod'

/**
 * Cómo se pagó. Son las cinco formas que ya usabas en el Excel.
 *
 * Ojo: no todas pesan contra el mismo tope. El mapa vive en
 * `lib/core/gastos.ts` (`TOPE_DE_FORMA_PAGO`), que replica cómo agrupaba
 * la hoja "Objetivos": las tres de tarjeta van al tope de tarjeta,
 * efectivo y transferencia al otro.
 */
export const formaPagoSchema = z.enum([
  'tarjeta_credito',
  'tarjeta_debito',
  'debito_automatico',
  'transferencia',
  'efectivo',
])
export type FormaPago = z.infer<typeof formaPagoSchema>

export const FORMAS_PAGO = formaPagoSchema.options

/** Etiqueta para los chips de la UI. Son los textos del Excel. */
export const ETIQUETA_FORMA_PAGO: Record<FormaPago, string> = {
  tarjeta_credito: 'Tarjeta crédito',
  tarjeta_debito: 'Tarjeta débito',
  debito_automatico: 'Débito automático',
  transferencia: 'Transferencia',
  efectivo: 'Efectivo',
}

/** El texto del Excel -> el valor del enum. Lo usa el script de migración. */
export const FORMA_PAGO_DESDE_EXCEL: Record<string, FormaPago> = {
  'Tarjeta crédito': 'tarjeta_credito',
  'Tarjeta débito': 'tarjeta_debito',
  'Débito automático': 'debito_automatico',
  Transferencia: 'transferencia',
  Efectivo: 'efectivo',
}

/**
 * Un movimiento tal como vive en la base: hechos y nada más.
 * `fecha` es "YYYY-MM-DD" sin hora ni zona. El mes se deriva, no se guarda.
 *
 * `banco` y `tarjeta` son descriptivos (de qué cuenta salió, con qué plástico).
 * No entran en ningún cálculo de topes: eso lo define `formaPago`.
 */
export const movimientoSchema = z.object({
  id: z.uuid(),
  fecha: z.iso.date(),
  comercioId: z.uuid(),
  importeCentavos: z.int().positive('El importe tiene que ser mayor a cero'),
  formaPago: formaPagoSchema,
  banco: z.string().trim().max(60).nullable(),
  tarjeta: z.string().trim().max(60).nullable(),
  nota: z.string().trim().max(200).nullable(),
})

export type Movimiento = z.infer<typeof movimientoSchema>

/**
 * El movimiento con los datos del comercio resueltos (la vista `movimientos_detalle`).
 * Es lo que consume `/lib/core/gastos.ts` para agrupar por categoría o comercio.
 */
export const movimientoDetalleSchema = movimientoSchema.extend({
  comercio: z.string(),
  categoria: z.string(),
  subcategoria: z.string().nullable(),
  esFijo: z.boolean(),
  /** Marca manual de compra puntual. Ausente o `null` = lo decide la app. */
  puntual: z.boolean().nullable().optional(),
})

export type MovimientoDetalle = z.infer<typeof movimientoDetalleSchema>

/** Lo que llega del formulario de Cargar. Se valida en la Server Action. */
export const nuevoMovimientoSchema = z.object({
  fecha: z.iso.date(),
  comercioId: z.uuid('Elegí un comercio'),
  importeCentavos: z.int().positive('El importe tiene que ser mayor a cero'),
  formaPago: formaPagoSchema,
  banco: z.string().trim().max(60).nullable().default(null),
  tarjeta: z.string().trim().max(60).nullable().default(null),
  nota: z.string().trim().max(200).nullable().default(null),
  puntual: z.boolean().nullable().default(null),
})

export type NuevoMovimiento = z.input<typeof nuevoMovimientoSchema>

export const editarMovimientoSchema = nuevoMovimientoSchema.partial().extend({
  id: z.uuid(),
})

export type EditarMovimiento = z.infer<typeof editarMovimientoSchema>
