import { createCn } from 'cn/config'

/**
 * Los tamaños de texto del `@theme` de `app/globals.css` (los `--text-*`).
 *
 * Hay que declararlos acá porque tailwind-merge solo conoce la escala built-in
 * (`text-xs` … `text-9xl`). Cualquier otro `text-algo` le parece un COLOR, así
 * que `cn('text-keypad-digits text-on-surface')` tiraba el tamaño a la basura
 * por creer que eran dos colores peleando — y al revés, con el orden invertido,
 * se perdía el color. Toda la tipografía del design system pasaba por ahí.
 *
 * Si se agrega un `--text-*` al `@theme`, va también en esta lista.
 */
const TAMANIOS_DE_TEXTO = [
  'display-currency',
  'display-currency-mobile',
  'headline-lg',
  'headline-lg-mobile',
  'headline-md',
  'headline-sm',
  'keypad-digits',
  'body-lg',
  'body-md',
  'body-sm',
  'label-numeric',
  'label-caps',
]

export const cn = createCn({
  extend: { theme: { text: TAMANIOS_DE_TEXTO } },
})
