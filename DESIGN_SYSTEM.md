# Design System — Control Financiero

Sistema de diseño de la app. **Fuente de verdad visual.** Al generar cualquier pantalla
o componente, usar estos tokens y reglas. No inventar colores ni tamaños fuera de esta paleta.

Base: **Material 3 en dark mode**, mobile-first. Acento verde-menta, ámbar para pendientes,
rojo para excedido. Tipografía **Geist**.


> **Dónde viven los tokens.** El proyecto usa **Tailwind v4**, que es CSS-first: no hay
> `tailwind.config.ts`. Los tokens están en el bloque `@theme` de `app/globals.css`,
> con exactamente los mismos nombres que usa este documento — `bg-surface-container`,
> `text-label-numeric`, `p-space-md` y el resto funcionan tal cual están escritos acá.
> Las piezas (`Card`, `Badge`, `Barra`, `ItemLista`, `Banner`, `Monto`) están armadas
> en `components/ds.tsx`: usalas antes de repetir clases.

---

## Principios

- **Dark mode siempre** (`<html class="dark">`). No hay tema claro por ahora.
- **Mobile-first**: diseñar para pantalla de celular vertical. Contenedor principal centrado,
  ancho máximo tipo `max-w-md`.
- **Jerarquía por superficie, no por bordes**: los niveles se distinguen con tonos de
  `surface-container-*`, no con líneas. Usar bordes solo para separadores finos.
- **Los números son protagonistas**: importes con tipografía tabular/numérica y peso medio.
- **Semáforo consistente**: verde = bien/pagado, ámbar = pendiente/ojo, rojo = excedido.

---

## Paleta semántica (qué significa cada color)

### Superficies (de más oscura a más clara)
| Token                        | Uso                                             |
|------------------------------|-------------------------------------------------|
| `surface` / `background`     | Fondo general de la app (#0f131c)               |
| `surface-container-lowest`   | Fondos hundidos, el nivel más bajo              |
| `surface-container-low`      | Banners sutiles, mini-cards informativas        |
| `surface-container`          | **Card estándar** (la más usada)                |
| `surface-container-high`     | Card destacada / item sobre una card            |
| `surface-container-highest`  | Tracks de barras de progreso, chips             |
| `on-surface`                 | Texto principal (#dfe2ef)                       |
| `on-surface-variant`         | Texto secundario / labels (#bbcabf)             |

### Primary — verde menta (acento principal, "todo bien")
- `primary` (#4edea3): íconos de acento, texto de acento, montos positivos.
- `primary-container` (#10b981): **relleno de barras de progreso OK**, botón principal (FAB).
- `on-primary` (#003824): texto/ícono sobre fondo primary.
- Uso: estados cumplidos, pagado, dentro del tope, confirmaciones.

### Tertiary — ámbar (pendiente / atención, "ojo con esto")
- `tertiary` (#ffb95f): montos pendientes, fechas de vencimiento, badges "restante".
- `tertiary-container` (#e29100): rellenos de alerta media.
- Uso: pagos pendientes, "cerca del tope", lo que todavía no se concretó.

### Error — rojo (excedido / mal)
- `error` (#ffb4ab): texto de excedido.
- `error-container` (#93000a): fondo de estado excedido.
- Uso: superaste el tope, diferencia negativa, alertas duras.

### Secondary — azulado (apoyo neutro)
- `secondary-container` / `on-secondary-container`: íconos informativos, bloques de
  "impacto en predicción", elementos que no son ni buenos ni malos, solo data.

---

## Mapa semáforo → estado de la app

| Estado                    | Color          | Token principal                         |
|---------------------------|----------------|-----------------------------------------|
| Dentro del tope / pagado  | 🟢 verde       | `primary` / `primary-container`         |
| Cerca del tope (>85%)     | 🟡 ámbar       | `tertiary`                              |
| Excedido (>100%)          | 🔴 rojo        | `error`                                 |
| Dato neutro / informativo | 🔵 azulado     | `secondary-container`                   |

Esto aplica a: barras de topes (tarjeta/efectivo), estado de presupuesto por concepto,
badges de gastos fijos, diferencias.

---

## Tipografía (Geist)

Cargar Geist (Google Fonts o `next/font`). Escala de tamaños (clases Tailwind `text-*`):

| Clase                      | Uso                                                      |
|----------------------------|----------------------------------------------------------|
| `display-currency`         | Monto hero (ej: gasto total del mes en el Home)          |
| `display-currency-mobile`  | Igual, en viewport chico                                 |
| `headline-lg` / `-md`      | Títulos de sección                                       |
| `headline-sm`              | Título de card, nombre de concepto                       |
| `keypad-digits`            | Dígitos del teclado numérico al cargar gasto             |
| `body-lg` / `body-md`      | Texto general                                            |
| `body-sm`                  | Texto secundario, fechas, subtítulos                     |
| `label-numeric`            | **Importes dentro de listas/cards** (peso medio)         |
| `label-caps`               | Etiquetas en mayúscula con tracking (badges, headers)    |

Regla: todo **importe de plata** usa `label-numeric` (en listas) o `display-currency`
(hero). Nunca un importe con la fuente de texto normal.

---

## Espaciado y formas

- Espaciados por tokens: `space-xs` (4px), `space-sm` (8px), `space-md` (16px),
  `space-lg` (24px), `space-xl` (32px). Márgenes laterales mobile: `margin-mobile` (16px).
- Radios: cards `rounded-xl` (12px), chips/botones chicos `rounded-lg` (8px),
  píldoras/avatares `rounded-full`.
- Padding estándar de card: `p-space-md`.
- Gap entre cards de una sección: `gap-space-sm`.

---

## Patrones de componentes (del mockup)

### Card estándar
`bg-surface-container rounded-xl p-space-md shadow-md flex flex-col gap-space-sm`

### Item de lista (dentro de una card contenedora)
`p-space-sm rounded-lg flex items-center justify-between`, separados por un
`h-px bg-surface-container-high` fino. Ícono en círculo a la izquierda
(`w-9 h-9 rounded-full bg-primary/10 text-primary`), texto al medio, monto a la derecha
con `label-numeric`.

### Barra de progreso
Track `bg-surface-container-highest rounded-full`, relleno `bg-primary-container rounded-full`
(verde si OK; cambiar a `tertiary`/`error` según estado). Altura `h-2`.
Glow opcional en el relleno con `shadow-[0_0_12px_rgba(16,185,129,0.5)]`.

### Botón principal (acción)
`bg-primary text-on-primary rounded-lg` + `active:scale-95 transition-transform`.
Botón secundario: `bg-surface-container text-on-surface`.

### FAB (cargar gasto)
Círculo `w-14 h-14 rounded-full bg-primary-container text-on-primary`, fijo, centrado
sobre la bottom-nav, con sombra de acento.

### Badge / chip de estado
`px-space-sm py-0.5 rounded-full text-label-caps` + color según semáforo
(ej: pendiente `bg-tertiary/15 text-tertiary`, OK `bg-primary/15 text-primary`).

### Mini-banner informativo
`bg-surface-container-low p-space-sm rounded-lg` con ícono `primary` a la izquierda
y texto `body-sm on-surface-variant`. Para explicaciones (ej: "detección automática activa").

### Navegación
- **Header** fijo arriba (`fixed top-0`), con `backdrop-blur`, logo + título de pantalla
  + selector de período (mes) + avatar.
- **Bottom-nav** fija abajo (`fixed bottom-0`), con `backdrop-blur`, 4 tabs
  (Este mes / Presupuesto / Fijos / Config) y hueco central para el FAB.
- Respetar `pt-safe` / `pb-safe` (safe areas del celular).

---

## Íconos

Material Symbols Outlined. Ejemplos usados: `dashboard`, `account_balance_wallet`,
`event_repeat`, `settings`, `trending_up` (inversión), `home` (expensas),
`directions_car` (seguro auto), `fitness_center` (gym), `bolt` (luz), `add` (FAB).
Tamaños típicos: 18–22px en UI, 28px en el FAB.

---

## Reglas para Claude Code al generar UI

- Usar **solo** los tokens del bloque `@theme` de `app/globals.css`. Si falta un color, es señal de que el
  diseño se está saliendo del sistema: preguntar, no inventar un hex nuevo.
- Todo importe → clase `label-numeric` o `display-currency`, nunca fuente normal.
- Estados siempre por semáforo (verde/ámbar/rojo) según la tabla de arriba.
- Mobile-first: construir para celular; nada de layouts que asuman desktop.
- Respetar safe areas (`pt-safe`, `pb-safe`) en header y bottom-nav.
- Generar **componentes React con shadcn/ui**, no HTML plano con `onclick` inline.
  El mockup HTML es referencia visual, no código a copiar.
