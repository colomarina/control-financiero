'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { useRouter } from 'next/navigation'
import { toast } from 'sonner'
import {
  guardarMovimiento,
  editarMovimiento,
  eliminarMovimiento,
} from '@/app/actions/movimientos'
import {
  FORMAS_PAGO,
  ETIQUETA_FORMA_PAGO,
  type FormaPago,
  type MovimientoDetalle,
} from '@/lib/schemas/movimiento'
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
}: {
  comercios: Comercio[]
  /** Atajos: los comercios más usados en los últimos dos meses. */
  frecuentes: Comercio[]
  hoy: string
  /** Si viene, el formulario edita ese movimiento en vez de crear uno nuevo. */
  movimiento?: MovimientoDetalle
}) {
  const esEdicion = movimiento !== undefined
  const router = useRouter()

  const [pendiente, startTransition] = useTransition()
  const [importe, setImporte] = useState<Importe>(
    movimiento ? desdeCentavos(movimiento.importeCentavos) : IMPORTE_VACIO,
  )
  // `form.reset()` no alcanza para un campo controlado: sin esto, después de
  // cargar un gasto de ayer el siguiente arrancaría también en ayer. Cambiar
  // la key remonta el campo y vuelve a hoy.
  const [versionFecha, setVersionFecha] = useState(0)
  const [formaPago, setFormaPago] = useState<FormaPago>(
    movimiento?.formaPago ?? 'tarjeta_credito',
  )
  const [comercioId, setComercioId] = useState(movimiento?.comercioId ?? '')
  const [busqueda, setBusqueda] = useState(movimiento?.comercio ?? '')
  const listaId = useId()
  const formRef = useRef<HTMLFormElement>(null)

  /**
   * El reset va acá y no en un efecto: limpiar el formulario es consecuencia
   * directa del envío, no de que el estado haya cambiado.
   */
  function enviar(formData: FormData) {
    startTransition(async () => {
      const r = esEdicion
        ? await editarMovimiento(null, formData)
        : await guardarMovimiento(null, formData)

      if (!r) return

      if (!r.ok) {
        toast.error(r.error)
        return
      }

      toast.success(r.mensaje)

      if (esEdicion) {
        // Editar es una visita puntual: terminada, se vuelve de donde se vino.
        router.back()
        return
      }

      formRef.current?.reset()
      setImporte(IMPORTE_VACIO)
      setComercioId('')
      setBusqueda('')
      setVersionFecha((v) => v + 1)
    })
  }

  function borrar() {
    if (!movimiento) return
    if (!confirm(`¿Borrar el gasto de ${movimiento.comercio}? No se puede deshacer.`)) return

    startTransition(async () => {
      const r = await eliminarMovimiento(movimiento.id)
      if (r?.ok) {
        toast.success(r.mensaje)
        router.back()
      } else if (r) {
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

  return (
    <form ref={formRef} action={enviar} className="gap-space-md flex flex-col">
      {movimiento && <input type="hidden" name="id" value={movimiento.id} />}
      <input type="hidden" name="comercioId" value={comercioId} />
      <input type="hidden" name="formaPago" value={formaPago} />

      {/* El importe es el protagonista. El valor viaja como texto ('1.500,50')
          porque la action lo parsea con `parsearImporte`. */}
      <input type="hidden" name="importe" value={mostrar(importe)} />

      <Card>
        <TituloCard>Importe</TituloCard>
        <Keypad valor={importe} onChange={setImporte} />
      </Card>

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

      <Card>
        <div className="gap-space-sm grid grid-cols-2">
          <div className="gap-space-xs flex flex-col">
            <TituloCard>Fecha</TituloCard>
            <CampoFecha
              key={versionFecha}
              name="fecha"
              defaultValue={movimiento?.fecha ?? hoy}
            />
          </div>
          <div className="gap-space-xs flex flex-col">
            <TituloCard>Banco</TituloCard>
            <input
              name="banco"
              aria-label="Banco"
              placeholder="Opcional"
              autoComplete="off"
              defaultValue={movimiento?.banco ?? ''}
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
            defaultValue={movimiento?.nota ?? ''}
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
          className="text-error text-body-md gap-space-sm flex h-12 w-full items-center justify-center rounded-lg transition-transform active:scale-95 disabled:opacity-40"
        >
          <Icono nombre="delete" className="text-[20px]" />
          Borrar gasto
        </button>
      )}
    </form>
  )
}
