'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  filtrarMovimientos,
  categoriasDe,
  totalDe,
  criteriosDe,
  SIN_FILTROS,
  type Filtros,
} from '@/lib/core/filtros'
import { formatoARS } from '@/lib/core/dinero'
import { fechaCorta, type Mes } from '@/lib/core/fechas'
import { rutaDeMovimiento } from '@/lib/core/cuotas'
import { ETIQUETA_FORMA_PAGO, type MovimientoDetalle } from '@/lib/schemas/movimiento'
import { Card, ItemLista, Separador, Monto } from '@/components/ds'
import { FiltrosMovimientos } from '@/components/FiltrosMovimientos'
import { iconoDe, TituloMovimiento } from '@/components/ListaMovimientos'

/** Cuántos resultados se dibujan. Más que esto no se lee, se scrollea. */
const TOPE_VISIBLE = 50

/**
 * Buscador del Historial.
 *
 * Filtra en el cliente: la pantalla ya trae todos los movimientos para los
 * agregados, así que buscar no cuesta una consulta más ni una vuelta al server.
 * Si algún día son miles de filas, el filtrado se baja a `lib/db/movimientos.ts`
 * sin tocar la lógica, que es pura y vive en `lib/core/filtros.ts`.
 *
 * Los controles son los mismos que los del Home (`FiltrosMovimientos`); acá se
 * suma el selector de mes, porque esta pantalla mira todo el histórico.
 */
export function BuscadorMovimientos({
  movimientos,
  meses,
}: {
  movimientos: MovimientoDetalle[]
  /** Los meses con datos, del más nuevo al más viejo. */
  meses: Mes[]
}) {
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)

  const categorias = useMemo(() => categoriasDe(movimientos), [movimientos])
  const filtrados = useMemo(
    () => filtrarMovimientos(movimientos, criteriosDe(filtros)),
    [movimientos, filtros],
  )

  return (
    <div className="gap-space-sm flex flex-col">
      {/* Destacado porque el Historial lo mete adentro de una `Seccion`, que
          ya pone el fondo `surface-container`: sin esto se funden en uno. */}
      <FiltrosMovimientos
        valor={filtros}
        onCambio={setFiltros}
        categorias={categorias}
        meses={meses}
        destacada
      />

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
              {/* Tocar un resultado lo abre para editar o borrar. `rutaDeMovimiento`
                  y `TituloMovimiento` son los mismos que usa `ListaMovimientos`:
                  una cuota tiene que llevar al mismo lugar y verse igual en las
                  dos pantallas. */}
              <Link
                href={rutaDeMovimiento(m)}
                // `active:` y no solo `hover:`: en el celular no hay hover, y
                // el destello al tocar es lo único que confirma el toque antes
                // de que aparezca el esqueleto de la otra pantalla.
                className="hover:bg-surface-container-high active:bg-surface-container-highest block rounded-lg transition-colors"
              >
                <ItemLista
                  icono={iconoDe(m.categoria)}
                  tonoIcono={m.esFijo ? 'neutro' : 'ok'}
                  titulo={<TituloMovimiento m={m} />}
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
