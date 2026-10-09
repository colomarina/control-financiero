'use client'

import Link from 'next/link'
import { Card, botonPrimario, botonSecundario } from '@/components/ds'
import { Icono } from '@/components/Icono'

/**
 * Cuando una pantalla no pudo cargar. En la práctica es casi siempre la red o
 * Supabase caído, no un bug: por eso lo primero que se ofrece es reintentar.
 *
 * No muestra el mensaje técnico. Un error de Postgres no le dice nada a nadie y
 * puede filtrar nombres de tablas; el detalle queda en los logs de Vercel.
 */
export default function ErrorPantalla({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  return (
    <div className="gap-space-lg flex flex-col">
      <Card className="gap-space-md items-center text-center">
        <span className="bg-error/15 text-error grid size-14 place-items-center rounded-full">
          <Icono nombre="cloud_off" className="text-[28px]" />
        </span>

        <div className="gap-space-xs flex flex-col">
          <h1 className="text-headline-sm text-on-surface">No pude cargar esta pantalla</h1>
          <p className="text-body-sm text-on-surface-variant">
            Casi siempre es la conexión. Probá de nuevo; si sigue, revisá que Supabase esté
            funcionando.
          </p>
        </div>

        <button type="button" onClick={reset} className={botonPrimario}>
          <Icono nombre="refresh" className="text-[20px]" />
          Reintentar
        </button>

        <Link href="/" className={botonSecundario}>
          Ir al inicio
        </Link>

        {error.digest && (
          // Sirve para encontrar el error en los logs de Vercel.
          <p className="text-body-sm text-on-surface-variant/60 tabular-nums">
            Referencia: {error.digest}
          </p>
        )}
      </Card>
    </div>
  )
}
