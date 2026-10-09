import { describe, it, expect } from 'vitest'
import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { cn } from './utils'

/**
 * `cn` es tailwind-merge, que solo conoce la escala de texto built-in. Sin la
 * lista de tamaños del `@theme`, cualquier `text-algo` le parece un color y
 * descarta uno de los dos: `cn('text-keypad-digits text-on-surface')` perdía
 * el tamaño, y con el orden invertido perdía el color.
 *
 * Es un bug mudo —no rompe nada, solo deja la tipografía en el tamaño por
 * defecto— así que vale tenerlo clavado con tests.
 */

describe('cn con los tokens del design system', () => {
  it('conserva tamaño y color juntos', () => {
    expect(cn('text-keypad-digits text-on-surface')).toBe('text-keypad-digits text-on-surface')
    expect(cn('text-label-caps text-on-surface-variant uppercase')).toBe(
      'text-label-caps text-on-surface-variant uppercase',
    )
  })

  it('tampoco pierde el color si el tamaño va último', () => {
    expect(cn('text-on-surface text-display-currency-mobile')).toBe(
      'text-on-surface text-display-currency-mobile',
    )
  })

  it('sigue resolviendo los conflictos de verdad', () => {
    // Dos tamaños o dos colores: gana el último, como corresponde.
    expect(cn('text-body-sm text-body-lg')).toBe('text-body-lg')
    expect(cn('text-primary text-error')).toBe('text-error')
    // Y la escala built-in no se rompió.
    expect(cn('text-xs text-2xl')).toBe('text-2xl')
  })

  it('un className de afuera pisa el color sin tocar el tamaño', () => {
    expect(cn('text-body-md text-on-surface', 'text-primary')).toBe('text-body-md text-primary')
  })
})

describe('la lista de tamaños vs el @theme', () => {
  it('registra todos los --text-* de globals.css', () => {
    // Si se agrega un tamaño al `@theme` y no a `TAMANIOS_DE_TEXTO`, vuelve el
    // bug para ese token solo. Esto lo detecta sin que haya que acordarse.
    const css = readFileSync(resolve(import.meta.dirname, '../app/globals.css'), 'utf8')

    const enElTheme = [
      ...new Set(
        [...css.matchAll(/^\s*--text-([a-z0-9-]+):/gm)]
          .map((m) => m[1])
          // Las variantes `--text-x--line-height` y compañía no son tamaños.
          .filter((t) => !t.includes('--')),
      ),
    ]

    expect(enElTheme.length).toBeGreaterThan(0)

    const perdidos = enElTheme.filter(
      (token) => cn(`text-${token} text-on-surface`) !== `text-${token} text-on-surface`,
    )

    expect(perdidos).toEqual([])
  })
})
