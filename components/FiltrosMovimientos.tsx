'use client'

import { nombreMes, type Mes } from '@/lib/core/fechas'
import { FILTRO_TOPE, hayFiltro, SIN_FILTROS, type Filtros } from '@/lib/core/filtros'
import { FORMAS_PAGO, ETIQUETA_FORMA_PAGO } from '@/lib/schemas/movimiento'
import { Card, campo, botonSecundario } from '@/components/ds'
import { CampoSelect } from '@/components/CampoSelect'
import { Icono } from '@/components/Icono'

/**
 * El bloque de filtros de movimientos: texto libre arriba, y abajo una fila
 * por criterio.
 *
 * Es uno solo para las dos pantallas que filtran. El Home mira un mes y el
 * Historial mira todo, así que la única diferencia es si se ofrece el selector
 * de mes: si no le pasás `meses`, no se dibuja.
 *
 * Apilados y no en dos columnas: con el pulgar, una fila ancha se toca sin
 * apuntar, y en dos columnas "Toda forma de pago" entraba cortado. Cada fila
 * lleva su ícono y su nombre a la izquierda, y el valor a la derecha.
 */
/**
 * Primero los topes enteros y después cada forma suelta. "Todo tarjeta" es lo
 * que se busca casi siempre: crédito, débito y débito automático pesan contra
 * el mismo tope, y elegirlos de a uno no deja ver el total.
 */
const OPCIONES_FORMA_PAGO = [
  { valor: FILTRO_TOPE.tarjeta, etiqueta: 'Todo tarjeta' },
  { valor: FILTRO_TOPE.efectivo, etiqueta: 'Todo efectivo y transferencia' },
  ...FORMAS_PAGO.map((f) => ({ valor: f, etiqueta: ETIQUETA_FORMA_PAGO[f] })),
]

export function FiltrosMovimientos({
  valor,
  onCambio,
  categorias,
  meses,
  destacada = false,
}: {
  valor: Filtros
  onCambio: (filtros: Filtros) => void
  /** Las categorías presentes en lo que se está filtrando. */
  categorias: string[]
  /** Los meses con datos, del más nuevo al más viejo. Sin esto no hay filtro de mes. */
  meses?: Mes[]
  /** Un fondo más claro, para cuando el bloque vive adentro de una `Seccion`. */
  destacada?: boolean
}) {
  const poner = (parcial: Partial<Filtros>) => onCambio({ ...valor, ...parcial })

  return (
    <Card destacada={destacada} className="gap-space-sm">
      <div className="relative">
        <span className="text-on-surface-variant pointer-events-none absolute inset-y-0 left-3 grid place-items-center">
          <Icono nombre="search" className="text-[20px]" />
        </span>
        <input
          type="search"
          value={valor.texto}
          onChange={(e) => poner({ texto: e.target.value })}
          placeholder="Comercio, nota, categoría…"
          aria-label="Buscar movimientos"
          autoComplete="off"
          className={`${campo} pl-11`}
        />
      </div>

      <div className="gap-space-xs flex flex-col">
        <CampoSelect
          variante="filtro"
          icono="sell"
          titulo="Categoría"
          vacio="Todas"
          valor={valor.categoria}
          onCambio={(categoria) => poner({ categoria })}
          opciones={categorias.map((c) => ({ valor: c, etiqueta: c }))}
        />

        <CampoSelect
          variante="filtro"
          icono="credit_card"
          titulo="Forma de pago"
          vacio="Todas"
          valor={valor.formaPago}
          onCambio={(formaPago) => poner({ formaPago })}
          opciones={OPCIONES_FORMA_PAGO}
        />

        {meses && (
          <CampoSelect
            variante="filtro"
            icono="calendar_month"
            titulo="Mes"
            vacio="Todos"
            valor={valor.mes}
            onCambio={(mes) => poner({ mes })}
            opciones={meses.map((m) => ({ valor: m, etiqueta: nombreMes(m) }))}
          />
        )}
      </div>

      {hayFiltro(valor) && (
        <button
          type="button"
          onClick={() => onCambio(SIN_FILTROS)}
          className={`${botonSecundario} gap-space-xs flex items-center justify-center`}
        >
          <Icono nombre="filter_alt_off" className="text-[18px]" />
          Limpiar filtros
        </button>
      )}
    </Card>
  )
}
