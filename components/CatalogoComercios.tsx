'use client'

import { useMemo, useState } from 'react'
import type { Comercio } from '@/lib/schemas/comercio'
import { actualizarComercio } from '@/app/actions/comercios'
import { iconoDe } from '@/components/ListaMovimientos'
import { Icono } from '@/components/Icono'
import { normalizar } from '@/lib/core/filtros'
import { FilaEditable } from '@/components/FilaEditable'
import { Card, Badge, Separador, campo, etiqueta } from '@/components/ds'
import { cn } from '@/lib/utils'

/**
 * El catálogo: de acá salen la categoría, la subcategoría y si es fijo.
 * Editar un comercio cambia cómo se clasifican TODOS sus movimientos, también
 * los viejos, porque el movimiento no copia nada: hereda.
 */
export function CatalogoComercios({
  comercios,
  categorias,
}: {
  comercios: Comercio[]
  categorias: string[]
}) {
  const listaCategorias = 'categorias-existentes'
  const [busqueda, setBusqueda] = useState('')

  // El filtro mira nombre, categoría y subcategoría, sin acentos: con 50
  // comercios encontrar uno para editar también era scroll.
  const visibles = useMemo(() => {
    const q = normalizar(busqueda)
    if (q === '') return comercios
    return comercios.filter((c) =>
      normalizar(`${c.nombre} ${c.categoria} ${c.subcategoria ?? ''}`).includes(q),
    )
  }, [comercios, busqueda])

  return (
    <div className="gap-space-sm flex flex-col">
      {/* El buscador solo aparece cuando la lista ya es incómoda de recorrer. */}
      {comercios.length > 8 && (
        <div className="relative">
          <span className="text-on-surface-variant pointer-events-none absolute inset-y-0 left-3 grid place-items-center">
            <Icono nombre="search" className="text-[20px]" />
          </span>
          <input
            type="search"
            value={busqueda}
            onChange={(e) => setBusqueda(e.target.value)}
            placeholder="Buscar comercio…"
            aria-label="Buscar en el catálogo"
            autoComplete="off"
            className={`${campo} pl-11`}
          />
        </div>
      )}

      <Card className="p-space-sm gap-0">
      <datalist id={listaCategorias}>
        {categorias.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {visibles.length === 0 && (
        <p className="text-body-sm text-on-surface-variant p-space-sm text-center">
          Ningún comercio coincide con “{busqueda}”.
        </p>
      )}

      <ul>
        {visibles.map((c, i) => (
          <li key={c.id}>
            {i > 0 && <Separador />}
            <FilaEditable
              accion={actualizarComercio}
              resumen={
                <div className="p-space-sm gap-space-sm flex items-center">
                  <span
                    className={cn(
                      'grid size-9 shrink-0 place-items-center rounded-full',
                      c.activo
                        ? 'bg-primary/10 text-primary'
                        : 'bg-surface-container-highest text-on-surface-variant',
                    )}
                  >
                    <Icono nombre={iconoDe(c.categoria)} className="text-[20px]" />
                  </span>

                  <div className="min-w-0 flex-1">
                    <p
                      className={cn(
                        'text-body-md truncate',
                        c.activo ? 'text-on-surface' : 'text-on-surface-variant line-through',
                      )}
                    >
                      {c.nombre}
                    </p>
                    <p className="text-body-sm text-on-surface-variant truncate">
                      {c.categoria}
                      {c.subcategoria ? ` · ${c.subcategoria}` : ''}
                    </p>
                  </div>

                  {c.esFijo && <Badge tono="neutro">Fijo</Badge>}
                </div>
              }
            >
              <input type="hidden" name="id" value={c.id} />

              <div className="gap-space-xs flex flex-col">
                <label htmlFor={`nombre-${c.id}`} className={etiqueta}>
                  Nombre
                </label>
                <input
                  id={`nombre-${c.id}`}
                  name="nombre"
                  defaultValue={c.nombre}
                  required
                  className={campo}
                />
              </div>

              <div className="gap-space-sm grid grid-cols-2">
                <div className="gap-space-xs flex flex-col">
                  <label htmlFor={`cat-${c.id}`} className={etiqueta}>
                    Categoría
                  </label>
                  <input
                    id={`cat-${c.id}`}
                    name="categoria"
                    list={listaCategorias}
                    defaultValue={c.categoria}
                    required
                    className={campo}
                  />
                </div>
                <div className="gap-space-xs flex flex-col">
                  <label htmlFor={`sub-${c.id}`} className={etiqueta}>
                    Subcategoría
                  </label>
                  <input
                    id={`sub-${c.id}`}
                    name="subcategoria"
                    defaultValue={c.subcategoria ?? ''}
                    placeholder="Opcional"
                    className={campo}
                  />
                </div>
              </div>

              <div className="gap-space-md flex flex-wrap">
                <label className="gap-space-sm text-body-md text-on-surface flex items-center">
                  <input
                    type="checkbox"
                    name="esFijo"
                    defaultChecked={c.esFijo}
                    className="accent-primary size-4"
                  />
                  Es un gasto fijo
                </label>

                <label className="gap-space-sm text-body-md text-on-surface flex items-center">
                  <input
                    type="checkbox"
                    name="activo"
                    defaultChecked={c.activo}
                    className="accent-primary size-4"
                  />
                  Activo
                </label>
              </div>
            </FilaEditable>
          </li>
        ))}
      </ul>
      </Card>
    </div>
  )
}
