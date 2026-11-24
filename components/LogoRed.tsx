import Image from 'next/image'
import type { Red } from '@/lib/schemas/tarjeta'
import { ETIQUETA_RED } from '@/lib/schemas/tarjeta'
import visa from '@/assets/redes/visa.svg'
import mastercard from '@/assets/redes/mastercard.svg'
import amex from '@/assets/redes/amex.svg'
import { cn } from '@/lib/utils'

const LOGO = { visa, mastercard, amex }

/**
 * El logo de la red de una tarjeta (Visa, Mastercard, Amex).
 *
 * Es la única pieza de la UI con colores fuera de la paleta: son marcas, no
 * colores de interfaz (ver DESIGN_SYSTEM.md). Por eso va chica —24×15 por
 * defecto— para que no compita con el semáforo.
 *
 * Los SVG se importan (no van en `public/`): Next les pone hash y los sirve
 * desde `/_next/static`, que es lo único que cachea el service worker.
 * `unoptimized` porque un SVG no tiene nada que optimizar.
 */
export function LogoRed({
  red,
  ancho = 24,
  className,
}: {
  red: Red
  ancho?: number
  className?: string
}) {
  return (
    <Image
      src={LOGO[red]}
      alt={ETIQUETA_RED[red]}
      width={ancho}
      height={Math.round((ancho * 20) / 32)}
      unoptimized
      className={cn('inline-block shrink-0 align-[-3px]', className)}
    />
  )
}
