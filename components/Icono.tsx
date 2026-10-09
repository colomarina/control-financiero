import { cn } from '@/lib/utils'

/**
 * Ícono de Material Symbols Outlined (el set del design system).
 *
 * El nombre es el literal de Google: `dashboard`, `account_balance_wallet`,
 * `event_repeat`, `settings`, `trending_up`, `home`, `directions_car`,
 * `fitness_center`, `bolt`, `add`.
 *
 * Tamaños típicos: 18–22px en la UI, 28px en el FAB. Se controla con una clase
 * de texto (`text-[20px]`) porque la fuente hereda `font-size`.
 */
export function Icono({
  nombre,
  className,
  relleno = false,
}: {
  nombre: string
  className?: string
  /** Variante rellena (para el tab activo, por ejemplo). */
  relleno?: boolean
}) {
  return (
    <span
      aria-hidden
      translate="no"
      className={cn('material-symbols-outlined', className)}
      style={relleno ? { fontVariationSettings: "'FILL' 1" } : undefined}
    >
      {nombre}
    </span>
  )
}
