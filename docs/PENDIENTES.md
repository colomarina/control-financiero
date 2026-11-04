# Pendientes

Lo que queda. Cada tarea trae el contexto necesario para retomarla sin releer todo el
proyecto.

Lo ya terminado (etapas 0–4, deploy, cambio de contraseña) está en el `CLAUDE.md` de la raíz.

---

## 0. Correr la migración de `pagos_esperados` 🟡

Una sola vez, en el SQL Editor de Supabase. El checklist de fijos ahora cuenta facturas,
y la columna no existe en la base vieja:

```sql
alter table gastos_fijos
  add column if not exists pagos_esperados smallint not null default 1;

do $$ begin
  alter table gastos_fijos
    add constraint gastos_fijos_pagos_esperados_valido check (pagos_esperados between 1 and 12);
exception when duplicate_object then null; end $$;
```

(También está en `supabase/schema.sql`, que se puede re-correr entero: es idempotente.)

Después, en `/fijos`, abrir **Personal Flow** y ponerle **2 facturas por mes**. El resto
queda en 1, que es el default. Hasta que la migración corra, la app no se rompe —
`lib/db/gastosFijos.ts` lee `pagos_esperados ?? 1`— pero Personal Flow va a figurar pagado
con una sola factura.

**Criterio de listo**: Personal Flow con una sola factura cargada dice `Parcial · falta 1 factura`.

---

## 0.1 Correr la migración de `compras_cuotas` 🟡

Una sola vez, en el SQL Editor de Supabase. La tabla, sus índices y la vista
`compras_cuotas_detalle` son nuevos y no existen en la base vieja: pegar
`supabase/schema.sql` entero y ejecutarlo (es idempotente, se puede re-correr
las veces que haga falta — ya tiene adentro la migración del punto 0).

**Criterio de listo**: insertar una compra de prueba desde el SQL Editor y que
`getComprasEnCuotas()` (`lib/db/cuotas.ts`) la devuelva.

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

## Descartado

- **Export a CSV.** Se evaluó y no interesa: para mirar los datos ya está el buscador del
  Historial, y el respaldo lo resuelve el punto 1, que sí restaura la base.
