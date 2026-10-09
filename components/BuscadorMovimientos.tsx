'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { filtrarMovimientos, categoriasDe, totalDe } from '@/lib/core/filtros'
import { formatoARS } from '@/lib/core/dinero'
import { fechaCorta, nombreMes, diasDelMes, type Mes } from '@/lib/core/fechas'
import {
  FORMAS_PAGO,
  ETIQUETA_FORMA_PAGO,
  type FormaPago,
  type MovimientoDetalle,
} from '@/lib/schemas/movimiento'
import { Card, ItemLista, Separador, Monto, campo, botonSecundario } from '@/components/ds'
import { iconoDe } from '@/components/ListaMovimientos'
import { Icono } from '@/components/Icono'

/** Cuántos resultados se dibujan. Más que esto no se lee, se scrollea. */
const TOPE_VISIBLE = 50

/**
 * Buscador del Historial.
 *
 * Filtra en el cliente: la pantalla ya trae todos los movimientos para los
 * agregados, así que buscar no cuesta una consulta más ni una vuelta al server.
 * Si algún día son miles de filas, el filtrado se baja a `lib/db/movimientos.ts`
 * sin tocar la lógica, que es pura y vive en `lib/core/filtros.ts`.
 */
export function BuscadorMovimientos({
  movimientos,
  meses,
}: {
  movimientos: MovimientoDetalle[]
  /** Los meses con datos, del más nuevo al más viejo. */
  meses: Mes[]
}) {
  const [texto, setTexto] = useState('')
  const [categoria, setCategoria] = useState('')
  const [formaPago, setFormaPago] = useState('')
  const [mes, setMes] = useState('')

  const categorias = useMemo(() => categoriasDe(movimientos), [movimientos])

  const filtrados = useMemo(
    () =>
      filtrarMovimientos(movimientos, {
        texto,
        categoria: categoria || null,
        formaPago: (formaPago as FormaPago) || null,
        // Un mes es el rango de su primer día a su último.
        desde: mes ? `${mes}-01` : null,
        hasta: mes ? `${mes}-${String(diasDelMes(mes)).padStart(2, '0')}` : null,
      }),
    [movimientos, texto, categoria, formaPago, mes],
  )

  const hayFiltros = texto !== '' || categoria !== '' || formaPago !== '' || mes !== ''

  function limpiar() {
    setTexto('')
    setCategoria('')
    setFormaPago('')
    setMes('')
  }

  return (
    <div className="gap-space-sm flex flex-col">
      <Card className="gap-space-sm">
        <div className="relative">
          <span className="text-on-surface-variant pointer-events-none absolute inset-y-0 left-3 grid place-items-center">
            <Icono nombre="search" className="text-[20px]" />
          </span>
          <input
            type="search"
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Comercio, nota, categoría…"
            aria-label="Buscar movimientos"
            autoComplete="off"
            className={`${campo} pl-11`}
          />
        </div>

        <div className="gap-space-sm grid grid-cols-2">
          <select
            value={categoria}
            onChange={(e) => setCategoria(e.target.value)}
            aria-label="Filtrar por categoría"
            className={campo}
          >
            <option value="">Toda categoría</option>
            {categorias.map((c) => (
              <option key={c} value={c}>
                {c}
              </option>
            ))}
          </select>

          <select
            value={formaPago}
            onChange={(e) => setFormaPago(e.target.value)}
            aria-label="Filtrar por forma de pago"
            className={campo}
          >
            <option value="">Toda forma de pago</option>
            {FORMAS_PAGO.map((f) => (
              <option key={f} value={f}>
                {ETIQUETA_FORMA_PAGO[f]}
              </option>
            ))}
          </select>

          <select
            value={mes}
            onChange={(e) => setMes(e.target.value)}
            aria-label="Filtrar por mes"
            className={campo}
          >
            <option value="">Todos los meses</option>
            {meses.map((m) => (
              <option key={m} value={m}>
                {nombreMes(m)}
              </option>
            ))}
          </select>

          {hayFiltros && (
            <button type="button" onClick={limpiar} className={botonSecundario}>
              Limpiar
            </button>
          )}
        </div>
      </Card>

      {/* El total de lo filtrado es la mitad de la gracia: contesta "cuánto
          llevo gastado en esto". */}
      <div className="px-space-xs gap-space-sm flex items-baseline justify-between">
        <span className="text-body-sm text-on-surface-variant">
          {filtrados.length === 0
            ? 'Sin resultados'
            : `${filtrados.length} ${filtrados.length === 1 ? 'movimiento' : 'movimientos'}`}
        </span>
        {filtrados.length > 0 && <Monto>{formatoARS(totalDe(filtrados))}</Monto>}
      </div>

      {filtrados.length === 0 ? (
        <Card>
          <p className="text-body-md text-on-surface-variant text-center">
            No hay movimientos que cumplan con eso.
          </p>
        </Card>
      ) : (
        <Card className="p-space-sm gap-0">
          {filtrados.slice(0, TOPE_VISIBLE).map((m, i) => (
            <div key={m.id}>
              {i > 0 && <Separador />}
              {/* Tocar un resultado lo abre para editar o borrar. */}
              <Link
                href={`/movimiento/${m.id}`}
                className="hover:bg-surface-container-high block rounded-lg transition-colors"
              >
                <ItemLista
                  icono={iconoDe(m.categoria)}
                  tonoIcono={m.esFijo ? 'neutro' : 'ok'}
                  titulo={m.comercio}
                  detalle={`${fechaCorta(m.fecha)} · ${m.categoria} · ${ETIQUETA_FORMA_PAGO[m.formaPago]}`}
                  derecha={<Monto>{formatoARS(m.importeCentavos)}</Monto>}
                />
              </Link>
            </div>
          ))}
        </Card>
      )}

      {filtrados.length > TOPE_VISIBLE && (
        <p className="text-body-sm text-on-surface-variant px-space-xs">
          Se muestran {TOPE_VISIBLE} de {filtrados.length}. Afiná la búsqueda para ver el
          resto; el total de arriba cuenta todos.
        </p>
      )}
    </div>
  )
}
