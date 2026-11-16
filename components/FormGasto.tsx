'use client'

import { useEffect, useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  guardarMovimiento,
  editarMovimiento,
  eliminarMovimiento,
} from '@/app/actions/movimientos'
import {
  guardarCompraEnCuotas,
  editarCompraEnCuotas,
  eliminarCompraEnCuotas,
} from '@/app/actions/cuotas'
import {
  FORMAS_PAGO,
  ETIQUETA_FORMA_PAGO,
  type FormaPago,
  type MovimientoDetalle,
} from '@/lib/schemas/movimiento'
import type { CompraCuotasDetalle } from '@/lib/schemas/compraCuotas'
import type { Comercio } from '@/lib/schemas/comercio'
import { Card, TituloCard, Banner, campo, botonPrimario } from '@/components/ds'
import { Icono } from '@/components/Icono'
import { Keypad } from '@/components/Keypad'
import { CampoFecha } from '@/components/CampoFecha'
import {
  IMPORTE_VACIO,
  desdeCentavos,
  mostrar,
  estaVacio,
  type Importe,
} from '@/lib/core/keypad'
import { parsearImporte, formatoARS } from '@/lib/core/dinero'
import { nombreMes } from '@/lib/core/fechas'
import { resumenPlan } from '@/lib/core/cuotas'
import { TOPE_DE_FORMA_PAGO } from '@/lib/core/gastos'
import type { Tope } from '@/lib/core/puntuales'
import { cn } from '@/lib/utils'

/**
 * El formulario de un gasto, que sirve para cargarlo y para editarlo.
 *
 * Pensado para usarse parado en la caja del super: importe primero y grande,
 * comercio a un tap, forma de pago en chips.
 *
 * Es uno solo a propósito. Si la edición tuviera su propio formulario, las dos
 * pantallas se irían separando —un campo nuevo acá, una validación distinta
 * allá— hasta que un gasto editado dejara de cumplir las reglas de uno nuevo.
 */
export function FormGasto({
  comercios,
  frecuentes,
  hoy,
  movimiento,
  compra,
  minimoCuotas = 1,
  umbrales = { tarjeta: null, efectivo: null },
}: {
  comercios: Comercio[]
  /** Atajos: los comercios más usados en los últimos dos meses. */
  frecuentes: Comercio[]
  hoy: string
  /** Si viene, el formulario edita ese movimiento en vez de crear uno nuevo. */
  movimiento?: MovimientoDetalle
  /** Si viene, el formulario edita esa compra en cuotas en vez de un movimiento suelto. */
  compra?: CompraCuotasDetalle
  /**
   * Piso del stepper de Cuotas al editar una compra: las que ya transcurrieron
   * no se pueden bajar. Viene calculado del server —`cuotasTranscurridas`
   * necesita "hoy", y este componente es cliente— y no se usa fuera de ese modo.
   */
  minimoCuotas?: number
  /**
   * Desde qué importe (centavos) una compra se sugiere como puntual, por tope.
   * `null` si no hay histórico. Sin usar al editar una compra en cuotas.
   */
  umbrales?: Record<Tope, number | null>
}) {
  // Tres modos: alta (ninguno de los dos), editar un movimiento suelto, o
  // editar una compra en cuotas. `base` junta los campos que movimiento y
  // compra comparten (fecha, comercio, forma de pago...) para no repetir el
  // ternario en cada inicialización.
  const esCompra = compra !== undefined
  const esEdicion = movimiento !== undefined || esCompra
  const base = movimiento ?? compra
  const router = useRouter()

  const [enTransicion, startTransition] = useTransition()
  /**
   * Se enciende al terminar de guardar o borrar una edición y **no se apaga**:
   * el componente se desmonta cuando llega la pantalla destino.
   *
   * Sin esto, entre que la action responde y la navegación ocurre, el botón
   * volvía por un instante a decir "Guardar cambios" —como si no hubiera
   * pasado nada— y recién después saltaba. Ese parpadeo es lo que se sentía
   * raro.
   */
  const [saliendo, setSaliendo] = useState(false)
  /** Para que el botón de borrar no diga "Guardando…", que sería mentira. */
  const [borrando, setBorrando] = useState(false)
  /**
   * Borrar pide dos toques en vez del `confirm()` del sistema, que lo dibuja el
   * SO y no se puede vestir. El primero arma la confirmación; si no llega el
   * segundo en 4 s, se desarma sola.
   */
  const [confirmando, setConfirmando] = useState(false)
  const temporizador = useRef<ReturnType<typeof setTimeout> | null>(null)
  const pendiente = enTransicion || saliendo
  const [importe, setImporte] = useState<Importe>(
    movimiento
      ? desdeCentavos(movimiento.importeCentavos)
      : compra
        ? desdeCentavos(compra.importeCuotaCentavos)
        : IMPORTE_VACIO,
  )
  // `form.reset()` no alcanza para un campo controlado: sin esto, después de
  // cargar un gasto de ayer el siguiente arrancaría también en ayer. Cambiar
  // la key remonta el campo y vuelve a hoy.
  const [versionFecha, setVersionFecha] = useState(0)
  const [formaPago, setFormaPago] = useState<FormaPago>(base?.formaPago ?? 'tarjeta_credito')
  const [comercioId, setComercioId] = useState(base?.comercioId ?? '')
  const [busqueda, setBusqueda] = useState(base?.comercio ?? '')
  // En alta arranca en 1 (un gasto de siempre); al editar una compra, en el
  // número de cuotas que tiene hoy. `CampoFecha` guarda la fecha en un input
  // oculto; este estado es la única copia que el resumen necesita leer.
  const [cuotas, setCuotas] = useState(compra?.cuotas ?? 1)
  const [fecha, setFecha] = useState(base?.fecha ?? hoy)
  // `null` = sin decisión manual: manda la sugerencia por monto. Siempre viaja
  // en el form (también al editar), o cada edición borraría una marca manual.
  const [forzado, setForzado] = useState<boolean | null>(movimiento?.puntual ?? null)
  const listaId = useId()
  const formRef = useRef<HTMLFormElement>(null)

  /**
   * El reset va acá y no en un efecto: limpiar el formulario es consecuencia
   * directa del envío, no de que el estado haya cambiado.
   */
  function enviar(formData: FormData) {
    startTransition(async () => {
      const r = esCompra
        ? await editarCompraEnCuotas(null, formData)
        : movimiento
          ? await editarMovimiento(null, formData)
          : cuotas >= 2
            ? await guardarCompraEnCuotas(null, formData)
            : await guardarMovimiento(null, formData)

      if (!r) return

      if (!r.ok) {
        toast.error(r.error)
        return
      }

      toast.success(r.mensaje)

      if (esEdicion) {
        // Editar es una visita puntual: terminada, se vuelve de donde se vino.
        // El botón queda en "Guardando…" hasta que la pantalla destino aparece.
        setSaliendo(true)
        router.back()
        return
      }

      formRef.current?.reset()
      setImporte(IMPORTE_VACIO)
      setComercioId('')
      setBusqueda('')
      setVersionFecha((v) => v + 1)
      setFecha(hoy)
      setCuotas(1)
      setForzado(null)
    })
  }

  function limpiarTemporizador() {
    if (temporizador.current) clearTimeout(temporizador.current)
    temporizador.current = null
  }

  // Si el componente se desmonta con la ventana abierta, no queda un
  // setState colgado.
  useEffect(() => limpiarTemporizador, [])

  const mensajeBorrar = compra
    ? `Se borra la compra en ${compra.comercio} y desaparecen también las cuotas que ya pasaron. No se puede deshacer.`
    : base
      ? `Se borra el gasto de ${base.comercio}. No se puede deshacer.`
      : ''

  function borrar() {
    if (!base) return
    if (!confirmando) {
      setConfirmando(true)
      limpiarTemporizador()
      temporizador.current = setTimeout(() => setConfirmando(false), 4000)
      return
    }
    limpiarTemporizador()
    setConfirmando(false)

    setBorrando(true)
    startTransition(async () => {
      const r = compra ? await eliminarCompraEnCuotas(compra.id) : await eliminarMovimiento(base.id)
      if (r?.ok) {
        toast.success(r.mensaje)
        setSaliendo(true)
        router.back()
      } else if (r) {
        // Si falló seguís en la pantalla: el botón tiene que volver a estar
        // usable para reintentar.
        setBorrando(false)
        toast.error(r.error)
      }
    })
  }

  // El datalist devuelve el NOMBRE; acá lo traducimos al id que espera la action.
  function alElegirComercio(valor: string) {
    setBusqueda(valor)
    const hit = comercios.find((c) => c.nombre.toLowerCase() === valor.trim().toLowerCase())
    setComercioId(hit?.id ?? '')
  }

  /**
   * Tap en un atajo. Llena también el input de texto: así el campo queda
   * coherente con lo elegido y se puede corregir desde ahí sin pelear con el
   * chip seleccionado.
   */
  function elegirComercio(c: Comercio) {
    setComercioId(c.id)
    setBusqueda(c.nombre)
  }

  const elegido = comercios.find((c) => c.id === comercioId)

  const umbral = umbrales[TOPE_DE_FORMA_PAGO[formaPago]]
  const importeCentavos = parsearImporte(mostrar(importe)) ?? 0
  const sugerido = !elegido?.esFijo && umbral !== null && importeCentavos > umbral
  const puntualActivo = forzado ?? sugerido

  return (
    <form ref={formRef} action={enviar} className="gap-space-md flex flex-col">
      {base && <input type="hidden" name="id" value={base.id} />}
      <input type="hidden" name="comercioId" value={comercioId} />
      <input type="hidden" name="formaPago" value={formaPago} />

      {/* El importe es el protagonista. El valor viaja como texto ('1.500,50')
          porque la action lo parsea con `parsearImporte`. Con 2+ cuotas es el
          importe de CADA cuota, no el total: `guardarCompraEnCuotas` lo toma así. */}
      <input type="hidden" name="importe" value={mostrar(importe)} />
      {/* No va al editar un movimiento suelto: ese modo ni siquiera muestra el
          campo. Sí va en alta (venga o no a ser una compra) y al editar una
          compra, que siempre manda `cuotas`. */}
      {!movimiento && <input type="hidden" name="cuotas" value={cuotas} />}
      {!esCompra && (
        <input
          type="hidden"
          name="puntual"
          value={forzado === null ? '' : forzado ? 'si' : 'no'}
        />
      )}

      <Card>
        <TituloCard>Importe</TituloCard>
        <Keypad valor={importe} onChange={setImporte} />
      </Card>

      {/* Al editar un movimiento suelto no tiene sentido: convertir un gasto
          ya cargado en una compra en cuotas (o viceversa) es otra operación,
          no una edición, y dejar el stepper visible ahí sería un control a la
          vista que no hace nada. Al editar una compra sí se muestra —achicar
          el plan es la forma de registrar una baja o una devolución— con el
          piso en `minimoCuotas`: las cuotas ya transcurridas no se pueden
          borrar, quedan pagadas. */}
      {!movimiento && (
        <Card>
          <TituloCard>Cuotas</TituloCard>
          <div className="gap-space-lg flex items-center justify-center">
            <button
              type="button"
              onClick={() => setCuotas((c) => Math.max(minimoCuotas, c - 1))}
              disabled={cuotas === minimoCuotas}
              aria-label="Menos cuotas"
              className="bg-surface-container-high text-on-surface flex h-11 w-11 items-center justify-center rounded-lg transition-transform active:scale-95 disabled:opacity-40"
            >
              <Icono nombre="remove" className="text-[20px]" />
            </button>
            <span className="text-headline-sm text-on-surface w-8 text-center tabular-nums">
              {cuotas}
            </span>
            <button
              type="button"
              onClick={() => setCuotas((c) => Math.min(48, c + 1))}
              disabled={cuotas === 48}
              aria-label="Más cuotas"
              className="bg-surface-container-high text-on-surface flex h-11 w-11 items-center justify-center rounded-lg transition-transform active:scale-95 disabled:opacity-40"
            >
              <Icono nombre="add" className="text-[20px]" />
            </button>
          </div>

          {cuotas >= 2 &&
            (() => {
              const cuota = parsearImporte(mostrar(importe)) ?? 0
              const { total, desde, hasta } = resumenPlan(cuota, cuotas, fecha)
              return (
                <Banner icono="credit_card">
                  <span className="text-on-surface">
                    {cuotas} cuotas de {formatoARS(cuota)} ={' '}
                    <span className="text-primary">{formatoARS(total)}</span>. De{' '}
                    {nombreMes(desde)} a {nombreMes(hasta)}.
                  </span>
                </Banner>
              )
            })()}
        </Card>
      )}

      <Card>
        <TituloCard>Comercio</TituloCard>

        {/* Los habituales, a un tap. Con esto y el teclado numérico, cargar un
            gasto de todos los días no necesita teclado en ningún momento. */}
        {frecuentes.length > 0 && (
          <div className="gap-space-sm grid grid-cols-2">
            {frecuentes.map((c) => (
              <button
                key={c.id}
                type="button"
                onClick={() => elegirComercio(c)}
                aria-pressed={comercioId === c.id}
                className={cn(
                  'px-space-sm gap-space-xs flex touch-manipulation flex-col items-start',
                  'rounded-lg py-2 text-left transition-transform active:scale-95',
                  comercioId === c.id
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface',
                )}
              >
                <span className="text-body-md w-full truncate">{c.nombre}</span>
                <span
                  className={cn(
                    'text-body-sm w-full truncate',
                    comercioId === c.id ? 'text-on-primary/70' : 'text-on-surface-variant',
                  )}
                >
                  {c.categoria}
                </span>
              </button>
            ))}
          </div>
        )}

        <input
          id="comercio"
          aria-label="Comercio"
          list={listaId}
          value={busqueda}
          onChange={(e) => alElegirComercio(e.target.value)}
          placeholder={frecuentes.length > 0 ? 'Otro comercio…' : 'Empezá a escribir…'}
          autoComplete="off"
          required
          className={campo}
        />
        <datalist id={listaId}>
          {comercios.map((c) => (
            <option key={c.id} value={c.nombre}>
              {c.categoria}
            </option>
          ))}
        </datalist>

        {elegido ? (
          <p className="text-body-sm text-on-surface-variant">
            {elegido.categoria}
            {elegido.subcategoria ? ` · ${elegido.subcategoria}` : ''}
            {elegido.esFijo ? ' · gasto fijo' : ''}
          </p>
        ) : busqueda.trim() !== '' ? (
          <p className="text-body-sm text-tertiary">
            Ese comercio no está en el catálogo. Elegí uno de la lista.
          </p>
        ) : (
          <Banner icono="auto_awesome">
            La categoría y si es fijo salen solos del comercio.
          </Banner>
        )}
      </Card>

      <Card>
        <fieldset className="gap-space-sm flex flex-col">
          <legend className="text-label-caps text-on-surface-variant mb-space-sm uppercase">
            Forma de pago
          </legend>
          <div className="gap-space-sm grid grid-cols-2">
            {FORMAS_PAGO.map((f) => (
              <button
                key={f}
                type="button"
                onClick={() => setFormaPago(f)}
                aria-pressed={formaPago === f}
                className={cn(
                  'px-space-sm text-body-md rounded-lg py-3 transition-transform active:scale-95',
                  formaPago === f
                    ? 'bg-primary text-on-primary'
                    : 'bg-surface-container-high text-on-surface',
                )}
              >
                {ETIQUETA_FORMA_PAGO[f]}
              </button>
            ))}
          </div>
        </fieldset>
      </Card>

      {!esCompra && cuotas < 2 && (
        <Card>
          <div className="gap-space-md flex items-center justify-between">
            <div className="gap-space-xs flex flex-col">
              <span id="puntual-titulo" className="text-body-md text-on-surface">
                Compra puntual
              </span>
              <span className="text-body-sm text-on-surface-variant">
                {forzado === null && sugerido
                  ? 'Lo marcamos por el monto'
                  : 'No se proyecta al resto del mes'}
              </span>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={puntualActivo}
              aria-labelledby="puntual-titulo"
              onClick={() => setForzado(!puntualActivo)}
              className={cn(
                'relative h-7 w-12 shrink-0 rounded-full transition-colors',
                puntualActivo ? 'bg-primary' : 'bg-surface-container-high',
              )}
            >
              <span
                className={cn(
                  'absolute top-1 left-1 h-5 w-5 rounded-full transition-transform',
                  puntualActivo ? 'bg-on-primary translate-x-5' : 'bg-on-surface-variant',
                )}
              />
            </button>
          </div>
        </Card>
      )}

      <Card>
        <div className="gap-space-sm grid grid-cols-2">
          <div className="gap-space-xs flex flex-col">
            <TituloCard>Fecha</TituloCard>
            <CampoFecha
              key={versionFecha}
              name="fecha"
              defaultValue={base?.fecha ?? hoy}
              onChange={setFecha}
            />
          </div>
          <div className="gap-space-xs flex flex-col">
            <TituloCard>Banco</TituloCard>
            <input
              name="banco"
              aria-label="Banco"
              placeholder="Opcional"
              autoComplete="off"
              defaultValue={base?.banco ?? ''}
              className={campo}
            />
          </div>
        </div>

        <div className="gap-space-xs mt-space-sm flex flex-col">
          <TituloCard>Nota</TituloCard>
          <input
            name="nota"
            aria-label="Nota"
            placeholder="Opcional"
            autoComplete="off"
            defaultValue={base?.nota ?? ''}
            className={campo}
          />
        </div>
      </Card>

      <button
        type="submit"
        disabled={pendiente || comercioId === '' || estaVacio(importe)}
        className={botonPrimario}
      >
        <Icono nombre={pendiente ? 'hourglass_top' : 'check'} className="text-[20px]" />
        {pendiente ? 'Guardando…' : esEdicion ? 'Guardar cambios' : 'Guardar'}
      </button>

      {esEdicion && (
        // Borrar va último y en rojo sobre fondo plano: es destructivo, no
        // tiene que competir visualmente con guardar.
        <button
          type="button"
          onClick={borrar}
          disabled={pendiente}
          className={cn(
            'text-body-md gap-space-sm flex h-12 w-full items-center justify-center rounded-lg transition-transform active:scale-95 disabled:opacity-40',
            confirmando ? 'bg-error text-on-error' : 'text-error',
          )}
        >
          <Icono nombre={borrando ? 'hourglass_top' : 'delete'} className="text-[20px]" />
          {/* "Borrar gasto" alcanza para un movimiento: desaparece y listo. Una
              compra necesita la aclaración, porque bajar las cuotas (arriba)
              también borra algo —las que faltaban— y es la operación correcta
              para una baja o devolución. Esto es para "lo cargué mal". */}
          {borrando
            ? 'Borrando…'
            : confirmando
              ? 'Tocá de nuevo para borrar'
              : esCompra
                ? 'Borrar — lo cargué mal'
                : 'Borrar gasto'}
        </button>
      )}
      {esEdicion && confirmando && (
        <p role="status" className="text-on-surface-variant text-body-sm text-center">
          {mensajeBorrar}
        </p>
      )}
    </form>
  )
}
