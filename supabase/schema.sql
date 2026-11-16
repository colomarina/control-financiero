-- ============================================================================
-- Control Financiero — DDL
-- Pegar entero en el SQL Editor de Supabase. Es idempotente: se puede re-correr.
--
-- Modelado a partir del Excel "Control_Financiero.xlsx" (hojas Movimientos,
-- Categorias, Gastos Fijos, Historial Presupuestos y Configuracion).
--
-- Principio: la base guarda HECHOS. Ningún cálculo se persiste.
--   - El mes sale de la fecha (no hay columna `mes` en movimientos).
--   - Categoría / subcategoría / es_fijo salen del comercio (no se copian).
--   - Si un gasto fijo está pagado se DERIVA de los movimientos del mes
--     (por eso no hay tabla de tildes).
--   - Todo importe es BIGINT en CENTAVOS. Nunca numeric, nunca float.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- Tipos
-- ----------------------------------------------------------------------------
-- Las cinco formas de pago que ya usabas en el Excel.
-- Contra qué tope pesa cada una se define en la app (lib/core/gastos.ts):
--   tope tarjeta  = tarjeta_credito + tarjeta_debito + debito_automatico
--   tope efectivo = efectivo + transferencia
do $$ begin
  create type forma_pago as enum (
    'tarjeta_credito',
    'tarjeta_debito',
    'debito_automatico',
    'transferencia',
    'efectivo'
  );
exception when duplicate_object then null; end $$;

-- ----------------------------------------------------------------------------
-- comercios — el catálogo (hoja "Categorias").
-- De acá salen categoría, subcategoría y es_fijo.
-- ----------------------------------------------------------------------------
create table if not exists comercios (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null default auth.uid() references auth.users(id) on delete cascade,
  nombre        text not null,
  categoria     text not null,
  subcategoria  text,
  es_fijo       boolean not null default false,
  activo        boolean not null default true,
  created_at    timestamptz not null default now(),
  constraint comercios_nombre_no_vacio check (length(trim(nombre)) > 0)
);

-- Un comercio no se repite por usuario (case-insensitive).
create unique index if not exists comercios_user_nombre_uq
  on comercios (user_id, lower(nombre));

create index if not exists comercios_user_activo_ix
  on comercios (user_id, activo) where activo;

-- ----------------------------------------------------------------------------
-- movimientos — el hecho central (hoja "Movimientos").
--
-- `fecha` es DATE (sin hora, sin zona): un gasto del 30/09 a las 23:00 es del
-- 30/09 aunque el server corra en UTC.
--
-- `banco` y `tarjeta` son descriptivos (Galicia/Santander/Mercado Pago/FCI,
-- Visa/Mastercard/Amex). No entran en el cálculo de topes: eso lo define
-- `forma_pago`. Van como texto libre para que agregar un banco no sea una
-- migración.
-- ----------------------------------------------------------------------------
create table if not exists movimientos (
  id                uuid primary key default gen_random_uuid(),
  user_id           uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha             date not null,
  comercio_id       uuid not null references comercios(id) on delete restrict,
  importe_centavos  bigint not null,
  forma_pago        forma_pago not null,
  banco             text,
  tarjeta           text,
  nota              text,
  created_at        timestamptz not null default now(),
  constraint movimientos_importe_positivo check (importe_centavos > 0)
);

-- `puntual`: marca manual de compra puntual (no recurrente). null = lo decide la
-- app; true/false = el usuario lo forzó. Idempotente para bases ya creadas.
alter table movimientos add column if not exists puntual boolean;

-- El índice que pide la consulta de todas las pantallas: "los movimientos del mes".
create index if not exists movimientos_user_fecha_ix
  on movimientos (user_id, fecha desc);

create index if not exists movimientos_comercio_ix
  on movimientos (comercio_id);

-- ----------------------------------------------------------------------------
-- presupuesto — el plan por comercio y por mes (hoja "Historial Presupuestos").
-- La hoja "Presupuesto" del Excel es la vista: plan vs real. Eso lo calcula la app.
-- ----------------------------------------------------------------------------
create table if not exists presupuesto (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid not null default auth.uid() references auth.users(id) on delete cascade,
  mes                text not null,
  comercio_id        uuid not null references comercios(id) on delete cascade,
  planeado_centavos  bigint not null default 0,
  created_at         timestamptz not null default now(),
  constraint presupuesto_mes_formato check (mes ~ '^\d{4}-\d{2}$'),
  constraint presupuesto_planeado_no_negativo check (planeado_centavos >= 0)
);

create unique index if not exists presupuesto_user_mes_comercio_uq
  on presupuesto (user_id, mes, comercio_id);

-- ----------------------------------------------------------------------------
-- gastos_fijos — el checklist recurrente (hoja "Gastos Fijos").
--
-- NO hay tabla de "pagado". Un fijo está pagado si su comercio aparece en los
-- movimientos del mes, igual que en el Excel: el hecho es el movimiento.
--
-- `pagos_esperados` son las facturas que llegan por mes: casi siempre una,
-- dos para Personal Flow (una línea por persona). El estado del checklist se
-- cuenta en facturas y no en plata, porque el monto lo decide el proveedor:
-- la luz a 85.000 cuando se esperaban 90.000 está PAGA, no a medias.
--
-- `vencimiento` es texto porque en el Excel hay valores como "Día 1 y 28".
-- ----------------------------------------------------------------------------
create table if not exists gastos_fijos (
  id                        uuid primary key default gen_random_uuid(),
  user_id                   uuid not null default auth.uid() references auth.users(id) on delete cascade,
  comercio_id               uuid not null references comercios(id) on delete cascade,
  importe_estimado_centavos bigint not null default 0,
  pagos_esperados           smallint not null default 1,
  vencimiento               text,
  activo                    boolean not null default true,
  created_at                timestamptz not null default now(),
  constraint gastos_fijos_estimado_no_negativo check (importe_estimado_centavos >= 0)
);

-- Si la tabla ya existía, el `create table if not exists` de arriba no la toca:
-- la columna se suma acá. Los fijos viejos quedan en una factura por mes.
alter table gastos_fijos
  add column if not exists pagos_esperados smallint not null default 1;

do $$ begin
  alter table gastos_fijos
    add constraint gastos_fijos_pagos_esperados_valido check (pagos_esperados between 1 and 12);
exception when duplicate_object then null; end $$;

create unique index if not exists gastos_fijos_user_comercio_uq
  on gastos_fijos (user_id, comercio_id);

-- Si venís de una versión anterior de este schema, la tabla de tildes ya no va.
drop table if exists gastos_fijos_pagos;

-- ----------------------------------------------------------------------------
-- compras_cuotas — una compra en cuotas, guardada una sola vez.
--
-- Lo que se guarda es el importe DE LA CUOTA y la cantidad, nunca el total: es
-- lo que el usuario sabe con certeza ("12 cuotas de $48.500"), y con interés
-- el total ÷ 12 no coincide con lo que cobran. Las cuotas individuales no son
-- filas acá: se derivan mes a mes en `lib/core/cuotas.ts`, igual que un gasto
-- fijo no tiene tabla de tildes y se deriva de los movimientos del mes.
-- ----------------------------------------------------------------------------
create table if not exists compras_cuotas (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null default auth.uid() references auth.users(id) on delete cascade,
  fecha                   date not null,
  comercio_id             uuid not null references comercios(id) on delete restrict,
  importe_cuota_centavos  bigint not null,
  cuotas                  smallint not null,
  forma_pago              forma_pago not null,
  banco                   text,
  tarjeta                 text,
  nota                    text,
  created_at              timestamptz not null default now(),
  constraint compras_cuotas_importe_positivo check (importe_cuota_centavos > 0),
  constraint compras_cuotas_cantidad_valida check (cuotas between 2 and 48)
);

create index if not exists compras_cuotas_user_fecha_ix on compras_cuotas (user_id, fecha desc);
create index if not exists compras_cuotas_comercio_ix on compras_cuotas (comercio_id);

-- ----------------------------------------------------------------------------
-- config — los parámetros (hoja "Configuracion"). Una sola fila por usuario.
-- ----------------------------------------------------------------------------
create table if not exists config (
  user_id                       uuid primary key default auth.uid() references auth.users(id) on delete cascade,

  -- Topes mensuales (hoja Configuracion C14 / C15)
  tope_tarjeta_centavos         bigint not null default 0,
  tope_efectivo_centavos        bigint not null default 0,

  -- Contexto (hoja Configuracion C5 / C6 / C8 / C9)
  sueldo_centavos               bigint not null default 0,
  objetivo_gasto_mensual_centavos bigint not null default 0,
  objetivo_ahorro_usd           integer not null default 0,
  cotizacion_usd_centavos       bigint not null default 0,

  -- A partir de qué % del tope la barra pasa a "cerca".
  -- Unifica los tres umbrales que convivían en el Excel (0,80 / 0,85 / 0,90).
  umbral_cerca_pct              smallint not null default 85,

  -- En desuso desde 2026-11; se deja para no migrar. La predicción ya no mira un
  -- día fijo: mezcla el ritmo del mes con el histórico (ver lib/core/prediccion.ts).
  umbral_dia                    smallint not null default 10,

  -- Cuántos meses cerrados mira el promedio histórico (para el arranque del mes).
  meses_historico               smallint not null default 3,

  updated_at                    timestamptz not null default now(),

  constraint config_topes_no_negativos check (
    tope_tarjeta_centavos >= 0 and tope_efectivo_centavos >= 0),
  constraint config_contexto_no_negativo check (
    sueldo_centavos >= 0 and objetivo_gasto_mensual_centavos >= 0
    and objetivo_ahorro_usd >= 0 and cotizacion_usd_centavos >= 0),
  constraint config_umbral_cerca_valido check (umbral_cerca_pct between 1 and 100),
  constraint config_umbral_dia_valido check (umbral_dia between 1 and 28),
  constraint config_historico_valido check (meses_historico between 1 and 24)
);

-- ============================================================================
-- Row Level Security
-- La anon key de Supabase viaja al browser, así que sin RLS la tabla es pública.
-- Cada fila es visible solo para su dueño.
-- ============================================================================
alter table comercios      enable row level security;
alter table movimientos    enable row level security;
alter table presupuesto    enable row level security;
alter table gastos_fijos   enable row level security;
alter table config         enable row level security;
alter table compras_cuotas enable row level security;

do $$
declare t text;
begin
  foreach t in array array['comercios', 'movimientos', 'presupuesto', 'gastos_fijos', 'config', 'compras_cuotas']
  loop
    execute format('drop policy if exists %I on %I', t || '_propias', t);
    execute format(
      'create policy %I on %I for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid())',
      t || '_propias', t
    );
  end loop;
end $$;

-- ============================================================================
-- Vista de conveniencia (lectura; NO calcula agregados — eso lo hace la app).
-- Resuelve el join movimiento -> comercio para no repetirlo en cada query.
-- `security_invoker` hace que la vista respete el RLS de quien la consulta.
-- ============================================================================
create or replace view movimientos_detalle
with (security_invoker = true) as
select
  m.id,
  m.user_id,
  m.fecha,
  to_char(m.fecha, 'YYYY-MM') as mes,
  m.importe_centavos,
  m.forma_pago,
  m.banco,
  m.tarjeta,
  m.nota,
  m.created_at,
  c.id            as comercio_id,
  c.nombre        as comercio,
  c.categoria,
  c.subcategoria,
  c.es_fijo,
  -- Al final: `create or replace view` solo permite agregar columnas al final.
  m.puntual
from movimientos m
join comercios c on c.id = m.comercio_id;

-- ----------------------------------------------------------------------------
-- Vista de conveniencia para compras en cuotas, espejo de `movimientos_detalle`.
-- Resuelve el join con comercios; las cuotas en sí no son filas, las deriva
-- `lib/core/cuotas.ts` a partir de esta compra.
-- ----------------------------------------------------------------------------
create or replace view compras_cuotas_detalle
with (security_invoker = true) as
select
  cc.id,
  cc.user_id,
  cc.fecha,
  cc.importe_cuota_centavos,
  cc.cuotas,
  cc.forma_pago,
  cc.banco,
  cc.tarjeta,
  cc.nota,
  cc.created_at,
  c.id            as comercio_id,
  c.nombre        as comercio,
  c.categoria,
  c.subcategoria,
  c.es_fijo
from compras_cuotas cc
join comercios c on c.id = cc.comercio_id;
