'use client'

import {
  BarChart,
  Bar,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from 'recharts'
import type { PuntoEvolucion } from '@/lib/core/historial'
import { formatoARS } from '@/lib/core/dinero'
import { nombreMes } from '@/lib/core/fechas'

/**
 * Evolución del gasto mes a mes. UNA sola serie: el total del mes.
 *
 * Por qué una y no el apilado tarjeta/efectivo: la paleta del design system
 * reserva verde, ámbar y rojo para el semáforo, y no tiene dos tonos más que
 * sean distinguibles entre sí (los azulados quedan casi grises). Usar el
 * semáforo como colores de serie haría leer "tarjeta = bien, efectivo = ojo",
 * que es falso. El desglose por tope está en la tabla de abajo.
 *
 * El mes en curso va con otro tono porque está incompleto: compararlo de igual
 * a igual contra un mes cerrado es engañoso.
 */

/** "2026-09" -> "sep" — en el eje no entra el mes completo. */
function etiquetaCorta(mes: string): string {
  return nombreMes(mes).slice(0, 3).toLowerCase()
}

/** Pesos redondos para el eje: 1.200.000 -> "1,2M", 800.000 -> "800k". */
function tickPlata(centavos: number): string {
  const pesos = centavos / 100
  if (pesos >= 1_000_000)
    return `${(pesos / 1_000_000).toLocaleString('es-AR', { maximumFractionDigits: 1 })}M`
  if (pesos >= 1_000) return `${Math.round(pesos / 1_000)}k`
  return String(Math.round(pesos))
}

function Tooltipcito({
  active,
  payload,
  label,
}: {
  active?: boolean
  payload?: Array<{ payload?: PuntoEvolucion }>
  label?: string
}) {
  const punto = payload?.[0]?.payload
  if (!active || !punto) return null

  return (
    <div className="bg-surface-container-high border-outline-variant rounded-lg border px-space-sm py-space-sm shadow-md">
      <p className="text-label-caps text-on-surface-variant uppercase">
        {label ? nombreMes(label) : ''}
        {punto.enCurso && ' · en curso'}
      </p>
      <p className="text-label-numeric text-on-surface mt-1 tabular-nums">
        {formatoARS(punto.total)}
      </p>
      <ul className="text-body-sm text-on-surface-variant mt-1 space-y-0.5 tabular-nums">
        <li>Tarjeta {formatoARS(punto.tarjeta)}</li>
        <li>Efectivo y transf. {formatoARS(punto.efectivo)}</li>
      </ul>
    </div>
  )
}

export function GraficoEvolucion({ datos }: { datos: PuntoEvolucion[] }) {
  // Con menos de dos meses no hay evolución que mostrar: una sola barra no
  // dice nada que la tabla no diga mejor.
  if (datos.length < 2) return null

  return (
    <figure className="gap-space-sm flex flex-col">
      <div className="h-56 w-full">
        <ResponsiveContainer width="100%" height="100%">
          <BarChart data={datos} margin={{ top: 4, right: 4, bottom: 0, left: -8 }}>
            <CartesianGrid
              vertical={false}
              /* Recharts la puntea por defecto; sólida y hairline, recesiva. */
              strokeDasharray="0"
              strokeWidth={1}
              stroke="var(--color-surface-container-highest)"
            />
            <XAxis
              dataKey="mes"
              tickFormatter={etiquetaCorta}
              tickLine={false}
              axisLine={false}
              tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
            />
            <YAxis
              tickFormatter={tickPlata}
              tickLine={false}
              axisLine={false}
              width={44}
              tick={{ fill: 'var(--color-on-surface-variant)', fontSize: 11 }}
            />
            <Tooltip
              content={<Tooltipcito />}
              cursor={{ fill: 'var(--color-surface-container-high)' }}
            />
            <Bar dataKey="total" maxBarSize={24} radius={[4, 4, 0, 0]}>
              {datos.map((p) => (
                <Cell
                  key={p.mes}
                  fill={
                    p.enCurso
                      ? 'var(--color-surface-container-highest)'
                      : 'var(--color-primary-container)'
                  }
                />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <figcaption className="text-body-sm text-on-surface-variant">
        Gasto total por mes. El mes en curso va apagado porque está incompleto.
        El desglose por tope está en la tabla.
      </figcaption>
    </figure>
  )
}
