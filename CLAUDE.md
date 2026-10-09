# CLAUDE.md — Control Financiero

Guía para Claude Code. Leer antes de generar código. Este archivo manda sobre cualquier
suposición por defecto. Si algo acá choca con un pedido puntual, preguntar antes de avanzar.

App web **personal** (un solo usuario) para trackear finanzas mensuales. **Mobile-first**:
la acción principal es cargar un gasto desde el celular en 3 taps.

Documentos de referencia (en la raíz / `/docs`):
- `ARQUITECTURA_APP_FINANZAS.md` — arquitectura completa y orden de construcción.
- `DESIGN_SYSTEM.md` — tokens y reglas visuales. **Fuente de verdad de la UI.**

---

## Stack (cerrado, no cambiar sin avisar)

Next.js (App Router) · TypeScript · Supabase (Postgres + auth) · Tailwind · shadcn/ui ·
Zod · Vitest · date-fns · Recharts. Deploy en Vercel.

---

## Reglas de arquitectura

- **Estructura híbrida**: rutas/UI en `/app`, lógica pura en `/lib/core`, acceso a datos en
  `/lib/db`, Server Actions en `/app/actions`, schemas Zod en `/lib/schemas`, componentes en
  `/components`.
- **`/lib/core` es sagrado**: funciones puras, sin imports de Supabase, React ni Next. Entra
  data, sale data. Cada archivo con su `.test.ts` al lado (Vitest).
- **Acceso a datos solo por `/lib/db`**: ninguna página ni action llama a supabase-js directo.
  El repositorio expone funciones con nombre claro (`getMovimientos(mes)`, `crearMovimiento(...)`).
- **Lectura**: Server Component → `/lib/db` → `/lib/core` (calcula) → UI.
- **Escritura**: UI → Server Action → valida con **Zod** → `/lib/db` → `revalidatePath()`.
  Sin fetch del cliente, sin API routes a mano.
- **La base guarda hechos, la app deriva vistas**: ningún cálculo se persiste. El mes sale de
  la fecha (`to_char(fecha,'YYYY-MM')`); categoría/subcategoría/es_fijo salen del comercio.
- **Plata en centavos**: todo importe es entero de centavos (`150000` = $1.500,00). Convertir a
  pesos solo al mostrar (`/lib/core/dinero.ts`). Nunca float en cálculos.
- **Validar todo input con Zod** en la Server Action antes de escribir.

### Árbol de referencia
```
app/(app)/{page,cargar,presupuesto,historial,fijos,config}  · rutas + UI
app/actions/*            · Server Actions (escritura, validan Zod)
lib/core/*               · lógica pura + tests (dinero, fechas, topes, gastos, prediccion, presupuesto)
lib/db/*                 · repositorio sobre supabase-js
lib/schemas/*            · Zod (validación = fuente de tipos)
components/ui/*          · shadcn/ui
components/*             · componentes propios (BarraTope, FormGasto, ...)
supabase/{schema,seed}.sql
scripts/migrar-excel.ts
```

---

## Reglas de UI (resumen; el detalle está en DESIGN_SYSTEM.md)

- **Dark mode siempre** (`<html class="dark">`), **mobile-first**, contenedor `max-w-md` centrado.
- Usar **solo** los tokens del bloque `@theme` de `app/globals.css`. Si falta un color, el diseño se está saliendo
  del sistema: preguntar, no inventar un hex.
- **Semáforo**: verde (`primary`) = OK/pagado/dentro del tope · ámbar (`tertiary`) = pendiente/
  cerca (>85%) · rojo (`error`) = excedido · azulado (`secondary-container`) = dato neutro.
- Todo **importe** → clase `label-numeric` (en listas) o `display-currency` (hero). Nunca fuente normal.
- Respetar safe areas (`pt-safe`, `pb-safe`) en header y bottom-nav.
- Los mockups HTML son **referencia visual**, no código a copiar: traducir a componentes React
  con shadcn/ui siguiendo el design system.

---

## shadcn/ui — integración con el design system (decisión: Opción A)

**La paleta del design system es la fuente de verdad. shadcn se adapta a ella, no al revés.**

Al inicializar shadcn y agregar componentes, seguir estas reglas:

1. **Mapear las variables de shadcn a los tokens del design system.** shadcn genera variables CSS
   en `globals.css` (`--primary`, `--background`, `--card`, etc.). Hay que setearlas con los
   valores de nuestra paleta (Material 3 dark), no con las que trae por defecto. Correspondencia:

   | Variable shadcn        | Token del design system            | Hex       |
   |------------------------|------------------------------------|-----------|
   | `--background`         | surface                            | #0f131c   |
   | `--foreground`         | on-surface                         | #dfe2ef   |
   | `--card`               | surface-container                  | #1c1f29   |
   | `--card-foreground`    | on-surface                         | #dfe2ef   |
   | `--popover`            | surface-container-high             | #262a34   |
   | `--primary`            | primary                            | #4edea3   |
   | `--primary-foreground` | on-primary                         | #003824   |
   | `--secondary`          | secondary-container                | #3f465c   |
   | `--secondary-foreground`| on-secondary-container            | #adb4ce   |
   | `--muted`              | surface-container-high             | #262a34   |
   | `--muted-foreground`   | on-surface-variant                 | #bbcabf   |
   | `--accent`             | tertiary-container                 | #e29100   |
   | `--accent-foreground`  | on-tertiary-container              | #523200   |
   | `--destructive`        | error-container                    | #93000a   |
   | `--destructive-foreground`| on-error-container              | #ffdad6   |
   | `--border`             | outline-variant                    | #3c4a42   |
   | `--input`              | outline-variant                    | #3c4a42   |
   | `--ring`               | primary                            | #4edea3   |

2. **No duplicar la paleta.** Los tokens semánticos nuestros (`surface-container-*`, `tertiary`,
   etc.) viven en el `@theme` de `app/globals.css` y se usan en todo el UI propio. Las variables de shadcn
   son solo el puente para que sus componentes (botones, dialog, select) hereden nuestros colores.
3. **Base dark**: configurar shadcn en modo dark (sin theme switcher; no hay tema claro).
4. **Radius**: usar `--radius` acorde a nuestros radios (cards `xl` = 0.75rem).
5. Si un componente de shadcn necesita un color que no mapea limpio, preferir componer con
   nuestras clases Tailwind antes que agregar un color nuevo.

> Resultado: un solo sistema de color. Un botón de shadcn y una `BarraTope` propia usan el mismo
> verde menta porque ambos salen de la misma paleta.

---

## Orden de construcción (pedir una etapa por vez)

0. **Andamiaje**: create-next-app (TS+Tailwind), shadcn init + mapeo de variables, Supabase +
   `schema.sql` + auth magic link, `dinero.ts`/`fechas.ts` con tests.
1. **Movimientos** (corazón): schemas + repositorio + `gastos.ts` + action `crearMovimiento` +
   pantalla Cargar + Home con barras de topes.
2. **Predicción**: `prediccion.ts` (B+E) con tests + mostrarla en Home.
3. **Presupuesto**: repositorio + `presupuesto.ts` + pantalla con mes objetivo.
4. **Historial + fijos + gráficos** (Recharts).
5. **Pulido**: PWA, búsqueda, filtros, export.

Regla: cada etapa tiene que quedar usable. El Excel es el respaldo hasta la etapa 4.

---

## Checklist antes de dar por lista una pieza

- [ ] ¿La lógica quedó en `/lib/core` pura y con test?
- [ ] ¿El acceso a datos pasó por `/lib/db` (no supabase-js suelto)?
- [ ] ¿El input se validó con Zod en la action?
- [ ] ¿Los importes están en centavos y se formatean solo al mostrar?
- [ ] ¿La UI usa solo tokens del design system y el semáforo correcto?
- [ ] ¿Funciona bien en pantalla de celular (mobile-first, safe areas)?

---

## Reglas del dominio (salen del Excel original)

**Formas de pago** (5) y contra qué tope pesa cada una. El mapa vive en
`TOPE_DE_FORMA_PAGO` (`lib/core/gastos.ts`), que es la única fuente de verdad:

| Forma de pago       | Tope          |
|---------------------|---------------|
| `tarjeta_credito`   | tarjeta       |
| `tarjeta_debito`    | tarjeta       |
| `debito_automatico` | tarjeta       |
| `transferencia`     | efectivo      |
| `efectivo`          | efectivo      |

**Gastos fijos**: no hay tilde manual. Un fijo está pagado si su comercio aparece
en los movimientos del mes (`lib/core/fijos.ts`). El hecho es el movimiento; el
estado se deriva. Hay un estado `parcial` que el Excel no distinguía.

**Predicción — método B+E** (`lib/core/prediccion.ts`):

```
B (Base)  = gastado del mes + fijos pendientes
E (Extra) = ritmo variable diario × días restantes × factor
cierre    = B + E      factores: optimista 0,85 · normal 1,00 · pesimista 1,25
```

El ritmo variable diario es `(gastado − fijos ya pagados) / día actual`, contando
solo lo que pesa contra el mismo tope. Antes de `config.umbral_dia` la predicción
devuelve `temprano` en lugar de un número: con pocos días el ritmo es ruido.

**Fechas y zona horaria**: una fecha de movimiento es `"YYYY-MM-DD"` (`date` en
Postgres), sin hora ni zona. "Hoy" se resuelve siempre con `hoyISO()` /
`diaActual()` de `lib/core/fechas.ts`, que anclan a Buenos Aires. Nunca
`new Date().toISOString().slice(0,10)`: Vercel corre en UTC y después de las 21:00
manda el gasto al día siguiente.

---

## Estado real del repo (actualizar si cambia)

- **Tailwind v4, CSS-first.** No hay `tailwind.config.ts`: un config v3 no se carga.
  Los tokens del design system están en el `@theme` de `app/globals.css`, con los
  mismos nombres que documenta `DESIGN_SYSTEM.md`. El puente a shadcn (la tabla de
  arriba) está en el mismo archivo, con los hex literales para no armar un ciclo de
  variables CSS.
- **Las piezas del design system viven en `components/ds.tsx`**: `Card`, `TituloCard`,
  `MontoHero`, `Badge`, `Barra`, `ItemLista`, `Separador`, `Banner`, `Monto`, y las
  clases `campo`, `botonPrimario`, `botonSecundario`, `etiqueta`. Usarlas antes de
  repetir clases sueltas. El semáforo tiene un solo mapa: el tipo `Semaforo`.
- **Íconos**: `components/Icono.tsx` (Material Symbols Outlined). La fuente se carga
  por stylesheet en `app/layout.tsx` porque no está en `next/font/google`.
- **shadcn**: solo queda `components/ui/sonner.tsx` (los toasts). Los campos y botones
  se componen con tokens nuestros, que es lo que habilita la regla 5 de arriba. Para
  sumar un componente: `npx shadcn@latest add <nombre>` — el puente de variables ya
  está hecho, así que hereda la paleta solo.
- **Next 16**: `middleware` se llama `proxy` (`proxy.ts` en la raíz). Cache Components
  está apagado a propósito para que valga el flujo clásico con `revalidatePath`.
- **Un solo umbral de semáforo**: `config.umbral_cerca_pct` (default 85). El Excel
  original tenía 0,80 / 0,85 / 0,90 conviviendo.
- **Gráficos**: la paleta del design system reserva verde/ámbar/rojo para el semáforo y
  no tiene dos tonos más que se distingan entre sí, así que los gráficos van de **una
  sola serie**. Si hace falta comparar series, primero hay que sumar colores al sistema.

## Pendiente

- Etapa 5: PWA, búsqueda, filtros, export.
- El `DESIGN_SYSTEM.md` nombra una pantalla de teclado numérico (`keypad-digits`) que
  todavía no existe: hoy el importe se carga con un input grande.
- `lib/core/fijos.test.ts` usa importes reales como fixtures (OSDE, EDELAP). Si alguna vez
  el repo deja de ser privado, cambiarlos por números inventados.

## Ya hecho (no volver a proponerlo)

- **Deployado en Vercel**, repo privado en `colomarina/control-financiero`.
- **`supabase/seed.sql` no se versiona** (está en `.gitignore`): tiene datos financieros
  reales. Se regenera con `npm run migrar <xlsx>`. `schema.sql` sí va al repo: es DDL puro.
- **Cambio de contraseña** en `/config` (`cambiarPassword` en `app/actions/auth.ts`), que
  valida la actual con `current_password`. No hay signup: el usuario se crea desde el
  dashboard de Supabase.
- **`cn` corre sobre tablas precompiladas** (`lib/utils.ts` + `lib/cn-tables.mjs`, que genera
  `npm run cn:build`). tailwind-merge solo conoce la escala de texto built-in, así que
  cualquier `text-algo` del `@theme` le parecía un color: `cn('text-keypad-digits
  text-on-surface')` devolvía solo el color y **toda la tipografía del design system se
  perdía en silencio**. El builder lee las escalas de `app/globals.css`, así que no hay lista
  que mantener a mano.
  - **`lib/cn-tables.mjs` es generado y está commiteado.** Si se tocan los tokens del `@theme`
    o se suman clases nuevas de Tailwind, correr `npm run cn:build` y commitear el resultado.
    `lib/utils.test.ts` falla si las tablas quedaron viejas respecto de `globals.css`.
  - Precompilar además subsetea los class groups: el bundle quedó **más chico que con el `cn`
    original**, así que el arreglo del bug salió gratis.
  - Los componentes de `components/ui/*` que agrega shadcn vienen con `import { cn } from "cn"`.
    **Cambiarlo a `@/lib/utils`** o quedan fuera de esta config y duplican el motor.
- **Campo de fecha con calendario** (`components/CampoFecha.tsx`), en lugar del
  `<input type="date">`. El valor sigue viajando como `"YYYY-MM-DD"` en un input oculto.
  - El calendario (`CalendarioFecha` + `react-day-picker`) pesa ~165 KB y vive en su propio
    módulo porque `CampoFecha` lo carga con `next/dynamic` recién al abrir el popover: la
    fecha casi siempre es hoy y el resto del formulario no tiene por qué pagarlo.
  - El puente `Date` ↔ ISO va por `aFechaLocal` / `desdeFechaLocal` (`lib/core/fechas.ts`).
    **Nunca `new Date(iso)` ni `toISOString()`**: los dos pasan por UTC y corren la fecha un
    día para atrás en Buenos Aires. Hay un test que deja el bug documentado.
  - Al ser un campo controlado, `form.reset()` no lo vuelve a hoy: `FormGasto` lo remonta con
    una `key` después de guardar.
- **Búsqueda y filtros** en Historial: `lib/core/filtros.ts` (puro, con test) + el client
  component `BuscadorMovimientos`. Filtra **en el cliente** porque la pantalla ya trae todo
  el histórico para los agregados; si algún día son miles de filas, el filtrado se baja a
  `lib/db/movimientos.ts` sin tocar la lógica. El texto se parte en palabras y todas tienen
  que aparecer, aunque sea en campos distintos.
- **Atajos de comercio** en Cargar: `lib/core/frecuentes.ts` (puro, con test) ordena por usos
  y desempata por el más reciente. La pantalla pasa los movimientos de dos meses; si no hay
  ninguno, la grilla no se dibuja y queda el buscador de siempre.
- **Teclado numérico del importe**: `components/Keypad.tsx` sobre `lib/core/keypad.ts`
  (puro, con test). Se tipea en **pesos**, no en centavos: `1500` es $1.500 y los centavos
  solo aparecen si se aprieta la coma. El form manda el texto formateado (`mostrar()`) y la
  action lo pasa por `parsearImporte`; ese ida y vuelta está testeado, no romperlo.
  Ya no existe el `keypad-digits` "pendiente" del `DESIGN_SYSTEM.md`.
- **PWA** (etapa 5, primera parte): `app/manifest.ts`, `public/sw.js` + `RegistrarSW`, e
  íconos generados por `npm run iconos` (`scripts/generar-iconos.ts`, PNG a mano con zlib,
  sin dependencias). Los de `public/` los referencia el manifest; los de `app/`
  (`icon.png`, `apple-icon.png`) son convención de Next.
  - El service worker **solo cachea `/_next/static/*`**. Nada de páginas, Server Actions ni
    payloads de RSC: son datos financieros y van siempre a la red.
  - **Al tocar el matcher de `proxy.ts`**, acordarse de que `manifest.webmanifest` y `sw.js`
    tienen que seguir afuera. El navegador los pide por su cuenta —el manifest a veces sin
    cookies— y un redirect al login rompe la instalación.
