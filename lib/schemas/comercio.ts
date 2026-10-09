import { z } from 'zod'

/**
 * El comercio es el catálogo. De acá salen categoría, subcategoría y es_fijo:
 * el movimiento NO los copia, los hereda.
 */
export const comercioSchema = z.object({
  id: z.uuid(),
  nombre: z.string().trim().min(1, 'Poné un nombre').max(80),
  categoria: z.string().trim().min(1, 'Elegí una categoría').max(60),
  subcategoria: z.string().trim().max(60).nullable(),
  esFijo: z.boolean(),
  activo: z.boolean(),
})

export type Comercio = z.infer<typeof comercioSchema>

/** Lo que llega del formulario al crear un comercio. */
export const nuevoComercioSchema = comercioSchema.omit({
  id: true,
  activo: true,
}).extend({
  subcategoria: z.string().trim().max(60).nullable().default(null),
  esFijo: z.boolean().default(false),
})

export type NuevoComercio = z.input<typeof nuevoComercioSchema>

/** Lo que llega del formulario al editar: todo opcional menos el id. */
export const editarComercioSchema = comercioSchema.partial().extend({
  id: z.uuid(),
})

export type EditarComercio = z.infer<typeof editarComercioSchema>
