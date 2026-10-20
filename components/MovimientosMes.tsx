'use client'

import { useMemo, useState } from 'react'
import Link from 'next/link'
import {
  filtrarMovimientos,
  categoriasDe,
  totalDe,
  criteriosDe,
  hayFiltro,
  SIN_FILTROS,
  type Filtros,
} from '@/lib/core/filtros'
import { formatoARS } from '@/lib/core/dinero'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import { ListaMovimientos } from '@/components/ListaMovimientos'
import { FiltrosMovimientos } from '@/components/FiltrosMovimientos'
import { Card, Monto } from '@/components/ds'
import { Icono } from '@/components/Icono'
import { cn } from '@/lib/utils'

/**
 * Los movimientos del mes en el Home, con su buscador.
 *
 * Los filtros arrancan plegados: el Home es una pantalla de vistazo y la lista
 * tiene que quedar arriba. Los abre el botón de la lupa.
 *
 * Plegarlos con un filtro puesto es válido y no lo esconde: el contador pasa a
 * "12 de 48", aparece el total de lo filtrado y la lupa queda en verde. Un mes
 * al que le faltan movimientos sin explicación sería el bug.
 *
 * Filtra en el cliente, igual que el Historial: la lista del mes ya está en la
 * pantalla, así que buscar no cuesta ni una consulta ni una vuelta al server.
 */
export function MovimientosMes({ movimientos }: { movimientos: MovimientoDetalle[] }) {
  const [filtros, setFiltros] = useState<Filtros>(SIN_FILTROS)
  const [abierto, setAbierto] = useState(false)

  const categorias = useMemo(() => categoriasDe(movimientos), [movimientos])
  const filtrados = useMemo(
    () => filtrarMovimientos(movimientos, criteriosDe(filtros)),
    [movimientos, filtros],
  )

  const filtrando = hayFiltro(filtros)

  return (
    <section className="gap-space-sm flex flex-col">
      <div className="px-space-xs gap-space-sm flex items-center justify-between">
        <h2 className="text-headline-md text-on-surface">Movimientos</h2>

        <div className="gap-space-sm flex items-center">
          <span className="text-body-sm text-on-surface-variant tabular-nums">
            {filtrando ? `${filtrados.length} de ${movimientos.length}` : movimientos.length}
          </span>
          <button
            type="button"
            onClick={() => setAbierto(!abierto)}
            aria-expanded={abierto}
            aria-label={abierto ? 'Cerrar el buscador' : 'Buscar y filtrar'}
            className={cn(
              'grid size-9 shrink-0 place-items-center rounded-full transition-colors',
              abierto || filtrando
                ? 'bg-primary/10 text-primary'
                : 'text-on-surface-variant hover:bg-surface-container-high hover:text-on-surface',
            )}
          >
            <Icono nombre={abierto ? 'search_off' : 'search'} className="text-[20px]" />
          </button>
        </div>
      </div>

      {abierto && (
        <FiltrosMovimientos valor={filtros} onCambio={setFiltros} categorias={categorias} />
      )}

      {/* Con un filtro puesto, el total de lo que quedó es la mitad de la
          gracia: contesta "cuánto llevo gastado en esto". */}
      {filtrando && filtrados.length > 0 && (
        <div className="px-space-xs flex items-baseline justify-between">
          <span className="text-body-sm text-on-surface-variant">Total filtrado</span>
          <Monto>{formatoARS(totalDe(filtrados))}</Monto>
        </div>
      )}

      {movimientos.length === 0 ? (
        <Card>
          <p className="text-body-md text-on-surface-variant text-center">
            Todavía no cargaste nada este mes.{' '}
            <Link href="/cargar" className="text-primary underline underline-offset-4">
              Cargar un gasto
            </Link>
          </p>
        </Card>
      ) : filtrados.length === 0 ? (
        <Card>
          <p className="text-body-md text-on-surface-variant text-center">
            No hay movimientos que cumplan con eso.
          </p>
        </Card>
      ) : (
        <ListaMovimientos movimientos={filtrados} />
      )}
    </section>
  )
}
