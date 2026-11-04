# Compras en cuotas — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cargar una compra en cuotas una sola vez y que su cuota aparezca sola cada mes, identificada `6/12`, pesando contra el tope y sin distorsionar la predicción.

**Architecture:** La compra es un hecho nuevo en su propia tabla (`compras_cuotas`). Las cuotas no se guardan: un módulo puro las deriva mes a mes y las **materializa en memoria como objetos que cumplen `MovimientoDetalle`**, con una marca extra. Por eso todo `lib/core` (topes, agregados, filtros, historial) las procesa sin tocarse; las páginas deciden a quién le pasan la lista mezclada y a quién solo los movimientos reales.

**Tech Stack:** Next 16 (App Router) · TypeScript · Supabase (Postgres) · Zod 4 · Vitest 5 · Tailwind v4 CSS-first.

**Spec:** [`docs/superpowers/specs/2026-11-04-compras-en-cuotas-design.md`](../specs/2026-11-04-compras-en-cuotas-design.md)

## Global Constraints

- El `CLAUDE.md` de la raíz manda sobre todo lo de acá, incluido su checklist de cierre.
- `lib/core/*` es puro: sin Supabase, sin React, sin Next. Cada archivo con su `.test.ts` al lado.
- Acceso a datos solo por `lib/db/*`. Ninguna página llama a supabase-js.
- Todo importe es entero de centavos. Se formatea solo al mostrar, con `formatoARS`.
- Todo input se valida con Zod en la Server Action antes de escribir.
- Fechas: solo `lib/core/fechas.ts`. **Nunca `new Date(iso)` ni `toISOString()`.**
- Solo tokens del `@theme` de `app/globals.css` y piezas de `components/ds.tsx`. Si falta un color, preguntar.
- Dark mode siempre, mobile-first, `max-w-md`. Cada ruta nueva con su `loading.tsx` propio.
- Nada de `<select>` nativo: va `components/CampoSelect.tsx`.
- Crear, editar o borrar una compra hace `revalidatePath('/', 'layout')`.
- Rango de `cuotas`: **2 a 48**, en la constraint de Postgres y en el Zod.
- **Dos pantallas no cambian, a propósito**, y ninguna tarea las toca: `/presupuesto` (usa `getMovimientosDelMes`, nunca ve una cuota — el presupuesto es la plata que se separa en efectivo y transferencias) y los atajos de comercio de `/cargar` (`comerciosFrecuentes` ordena por cantidad de usos, y una compra de doce meses se clavaría arriba de la grilla un año entero). Si al terminar alguna de las dos recibe cuotas, es un bug.
- El repo no tiene testing de componentes React ni de la capa `lib/db`. Las tareas de UI y de repositorio se verifican con `npm run lint` y `npm run build`, más la prueba manual que indica cada una. No inventar infraestructura de testing nueva.
- Comandos: `npm test` (vitest run), `npm run lint`, `npm run build`.

## Review Focus

Cinco cosas que el spec implica y que fallan en silencio si nadie las fija. Cada una tiene su test en la tarea que es dueña del código.

1. **Compra un día 31 → cuota en un mes que no tiene 31.** La fecha sintética tiene que recortarse a los días del mes destino, o sale `"2026-02-31"` y `diaDe` revienta al agrupar la lista del Home. (Task 2)
2. **Comercio marcado `es_fijo` con una compra en cuotas.** Si `fijos.ts` recibiera la lista mezclada, la cuota se contaría como factura llegada *y* se descontaría dos veces del ritmo variable: la predicción baja sola y nada se rompe. (Task 4)
3. **Un mes anterior al de la compra.** No hay cuota: ni número 0, ni negativo, ni la cuota 1 adelantada. (Task 2)
4. **Un plan ya terminado.** Sigue dando sus cuotas en los meses que le tocaron, ninguna en el mes actual, y no aparece entre los planes activos. (Task 2)
5. **Editar a menos cuotas que las ya transcurridas.** La regla vive en el core y la action la aplica con su propio mensaje, no solo el `min` del input: el input se puede saltear. (Task 2, usada en Task 7)

---

### Task 1: Aritmética de meses y los schemas de la compra

**Files:**
- Modify: `lib/core/fechas.ts` (agregar `mesesEntre`, después de `sumarMeses`)
- Modify: `lib/core/fechas.test.ts`
- Create: `lib/schemas/compraCuotas.ts`

**Interfaces:**
- Consumes: `formaPagoSchema` de `lib/schemas/movimiento`.
- Produces:
  - `mesesEntre(desde: Mes, hasta: Mes): number` — meses de `desde` a `hasta`; negativo si `hasta` es anterior.
  - `CompraCuotas`, `CompraCuotasDetalle`, `NuevaCompraCuotas` y sus schemas Zod.

- [ ] **Step 1: Escribir los tests que fallan en `lib/core/fechas.test.ts`**

```ts
describe('mesesEntre', () => {
  it('cuenta los meses entre dos meses del mismo año', () => {
    expect(mesesEntre('2026-11', '2026-11')).toBe(0)
    expect(mesesEntre('2026-01', '2026-03')).toBe(2)
  })

  it('cruza el año', () => {
    expect(mesesEntre('2026-11', '2027-10')).toBe(11)
  })

  it('es negativo hacia atrás', () => {
    expect(mesesEntre('2026-11', '2026-09')).toBe(-2)
  })

  it('rechaza un mes mal formado', () => {
    expect(() => mesesEntre('2026-13', '2026-11')).toThrow()
    expect(() => mesesEntre('2026-11', 'noviembre')).toThrow()
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- fechas`
Expected: FAIL — `mesesEntre is not a function`.

- [ ] **Step 3: Implementar `mesesEntre(desde: Mes, hasta: Mes): number` en `lib/core/fechas.ts`**

Mismo patrón que `sumarMeses`: validar los dos contra `RE_MES` con el mismo mensaje de error que usan las demás, convertir cada mes a un índice absoluto `año * 12 + (mes - 1)` y restar. `sumarMeses` valida el rango de mes implícitamente vía `RE_MES`; replicar esa misma validación y nada más.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -- fechas`
Expected: PASS.

- [ ] **Step 5: Crear `lib/schemas/compraCuotas.ts`**

Espejo de `lib/schemas/movimiento.ts`, con su comentario de encabezado explicando que lo que se guarda es **el importe de la cuota y cuántas son**, no el total, porque es lo que el usuario sabe con certeza.

```ts
export const compraCuotasSchema = z.object({
  id: z.uuid(),
  fecha: z.iso.date(),
  comercioId: z.uuid('Elegí un comercio'),
  importeCuotaCentavos: z.int().positive('El importe de la cuota tiene que ser mayor a cero'),
  cuotas: z.int().min(2, 'Una compra en cuotas tiene al menos 2').max(48, 'Máximo 48 cuotas'),
  formaPago: formaPagoSchema,
  banco: z.string().trim().max(60).nullable(),
  tarjeta: z.string().trim().max(60).nullable(),
  nota: z.string().trim().max(200).nullable(),
})
export type CompraCuotas = z.infer<typeof compraCuotasSchema>

export const compraCuotasDetalleSchema = compraCuotasSchema.extend({
  comercio: z.string(),
  categoria: z.string(),
  subcategoria: z.string().nullable(),
  esFijo: z.boolean(),
})
export type CompraCuotasDetalle = z.infer<typeof compraCuotasDetalleSchema>

export const nuevaCompraCuotasSchema = compraCuotasSchema.omit({ id: true }).extend({
  banco: z.string().trim().max(60).nullable().default(null),
  tarjeta: z.string().trim().max(60).nullable().default(null),
  nota: z.string().trim().max(200).nullable().default(null),
})
export type NuevaCompraCuotas = z.input<typeof nuevaCompraCuotasSchema>
```

No lleva test: ningún schema del repo tiene uno, y las reglas que importan se prueban en la action (Task 5) y en el core (Task 2).

- [ ] **Step 6: Commit**

```bash
git add lib/core/fechas.ts lib/core/fechas.test.ts lib/schemas/compraCuotas.ts
git commit -m "Cuotas: aritmetica de meses y schema de la compra"
```

---

### Task 2: `lib/core/cuotas.ts` — la derivación

El corazón. Todo lo demás consume esto.

**Files:**
- Create: `lib/core/cuotas.ts`
- Test: `lib/core/cuotas.test.ts`

**Interfaces:**
- Consumes: `CompraCuotasDetalle` (Task 1), `mesesEntre`/`mesDe`/`sumarMeses`/`diasDelMes`/`diaDe` de `fechas.ts`, `sumar` de `dinero.ts`, `MovimientoDetalle` de `lib/schemas/movimiento`.
- Produces:

```ts
export interface MarcaCuota { compraId: string; numero: number; total: number }
/** Una cuota derivada. Cumple `MovimientoDetalle`: todo `lib/core` la procesa igual. */
export type Cuota = MovimientoDetalle & { cuota: MarcaCuota }

export function esCuota(m: MovimientoDetalle): m is Cuota
export function numeroDeCuota(compra: CompraCuotasDetalle, mes: Mes): number | null
export function totalPlan(compra: CompraCuotasDetalle): number
export function mesFinal(compra: CompraCuotasDetalle): Mes
export function cuotasTranscurridas(compra: CompraCuotasDetalle, mes: Mes): number
/** ¿Se puede dejar el plan en `nuevasCuotas`? El piso son las ya transcurridas. */
export function puedeReducirA(compra: CompraCuotasDetalle, nuevasCuotas: number, mes: Mes): boolean
export function fechaDeCuota(compra: CompraCuotasDetalle, mes: Mes): FechaISO
export function cuotasEntre(compras: CompraCuotasDetalle[], desde: Mes, hasta: Mes): Cuota[]
export function cuotasDelMes(compras: CompraCuotasDetalle[], mes: Mes): Cuota[]

export interface PlanActivo {
  compra: CompraCuotasDetalle
  numero: number
  importe: number
  restantes: number
  faltaPagar: number
  mesFinal: Mes
}
export function planesActivos(compras: CompraCuotasDetalle[], mes: Mes): PlanActivo[]

export interface MesComprometido { mes: Mes; total: number; planes: number }
export function proximosMeses(compras: CompraCuotasDetalle[], desde: Mes, n: number): MesComprometido[]

export interface ResumenPlan { total: number; desde: Mes; hasta: Mes }
export function resumenPlan(importeCuotaCentavos: number, cuotas: number, fechaCompra: FechaISO): ResumenPlan
```

- [ ] **Step 1: Escribir los tests que fallan en `lib/core/cuotas.test.ts`**

Fixtures al estilo de `fijos.test.ts`: ids uuid fijos, números redondos, nombres genéricos. Una helper `compra(p: Partial<CompraCuotasDetalle> = {}): CompraCuotasDetalle` con default `fecha: '2026-11-03'`, `cuotas: 12`, `importeCuotaCentavos: 48_500`, `formaPago: 'tarjeta_credito'`, `esFijo: false`.

```ts
describe('numeroDeCuota', () => {
  it('la cuota 1 es la del mes de la compra', () => {
    expect(numeroDeCuota(compra(), '2026-11')).toBe(1)
  })
  it('avanza un número por mes y llega hasta la última', () => {
    expect(numeroDeCuota(compra(), '2027-06')).toBe(8)
    expect(numeroDeCuota(compra(), '2027-10')).toBe(12)
  })
  // Review Focus 3
  it('no hay cuota antes del mes de la compra', () => {
    expect(numeroDeCuota(compra(), '2026-10')).toBeNull()
    expect(numeroDeCuota(compra(), '2020-01')).toBeNull()
  })
  it('no hay cuota después de la última', () => {
    expect(numeroDeCuota(compra(), '2027-11')).toBeNull()
  })
})

describe('fechaDeCuota', () => {
  it('mantiene el día de la compra', () => {
    expect(fechaDeCuota(compra(), '2027-06')).toBe('2027-06-03')
  })
  // Review Focus 1
  it('recorta el día a los que tiene el mes destino', () => {
    const c = compra({ fecha: '2026-01-31', cuotas: 3 })
    expect(fechaDeCuota(c, '2026-02')).toBe('2026-02-28')
    expect(fechaDeCuota(c, '2026-03')).toBe('2026-03-31')
  })
})

describe('cuotasDelMes', () => {
  it('materializa la cuota como un movimiento con la marca', () => {
    const [c] = cuotasDelMes([compra()], '2027-06')
    expect(c.importeCentavos).toBe(48_500)
    expect(c.comercio).toBe('Asistencia')      // viene del comercio de la compra
    expect(c.formaPago).toBe('tarjeta_credito')
    expect(c.cuota).toEqual({ compraId: c.cuota.compraId, numero: 8, total: 12 })
    expect(esCuota(c)).toBe(true)
  })
  it('da ids distintos a dos compras del mismo comercio en el mismo mes', () => {
    const dos = cuotasDelMes([compra({ id: ID.a }), compra({ id: ID.b })], '2026-11')
    expect(new Set(dos.map((c) => c.id)).size).toBe(2)
  })
  it('una lista vacía de compras no produce cuotas', () => {
    expect(cuotasDelMes([], '2026-11')).toEqual([])
  })
})

describe('cuotasEntre', () => {
  it('trae una cuota por mes del rango, y nada fuera', () => {
    const cs = cuotasEntre([compra()], '2026-09', '2027-01')
    expect(cs.map((c) => c.cuota.numero)).toEqual([1, 2, 3])
  })
  // Review Focus 4
  it('un plan terminado sigue dando sus cuotas pasadas y ninguna después', () => {
    const viejo = compra({ fecha: '2025-01-10', cuotas: 6 })
    expect(cuotasEntre([viejo], '2025-01', '2026-11')).toHaveLength(6)
    expect(cuotasDelMes([viejo], '2026-11')).toEqual([])
  })
})

describe('cuotasTranscurridas', () => {
  it('cuenta el mes actual como transcurrido', () => {
    expect(cuotasTranscurridas(compra(), '2026-11')).toBe(1)
    expect(cuotasTranscurridas(compra(), '2027-03')).toBe(5)
  })
  it('es 0 antes de la compra y nunca pasa del total', () => {
    expect(cuotasTranscurridas(compra(), '2026-10')).toBe(0)
    expect(cuotasTranscurridas(compra(), '2030-01')).toBe(12)
  })
})

// Review Focus 5
describe('puedeReducirA', () => {
  it('deja bajar hasta las cuotas ya transcurridas, no por debajo', () => {
    const c = compra({ fecha: '2026-11-03', cuotas: 12 })
    expect(cuotasTranscurridas(c, '2027-03')).toBe(5)
    expect(puedeReducirA(c, 5, '2027-03')).toBe(true)
    expect(puedeReducirA(c, 4, '2027-03')).toBe(false)   // borraría dos meses cerrados
  })
  it('deja subirlas siempre', () => {
    expect(puedeReducirA(compra(), 18, '2027-03')).toBe(true)
  })
})

describe('planesActivos', () => {
  it('deja afuera los planes terminados y trae lo que falta de los vivos', () => {
    const vivo = compra()
    const terminado = compra({ id: ID.b, fecha: '2025-01-10', cuotas: 6 })
    const [p] = planesActivos([vivo, terminado], '2026-11')
    expect(p.compra.id).toBe(vivo.id)
    expect(p).toMatchObject({ numero: 1, importe: 48_500, restantes: 11, faltaPagar: 533_500, mesFinal: '2027-10' })
  })
})

describe('proximosMeses', () => {
  it('suma lo comprometido mes a mes e incluye el mes de arranque', () => {
    const a = compra()                                   // 12 × 48.500 desde 2026-11
    const b = compra({ id: ID.b, fecha: '2026-11-20', cuotas: 2, importeCuotaCentavos: 100_000 })
    expect(proximosMeses([a, b], '2026-11', 3)).toEqual([
      { mes: '2026-11', total: 148_500, planes: 2 },
      { mes: '2026-12', total: 148_500, planes: 2 },
      { mes: '2027-01', total: 48_500, planes: 1 },
    ])
  })
  it('devuelve los meses igual cuando no hay nada comprometido', () => {
    expect(proximosMeses([], '2026-11', 2)).toEqual([
      { mes: '2026-11', total: 0, planes: 0 },
      { mes: '2026-12', total: 0, planes: 0 },
    ])
  })
})

describe('resumenPlan', () => {
  it('es lo que el formulario muestra antes de guardar', () => {
    expect(resumenPlan(48_500, 12, '2026-11-03')).toEqual({
      total: 582_000, desde: '2026-11', hasta: '2027-10',
    })
  })
})

describe('totalPlan y mesFinal', () => {
  it('derivan el total y el último mes de la cuota y la cantidad', () => {
    expect(totalPlan(compra())).toBe(582_000)
    expect(mesFinal(compra())).toBe('2027-10')
  })
})

describe('esCuota', () => {
  it('un movimiento real no es una cuota', () => {
    expect(esCuota(mov())).toBe(false)   // helper como la de fijos.test.ts
  })
})
```

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- cuotas`
Expected: FAIL — el módulo no existe.

- [ ] **Step 3: Implementar `lib/core/cuotas.ts`**

Encabezado de módulo con el porqué: la base guarda la compra, la app deriva las cuotas, y la derivación produce objetos que cumplen `MovimientoDetalle` justamente para que el resto de `lib/core` no se entere.

Claves que las firmas y los tests no determinan:

- `numeroDeCuota`: `const d = mesesEntre(mesDe(compra.fecha), mes)`; hay cuota si `d >= 0 && d < compra.cuotas`, y es `d + 1`.
- `fechaDeCuota`: día `Math.min(diaDe(compra.fecha), diasDelMes(mes))`, armado a mano como string, nunca por `Date`.
- El `id` sintético lleva la compra y el número adentro: `` `cuota:${compra.id}:${numero}` ``. Es estable, sirve de `key` de React y hace posible rutear al detalle.
- `esCuota` es un type guard por presencia de la propiedad `cuota`.
- `cuotasDelMes` es `cuotasEntre(compras, mes, mes)`.
- `cuotasEntre` recorre los meses del rango; si `hasta` es anterior a `desde`, devuelve `[]`.
- `puedeReducirA` es `nuevasCuotas >= cuotasTranscurridas(compra, mes)`. Existe como función y no como `if` suelto en la action para que la regla tenga test: es de dominio, no de formulario.
- `planesActivos` conserva el orden de `compras`. `faltaPagar` es `restantes × importeCuotaCentavos`, con `restantes = compra.cuotas - numero`.
- `proximosMeses` devuelve siempre `n` meses, aunque estén en cero.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test -- cuotas`
Expected: PASS, todos los describe.

- [ ] **Step 5: Commit**

```bash
git add lib/core/cuotas.ts lib/core/cuotas.test.ts
git commit -m "Cuotas: derivar las cuotas de una compra como movimientos"
```

---

### Task 3: Tabla, repositorio y migración

**Files:**
- Modify: `supabase/schema.sql` (tabla nueva antes del bloque de RLS; sumarla al array de tablas de ese bloque)
- Create: `lib/db/cuotas.ts`
- Modify: `docs/PENDIENTES.md`

**Interfaces:**
- Consumes: `CompraCuotasDetalle`, `NuevaCompraCuotas` (Task 1); `crearCliente` de `lib/db/client`.
- Produces:
  - `getComprasEnCuotas(): Promise<CompraCuotasDetalle[]>` — todas, ordenadas por `fecha` descendente.
  - `getCompraEnCuotas(id: string): Promise<CompraCuotasDetalle | null>`
  - `crearCompra(c: NuevaCompraCuotas): Promise<void>`
  - `actualizarCompra(id: string, c: NuevaCompraCuotas): Promise<void>`
  - `borrarCompra(id: string): Promise<void>`

- [ ] **Step 1: Agregar la tabla a `supabase/schema.sql`**

Idempotente como el resto del archivo, con el comentario de bloque que explique qué guarda y por qué el importe es el de la cuota. Columnas y constraints según el spec:

```sql
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
```

`on delete restrict` en `comercio_id`, igual que `movimientos`: borrar un comercio no puede llevarse un plan por delante.

Sumar `'compras_cuotas'` al array del bloque de Row Level Security que ya recorre las cinco tablas.

Agregar también una vista `compras_cuotas_detalle` con `security_invoker = true`, espejo de `movimientos_detalle`: resuelve el join con `comercios` y expone `comercio`, `categoria`, `subcategoria`, `es_fijo`. Sin agregados.

- [ ] **Step 2: Verificar que el SQL es válido y se puede re-correr**

Run: pegar el `schema.sql` entero en el SQL Editor de Supabase y ejecutarlo dos veces.
Expected: las dos corridas terminan sin error.

- [ ] **Step 3: Implementar `lib/db/cuotas.ts`**

Espejo de `lib/db/movimientos.ts`: `'server-only'` arriba, constante `COLUMNAS`, tipo `FilaDetalle` con los nombres de Postgres, función `aDominio` que pasa a camelCase y envuelve los `bigint` en `Number()`. Los errores se tiran con el mismo formato (`No pude leer las compras en cuotas: ${error.message}`).

`getComprasEnCuotas` trae **todas** las filas sin filtro de fecha: un plan viejo sigue haciendo falta para el historial de sus meses, y son decenas de filas en toda la vida de la app.

- [ ] **Step 4: Verificar que compila y pasa el lint**

Run: `npm run lint && npm run build`
Expected: sin errores.

- [ ] **Step 5: Anotar la migración en `docs/PENDIENTES.md`**

Un punto nuevo con el mismo formato que el punto 0 que ya está ahí: qué correr, que `schema.sql` es idempotente, y el criterio de listo (insertar una compra de prueba desde el SQL Editor y que `getComprasEnCuotas` la devuelva).

- [ ] **Step 6: Commit**

```bash
git add supabase/schema.sql lib/db/cuotas.ts docs/PENDIENTES.md
git commit -m "Cuotas: tabla compras_cuotas, vista detalle y repositorio"
```

---

### Task 4: Que las cuotas no inflen la predicción

**Files:**
- Modify: `lib/core/prediccion.ts` (`promedioHistoricoDiario`)
- Modify: `lib/core/prediccion.test.ts`

**Interfaces:**
- Consumes: `esCuota`, `cuotasDelMes` (Task 2); `fijosYaPagados` de `fijos.ts`; `gastoContraTope` de `gastos.ts`.
- Produces: `promedioHistoricoDiario` con la misma firma, excluyendo cuotas.

- [ ] **Step 1: Escribir los tests que fallan en `lib/core/prediccion.test.ts`**

```ts
describe('promedioHistoricoDiario con cuotas', () => {
  it('no cuenta las cuotas de los meses viejos en el ritmo variable', () => {
    const variables = [/* movimientos no fijos de 2026-09 y 2026-10 */]
    const sinCuotas = promedioHistoricoDiario(variables, '2026-11', 2, 'tarjeta')
    const conCuotas = promedioHistoricoDiario(
      [...variables, ...cuotasEntre([compraVieja], '2026-09', '2026-10')],
      '2026-11', 2, 'tarjeta',
    )
    expect(conCuotas).toBe(sinCuotas)
  })
})

// Review Focus 2
describe('el ritmo variable con una cuota de un comercio fijo', () => {
  it('descuenta la cuota una sola vez', () => {
    // compra en cuotas sobre un comercio marcado es_fijo, más una factura real
    // de ese mismo comercio en el mes.
    const cuotas = cuotasDelMes([compraDeComercioFijo], '2026-11')
    const mezclados = [...movsReales, ...cuotas]

    const gastadoReal = gastoContraTope(mezclados, '2026-11', 'tarjeta')
    const noVariable =
      fijosYaPagados(fijos, movsReales, '2026-11', 'tarjeta') +
      gastoContraTope(cuotas, '2026-11', 'tarjeta')

    expect(tasaVariableDiaria({ gastadoReal, fijosYaPagados: noVariable, diaActual: 10 }))
      .toBe(/* solo el gasto variable del mes, dividido 10 */)
  })
})
```

El segundo test es la regresión que importa: reproduce exactamente la cuenta que hace el Home y fija que `fijos.ts` recibe **solo movimientos reales**. Si alguien le pasa la lista mezclada, este test baja a cero y falla.

- [ ] **Step 2: Correr y verificar que falla**

Run: `npm test -- prediccion`
Expected: FAIL — el primer test da distinto; el segundo descuenta de más.

- [ ] **Step 3: Excluir las cuotas en `promedioHistoricoDiario`**

En `lib/core/prediccion.ts`, el filtro del gasto variable pasa a ser `!m.esFijo && !esCuota(m) && TOPE_DE_FORMA_PAGO[m.formaPago] === tope`. Importar `esCuota` de `./cuotas`.

Actualizar el comentario del módulo con el motivo que dio el usuario: son compras grandes y esporádicas, no se repiten y no dicen nada sobre cuánto se gasta por día.

Agregar sobre `tasaVariableDiaria` una nota corta: lo que recibe en `fijosYaPagados` es "lo ya gastado que no es variable" —fijos **más** cuotas del mes—, y es la **unión** de los dos conjuntos, no la suma de dos listas superpuestas; por eso `fijos.ts` recibe solo movimientos reales.

- [ ] **Step 4: Correr y verificar que pasa**

Run: `npm test`
Expected: PASS, toda la suite.

- [ ] **Step 5: Commit**

```bash
git add lib/core/prediccion.ts lib/core/prediccion.test.ts
git commit -m "Prediccion: las cuotas no entran al ritmo variable"
```

---

### Task 5: Cargar — el campo Cuotas y el alta

**Files:**
- Modify: `components/FormGasto.tsx`
- Create: `app/actions/cuotas.ts`

**Interfaces:**
- Consumes: `resumenPlan` (Task 2), `nuevaCompraCuotasSchema` (Task 1), `crearCompra` (Task 3), `parsearImporte` de `dinero.ts`, `EstadoForm` de `app/actions/movimientos`.
- Produces:
  - `guardarCompraEnCuotas(_estado: EstadoForm, formData: FormData): Promise<EstadoForm>`
  - `FormGasto` con prop nueva `compra?: CompraCuotasDetalle` (en esta tarea solo se agrega el campo en modo alta; el modo edición de compra lo usa Task 7).

- [ ] **Step 1: Implementar `app/actions/cuotas.ts`**

Espejo de `app/actions/movimientos.ts`: reusa su helper `texto(fd, campo)` (exportarla desde ahí o duplicar las cuatro líneas, lo que quede más limpio), parsea el importe con `parsearImporte` antes de validar, valida con `nuevaCompraCuotasSchema`, escribe por `lib/db/cuotas.ts`, y devuelve `EstadoForm`.

`cuotas` llega del FormData como string: pasarlo por `Number()` antes del `safeParse`, igual que el importe. Si no es un entero, el schema lo rechaza con su propio mensaje.

Al terminar: `revalidatePath('/', 'layout')` —no solo `/`— porque una compra mueve topes, predicción, fijos e historial de muchos meses a la vez. Mensaje de éxito: `'Compra en cuotas cargada.'`

- [ ] **Step 2: Agregar el campo Cuotas a `components/FormGasto.tsx`**

Estado `const [cuotas, setCuotas] = useState(1)`, y una card nueva **debajo de la del importe** (el importe sigue siendo el protagonista; el campo tiene que leerse como una modificación de ese número).

- Stepper `−` / `+` con el número al medio, al estilo de los botones de forma de pago que ya están en el archivo: `rounded-lg`, `transition-transform active:scale-95`, `bg-surface-container-high`. Rango 1 a 48.
- El `−` deshabilitado en 1; el `+` deshabilitado en 48.
- Con `cuotas === 1` no se muestra nada más: es el gasto de siempre.
- Con `cuotas >= 2`, debajo del stepper aparece un `Banner` con el resumen, que sale de `resumenPlan(parsearImporte(mostrar(importe)) ?? 0, cuotas, fecha)`:
  `{cuotas} cuotas de {formatoARS(cuota)} = {formatoARS(total)}. De {nombreMes(desde)} a {nombreMes(hasta)}.`
  Es lo único que separa cargar $48.500 de comprometer $582.000, así que no puede ser un detalle gris: va en `text-on-surface` con el total en `text-primary`.
- La fecha que usa el resumen es la del campo `fecha`. Como `CampoFecha` mantiene su valor en un input oculto, hace falta subir ese valor a estado en `FormGasto` (`const [fecha, setFecha] = useState(movimiento?.fecha ?? hoy)`) y pasarle un `onChange` a `CampoFecha`. Si `CampoFecha` hoy no expone uno, agregárselo sin romper su uso actual (prop opcional).
- **El campo no se dibuja cuando `movimiento !== undefined`.** Editando un gasto suelto no existe. Dejar un comentario con el motivo: convertir una fila de una tabla a la otra para un caso que pasa casi nunca dejaba un control a la vista que no hace nada.
- `enviar()` bifurca: con `cuotas >= 2` y sin `movimiento` llama a `guardarCompraEnCuotas`; si no, queda como está. Un `<input type="hidden" name="cuotas" value={cuotas} />` lleva el valor.
- Después de guardar una compra, el reset es el mismo que ya hace el alta, más `setCuotas(1)`.

- [ ] **Step 3: Verificar que compila y pasa el lint**

Run: `npm run lint && npm run build`
Expected: sin errores.

- [ ] **Step 4: Probarlo a mano**

Run: `npm run dev`, abrir `/cargar` en vista de celular.
Expected: con Cuotas en 1 la pantalla es idéntica a la de antes. Subiéndolo a 12 aparece el resumen con el total y los meses correctos, y Guardar deja la compra en la base (verificable en el SQL Editor de Supabase). El resumen se actualiza al cambiar el importe y al cambiar la fecha.

- [ ] **Step 5: Commit**

```bash
git add components/FormGasto.tsx components/CampoFecha.tsx app/actions/cuotas.ts
git commit -m "Cargar: campo Cuotas y alta de una compra en cuotas"
```

---

### Task 6: Home — la cuota entre los movimientos del mes

**Files:**
- Modify: `app/(app)/page.tsx`
- Modify: `components/ListaMovimientos.tsx`

**Interfaces:**
- Consumes: `getComprasEnCuotas` (Task 3); `cuotasDelMes`, `cuotasEntre`, `esCuota` (Task 2); `gastoContraTope` de `gastos.ts`.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Mezclar las cuotas en `app/(app)/page.tsx`**

Sumar `getComprasEnCuotas()` al `Promise.all` existente. Después:

```ts
const cuotasMes = cuotasDelMes(compras, mes)
const conCuotas = [...movs, ...cuotasEntre(compras, desde, mes)]
```

`movs` son los movimientos reales y **no se tocan**. A partir de ahí, quién recibe qué (esta es la tabla del spec, aplicada):

- `gastoTarjetaMes` / `gastoEfectivoMes` → `conCuotas`
- `movimientosOrdenados` → `conCuotas`
- `promedioHistoricoDiario` → `conCuotas` (excluye las cuotas por dentro desde Task 4)
- `fijosPendientes`, `fijosYaPagados`, `contadorFijos` → **`movs`**
- `tasaVariableDiaria`, campo `fijosYaPagados` → `fijosYaPagados(fijos, movs, mes, 'tarjeta') + gastoContraTope(cuotasMes, mes, 'tarjeta')`

Dejar un comentario corto sobre esa última línea: es la unión de lo que ya se gastó y no es variable; si `fijos.ts` recibiera la lista mezclada, una cuota de un comercio fijo se descontaría dos veces.

- [ ] **Step 2: Mostrar la cuota en `components/ListaMovimientos.tsx`**

Dentro del `.map`, calcular `const c = esCuota(m) ? m.cuota : null`.

- `href`: `` c ? `/compra/${c.compraId}` : `/movimiento/${m.id}` ``.
- `titulo`: con cuota, el nombre del comercio precedido por un `Badge` con `{c.numero}/{c.total}`. El tono es `neutro`, salvo en la última cuota (`c.numero === c.total`) que va `atencion` —ámbar—: que un plan esté por terminar es la única información del plan que se quiere ver desde el Home.
- El resto del `ItemLista` queda igual: la categoría y la forma de pago salen del comercio de la compra.

- [ ] **Step 3: Verificar que compila y pasa el lint**

Run: `npm run lint && npm run build`
Expected: sin errores.

- [ ] **Step 4: Probarlo a mano**

Run: `npm run dev`, abrir `/` con la compra cargada en Task 5.
Expected: la cuota aparece en la lista del mes con el chip `1/12`, el total de la barra de Tarjeta la incluye, y el "Cierre estimado" **no** se dispara por ella. El chip de un plan que termina este mes sale en ámbar.

- [ ] **Step 5: Commit**

```bash
git add "app/(app)/page.tsx" components/ListaMovimientos.tsx
git commit -m "Home: las cuotas del mes entre los movimientos"
```

---

### Task 7: `/compra/[id]` — detalle, editar y borrar

**Files:**
- Create: `app/(app)/compra/[id]/page.tsx`
- Create: `app/(app)/compra/[id]/loading.tsx`
- Modify: `app/actions/cuotas.ts`
- Modify: `components/FormGasto.tsx`

**Interfaces:**
- Consumes: `getCompraEnCuotas`, `actualizarCompra`, `borrarCompra` (Task 3); `puedeReducirA`, `cuotasTranscurridas`, `totalPlan`, `mesFinal`, `numeroDeCuota` (Task 2).
- Produces:
  - `editarCompraEnCuotas(_estado: EstadoForm, formData: FormData): Promise<EstadoForm>`
  - `eliminarCompraEnCuotas(id: string): Promise<EstadoForm>`

- [ ] **Step 1: Implementar las actions de edición y borrado en `app/actions/cuotas.ts`**

`editarCompraEnCuotas` valida con el **mismo** `nuevaCompraCuotasSchema` que el alta, por el mismo motivo que `editarMovimiento` reusa el schema del alta: una compra editada tiene que cumplir las reglas de una nueva.

Después del `safeParse`, la regla de dominio: leer la compra guardada con `getCompraEnCuotas(id)` y rechazar si `!puedeReducirA(guardada, parsed.data.cuotas, mesActual())`, con el mensaje
`` `Ya pasaron ${cuotasTranscurridas(guardada, mesActual())} cuotas de este plan. No podés bajarlo por debajo de eso: las que pagaste quedan.` ``
Va acá y no solo en el `min` del input porque el input se puede saltear y la action es el único lugar que manda.

`eliminarCompraEnCuotas` borra sin más. Las dos hacen `revalidatePath('/', 'layout')`.

- [ ] **Step 2: Armar la pantalla `app/(app)/compra/[id]/page.tsx`**

Server component, mismo esqueleto que `app/(app)/movimiento/[id]/page.tsx`: `await params`, `getCompraEnCuotas(id)`, `notFound()` si no aparece (el RLS ya filtró por usuario).

Contenido, con piezas de `components/ds.tsx`:

- Encabezado: nombre del comercio y "Comprado el {fecha larga}".
- `Card` con `TituloCard` "Cuota de este mes", `MontoHero` con `formatoARS(compra.importeCuotaCentavos)`, una `Barra` con el avance (`numero / cuotas`) y debajo el renglón de números: cuota N de M, cuántas quedan, cuánto falta pagar, el total del plan y el mes de la última.
- `Card` con el mes a mes del plan. Si son muchas cuotas, mostrar las primeras y las últimas con un separador en el medio antes que una lista de 48 filas.
- `FormGasto` con la prop `compra`, para editar.

El `loading.tsx` lleva el esqueleto de **esta** pantalla —el hero, la barra, el bloque del mes a mes—, no uno genérico: la gracia es reservar la forma final para que al llegar los datos nada salte.

- [ ] **Step 3: Agregar el modo compra a `components/FormGasto.tsx`**

Con `compra !== undefined`:
- El campo Cuotas **sí** se muestra, arrancando en `compra.cuotas`, con `min` = `cuotasTranscurridas(compra, mesActual())` pasado desde el server como prop (el formulario es cliente y no debe calcular "hoy").
- Los demás campos se inicializan desde `compra` igual que hoy se inicializan desde `movimiento`. El importe es `compra.importeCuotaCentavos`.
- `enviar()` llama a `editarCompraEnCuotas`; el botón de borrar llama a `eliminarCompraEnCuotas`.
- El texto del borrado dice lo que significa, no solo "Borrar": `'Borrar — lo cargué mal'`, y el `confirm()` aclara que desaparecen también las cuotas que ya pasaron. Bajar las cuotas es la otra acción, y es la que corresponde a una baja o devolución.

- [ ] **Step 4: Verificar que compila, pasa el lint y los tests**

Run: `npm run lint && npm test && npm run build`
Expected: sin errores.

- [ ] **Step 5: Probarlo a mano**

Run: `npm run dev`.
Expected: tocar la cuota en el Home abre `/compra/[id]`. Bajar las cuotas a un número válido actualiza el plan y el Home lo refleja. Intentar bajarlas por debajo de las transcurridas —salteando el input desde las devtools— devuelve el error de la action. Borrar saca el plan y sus cuotas de todos los meses.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/compra" app/actions/cuotas.ts components/FormGasto.tsx
git commit -m "Compra en cuotas: detalle, editar y borrar"
```

---

### Task 8: Fijos y cuotas

**Files:**
- Modify: `app/(app)/fijos/page.tsx`
- Modify: `app/(app)/fijos/loading.tsx`
- Create: `components/SeccionCuotas.tsx`

**Interfaces:**
- Consumes: `getComprasEnCuotas` (Task 3); `planesActivos`, `proximosMeses`, `totalPlan` (Task 2); `Seccion` de `components/Seccion.tsx`.
- Produces: nada que consuman otras tareas.

- [ ] **Step 1: Reorganizar `app/(app)/fijos/page.tsx` en secciones plegables**

El título de la pantalla pasa a "Fijos y cuotas". **El tab de la bottom-nav queda en "Fijos"**: "Fijos y cuotas" no entra en un tab de celular, y `NavMobile` no se toca.

La card grande de arriba ("Falta pagar $X") **sigue siendo solo de fijos** y no suma cuotas: mide facturas, y una cuota no es una factura. Dejarlo escrito en un comentario, porque es exactamente lo que un refactor futuro va a querer "arreglar".

Debajo, dos `Seccion`:
- **"Gastos fijos"**, `abierta`, con el checklist que ya existe tal cual, y el `AltaFijo` adentro. Contador: el mismo texto de facturas que ya arma la página.
- **"Cuotas"**, cerrada, con `<SeccionCuotas />`. Contador: cuántos planes activos y cuánto pesan este mes.

Lo que va adentro de una `Seccion` **no lleva `Card` propia**: la sección ya pone el fondo `surface-container`. Los sub-bloques que necesiten despegarse usan `surface-container-high`.

Nada de `montarAlAbrir` acá: no hay Recharts ni nada que necesite medirse.

- [ ] **Step 2: Implementar `components/SeccionCuotas.tsx`**

Server component. Recibe `planes: PlanActivo[]` y `meses: MesComprometido[]`.

- Lista de planes: por cada uno, chip `n/N`, comercio, importe de la cuota a la derecha, y una `Barra` de avance debajo. Tocar un plan lleva a `/compra/[id]`, con `active:` además de `hover:`.
- Al final, un sub-bloque **"Lo que viene"** en `surface-container-high`: una fila por mes con `nombreMes(mes)`, cuántos planes y el total. La página le pasa `proximosMeses(compras, sumarMeses(mes, 1), 4)` — cuatro meses entran sin scroll, y que un plan de 12 quede cortado ahí es aceptable: para eso está el detalle de la compra.
- Sin planes activos: un solo párrafo centrado, al estilo del vacío del checklist, diciendo que no hay nada en cuotas.

- [ ] **Step 3: Actualizar `app/(app)/fijos/loading.tsx`**

El esqueleto tiene que reflejar la forma nueva: la card de arriba y las dos secciones plegadas, no la lista larga de antes.

- [ ] **Step 4: Verificar que compila y pasa el lint**

Run: `npm run lint && npm run build`
Expected: sin errores.

- [ ] **Step 5: Probarlo a mano**

Run: `npm run dev`, abrir `/fijos` en vista de celular.
Expected: la pantalla entra entera sin scrollear. "Gastos fijos" abierta con el checklist de siempre y la card de arriba con el mismo número que antes de esta tarea. "Cuotas" cerrada, con el contador adelantando cuántos planes hay; abierta, los planes y "Lo que viene" con los meses correctos.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/fijos" components/SeccionCuotas.tsx
git commit -m "Fijos y cuotas: la seccion de planes y lo que viene"
```

---

### Task 9: Historial — las cuotas hasta el mes actual

**Files:**
- Modify: `app/(app)/historial/page.tsx`

**Interfaces:**
- Consumes: `getComprasEnCuotas` (Task 3); `cuotasEntre` (Task 2).
- Produces: nada.

- [ ] **Step 1: Mezclar las cuotas, cortando en el mes actual**

Sumar `getComprasEnCuotas()` a la carga de la página y armar:

```ts
const conCuotas = [...movs, ...cuotasEntre(compras, '2000-01', mes)]
```

`mes` es `mesActual()`, que la página ya calcula. A partir de ahí, `resumenMensual`, `promedioMensual`, `totalPorCategoria`, `mesesConDatos`, `serieEvolucion` y el `BuscadorMovimientos` reciben `conCuotas`.

Comentario con el motivo del corte, que es la parte que se pierde si alguien lo "simplifica": sin él, el mes a mes listaría hasta la última cuota del plan más largo y `promedioMensual` promediaría esos meses como **cerrados** —solo excluye el mes marcado `enCurso`—, así que el número de portada quedaría mal y el gráfico dibujaría un futuro decreciente. El futuro se mira en Fijos y cuotas.

- [ ] **Step 2: Verificar que compila y pasa el lint**

Run: `npm run lint && npm run build`
Expected: sin errores.

- [ ] **Step 3: Probarlo a mano**

Run: `npm run dev`, abrir `/historial`.
Expected: el mes a mes termina en el mes actual, no en 2027. El mes actual incluye su cuota. El buscador encuentra la cuota por el nombre del comercio y tocarla abre `/compra/[id]`.

- [ ] **Step 4: Verificar las dos pantallas que no tenían que cambiar**

Run: `npm run dev`, abrir `/presupuesto` parado en un mes con una cuota viva, y `/cargar`.
Expected: el presupuesto muestra el mismo "real" por comercio que antes de todo este trabajo —la cuota no figura— y la grilla de atajos de Cargar no tiene el comercio de la compra en cuotas salvo que se haya comprado ahí de verdad.

Run: `grep -rn "cuotasEntre\|cuotasDelMes" "app/(app)/presupuesto" "app/(app)/cargar"`
Expected: sin resultados.

- [ ] **Step 5: Correr toda la suite**

Run: `npm test && npm run lint && npm run build`
Expected: todo verde.

- [ ] **Step 6: Commit**

```bash
git add "app/(app)/historial/page.tsx"
git commit -m "Historial: incluir las cuotas hasta el mes actual"
```

---

## Después del plan

Dos cosas que el spec deja afuera de las tareas y conviene no olvidar al cerrar la rama:

- **Correr la migración** en el SQL Editor de Supabase (queda anotada en `docs/PENDIENTES.md` por Task 3). Hasta que corra, la app levanta pero `getComprasEnCuotas` falla.
- **Actualizar el `CLAUDE.md`** de la raíz: la sección "Ya hecho (no volver a proponerlo)" es la que evita que alguien reproponga esto, y la regla de quién recibe la lista mezclada merece estar ahí, no solo en el spec.
