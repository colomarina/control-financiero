'use client'

import { useSyncExternalStore } from 'react'
import { Icono } from '@/components/Icono'
import { cn } from '@/lib/utils'

/**
 * El ojito del Home: tapa los importes por si hay gente cerca.
 *
 * El estado vive en un atributo de `<html>` (`data-privado`) y no en React:
 * así lo puede poner el script del layout **antes del primer pintado**, y al
 * recargar con el modo puesto los números no se ven ni un instante. Se
 * recuerda en `localStorage` (por dispositivo: en el celular puede quedar
 * puesto y en la compu no). El CSS está en `globals.css`.
 */
export const CLAVE_PRIVADO = 'privado'

const suscriptores = new Set<() => void>()

function suscribir(avisar: () => void) {
  suscriptores.add(avisar)
  return () => {
    suscriptores.delete(avisar)
  }
}

const estaPrivado = () => document.documentElement.hasAttribute('data-privado')

export function BotonPrivado() {
  // En el server no se sabe: arranca "visible" y se corrige al hidratar.
  const privado = useSyncExternalStore(suscribir, estaPrivado, () => false)

  function alternar() {
    const nuevo = !estaPrivado()
    document.documentElement.toggleAttribute('data-privado', nuevo)
    try {
      if (nuevo) localStorage.setItem(CLAVE_PRIVADO, '1')
      else localStorage.removeItem(CLAVE_PRIVADO)
    } catch {
      // Sin storage (modo incógnito estricto) el modo dura hasta recargar.
    }
    suscriptores.forEach((avisar) => avisar())
  }

  return (
    <button
      type="button"
      onClick={alternar}
      aria-pressed={privado}
      aria-label={privado ? 'Mostrar importes' : 'Ocultar importes'}
      className={cn(
        'grid size-10 shrink-0 place-items-center rounded-full transition-colors active:scale-95',
        privado
          ? 'bg-primary/15 text-primary'
          : 'bg-surface-container-high text-on-surface-variant',
      )}
    >
      <Icono nombre={privado ? 'visibility_off' : 'visibility'} className="text-[22px]" />
    </button>
  )
}
