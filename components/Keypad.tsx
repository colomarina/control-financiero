'use client'

import { useEffect } from 'react'
import {
  pulsarDigito,
  pulsarComa,
  borrar,
  mostrar,
  estaVacio,
  type Importe,
} from '@/lib/core/keypad'
import { Icono } from '@/components/Icono'
import { cn } from '@/lib/utils'

/**
 * Teclado numérico del importe.
 *
 * Existe para no depender del teclado del sistema: en el celular ese teclado
 * tapa media pantalla, tarda en abrir y cambia de layout según el dispositivo.
 * Acá las teclas están siempre en el mismo lugar y al alcance del pulgar.
 *
 * Toda la lógica (qué pasa al tocar cada tecla) vive en `lib/core/keypad.ts`,
 * que es puro y está testeado. Este componente solo dibuja y despacha.
 */

const TECLAS = ['1', '2', '3', '4', '5', '6', '7', '8', '9', ',', '0', '⌫'] as const

const ARIA: Record<string, string> = { ',': 'Coma decimal', '⌫': 'Borrar' }

export function Keypad({
  valor,
  onChange,
}: {
  valor: Importe
  onChange: (i: Importe) => void
}) {
  function pulsar(tecla: string) {
    if (tecla === '⌫') onChange(borrar(valor))
    else if (tecla === ',') onChange(pulsarComa(valor))
    else onChange(pulsarDigito(valor, tecla))
  }

  // En la compu se puede tipear con el teclado de verdad. Se ignora si el foco
  // está en otro campo del formulario (comercio, nota), para no robarle las
  // teclas a quien está escribiendo ahí.
  useEffect(() => {
    function alTeclear(e: KeyboardEvent) {
      if (e.ctrlKey || e.metaKey || e.altKey) return

      const dentroDeUnCampo =
        e.target instanceof HTMLElement &&
        ['INPUT', 'TEXTAREA', 'SELECT'].includes(e.target.tagName)
      if (dentroDeUnCampo) return

      if (/^[0-9]$/.test(e.key)) onChange(pulsarDigito(valor, e.key))
      else if (e.key === ',' || e.key === '.') onChange(pulsarComa(valor))
      else if (e.key === 'Backspace') onChange(borrar(valor))
      else return

      e.preventDefault()
    }

    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [valor, onChange])

  const vacio = estaVacio(valor)

  return (
    <div className="gap-space-md flex flex-col">
      {/* El importe, en grande. `aria-live` para que el lector de pantalla
          cante el valor a medida que cambia. */}
      <output
        aria-label="Importe"
        aria-live="polite"
        className="gap-space-xs flex items-baseline justify-center py-2"
      >
        <span
          className={cn(
            'text-keypad-digits transition-colors',
            vacio ? 'text-on-surface-variant/40' : 'text-on-surface-variant',
          )}
        >
          $
        </span>
        <span
          className={cn(
            'text-display-currency-mobile tabular-nums transition-colors',
            vacio ? 'text-on-surface-variant/40' : 'text-on-surface',
          )}
        >
          {mostrar(valor)}
        </span>
      </output>

      <div className="gap-space-sm grid grid-cols-3">
        {TECLAS.map((t) => (
          <button
            key={t}
            type="button"
            onClick={() => pulsar(t)}
            aria-label={ARIA[t] ?? t}
            // `touch-manipulation` saca el delay de 300ms y el zoom por doble tap.
            className={cn(
              'text-keypad-digits text-on-surface h-14 touch-manipulation rounded-lg',
              'transition-transform select-none active:scale-95',
              t === '⌫'
                ? 'text-on-surface-variant grid place-items-center'
                : 'bg-surface-container-high',
            )}
          >
            {t === '⌫' ? <Icono nombre="backspace" className="text-[22px]" /> : t}
          </button>
        ))}
      </div>
    </div>
  )
}
