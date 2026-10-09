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

## 2. Teclado numérico para el importe

**Por qué.** El `DESIGN_SYSTEM.md` describe una pantalla `keypad-digits` que nunca se
construyó: hoy el importe se carga con un input grande y el teclado del sistema. Es
justamente la pantalla del "3 taps".

**Qué hacer.** Traducir el mockup del design system a un componente React. El estado es un
string de dígitos que se formatea a pesos al vuelo; el valor sale en centavos, así que no hay
coma ni redondeo que manejar (ver `lib/core/dinero.ts`).

**Criterio de listo**: cargar un gasto sin que aparezca el teclado del sistema.

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
