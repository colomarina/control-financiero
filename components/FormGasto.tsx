'use client'

import { useId, useRef, useState, useTransition } from 'react'
import { toast } from 'sonner'
import { guardarMovimiento } from '@/app/actions/movimientos'
import { FORMAS_PAGO, ETIQUETA_FORMA_PAGO, type FormaPago } from '@/lib/schemas/movimiento'
import type { Comercio } from '@/lib/schemas/comercio'
import { Card, TituloCard, Banner, campo, botonPrimario } from '@/components/ds'
import { Icono } from '@/components/Icono'
import { Keypad } from '@/components/Keypad'
import { IMPORTE_VACIO, mostrar, estaVacio, type Importe } from '@/lib/core/keypad'
import { cn } from '@/lib/utils'

/**
 * Pantalla de carga. Pensada para usarse parado en la caja del super:
 * importe primero y grande, comercio con autocomplete, forma de pago en chips.
 */
export function FormGasto({
  comercios,
  hoy,
}: {
  comercios: Comercio[]
  hoy: string
}) {
  const [pendiente, startTransition] = useTransition()
  const [importe, setImporte] = useState<Importe>(IMPORTE_VACIO)
  const [formaPago, setFormaPago] = useState<FormaPago>('tarjeta_credito')
  const [comercioId, setComercioId] = useState('')
  const [busqueda, setBusqueda] = useState('')
  const listaId = useId()
  const formRef = useRef<HTMLFormElement>(null)

  /**
   * El reset va acá y no en un efecto: limpiar el formulario es consecuencia
   * directa del envío, no de que el estado haya cambiado.
   */
  function enviar(formData: FormData) {
    startTransition(async () => {
      const r = await guardarMovimiento(null, formData)
      if (r?.ok) {
        toast.success(r.mensaje)
        formRef.current?.reset()
        setImporte(IMPORTE_VACIO)
        setComercioId('')
        setBusqueda('')
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

  const elegido = comercios.find((c) => c.id === comercioId)

  return (
    <form ref={formRef} action={enviar} className="gap-space-md flex flex-col">
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
        <input
          id="comercio"
          aria-label="Comercio"
          list={listaId}
          value={busqueda}
          onChange={(e) => alElegirComercio(e.target.value)}
          placeholder="Empezá a escribir…"
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
            <input
              name="fecha"
              aria-label="Fecha"
              type="date"
              defaultValue={hoy}
              required
              className={campo}
            />
          </div>
          <div className="gap-space-xs flex flex-col">
            <TituloCard>Banco</TituloCard>
            <input
              name="banco"
              aria-label="Banco"
              placeholder="Opcional"
              autoComplete="off"
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
        {pendiente ? 'Guardando…' : 'Guardar'}
      </button>
    </form>
  )
}
