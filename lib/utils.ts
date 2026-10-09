import { createCn } from 'cn/engine'
import tables from './cn-tables.mjs'

/**
 * `cn` sobre tablas precompiladas (`npm run cn:build` -> `lib/cn-tables.mjs`).
 *
 * Dos cosas se resuelven en build y no en el navegador:
 *
 * 1. **Los tamaños de texto del design system.** tailwind-merge solo conoce la
 *    escala built-in, así que cualquier `text-algo` del `@theme` le parecía un
 *    color y descartaba uno de los dos: `cn('text-keypad-digits text-on-surface')`
 *    devolvía solo el color y la tipografía se perdía en silencio. El builder
 *    lee las escalas de `app/globals.css`, así que no hay ninguna lista que
 *    mantener a mano: alcanza con regenerar.
 * 2. **El peso.** Mandar el config entero y el compilador al cliente costaba
 *    ~16 KB gzip; estas tablas traen solo los grupos que el proyecto usa.
 *
 * Si se agrega un token al `@theme` o una clase nueva de Tailwind, regenerar
 * con `npm run cn:build`. `lib/utils.test.ts` falla si las tablas quedaron
 * viejas respecto de `globals.css`.
 */
export const cn = createCn(tables)
