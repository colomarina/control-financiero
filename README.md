# Control Financiero

App web personal (un solo usuario) para trackear finanzas mensuales. Mobile-first: la acción
principal es cargar un gasto desde el celular en 3 taps.

Reemplaza al Excel `Control_Financiero.xlsx`. La base guarda **hechos** (movimientos, comercios,
plan); todo lo demás —topes, predicción de cierre, si un fijo está pagado— lo deriva la app.

**Stack**: Next.js 16 (App Router) · TypeScript · Supabase (Postgres + auth) · Tailwind v4 ·
Zod · Vitest · Recharts. Deploy en Vercel.

Documentación: [`ARQUITECTURA_APP_FINANZAS.md`](./ARQUITECTURA_APP_FINANZAS.md) ·
[`DESIGN_SYSTEM.md`](./DESIGN_SYSTEM.md) · [`CLAUDE.md`](./CLAUDE.md)

---

## Levantar el proyecto de cero

### 1. Supabase

1. Crear un proyecto en [supabase.com](https://supabase.com).
2. SQL Editor → pegar entero [`supabase/schema.sql`](./supabase/schema.sql) y correrlo.
   Es idempotente: se puede re-correr sin romper nada. Crea las tablas, los índices,
   el RLS (cada fila visible solo para su dueño) y la vista `movimientos_detalle`.
3. **Crear el usuario a mano**: Authentication → Users → *Add user* → mail + contraseña.
   La app **no tiene signup**: es de un solo usuario y el alta se hace acá.

### 2. Variables de entorno

```bash
cp .env.example .env.local
```

Los dos valores salen de Project Settings → Data API / API Keys:

| Variable | De dónde sale |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | anon / public key |

La anon key viaja al browser — es correcto que sea pública, lo que protege los datos es el RLS
del `schema.sql`. La `service_role` key no se usa en ningún lado y no debe entrar al repo.

### 3. Correr

```bash
npm install
npm run dev      # http://localhost:3000
```

### 4. Importar el Excel (opcional, una sola vez)

```bash
npm run migrar "ruta/al/Control_Financiero.xlsx"   # genera supabase/seed.sql
```

Después pegar el `seed.sql` resultante en el SQL Editor. Requiere que el usuario ya exista en
`auth.users` (paso 1.3) y aborta si ya hay movimientos cargados, así que no duplica nada.

El script no usa dependencias: lee el `.xlsx` como ZIP con `zlib`.

---

## Comandos

| Comando | Qué hace |
|---|---|
| `npm run dev` | Servidor de desarrollo |
| `npm run build` | Build de producción |
| `npm test` | Tests de `lib/core` (Vitest) |
| `npm run test:watch` | Tests en watch |
| `npm run lint` | ESLint |
| `npm run migrar <xlsx>` | Genera `supabase/seed.sql` desde el Excel |
| `npm run iconos` | Regenera los íconos de la PWA (solo si cambian los colores) |

---

## Estructura

```
app/(app)/…        rutas y UI (home, cargar, presupuesto, historial, fijos, config)
app/actions/…      Server Actions — toda escritura valida con Zod acá
lib/core/…         lógica pura + tests (dinero, fechas, topes, gastos, fijos,
                   predicción, presupuesto, historial). Sin imports de React ni Supabase.
lib/db/…           único lugar que habla con supabase-js
lib/schemas/…      Zod (la validación es la fuente de los tipos)
components/…       UI propia; `ds.tsx` son las piezas del design system
supabase/…         schema.sql (DDL). El seed.sql que genera `migrar` no se versiona.
proxy.ts           auth: refresca sesión y manda al login (en Next 16 el middleware se llama así)
```

Dos reglas que conviene no olvidar:

- **Todo importe es un entero de centavos.** `150000` son $1.500,00. Se convierte a pesos solo
  al mostrar (`lib/core/dinero.ts`). Nunca float en un cálculo.
- **"Hoy" se resuelve con `hoyISO()` / `diaActual()`** (`lib/core/fechas.ts`), que anclan a
  Buenos Aires. Vercel corre en UTC: con `new Date()` un gasto de las 22:00 se iría al día
  siguiente.

---

## Deploy

Vercel → importar el repo → cargar `NEXT_PUBLIC_SUPABASE_URL` y `NEXT_PUBLIC_SUPABASE_ANON_KEY`
en Environment Variables. No hace falta nada más.

---

## Estado

Etapas 0–4 completas: movimientos, topes, predicción B+E, presupuesto, historial, fijos y
gráficos. Pendiente la etapa 5 (PWA, búsqueda, filtros, export).

> `supabase/seed.sql` **no se versiona**: contiene datos financieros reales (sueldo, topes,
> movimientos) y está en el `.gitignore`. Se regenera cuando haga falta con `npm run migrar`.
> El respaldo de esos datos es el Excel original, no el repo.
