# Arquitectura de Desarrollo — App Control Financiero

Guía técnica para construir la app con **Claude Code**. Pensada como referencia estable:
abrila al lado mientras desarrollás y pedile a Claude Code una pieza por vez.

**Stack cerrado**: Next.js (App Router) + TypeScript + Supabase (Postgres + auth) +
Tailwind + shadcn/ui + Zod + Vitest + date-fns. Deploy en Vercel. Un solo usuario (vos).

---

## Decisiones de arquitectura (cerradas)

| # | Decisión            | Elegido                                                        |
|---|---------------------|---------------------------------------------------------------|
| 1 | Estructura          | Híbrida: rutas/UI en `/app`, lógica pura en `/lib/core`, datos en `/lib/db` |
| 2 | Acceso a datos      | Capa repositorio sobre supabase-js (`/lib/db/*`)              |
| 3 | Validación          | Zod (esquemas = fuente de tipos)                              |
| 4 | Testing             | Vitest sobre `/lib/core` (lógica pura)                        |
| 5 | UI                  | Tailwind + shadcn/ui                                          |
| 6 | Fechas / plata      | date-fns; plata como **entero en centavos**                  |

**Principio rector**: la base guarda **hechos** (movimientos); la app **deriva** las vistas.
Ningún cálculo se persiste. El mes sale de la fecha, la categoría sale del comercio.

**Regla de la plata**: todo importe se guarda y se opera como **entero de centavos**
(`150000` = $1.500,00). Se convierte a pesos solo al mostrar. Nunca float en cálculos.

---

## Estructura de carpetas

```
control-financiero/
├── app/                          # Next.js App Router (rutas + UI)
│   ├── (app)/                    # grupo con layout principal (navbar mobile)
│   │   ├── page.tsx              # HOME · "Este mes"
│   │   ├── cargar/page.tsx       # Cargar movimiento
│   │   ├── presupuesto/page.tsx  # Presupuesto vs real
│   │   ├── historial/page.tsx    # Meses cerrados + evolución
│   │   ├── fijos/page.tsx        # Checklist gastos fijos
│   │   └── config/page.tsx       # Parámetros + catálogo comercios
│   ├── actions/                  # Server Actions (escritura)
│   │   ├── movimientos.ts
│   │   ├── presupuesto.ts
│   │   ├── comercios.ts
│   │   └── config.ts
│   ├── layout.tsx
│   └── globals.css
│
├── lib/
│   ├── core/                     # ⭐ LÓGICA PURA (sin DB, sin React) — testeable
│   │   ├── dinero.ts             # centavos ↔ pesos, formateo ARS
│   │   ├── fechas.ts             # mes de una fecha, días del mes, día actual
│   │   ├── topes.ts              # estado OK/Cerca/Excedido
│   │   ├── gastos.ts             # gastoTarjetaMes, gastoEfectivoMes, porCategoria, porComercio
│   │   ├── prediccion.ts         # método B+E completo
│   │   ├── presupuesto.ts        # presupuestoVsReal
│   │   └── *.test.ts             # tests Vitest al lado de cada archivo
│   │
│   ├── db/                       # CAPA REPOSITORIO (envuelve supabase-js)
│   │   ├── client.ts             # crea cliente Supabase (server)
│   │   ├── movimientos.ts        # getMovimientos(mes), crearMovimiento(...), etc.
│   │   ├── comercios.ts
│   │   ├── presupuesto.ts
│   │   ├── gastosFijos.ts
│   │   └── config.ts
│   │
│   ├── schemas/                  # Zod: validación + tipos derivados
│   │   ├── movimiento.ts
│   │   ├── comercio.ts
│   │   ├── presupuesto.ts
│   │   └── config.ts
│   │
│   └── types.ts                  # tipos compartidos (derivados de Zod)
│
├── components/
│   ├── ui/                       # shadcn/ui (generados)
│   └── ...                       # componentes propios (BarraTope, FormGasto, etc.)
│
├── supabase/
│   ├── schema.sql                # DDL de las tablas (pegar en Supabase)
│   └── seed.sql                  # datos iniciales (migración desde Excel)
│
├── scripts/
│   └── migrar-excel.ts           # exporta el Excel actual a seed.sql / inserts
│
└── (config: tailwind, tsconfig, vitest.config, etc.)
```

**Por qué esta forma con Claude Code**: cada tipo de cosa tiene un lugar único y predecible.
Cuando le pedís "agregá X", sabe exactamente dónde va la lógica, dónde la query, dónde el test.

---

## Flujo de datos (cómo se conecta todo)

```
Usuario (celular)
    │
    ▼
Página (Server Component en /app)  ──lee──►  /lib/db/*  ──►  Supabase
    │                                           ▲
    │ pasa datos crudos                         │
    ▼                                           │
/lib/core/* (calcula vistas: topes, predicción)│
    │                                           │
    ▼                                           │
Componentes UI (muestran)                       │
    │                                           │
    │ usuario carga/edita                       │
    ▼                                           │
Server Action (/app/actions)  ──valida Zod──► escribe vía /lib/db ──► Supabase
    │
    ▼
revalidatePath() → la página se refresca sola
```

Lectura: Server Component → repositorio → core → UI.
Escritura: UI → Server Action (valida con Zod) → repositorio → `revalidatePath`.
Sin fetch del cliente, sin API routes a mano. Type-safe de punta a punta.

---

## Convenciones para Claude Code

Poné esto en un `CLAUDE.md` en la raíz del repo (Claude Code lo lee solo):

- **`/lib/core` es sagrado**: funciones puras, sin imports de Supabase, React ni Next.
  Entra data, sale data. Cada archivo con su `.test.ts` al lado.
- **Plata siempre en centavos** (enteros). Conversión a pesos solo en la capa de presentación
  (`dinero.ts` tiene `aPesos()` y `formatoARS()`).
- **Nada de cálculos en la base ni en SQL**: Postgres guarda filas, la app calcula.
- **Acceso a datos solo por `/lib/db`**: ninguna página ni action llama a supabase-js directo.
- **Validar todo input con Zod** en la Server Action antes de escribir.
- **Mobile-first**: estilos pensados para pantalla de celular vertical primero.
- **Derivados, no guardados**: mes = `to_char(fecha,'YYYY-MM')`; categoría/subcat/es_fijo vienen del comercio.

---

## Orden de construcción (pedile a Claude Code una etapa por vez)

### Etapa 0 — Andamiaje
1. `create-next-app` con TS + Tailwind + App Router.
2. Instalar shadcn/ui, Zod, Vitest, date-fns, supabase-js.
3. Crear proyecto Supabase; correr `supabase/schema.sql`; activar auth magic link.
4. `/lib/core/dinero.ts` y `fechas.ts` con sus tests (lo más fácil, para validar el setup de Vitest).
> Entregable: la app levanta, los tests corren verdes.

### Etapa 1 — Movimientos (el corazón)
1. Schemas Zod de movimiento y comercio.
2. Repositorio `/lib/db/movimientos.ts` y `comercios.ts`.
3. `/lib/core/gastos.ts` + tests.
4. Server Action `crearMovimiento`.
5. Pantalla **Cargar** (autocomplete comercio + importe + chips forma de pago).
6. **Home** con las dos barras de topes + lista de movimientos del mes.
> Entregable: cargás gastos del cel y ves cómo venís vs topes. Ya la usás en paralelo al Excel.

### Etapa 2 — Predicción
1. `/lib/core/prediccion.ts` con método B+E + tests (casos: antes del umbral, después, sin histórico).
2. Mostrar cierre estimado / aviso temprano en el Home.
> Entregable: la predicción B+E en código limpio y testeado.

### Etapa 3 — Presupuesto
1. Schema + repositorio de presupuesto.
2. `/lib/core/presupuesto.ts` (plan vs real por comercio) + tests.
3. Pantalla Presupuesto con selector de mes objetivo.
> Entregable: reemplaza las hojas Presupuesto + Historial.

### Etapa 4 — Historial, fijos y gráficos
1. Resumen mensual + evolución (Recharts).
2. Checklist de gastos fijos.
> Entregable: la app cubre todo el Excel. Migrás del todo.

### Etapa 5 — Pulido
- PWA (instalable en el cel), búsqueda, filtros, export.

---

## Lógica de `/lib/core` — firmas de referencia

```ts
// dinero.ts
aPesos(centavos: number): number
formatoARS(centavos: number): string          // "$1.500"

// fechas.ts
mesDe(fecha: Date): string                     // "2026-09"
diasDelMes(mes: string): number
diaActual(hoy?: Date): number

// topes.ts
type EstadoTope = 'ok' | 'cerca' | 'excedido'
estadoTope(gastado: number, tope: number): EstadoTope   // cerca > 85%

// gastos.ts
gastoTarjetaMes(movs: Movimiento[], mes: string): number
gastoEfectivoMes(movs: Movimiento[], mes: string): number
gastoPorComercio(movs: Movimiento[], mes: string): Map<string, number>

// prediccion.ts
promedioHistoricoDiario(movs: Movimiento[], mesActual: string, nMeses?: number): number
prediccionCierre(args: {
  gastadoReal: number; fijosPendientes: number; promHistorico: number;
  diaActual: number; diasMes: number; umbralDia: number;
}): { status: 'temprano'; mensaje: string }
 | { status: 'proyeccion'; optimista: number; normal: number; pesimista: number }

// presupuesto.ts
presupuestoVsReal(plan: Presupuesto[], movs: Movimiento[], mes: string): FilaPresupuesto[]
```

Todas reciben data y devuelven data: se testean sin levantar nada.

---

## Próximos entregables que te puedo armar

1. **`schema.sql`** completo (tablas Supabase listas para pegar).
2. **Script de migración** del Excel actual → inserts/seed.
3. **`CLAUDE.md`** con las convenciones de arriba, listo para la raíz del repo.
4. Arrancar la **Etapa 0** juntos.
