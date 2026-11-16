# Pendientes

Lo que queda. Cada tarea trae el contexto necesario para retomarla sin releer todo el
proyecto.

Lo ya terminado (etapas 0–4, deploy, cambio de contraseña, registro cerrado) está en el
`CLAUDE.md` de la raíz.

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

## 0.1 Correr la migración de `compras_cuotas` ✅

Hecha el 4/11/2026: la tabla, sus índices, su política de RLS y la vista
`compras_cuotas_detalle` ya existen en la base. Queda anotado acá hasta que la
rama `compras-en-cuotas` se mergee, porque la base ya tiene la tabla y el
código que la usa todavía no está en `master`.

---

## 0.2 Correr la migración `movimientos_puntual` ✅

Hecha el 16/11/2026 (migración `movimientos_puntual`): la columna `puntual` y la vista
`movimientos_detalle` con `m.puntual` al final ya existen en la base. Queda anotado acá
hasta que la rama `seguridad-y-prediccion` se mergee. Es aditivo (columna nullable, columna
al final de la vista), así que el código de `master` sigue andando con la base migrada.

```sql
alter table movimientos add column if not exists puntual boolean;

create or replace view movimientos_detalle
with (security_invoker = true) as
select
  m.id, m.user_id, m.fecha, to_char(m.fecha, 'YYYY-MM') as mes,
  m.importe_centavos, m.forma_pago, m.banco, m.tarjeta, m.nota, m.created_at,
  c.id as comercio_id, c.nombre as comercio, c.categoria, c.subcategoria, c.es_fijo,
  m.puntual
from movimientos m
join comercios c on c.id = m.comercio_id;
```

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

## 2. Actualizar Next.js por el aviso de seguridad 🟠

`npm run build` corta la primera corrida con un `SecurityFatalError` de Next.js
avisando de una vulnerabilidad conocida en la **16.4.0**, que es la versión que
tiene el proyecto. En la segunda corrida compila igual, así que no frena el
desarrollo — pero la app está deployada en Vercel y es pública.

**Qué hacer.** `next upgrade --agent=security`, que es lo que sugiere el propio
mensaje, y después correr la suite entera: el proyecto usa App Router, Server
Actions y `proxy.ts` (el `middleware` renombrado de Next 16), que es donde un
salto de versión suele doler.

**Por qué no se hizo en el momento**: apareció en medio de la rama de cuotas, y
mezclar un salto de framework con una feature a medio hacer convierte cualquier
falla en una pregunta sin respuesta. Va sola, con la rama limpia.

**Criterio de listo**: `npm run build` sin el aviso, `npm test` en verde, y la
app levantando en local con el login, cargar un gasto y el Home andando.

---

## Descartado

- **Export a CSV.** Se evaluó y no interesa: para mirar los datos ya está el buscador del
  Historial, y el respaldo lo resuelve el punto 1, que sí restaura la base.
