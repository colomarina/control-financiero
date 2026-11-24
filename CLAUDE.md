# CLAUDE.md — Control Financiero

Guía para Claude Code. Leer antes de generar código. Este archivo manda sobre cualquier
suposición por defecto. Si algo acá choca con un pedido puntual, preguntar antes de avanzar.

App web **personal** (un solo usuario) para trackear finanzas mensuales. **Mobile-first**:
la acción principal es cargar un gasto desde el celular en 3 taps.

Documentos de referencia (en `/docs`):
- `docs/ARQUITECTURA_APP_FINANZAS.md` — arquitectura completa y orden de construcción.
- `docs/DESIGN_SYSTEM.md` — tokens y reglas visuales. **Fuente de verdad de la UI.**
- `docs/PENDIENTES.md` — lo que queda por hacer, y lo descartado con su porqué.

Este archivo y el `README.md` se quedan en la raíz: Claude Code lee el `CLAUDE.md` de ahí y
GitHub muestra el README en la portada.

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
2. **Predicción**: `prediccion.ts` con tests + mostrarla en Home.
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

**Presupuesto vs. Gastos fijos** — son dos cosas distintas y conviene no mezclarlas:

| | Gastos fijos | Presupuesto |
|---|---|---|
| Qué son | Débitos automáticos | Plata que el usuario separa |
| El monto | Lo decide el proveedor | Lo decide el usuario |
| Para qué sirve | Verificar que se pagó | Repartir y no pasarse |
| Ejemplos reales | Prepaga, luz, Netflix | Verdulería, gym, inversión mensual |

El presupuesto **no pretende cubrir todo el gasto del mes**: es un subconjunto elegido a
propósito (en el Excel original, 11 comercios de 48). Por eso **no va ningún "gastado fuera
del plan"**: sumar los comercios no presupuestados mezcla lo que el usuario decidió no
planificar con una fuga, y no significa nada. Existió, confundía, se sacó. El gasto total
del mes es cosa del Home.

Tampoco se separa ahorro de gasto: una línea de inversión es, a efectos del plan, plata que
sale. Así la usaba el Excel y así se decidió dejarla.

**Gastos fijos**: no hay tilde manual. Un fijo está pagado cuando en el mes
aparecen todas las facturas que espera (`pagos_esperados`: una, salvo Personal
Flow que son dos, una línea por persona). El hecho es el movimiento; el estado se
deriva (`lib/core/fijos.ts`).

**Se cuentan facturas, no plata.** El monto lo pone el proveedor y cambia todos
los meses, así que comparar pagado contra estimado inventaba un "falta $5.000"
cada vez que la luz salía más barata de lo previsto. El estimado sigue valiendo
para la predicción —`falta` lo prorratea por las facturas pendientes— y el desvío
contra lo esperado se muestra como dato (`desvioPct`), no como deuda. Hay un
estado `parcial` que el Excel no distinguía: llegó alguna factura, no todas.

**Predicción — base + ritmo mezclado + puntuales** (`lib/core/prediccion.ts`, con la
clasificación de compras en `lib/core/puntuales.ts`):

```
variable(m)   = movimiento real del tope, que NO es cuota, NO es comercio es_fijo
                y NO es de un comercio con gasto fijo activo
puntual(m)    = m.puntual ?? (m.importe > umbral)          ← la marca manual manda
umbral        = DIAS_PUNTUAL (5) × mediana de los ritmos diarios brutos de los meses históricos

ritmoHist     = promedio, en los meses históricos, de (variable − puntuales) / días del mes
puntualesHist = promedio mensual de puntuales en esos meses
ritmoMes      = (variable − puntuales) del mes / día actual
ritmo         = (PESO_HISTORICO_DIAS·ritmoHist + día·ritmoMes) / (PESO_HISTORICO_DIAS + día)

restantes     = días del mes − día actual
esperados     = max(0, puntualesHist − puntuales del mes) × restantes / días del mes
base          = gastado del tope (todo: fijos, cuotas, puntuales) + fijos pendientes
optimista     = base + ritmo·restantes·0,85
normal        = base + ritmo·restantes      + esperados
pesimista     = base + ritmo·restantes·1,25 + esperados
```

Los fijos pendientes pesan solo contra tarjeta (son débitos automáticos): el cierre de
efectivo usa `fijosPendientes = 0`.

Las constantes: `DIAS_PUNTUAL = 5`, `PESO_HISTORICO_DIAS = 7`,
`DIAS_MINIMOS_SIN_HISTORICO = 7`.

- **Por qué cambió.** El Excel proyectaba desde el día 1, con el ritmo hecho ruido. La
  versión B+E que lo reemplazó (ritmo = `(gastado − fijos pagados) / día`, con un
  `umbral_dia` fijo) tenía el defecto inverso: una compra grande se proyectaba como gasto
  diario —una tele el día 5 multiplicaba por cuatro el cierre estimado—.
- **El umbral de puntual es en "días de gasto", no en múltiplos del ticket.** "3× la mediana
  del ticket" (lo primero que se probó) marcaba entre 2 y 9 compras por mes con los datos
  reales: un supermercado normal ya pasaba. "5 días de tu gasto normal" marca una por mes,
  estable, y tomar la mediana *entre meses* evita que un mes con una compra enorme suba el
  umbral.
- **Marca manual**: `movimientos.puntual` es `null` (la app decide por el umbral), `true` o
  `false` (el usuario lo forzó). Se edita con el switch "Compra puntual" del único
  `FormGasto`, que además lo sugiere cuando el monto supera el umbral.
- **No hay día mínimo configurable.** El histórico vale `PESO_HISTORICO_DIAS` días de datos:
  el día 1 manda casi todo el histórico y a fin de mes casi todo el mes. Sin histórico no hay
  con qué mezclar, y antes de `DIAS_MINIMOS_SIN_HISTORICO` la predicción devuelve `temprano`:
  el único caso que queda. `config.umbral_dia` sigue en la tabla pero ya nada lo lee.
- Las cuotas y los fijos son plata comprometida: entran a la base y **nunca** al ritmo. El
  rango optimista–pesimista se angosta solo, porque el factor aplica solo al tramo proyectado.

**Compras en cuotas — quién recibe las cuotas derivadas y quién no.** Una compra
en cuotas se guarda **una sola vez** (`compras_cuotas`); las cuotas no se guardan
nunca: `lib/core/cuotas.ts` las deriva mes a mes y las materializa como objetos
que cumplen `MovimientoDetalle` más una marca `cuota`. Por eso el resto de
`lib/core` procesa listas mezcladas sin enterarse. **Qué lista recibe cada
pantalla es la regla que más caro sale violar en toda la app**: nada falla, nada
tira error, nada se pone en rojo — simplemente la pantalla informa mal la plata.

| Pantalla | Qué recibe |
|---|---|
| Home: topes, lista ordenada | movimientos **+** cuotas (hasta el mes actual) |
| Home: cierre estimado (`prediccionDelTope`: ritmo, puntuales, histórico, umbral) | **solo movimientos reales**; las cuotas entran únicamente al `gastado` del tope |
| Historial: mes a mes, promedio, gráfico, categorías, buscador | movimientos **+** cuotas, **cortando en el mes actual** |
| Checklist de fijos (`lib/core/fijos.ts`) | **solo movimientos reales** |
| `/presupuesto` | **solo movimientos reales** |
| Atajos de comercio en `/cargar` | **solo movimientos reales** |
| Umbral de compra puntual (`/cargar`, `/movimiento/[id]`) | **solo movimientos reales** |

Cada fila, con su porqué:

- **El cierre estimado y el umbral de puntual no ven cuotas** porque una compra en 12
  cuotas inflaría el ritmo y el umbral durante un año entero. `esVariable` ya descarta
  las cuotas, pero la regla no puede depender de eso: la lista se filtra antes de entrar.
  La cuota sí pesa en el `gastado` del tope, que es lo que se debe.
- **El Historial corta en el mes actual** porque `promedioMensual` excluye un solo
  mes, el marcado `enCurso`. Los meses futuros que una compra en cuotas ya tiene
  comprometidos entrarían al promedio **como meses cerrados**, y el número de
  portada —el promedio mensual— quedaría mal. El futuro se mira en Fijos y
  cuotas, que es la pantalla que existe para eso.
- **El checklist de fijos nunca ve una cuota** porque `checklistFijos` decide que
  una factura llegó contando cuántos movimientos de ese comercio hay en el mes.
  Una cuota de un comercio marcado `es_fijo` se contaría como la factura del mes
  y el fijo figuraría pagado sin que hubiera llegado nada. `fijos.ts` además las
  descarta en sus propias entradas, así que la regla no depende de que cada
  pantalla nueva se acuerde de respetarla.
- **El presupuesto no cuenta cuotas** porque el presupuesto es la plata que el
  usuario separa a propósito, en efectivo y transferencias —verdulería, gym, la
  inversión del mes—. Una cuota de tarjeta no es eso.
- **Los atajos de `/cargar` tampoco**, porque `comerciosFrecuentes` ordena por
  cantidad de usos: una compra en 12 cuotas se clavaría arriba de la grilla
  durante un año entero sin que el usuario la haya vuelto a comprar nunca.

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
  `MontoHero`, `Badge`, `Barra`, `ItemLista`, `Separador`, `Banner`, `Monto`,
  `Esqueleto`/`Cargando`, y las clases `campo`,
  `botonPrimario`, `botonSecundario`, `etiqueta`. Usarlas antes de repetir clases
  sueltas. El semáforo tiene un solo mapa: el tipo `Semaforo`.
  - Dos piezas viven aparte porque necesitan estado propio; las dos siguen dejando
    que el server renderice a sus hijos.
    - `Seccion` (`components/Seccion.tsx`), la card plegable: con `montarAlAbrir` no
      dibuja el contenido hasta que se abre.
    - `FilaEditable` (`components/FilaEditable.tsx`), **la fila de lista que se abre
      para editarse**. La usan las tres pantallas que tienen una: el plan de
      `/presupuesto`, el checklist de `/fijos` y el catálogo de `/config`. Pone el
      lápiz en círculo que se tiñe al abrirse, y al guardar muestra el toast y
      **cierra la fila**. No armar otra a mano: antes cada pantalla resolvía lo mismo
      distinto —un "Editar plan" subrayado, un lápiz, nada— y en las tres guardar no
      se veía, porque la página se revalidaba por detrás con el editor abierto
      mostrando lo mismo de antes.
      - Por eso **la action de una fila devuelve `{ ok, mensaje } | { ok, error }`,
        nunca `void`**: sin eso no hay qué avisar ni cuándo cerrar. `guardarFijoDirecto`
        además **tiraba** para que el error no se lo tragara nadie; ahora el toast es
        ese lugar, así que un monto mal tipeado no se lleva puesto el checklist entero.
      - El padding de la fila cerrada lo trae el `resumen` de cada pantalla, no el
        componente: así una fila se ve igual que antes de tener editor.
      - Lo que no es parte del formulario va en `pie`, fuera del `<form>`. Ahí está el
        "Quitar de fijos", que es su propio form y anidado no podría existir.
- **Esperar tiene dos capas, y las dos tienen que estar.** Cada ruta trae su
  `loading.tsx` con el esqueleto de *esa* pantalla (no uno genérico: la gracia es
  reservar la forma final para que al llegar los datos nada salte). Pero el esqueleto
  aparece recién cuando arranca la navegación, y entre el tap y ese momento no pasa
  nada: en el celular eso se lee como "no me registró el toque".
  - Por eso todo destino se acusa en el acto. La bottom-nav tiñe el tab tocado
    (`useLinkStatus` en `NavMobile`), y el FAB y el link a Historial cambian su ícono
    por un spinner (`LinkConEstado`). `useLinkStatus` **solo funciona adentro de un
    `<Link>`**, así que el contenido siempre va en un componente aparte.
  - Las filas que navegan llevan `active:` además de `hover:`: en el celular no hay
    hover y el destello al tocar es el único acuse antes del esqueleto.
- **Config e Historial son secciones plegables** (`Seccion`). Son las dos pantallas
  de bloques largos: abiertos obligan a scrollear tres o cuatro pantallas, plegados
  entran de una y el contador del encabezado adelanta qué hay adentro. En cada una
  arranca abierta la sección que más se usa (Catálogo y Mes a mes).
  - Lo que va adentro **no lleva `Card` propia**: la `Seccion` ya pone el fondo
    `surface-container`. Un sub-bloque que necesite despegarse usa
    `surface-container-high` (ver `AltaComercio`, o `FiltrosMovimientos` con
    `destacada`).
  - El gráfico de Recharts va con `montarAlAbrir`: dentro de un `<details>` cerrado
    el contenedor mide 0×0 y `ResponsiveContainer` nace sin tamaño. **No usarlo en
    el buscador**: al cerrarse se desmonta y se perderían los filtros puestos.
- **Íconos**: `components/Icono.tsx` (Material Symbols Outlined). La fuente se carga
  por stylesheet en `app/layout.tsx` porque no está en `next/font/google`.
- **shadcn**: de la librería quedan cuatro componentes en `components/ui/` —`sonner`
  (los toasts), `popover`, `calendar` y `button`—. Los campos y botones del resto se
  componen con tokens nuestros, que es lo que habilita la regla 5 de arriba. Para sumar
  un componente: `npx shadcn@latest add <nombre>` — el puente de variables ya está
  hecho, así que hereda la paleta solo.
  - **El paquete `shadcn` no está instalado, y no hay que instalarlo.** Lo único que
    lo pedía era un `@import "shadcn/tailwind.css"` en `globals.css`: 637 líneas de
    las que esta app usa nueve variantes `@custom-variant data-*`, hoy copiadas al
    propio `globals.css`. El paquete arrastraba el SDK de MCP (con Express adentro),
    dotenvx y systeminformation —18 vulnerabilidades, todas en código que esta app no
    ejecuta jamás—. El CLI se corre con `npx`, que no instala nada.
  - Si un componente nuevo pide una variante `data-*` que no está, copiarla de
    `shadcn/dist/tailwind.css` al bloque de `globals.css`, no volver a traer el import.
    Lo que no se copió es `scroll-fade`, `shimmer` y `no-scrollbar`.
  - **Cómo se verifica que las variantes siguen vivas**, si alguien vuelve a tocar el
    bloque: un `build` verde no alcanza —una variante que falta no rompe nada, solo
    apaga la animación—. El popover abierto tiene que dar `animationName: "enter"` y,
    al cerrarse, `"exit"`; sin la variante da `"none"`. Se mira con
    `getComputedStyle` sobre `[data-slot="popover-content"]`. Para llegar a un
    `CampoSelect` sin credenciales, una página de prueba bajo `/login` alcanza:
    `proxy.ts` deja pasar sin sesión todo lo que empieza con `/login`. **Ojo**: una
    carpeta que arranca con `_` es privada en el App Router y no crea ruta.
  - **`overrides` en `package.json`**: `@typescript-eslint/typescript-estree` pide
    `minimatch ^10.2.2` y toda la 10.x tiene un advisory de DoS por globs; el arreglo
    está en la 11. El override la sube a `^11.0.4`.
    - **No hay forma de evitarlo todavía**: la última `typescript-estree` (8.72.1 al
      2026-11-05) sigue declarando `^10.2.2`, así que actualizar no alcanza. Y lo que
      ofrecía `npm audit fix --force` era bajar `eslint-config-next` a 15.5.29, que
      deshacía el parche de seguridad de Next y lo dejaba desalineado con `next`.
    - **Por qué el salto de major no asusta**: `typescript-estree` usa *una* función
      de minimatch, en un solo lugar (`useProgramFromProjectService.js`, la llamada
      `minimatch(filePath, pattern, { dot: true })`), y esa firma no cambió. Lo único
      que la 11 rompe es el soporte de Node 18. Está verificado que las reglas de
      typescript-eslint siguen disparando, no solo que `eslint` termina en 0.
    - Cuando typescript-estree acepte la 11 por su cuenta, el override sobra.
- **Next 16**: `middleware` se llama `proxy` (`proxy.ts` en la raíz). Cache Components
  está apagado a propósito para que valga el flujo clásico con `revalidatePath`.
- **La sesión se verifica con `getClaims()`** (firma ES256 validada en local contra el
  JWKS cacheado, en `proxy.ts` y en `usuarioActual`), nunca con `getSession()`, que no valida
  nada. `cambiarPassword` sigue con `updateUser` + `current_password`.
- **Un solo umbral de semáforo**: `config.umbral_cerca_pct` (default 85). El Excel
  original tenía 0,80 / 0,85 / 0,90 conviviendo.
- **Gráficos**: la paleta del design system reserva verde/ámbar/rojo para el semáforo y
  no tiene dos tonos más que se distingan entre sí, así que los gráficos van de **una
  sola serie**. Si hace falta comparar series, primero hay que sumar colores al sistema.

## Pendiente

Las etapas 0–5 están completas. Lo que queda, con su contexto, vive en
[`docs/PENDIENTES.md`](docs/PENDIENTES.md) — hoy es solo el backup de la base, porque el
plan Free de Supabase no hace backups automáticos.

## Ya hecho (no volver a proponerlo)

- **Deployado en Vercel**, repo privado en `colomarina/control-financiero`.
- **`supabase/seed.sql` no se versiona** (está en `.gitignore`): tiene datos financieros
  reales. Se regenera con `npm run migrar <xlsx>`. `schema.sql` sí va al repo: es DDL puro.
- **Cambio de contraseña** en `/config` (`cambiarPassword` en `app/actions/auth.ts`), que
  valida la actual con `current_password`. No hay signup: el usuario se crea desde el
  dashboard de Supabase.
- **Registro cerrado en Supabase** (2026-11-16): la app no tenía pantalla de alta, pero la
  API de auth sí aceptaba registros. Ahora *Allow new users to sign up* está apagado. Se
  verifica con `GET <SUPABASE_URL>/auth/v1/settings` (header `apikey` = anon key): tiene
  que dar `"disable_signup":true`.
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
- **Editar y borrar un gasto**: ruta `/movimiento/[id]`, a la que se llega tocando un
  movimiento en el Home o en el buscador del Historial.
  - **`FormGasto` es uno solo** para cargar y para editar: con la prop `movimiento` cambia de
    modo. No duplicar el formulario — si se separan, un gasto editado termina cumpliendo
    reglas distintas a uno nuevo. `editarMovimiento` valida con el mismo schema que el alta.
  - Al editar se hace `revalidatePath('/', 'layout')`, no solo `/`: un movimiento puede
    cambiar de mes, de comercio o de forma de pago, y eso mueve topes, predicción, fijos e
    historial a la vez.
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
- **Búsqueda y filtros** en Historial y en el Home: `lib/core/filtros.ts` (puro, con test)
  + el client component `FiltrosMovimientos`, que es **uno solo** para las dos pantallas.
  El Home mira un mes y el Historial todo el histórico, así que la única diferencia es el
  selector de mes: va solo si le pasás `meses`. No duplicar los controles — si se separan,
  buscar significa dos cosas distintas según la pantalla.
  - El estado de los filtros es el tipo `Filtros` (todo string, `''` = sin filtrar) y lo
    traduce `criteriosDe`. Así un `<select>` controlado no tiene que inventar `null`s.
  - Filtra **en el cliente** porque las dos pantallas ya traen los movimientos para sus
    agregados; si algún día son miles de filas, el filtrado se baja a
    `lib/db/movimientos.ts` sin tocar la lógica. El texto se parte en palabras y todas
    tienen que aparecer, aunque sea en campos distintos.
  - En el Home el bloque arranca plegado: lo abre la lupa del encabezado. Plegarlo con un
    filtro puesto no lo esconde —el contador pasa a "12 de 48", aparece el total filtrado
    y la lupa queda en verde—; un mes al que le faltan movimientos sin explicación sería
    el bug.
- **Checklist de fijos**: la fila entera abre su editor, con `FilaEditable` (ver arriba).
  El campo "Facturas por mes" es el que distingue a Personal Flow, que llega en dos.
- **Nada de `<select>` nativo: va `components/CampoSelect.tsx`.** El menú de un select lo
  dibuja el sistema operativo y no se puede vestir —en el escritorio sale con fondo claro y
  el highlight azul de Windows—, que es exactamente el motivo por el que `CampoFecha`
  reemplazó al `<input type="date">`. Mismo patrón: trigger con `campo` + `Popover` +
  contenido nuestro. Lo usan los tres filtros y los campos de comercio y facturas.
  - Antes de volver al nativo: **ya se probó** envolverlo en un `<label>` (tocar la etiqueta
    *enfoca* el select pero no abre el desplegable) y taparlo con una copia en `opacity-0`
    (el menú **hereda la opacidad** y abre encima en vez de abajo). Está anotado en
    `DESIGN_SYSTEM.md`.
  - Las flechas, Home/End y el typeahead son lo que el nativo daba gratis: viven puros y con
    test en `lib/core/selector.ts`. Repetir la misma tecla **cicla**, como el select del
    sistema, y la búsqueda pasa por `normalizar`, así que "nutricion" encuentra "Nutrición".
  - Con `name` manda un input oculto, así que el `FormData` de las actions no cambió. Dos
    consecuencias: ese campo **necesita JS**, y `required` ya no frena el submit —lo frena
    el botón deshabilitado, y la action igual valida con Zod—.
  - Es controlado o no según le pases `valor`. Los formularios que hacen `form.reset()`
    (`AltaFijo`, `AltaLineaPlan`) lo usan **controlado** y limpian el estado a mano:
    `reset()` no toca un componente nuestro, y el comercio quedaba pegado del alta anterior.
- **Atajos de comercio** en Cargar: `lib/core/frecuentes.ts` (puro, con test) ordena por usos
  y desempata por el más reciente. Son **dos**, una sola fila: seis empujaban la forma de pago
  fuera de la pantalla. La pantalla pasa los movimientos de dos meses; si no hay ninguno, la
  grilla no se dibuja y queda el buscador de siempre.
- **Forma de pago**: dos botones con las más usadas (`formasDePagoFrecuentes`, mismo criterio
  que los comercios, siempre devuelve dos) y un `CampoSelect` con las otras tres. En un alta,
  elegir el comercio preselecciona la forma con que se lo pagó la última vez
  (`ultimaFormaPorComercio`); al editar no se toca, porque ya es un dato cargado. Las dos
  salen de **movimientos reales**: una compra en cuotas no es una elección de forma de pago
  que se repita.
- **Importe con el teclado del sistema**: `components/CampoImporte.tsx` sobre
  `lib/core/keypad.ts` (puro, con test). Antes era un teclado propio de 12 teclas en pantalla
  (`Keypad`): ocupaba media pantalla siempre. Ahora es un campo con `inputMode="decimal"`
  que **cancela cada `beforeinput`** y lo traduce con `aplicarEntrada`, así las reglas son las
  mismas que tenía el teclado propio: se tipea en **pesos**, no en centavos (`1500` es $1.500),
  los centavos solo con coma —el punto vale como coma, porque muchos teclados numéricos solo
  traen punto y los miles los pone la pantalla—. El form manda el texto formateado
  (`mostrar()`) y la action lo pasa por `parsearImporte`; ese ida y vuelta está testeado, no
  romperlo.
  - En un alta arranca enfocado (`autoFocus`). En iPhone igual hace falta tocar el monto: Safari
    no abre el teclado sin un toque. Al editar no se enfoca solo, para no tapar el resto.
  - Enter cierra el teclado en vez de mandar el formulario a medio llenar.
- **"Compra puntual" lleva una ⓘ con popover** que explica qué es. Popover y no tooltip:
  en el celular no hay hover.
- **PWA** (etapa 5, primera parte): `app/manifest.ts`, `public/sw.js` + `RegistrarSW`, e
  íconos generados por `npm run iconos` (`scripts/generar-iconos.ts`, PNG a mano con zlib,
  sin dependencias). Los de `public/` los referencia el manifest; los de `app/`
  (`icon.png`, `apple-icon.png`) son convención de Next.
  - El service worker **solo cachea `/_next/static/*`**. Nada de páginas, Server Actions ni
    payloads de RSC: son datos financieros y van siempre a la red.
  - **Al tocar el matcher de `proxy.ts`**, acordarse de que `manifest.webmanifest` y `sw.js`
    tienen que seguir afuera. El navegador los pide por su cuenta —el manifest a veces sin
    cookies— y un redirect al login rompe la instalación.
- **Presupuesto: "Listo" y "Mover plata"**. Gastar justo lo planeado es el estado `completo`
  ("Listo ✓", verde, al fondo de la lista). Y `MoverPlata` pasa lo no gastado del plan de un
  comercio al de otro en el mismo mes —"no hubo fulbito, esa plata fue a la carnicería"—: se
  reescribe el plan, nunca los movimientos. Las reglas viven en `moverPlata`
  (`lib/core/presupuesto.ts`): solo se mueve lo que no se gastó, y el destino puede no estar
  en el plan. Las dos líneas van en un solo upsert (`reescribirLineas`), que es atómico.
- **Compras en cuotas**: la compra se guarda **una sola vez** (`compras_cuotas` + la vista
  `compras_cuotas_detalle`, DDL en `supabase/schema.sql`) y las cuotas **no se guardan
  nunca**: las deriva `lib/core/cuotas.ts` mes a mes, materializadas como objetos que cumplen
  `MovimientoDetalle` más una marca `cuota`. Esa forma es todo el truco: topes, agregados,
  orden y filtros procesan listas mezcladas sin tocarse. **Qué pantalla recibe la lista
  mezclada y cuál no es la regla de la tabla de "Reglas del dominio"**, y es la única de esta
  feature que al violarse informa mal la plata sin que falle nada.
  - **El stepper de Cuotas vive en el único `FormGasto`**, con la prop `compra` como tercer
    modo. Mismo motivo que `movimiento`: dos formularios son dos juegos de reglas que se
    separan con el tiempo. Editando un movimiento suelto el campo directamente no se dibuja
    —convertir una fila de `movimientos` en una compra es otra operación, no una edición—.
  - **Editar y borrar significan cosas distintas, y el texto de la pantalla tiene que
    decirlo.** Bajar un plan de 12 a 3 quiere decir *"lo di de baja, pagué tres"*: las tres
    que ya pasaron quedan en sus meses para siempre y las nueve que faltaban dejan de
    aparecer. **Borrar** quiere decir *"lo cargué mal"*: desaparece todo, incluidas las
    cuotas pasadas. Por eso **no hay estado "cancelado"** — bajar el número ya lo expresa, y
    lo expresa en términos de lo que realmente pasó.
  - Y por eso **el piso del campo Cuotas al editar son las ya transcurridas**
    (`puedeReducirA`, con test): bajar por debajo borraría meses **cerrados** en silencio,
    cambiándoles el total, el gráfico y el promedio, todo presentado como "una cancelación".
    El piso se calcula contra el mes actual, así que el mismo plan tiene distinto mínimo en
    enero y en marzo. El `min` del input es ayuda visual: quien manda es la action.
  - El detalle del plan es `/compra/[id]`, a donde llevan las cuotas al tocarlas
    (`rutaDeMovimiento`, puro y con test, porque lo deciden dos listas distintas). Crear,
    editar o borrar una compra hace `revalidatePath('/', 'layout')`: mueve topes, predicción,
    fijos e historial de varios meses a la vez.
