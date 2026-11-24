import type { ReactNode } from 'react'
import { Icono } from '@/components/Icono'
import { cn } from '@/lib/utils'

/**
 * Las piezas del design system que se repiten en todas las pantallas.
 * Ver docs/DESIGN_SYSTEM.md › "Patrones de componentes".
 */

/** El semáforo de la app. Un solo lugar donde vive el mapa estado -> color. */
export type Semaforo = 'ok' | 'atencion' | 'mal' | 'neutro'

export const TEXTO_SEMAFORO: Record<Semaforo, string> = {
  ok: 'text-primary',
  atencion: 'text-tertiary',
  mal: 'text-error',
  neutro: 'text-on-surface-variant',
}

export const RELLENO_SEMAFORO: Record<Semaforo, string> = {
  ok: 'bg-primary-container',
  atencion: 'bg-tertiary',
  mal: 'bg-error',
  neutro: 'bg-secondary-container',
}

const CHIP_SEMAFORO: Record<Semaforo, string> = {
  ok: 'bg-primary/15 text-primary',
  atencion: 'bg-tertiary/15 text-tertiary',
  mal: 'bg-error/15 text-error',
  neutro: 'bg-secondary-container/40 text-on-secondary-container',
}

/** Card estándar: la superficie sobre la que va casi todo. */
export function Card({
  children,
  className,
  destacada = false,
}: {
  children: ReactNode
  className?: string
  /** Un nivel más de superficie, para la card que tiene que pesar más. */
  destacada?: boolean
}) {
  return (
    <section
      className={cn(
        'rounded-xl p-space-md gap-space-sm flex flex-col shadow-md',
        destacada ? 'bg-surface-container-high' : 'bg-surface-container',
        className,
      )}
    >
      {children}
    </section>
  )
}

/** Título chico de card. */
export function TituloCard({
  children,
  className,
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <h2 className={cn('text-label-caps text-on-surface-variant uppercase', className)}>
      {children}
    </h2>
  )
}

/** Monto hero: el número grande de una card. */
export function MontoHero({
  children,
  tono = 'neutro',
  className,
}: {
  children: ReactNode
  tono?: Semaforo
  className?: string
}) {
  return (
    <p
      className={cn(
        'text-display-currency-mobile',
        tono === 'neutro' ? 'text-on-surface' : TEXTO_SEMAFORO[tono],
        className,
      )}
    >
      <Privado>{children}</Privado>
    </p>
  )
}

/** Badge / chip de estado. */
export function Badge({
  children,
  tono = 'neutro',
  className,
}: {
  children: ReactNode
  tono?: Semaforo
  className?: string
}) {
  return (
    <span
      className={cn(
        'px-space-sm text-label-caps shrink-0 rounded-full py-0.5 uppercase',
        CHIP_SEMAFORO[tono],
        className,
      )}
    >
      {children}
    </span>
  )
}

/**
 * Barra de progreso. El track es la superficie más clara; el relleno toma el
 * color del semáforo. El glow solo aparece en verde, que es el estado "logrado".
 */
export function Barra({
  porcentaje,
  tono = 'ok',
  etiqueta,
}: {
  /** 0 a 100; se recorta sola. */
  porcentaje: number
  tono?: Semaforo
  etiqueta: string
}) {
  const ancho = Math.max(0, Math.min(porcentaje, 100))

  return (
    <div
      className="bg-surface-container-highest h-2 w-full overflow-hidden rounded-full"
      role="progressbar"
      aria-valuenow={Math.round(ancho)}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={etiqueta}
    >
      <div
        className={cn(
          'h-full rounded-full transition-[width]',
          RELLENO_SEMAFORO[tono],
          tono === 'ok' && 'shadow-[0_0_12px_rgba(16,185,129,0.5)]',
        )}
        style={{ width: `${ancho}%` }}
      />
    </div>
  )
}

/**
 * Item de lista dentro de una card: ícono en círculo, texto al medio,
 * monto a la derecha.
 */
export function ItemLista({
  icono,
  titulo,
  detalle,
  derecha,
  tonoIcono = 'ok',
}: {
  icono: string
  titulo: ReactNode
  detalle?: ReactNode
  derecha: ReactNode
  tonoIcono?: Semaforo
}) {
  return (
    <div className="p-space-sm gap-space-sm flex items-center justify-between rounded-lg">
      <span
        className={cn(
          'grid size-9 shrink-0 place-items-center rounded-full',
          tonoIcono === 'ok' && 'bg-primary/10 text-primary',
          tonoIcono === 'atencion' && 'bg-tertiary/10 text-tertiary',
          tonoIcono === 'mal' && 'bg-error/10 text-error',
          tonoIcono === 'neutro' && 'bg-secondary-container/40 text-on-secondary-container',
        )}
      >
        <Icono nombre={icono} className="text-[20px]" />
      </span>

      <div className="min-w-0 flex-1">
        <p className="text-body-md text-on-surface truncate">{titulo}</p>
        {detalle && (
          <p className="text-body-sm text-on-surface-variant truncate">{detalle}</p>
        )}
      </div>

      <div className="shrink-0 text-right">{derecha}</div>
    </div>
  )
}

/** Separador fino entre items de lista. */
export function Separador() {
  return <div className="bg-surface-container-high h-px" role="presentation" />
}

/**
 * Bloque gris que ocupa el lugar de algo que todavía no llegó.
 *
 * La gracia de un esqueleto no es "avisar que carga" —para eso alcanza un
 * spinner— sino **reservar la forma final**: cuando llega el contenido no se
 * mueve nada de lugar. Por eso cada `loading.tsx` dibuja la silueta de su
 * pantalla y no un esqueleto genérico.
 */
export function Esqueleto({ className }: { className?: string }) {
  return (
    <div
      aria-hidden
      className={cn('bg-surface-container-high animate-pulse rounded-lg', className)}
    />
  )
}

/**
 * El envoltorio de un `loading.tsx`: anuncia la espera a los lectores de
 * pantalla y deja el contenido con el mismo ritmo vertical que la pantalla real.
 */
export function Cargando({ children }: { children: ReactNode }) {
  return (
    <div role="status" aria-busy="true" aria-label="Cargando" className="gap-space-lg flex flex-col">
      {children}
    </div>
  )
}

/** Mini-banner informativo: una explicación corta con ícono. */
export function Banner({
  icono = 'info',
  children,
}: {
  icono?: string
  children: ReactNode
}) {
  return (
    <div className="bg-surface-container-low p-space-sm gap-space-sm flex items-start rounded-lg">
      <span className="text-primary mt-0.5 shrink-0">
        <Icono nombre={icono} className="text-[18px]" />
      </span>
      <p className="text-body-sm text-on-surface-variant">{children}</p>
    </div>
  )
}

/** El importe tal como lo quiere el design system: nunca con la fuente de texto. */
export function Monto({
  children,
  tono = 'neutro',
  className,
}: {
  children: ReactNode
  tono?: Semaforo
  className?: string
}) {
  return (
    <span
      className={cn(
        'text-label-numeric tabular-nums',
        tono === 'neutro' ? 'text-on-surface' : TEXTO_SEMAFORO[tono],
        className,
      )}
    >
      <Privado>{children}</Privado>
    </span>
  )
}

/**
 * Estilo de input del design system. Los campos son `<input>` planos y no el
 * de shadcn porque necesitan los tokens de superficie, no los de `--input`.
 */
export const campo =
  'bg-surface-container-high text-on-surface placeholder:text-on-surface-variant/60 ' +
  'border-outline-variant focus:border-primary focus:ring-primary/30 w-full rounded-lg ' +
  'border px-space-sm py-2.5 text-body-md outline-none focus:ring-2'

/** Botón principal. */
export const botonPrimario =
  'bg-primary text-on-primary text-body-lg flex h-12 w-full items-center justify-center ' +
  'gap-space-sm rounded-lg font-medium transition-transform active:scale-95 disabled:opacity-40'

/** Botón secundario / dentro de una card. */
export const botonSecundario =
  'bg-surface-container-highest text-on-surface text-body-sm px-space-md rounded-lg py-2 ' +
  'transition-transform active:scale-95'

/** Etiqueta de campo. */
export const etiqueta = 'text-label-caps text-on-surface-variant uppercase'

/** Un importe formateado adentro de un texto: "$1.500" o "-$1.500,50". */
const IMPORTE_EN_TEXTO = /(-?\$\d[\d.]*(?:,\d{2})?)/

/**
 * Un importe que el modo privado del Home tapa con `$ ***`.
 *
 * Se dibujan los dos —el valor y la máscara— y el CSS de `globals.css` elige
 * cuál se ve según `data-privado` en `<html>`. Así no hace falta JavaScript
 * para alternar, y la máscara ocupa su propio ancho: no deja adivinar el largo
 * del número como lo hacía el difuminado.
 */
export function Privado({ children }: { children: ReactNode }) {
  return (
    <>
      <span className="privado-valor">{children}</span>
      <span className="privado-mascara" aria-hidden>
        $ ***
      </span>
    </>
  )
}

/**
 * Un texto con importes adentro ("Quedan $40.000 de $2.000.000"), con cada
 * importe envuelto en `Privado`: en el modo privado se lee "Quedan $ *** de
 * $ ***".
 */
export function ConMontos({ children }: { children: string }) {
  return (
    <>
      {children.split(IMPORTE_EN_TEXTO).map((parte, i) =>
        i % 2 === 1 ? (
          <span key={i} className="tabular-nums">
            <Privado>{parte}</Privado>
          </span>
        ) : (
          parte
        ),
      )}
    </>
  )
}
