# Pendientes

Lo que queda, en orden de lo que más conviene atacar primero. Una por vez: cada tarea tiene
el contexto necesario para retomarla sin releer todo el proyecto.

Lo ya terminado (etapas 0–4, deploy, cambio de contraseña) está en `CLAUDE.md`.

---

## 1. Backup de la base 🔴

**Por qué primero.** El plan Free de Supabase **no tiene backups automáticos ni
point-in-time recovery** — eso arranca en el plan Pro. Hasta ahora el respaldo real era el
Excel; al dejarlo de usar, la base de Supabase queda como copia única de todo el historial.

**Qué hacer.** Un `npm run backup` que exporte la base a un `.sql` con fecha en el nombre,
fuera del repo (el dump tiene los mismos datos reales que `seed.sql`, así que **no se
versiona**).

- Vía recomendada por Supabase: `supabase db dump` (CLI).
- Guardar los dumps en una carpeta ignorada por git y copiarlos a Drive/Dropbox.
- Decidir cada cuánto: una vez por mes alcanza si los movimientos se cargan al día.

**Criterio de listo**: corrés un comando, te queda un archivo, y restaurarlo en una base
vacía reconstruye todo.

---

## 2. Elegir el comercio sin teclear

**Por qué.** Con el teclado numérico, el importe ya se carga sin que aparezca el teclado del
sistema — pero el campo Comercio sigue siendo un input de texto, así que al tocarlo el
teclado aparece igual y se come media pantalla. Es lo único que falta para que cargar un
gasto sean tres taps de verdad.

**Qué hacer.** Reemplazar (o anteponer) al input una grilla con los comercios más usados del
último mes, como chips grandes. El input queda abajo como salida de escape para los que no
están en la grilla.

- "Más usados" es un cálculo sobre los movimientos: va en `lib/core`, puro y con test.
- Ojo con el alta de comercios nuevos: hoy se hace desde Config, no desde esta pantalla.

**Criterio de listo**: cargar un gasto habitual sin que aparezca el teclado del sistema en
ningún momento.

---

## 3. Búsqueda y filtros en Historial

**Qué hacer.** Buscar por comercio o nota, y filtrar por categoría, forma de pago y rango de
fechas. La lógica de filtrado va en `lib/core` (pura, con test); la pantalla solo la usa.

**Ojo**: el filtrado conviene hacerlo en el repositorio (`lib/db/movimientos.ts`) si el
volumen crece — con un año de movimientos todavía entra cómodo en memoria.

---

## 4. Export

**Qué hacer.** Bajar los movimientos de un mes (o del año) a CSV. Sirve para abrir en Excel
cuando haga falta cruzar algo a mano, y es un respaldo más, aunque no reemplaza el punto 1:
el CSV no restaura la base.

---

## 5. Limpieza menor

- `lib/core/fijos.test.ts` usa importes reales como fixtures (OSDE $569.995, EDELAP $69.588).
  Hacen los tests legibles y el repo es privado, así que no urge — pero si alguna vez se hace
  público, cambiarlos por números inventados.
