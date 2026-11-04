# Compras en cuotas

Diseño — 4 de noviembre de 2026.

---

## Por qué

El 3 de noviembre de 2026 el usuario compró una asistencia al viajero en 12 cuotas, y poco
después un filtro de agua, también en 12. No cargó ninguna de las dos: no hay forma de
hacerlo. Si cargaba el total, noviembre quedaba con un gasto de medio millón que no existe;
si cargaba una cuota, el mes que viene no se iba a acordar de cargar la siguiente.

El resultado es que la app no sabe que noviembre ya arranca comprometido, y que cada mes
hasta octubre de 2027 va a arrancar igual. Ese es exactamente el número que la app existe
para mostrar.

Una compra en cuotas tiene una propiedad que ningún otro gasto de la app tiene: **el futuro
se conoce entero desde el momento en que se firma**. No hay nada que averiguar mes a mes, no
hay factura que esperar, no hay monto que confirmar. Todo el diseño sale de ahí.

---

## Lo que ya existe no sirve, y vale explicar por qué

**No son movimientos.** `movimientos` guarda hechos pasados; todo lo demás se deriva de ahí.
Generar las doce filas al momento de la compra metería en la base gastos de julio de 2027 que
todavía no ocurrieron, ensuciaría el historial y los gráficos con meses que no pasaron, y
convertiría cualquier corrección en doce ediciones.

**No son gastos fijos.** Desde el commit `309be74`, un fijo está pagado cuando aparecen todas
las facturas que espera. Esa mecánica existe porque el monto lo decide el proveedor y hay que
verificar que llegó. Una cuota es lo opuesto: monto exacto y fecha exacta, conocidos de
antemano. Meterla en el checklist sería pedirle al sistema que dude de una certeza, y le
agregaría al checklist cosas que no son facturas.

**La decisión:** la compra es el hecho y se guarda una sola vez. Las cuotas se **derivan**,
igual que hoy se deriva el mes de la fecha y el estado de un fijo de sus movimientos. Es la
misma regla de siempre: la base guarda hechos, la app deriva vistas.

---

## Objetivos

1. Cargar una compra en cuotas una sola vez, desde el celular, por el mismo flujo con el que
   se carga cualquier gasto.
2. Que la cuota de cada mes aparezca **sola**, identificada `6/12`, entre los movimientos del
   mes y pesando contra el tope de tarjeta.
3. Poder responder "¿con cuánto arranca junio?" antes de que llegue junio.
4. Que la predicción no se distorsione por culpa de esto.

## No-objetivos

- **Cuotas de monto variable.** UVA, recargos, intereses que se recalculan. El plan tiene un
  importe de cuota fijo. Si alguna vez cambia, se edita el plan.
- **Editar una cuota suelta.** No es un movimiento, es una derivación. Lo que se edita es la
  compra.
- **Primera cuota en un mes distinto al de la compra.** Depende del cierre de la tarjeta; el
  usuario confirmó que hoy no lo necesita. Si alguna vez hace falta, es un campo.
- **Cuotas ya corrientes de antes de esta feature.** Confirmado: no tiene ninguna. El alta no
  necesita un campo de "mes de inicio".
- Recordatorios, notificaciones, o importar cuotas desde el resumen de la tarjeta.

## Anti-objetivos

Cosas que harían fracasar esto aunque el código funcione:

- **Que haya que tocar algo cada mes para que la cuota aparezca.** Si en diciembre hay un
  botón "confirmar la cuota 2", fracasó. El usuario no va a tener ningún motivo para abrir la
  app y acordarse: no hizo nada ese día, no compró nada. Ese fue el pedido textual.
- **Filas futuras en `movimientos`.** Rompe el principio del que cuelga toda la app.
- **Que las cuotas inflen el ritmo variable** y la predicción empiece a proyectar de más todos
  los meses. Son compras grandes y esporádicas; no se repiten ni predicen nada sobre el gasto
  del día a día.
- **Un formulario de alta aparte.** Es el mismo error que ya está anotado en el `CLAUDE.md`
  para `FormGasto`: dos formularios significan dos conjuntos de reglas que se separan con el
  tiempo.
- **Mezclar cuotas y facturas en el checklist de fijos.** Comparten pantalla, no concepto.

---

## El modelo

### Tabla nueva: `compras_cuotas`

Guarda la compra. Nada más.

| Columna | Tipo | Nota |
|---|---|---|
| `id` | uuid pk | |
| `user_id` | uuid | igual que el resto, con RLS |
| `fecha` | date | fecha de compra. De acá sale el mes de la cuota 1 |
| `comercio_id` | uuid fk → comercios | categoría y subcategoría salen de acá, como siempre |
| `importe_cuota_centavos` | bigint > 0 | **la cuota, no el total** |
| `cuotas` | smallint ≥ 2 | 1 cuota es un movimiento común |
| `forma_pago` | forma_pago | el enum que ya existe |
| `banco` | text null | descriptivo |
| `tarjeta` | text null | descriptivo |
| `nota` | text null | |
| `created_at` | timestamptz | |

Se guarda el **importe de la cuota**, no el total, porque es lo que el usuario sabe con
certeza: te venden "12 cuotas de $48.500". Con interés, total ÷ 12 no da la cuota que te
cobran. El total lo deriva la app (`cuota × cantidad`) y se muestra como dato.

`cuotas ≥ 2` por constraint: una compra en una cuota es un gasto normal y va a `movimientos`.

Va con RLS por `user_id` como las otras cinco tablas, y el DDL idempotente se suma a
`supabase/schema.sql`. Como el schema se re-corre entero, no hace falta un archivo de
migración aparte, pero sí anotar en `docs/PENDIENTES.md` que hay que correrlo —igual que el
punto 0 que ya está ahí por `pagos_esperados`.

### El módulo puro: `lib/core/cuotas.ts`

Con su `cuotas.test.ts` al lado. Entra data, sale data. Lo que tiene que resolver:

**Qué cuota cae en un mes.** Dada una compra y un mes `YYYY-MM`, el número de cuota es la
distancia en meses entre el mes de la compra y el mes pedido, más uno. Si cae entre 1 y
`cuotas`, hay cuota; si no, no hay. Nada más que eso.

> `fechas.ts` no tiene hoy una función de distancia entre meses. Hace falta agregarla ahí
> (donde viven las fechas) y no en `cuotas.ts`.

**Las cuotas de un mes, como movimientos.** Esta es la pieza clave del diseño. La derivación
devuelve objetos que **cumplen `MovimientoDetalle`**, con los campos del comercio ya
resueltos, más un objeto extra que dice de qué compra vienen y qué número de cuota son.

La consecuencia es que **todo `lib/core` sigue funcionando sin tocarse**: `gastoContraTope`,
`gastoPorCategoria`, `movimientosOrdenados`, `filtrarMovimientos`, `resumenMensual`,
`serieEvolucion` — todos reciben `MovimientoDetalle[]` y no necesitan enterarse de que
algunos elementos nacieron derivados. Las páginas les pasan la lista mezclada y listo.

Detalles que esa materialización tiene que resolver:

- **El `id`** es sintético y estable, con la compra y el número adentro (por ejemplo
  `cuota:<compraId>:6`). Sirve de `key` en React y para rutear al detalle.
- **La `fecha`** es el mismo día del mes que la compra, limitado a los días que tiene ese mes
  (compra el 31 de enero → cuota de febrero el 28). Es lo que hace que la cuota se ordene en
  un lugar sensato dentro de la lista del Home, que ordena por fecha descendente.
- **`esFijo`** sale del comercio, como cualquier movimiento. No se fuerza.
- **La marca de cuota** es lo que permite distinguirlas donde importa: el chip `6/12` en la
  lista, el destino al tocarla, y la exclusión en la predicción.

**El panorama de los meses que vienen.** Dada la lista de compras y un mes de arranque, los
próximos N meses con su total comprometido y cuántos planes lo componen. Es lo que alimenta
"Lo que viene" en la pantalla de Fijos y cuotas.

### Qué pasa con la predicción

Este es el único lugar donde la elegancia de "son movimientos como cualquier otro" se rompe a
propósito, y hay que hacerlo explícito o rompe en silencio.

El método B+E calcula el ritmo variable como `(gastado − fijos ya pagados) / día actual`. Si
una cuota de $120.000 entra ahí como gasto común, el 4 de noviembre el ritmo diario sale
$30.000 por día y la proyección se va a las nubes.

Son compras grandes y esporádicas: no se repiten, y no dicen nada sobre cuánto se gasta por
día. Entonces:

- **En el ritmo del mes actual** (`tasaVariableDiaria`): lo que se descuenta del gastado deja
  de ser solo "fijos ya pagados" y pasa a ser "lo ya gastado que no es variable" — fijos más
  cuotas del mes, filtrado por el mismo tope, como ya se filtra hoy.

  > **Ojo con el doble descuento.** Es la **unión** de los dos conjuntos, no la suma de dos
  > números. Si `fijosYaPagados` recibiera la lista mezclada y además se le sumaran las cuotas
  > del mes, una cuota de un comercio marcado como fijo se restaría dos veces y la tasa se
  > iría a cero. No rompe nada: baja la proyección en silencio.
  >
  > La cuenta vive en `lib/core/prediccion.ts` (`gastoNoVariable`), no compuesta en la
  > página, y va con test. Que la componga la página dejaba al test **copiando** la suma en
  > vez de llamarla: alguien cambiaba el Home y el test seguía en verde, que es exactamente
  > lo que el test existía para impedir.
  >
  > Y el otro sumando se protege solo: `fijos.ts` descarta las cuotas por su cuenta (ver más
  > abajo), así que los dos conjuntos son **disjuntos** le pase quien le pase la lista.
- **En el promedio histórico** (`promedioHistoricoDiario`): hoy filtra `!m.esFijo`; tiene que
  excluir además las cuotas. Si no, un mes viejo con una compra grande sube el promedio que
  se usa en el arranque de los meses siguientes.
- **En la base B**: no hay nada que hacer. La cuota del mes ya está dentro del gastado real
  desde el día 1, que es lo correcto: es plata comprometida del mes, no una posibilidad.

### Quién recibe la lista mezclada, y hasta qué mes

"Las cuotas son movimientos como cualquier otro" vale para casi todo, pero no para todo. Esta
tabla es la regla, y conviene leerla antes de escribir cualquier página:

| Pantalla | Qué recibe | Hasta cuándo |
|---|---|---|
| Home | movimientos + cuotas | el mes actual |
| Historial y gráficos | movimientos + cuotas | **corta en el mes actual** |
| Buscador y filtros | movimientos + cuotas | lo que le pase su pantalla |
| Fijos y cuotas → sección Cuotas | las compras, sin materializar | **el futuro, a propósito** |
| Fijos y cuotas → checklist | **solo movimientos reales** | el mes actual |
| Presupuesto | **solo movimientos reales** | — |
| Atajos de comercio en Cargar | **solo movimientos reales** | últimos dos meses |

Los tres casos que se salen de la regla general, con su motivo:

**El Historial corta en el mes actual.** `app/(app)/historial/page.tsx` trae todo el histórico
y lo pasa a `resumenMensual`, `promedioMensual`, `serieEvolucion` y al selector de meses. Si la
lista trajera cuotas futuras, el mes a mes listaría hasta octubre de 2027 y —lo caro—
`promedioMensual` los promediaría como meses **cerrados**, porque solo excluye el mes marcado
`enCurso`. El número de portada quedaría mal y el gráfico dibujaría un futuro decreciente. El
futuro se mira en Fijos y cuotas, que es el lugar que se construye para eso.

**El checklist de fijos nunca ve una cuota.** `checklistFijos` cuenta cuántos movimientos del
comercio hay en el mes para decidir si llegaron todas las facturas. Si un comercio estuviera
marcado como fijo *y* tuviera una compra en cuotas, la cuota se contaría como una factura
llegada y el fijo figuraría pagado sin que llegara nada. Es textual el anti-objetivo de
mezclar cuotas y facturas. Es un bug silencioso: no rompe nada, solo miente.

Esta parte del diseño se revisó y cambió. Decía que la regla se cumplía **sin** filtrar
adentro de `fijos.ts`, pasándole solo movimientos reales desde cada página, por miedo al
doble descuento de la predicción. Pero una convención que hay que recordar en cada pantalla
nueva no es una garantía, y nada fallaba al violarla. **`fijos.ts` filtra las cuotas en sus
propias entradas** (`checklistFijos` y `fijosYaPagados`; `fijosPendientes` y `contadorFijos`
van por la primera). Hoy no cambia nada —las páginas ya le pasan movimientos reales— pero
convierte la regla en algo que no se puede violar.

Y el doble descuento que se temía es justo lo que el filtro evita: filtrando adentro, lo
que cuenta `fijos.ts` y lo que suma `gastoContraTope(cuotasDelMes, …)` son conjuntos
**disjuntos**, así que sumarlos nunca cuenta una cuota dos veces. La objeción de pureza
tampoco aplica: `esCuota` es una función pura del mismo `lib/core`, y `prediccion.ts` ya la
importa. Va con test de los dos lados.

**El presupuesto no cuenta cuotas.** El presupuesto es la plata que el usuario separa en
efectivo y transferencias —verdulería, gym, la inversión del mes—; una cuota de tarjeta no es
eso y mostrarla ahí no agrega nada. Decisión del usuario, con su motivo. Esto además hace
desaparecer la pregunta de qué significa "gasto real" en un mes que todavía no empezó: en esa
pantalla no hay cuotas, ni futuras ni pasadas.

**Los atajos de comercio tampoco.** `lib/core/frecuentes.ts` ordena por cantidad de usos; una
compra de doce meses se clavaría arriba de la grilla de Cargar durante un año entero sin que
el usuario la haya vuelto a comprar nunca.

Lo que sí funciona solo, sin tocar nada:

- **Topes**: la cuota pesa contra el tope de su `forma_pago`, por `TOPE_DE_FORMA_PAGO`.
- **Agregados del mes**: `gastoPorCategoria`, `gastoPorComercio`, `movimientosOrdenados`.
- **Buscador y filtros**: las cuotas se filtran como cualquier movimiento, bajo el nombre y la
  categoría de su comercio.

---

## Las pantallas

### Cargar — el mismo formulario

`FormGasto` gana un campo **Cuotas** que arranca en 1 y se toca con `−` / `+`.

- En **1**, no cambia absolutamente nada: es el gasto de siempre y se guarda en `movimientos`.
- En **2 o más**, el importe que se tipeó pasa a ser el de *cada* cuota, y aparece debajo un
  renglón de confirmación: *"12 cuotas de $48.500 = $582.000. De noviembre 2026 a octubre
  2027."* Ese renglón es importante: es lo único que separa cargar $48.500 de comprometer
  $582.000, y tiene que verse antes de apretar Guardar.

El campo se muestra siempre, sin condicionarlo a la forma de pago. No vale la pena la regla:
hay cuotas que no son de tarjeta de crédito, y una cuota en efectivo es asunto del usuario.

**Pero no aparece al editar un gasto ya cargado.** `FormGasto` tiene tres modos, y el campo
solo existe en dos: en el alta (arranca en 1) y editando una compra (arranca en las que tiene,
con piso; ver abajo). Editando un movimiento de `movimientos`, el campo no se dibuja. Si
cargaste algo como gasto suelto y en realidad era en cuotas, se borra y se carga de nuevo.

La alternativa era convertir la fila de una tabla a la otra —un alta y un borrado coordinados,
con el id de destino cambiando debajo de la navegación— para un caso que pasa casi nunca, y
dejaba un control a la vista que la mayoría de las veces no hace nada. Que el campo
directamente no esté es más honesto que un campo que se ignora.

La Server Action valida con Zod antes de escribir, como todas. Con `cuotas = 1` escribe un
movimiento; con `cuotas ≥ 2` escribe una compra. Si eso es una action que bifurca o dos
actions distintas queda a criterio del builder, pero **el formulario es uno solo** —la regla
del `CLAUDE.md` sobre `FormGasto` aplica igual acá, y por el mismo motivo.

### Home — la cuota entre los movimientos

La lista del mes trae movimientos y cuotas mezclados y ordenados por fecha. Una cuota se ve
como cualquier gasto, más un chip `6/12` antes del nombre del comercio. La última cuota de un
plan merece distinguirse (el chip en ámbar, `tertiary`): es la única información del plan que
el usuario quiere ver desde el Home.

Tocar una cuota lleva al detalle de la **compra**, no a un movimiento. Como toda fila que
navega, lleva `active:` además de `hover:` — en el celular no hay hover.

### `/fijos` pasa a ser **Fijos y cuotas**

Dos secciones plegables (`components/Seccion.tsx`, el patrón que ya usan Config e Historial):

- **Gastos fijos** — el checklist de siempre, sin cambios. Arranca **abierta**: es la que se
  usa mes a mes.
- **Cuotas** — los planes activos. Encabezado con cuántos son y cuánto pesan este mes. Cada
  plan: chip `n/N`, comercio, importe de la cuota y una barra de avance. Al final, **"Lo que
  viene"**: los próximos meses con su total comprometido y cuántos planes lo arman, que es lo
  que responde "¿con cuánto arranco en junio?".

La card grande de arriba de la pantalla (hoy "Falta pagar $X") **sigue siendo solo de fijos**.
No suma cuotas. Esa card mide facturas, y una cuota no es una factura; mezclarlas desarmaría
el trabajo del commit `309be74`. El total de cuotas vive dentro de su propia sección.

Lo que va adentro de una `Seccion` no lleva `Card` propia: la sección ya pone el fondo
`surface-container`.

### `/compra/[id]` — el detalle del plan

A dónde llega el usuario cuando toca una cuota.

- Comercio, fecha de compra, y el hero: la cuota de este mes.
- Barra de avance y el renglón de números: *"Cuota 1 de 12 · quedan 11 · $533.500 por pagar ·
  total $582.000 · última en octubre 2027."*
- El mes a mes del plan.
- **Editar el plan** — reusa `FormGasto` con una prop `compra`, igual que hoy reusa el mismo
  formulario para editar un movimiento con la prop `movimiento`.
- **Borrar.**

**Editar y borrar significan cosas distintas, y la pantalla tiene que decirlo:**

- **Bajar las cuotas de 12 a 3** quiere decir *"lo di de baja, pagué tres"*. Las tres que ya
  pasaron quedan en noviembre, diciembre y enero para siempre. Las nueve que faltaban dejan de
  aparecer. Es la salida correcta para una devolución o una cancelación.
- **Borrar** quiere decir *"lo cargué mal"*. Desaparece todo, incluidas las cuotas pasadas,
  como si nunca hubiera existido.

Por eso no hace falta un estado "cancelado": bajar el número de cuotas ya lo expresa, y lo
expresa en términos de lo que realmente pasó. El botón de borrar tiene que llevar esa
distinción en el texto, no solo "Borrar".

**El piso del campo Cuotas al editar son las cuotas ya transcurridas.** Si ya pasaron cinco,
el mínimo es cinco. Bajar a tres borraría dos meses **cerrados** en silencio: cambiaría el
total de esos meses, el gráfico de evolución y el promedio histórico, todo presentado al
usuario como "una cancelación". La regla sale de lo que el usuario dijo de las cuotas ya
pagadas: *"que queden, las pagué igual"*. Para deshacer una carga mal hecha está Borrar, que
es justamente la otra acción. Es una regla de dominio y va con test, no una validación de
forma: el piso se calcula contra el mes actual, así que el mismo plan tiene distinto mínimo en
enero y en marzo.

### Cuando el plan termina

Se apaga solo: cuando se pagó la última cuota, el plan deja de aparecer en la sección Cuotas y
deja de generar cuotas. Nadie lo archiva. Las doce cuotas que generó siguen en el historial y
en los gráficos de sus meses, porque ese gasto existió de verdad.

---

## Restricciones

- El `CLAUDE.md` de la raíz manda sobre todo lo de acá. Vale especialmente el checklist de
  "antes de dar por lista una pieza".
- `lib/core/cuotas.ts` es puro: sin Supabase, sin React, sin Next. Con su `.test.ts` al lado.
- El acceso a datos va por `lib/db/cuotas.ts`. Ninguna página llama a supabase-js.
- Importes en centavos enteros. Se formatean solo al mostrar.
- Fechas por `lib/core/fechas.ts`. **Nunca `new Date(iso)` ni `toISOString()`**: los dos pasan
  por UTC y corren la fecha un día en Buenos Aires. Hay un test que documenta el bug.
- Solo tokens del `@theme` de `app/globals.css` y las piezas de `components/ds.tsx`. Si falta
  un color, preguntar.
- El semáforo como siempre: verde OK, ámbar atención, rojo excedido.
- Mobile-first, `max-w-md`, safe areas. Cada ruta nueva con su `loading.tsx` propio, con el
  esqueleto de *esa* pantalla, y el destino acusado en el acto al tocarlo.
- Crear, editar o borrar una compra hace `revalidatePath('/', 'layout')`, no solo `/`: un plan
  mueve topes, predicción, fijos e historial de muchos meses a la vez. Mismo motivo que la
  edición de un movimiento.
- Supabase plan Free, RLS por `user_id` en la tabla nueva.
- Si se tocan los tokens del `@theme` o se suman clases nuevas de Tailwind, correr
  `npm run cn:build` y commitear `lib/cn-tables.mjs`.

---

## Lo que queda a criterio del builder

- Los nombres exactos de archivos, funciones y tipos.
- Si la action de alta bifurca por dentro o son dos actions. El formulario sí es uno solo.
- El rango permitido de `cuotas` en la constraint y en el Zod. Sugerido: 2 a 48.
- Cómo se trae la lista de compras desde `lib/db` (son decenas de filas en toda la vida de la
  app, no miles: traerlas todas es razonable y evita una consulta por mes).
- La forma exacta del campo Cuotas (stepper, input, o las dos cosas).
- Si `tasaVariableDiaria` renombra su parámetro `fijosYaPagados` ahora que recibe fijos más
  cuotas. El comportamiento no es negociable; el nombre sí.
- El orden de las secciones dentro de Fijos y cuotas.
- Si el mes tope de la derivación es un parámetro de la función o lo decide cada página. Lo
  que no queda a criterio es el resultado: la tabla de más arriba.
- Cómo `ListaMovimientos` manda la cuota a `/compra/[id]` en vez de a `/movimiento/[id]`.
  Ramificar el destino según la marca de cuota es más barato que tocar la ruta del
  movimiento, pero es decisión de implementación.
- Cuántos meses muestra "Lo que viene". Cuatro o cinco entran en pantalla sin scroll; que los
  planes largos queden cortados ahí es aceptable, para eso está el detalle de la compra.
