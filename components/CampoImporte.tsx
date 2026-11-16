'use client'

import { useEffect, useImperativeHandle, useRef, type Ref } from 'react'
import {
  aplicarEntrada,
  desdeTexto,
  mostrar,
  estaVacio,
  type Importe,
} from '@/lib/core/keypad'
import { cn } from '@/lib/utils'

/**
 * El importe, en grande, tipeado con el teclado del sistema.
 *
 * Antes era un teclado propio de 12 teclas en pantalla (el `Keypad`): ocupaba
 * media pantalla siempre y empujaba el comercio y la forma de pago fuera de
 * vista. Ahora es un campo real con `inputMode="decimal"`, así el celular abre
 * su teclado numérico y lo esconde cuando se pasa al resto del formulario.
 *
 * Las reglas no cambiaron: se tipea en pesos y los centavos solo van con coma.
 * El campo no deja que el navegador edite su texto: cada `beforeinput` se
 * cancela y se traduce con `aplicarEntrada` (`lib/core/keypad.ts`, puro y con
 * test). Por eso los miles los pone la pantalla y el cursor queda siempre al
 * final, tipee quien tipee.
 *
 * En iPhone el teclado no se abre solo al entrar: Safari no deja enfocar sin un
 * toque. Ahí hace falta tocar el monto una vez.
 */
export type CampoImporteHandle = { enfocar: () => void }

export function CampoImporte({
  valor,
  onChange,
  autoFocus = false,
  ref: handle,
}: {
  valor: Importe
  onChange: (i: Importe) => void
  /** Solo en un alta: al editar, el teclado abierto taparía el resto. */
  autoFocus?: boolean
  /** Para que el formulario lo vuelva a enfocar después de guardar. */
  ref?: Ref<CampoImporteHandle>
}) {
  const ref = useRef<HTMLInputElement>(null)
  useImperativeHandle(handle, () => ({ enfocar: () => ref.current?.focus() }), [])

  // El listener es nativo (React no expone `inputType` en `onBeforeInput`), así
  // que lee el valor actual de una ref y no de una clausura vieja.
  const actual = useRef({ valor, onChange })
  useEffect(() => {
    actual.current = { valor, onChange }
  })

  useEffect(() => {
    const el = ref.current
    if (!el) return
    function alEntrar(e: InputEvent) {
      // `insertCompositionText` no se puede cancelar: lo levanta el `onChange`.
      if (!e.cancelable) return
      e.preventDefault()
      const { valor, onChange } = actual.current
      const datos = e.data ?? e.dataTransfer?.getData('text/plain') ?? null
      const nuevo = aplicarEntrada(valor, e.inputType, datos)
      if (nuevo === valor) return
      // Se actualiza ya, sin esperar el render: si llegan dos teclas antes del
      // commit, la segunda parte del valor nuevo y no se pierde un dígito.
      actual.current = { ...actual.current, valor: nuevo }
      onChange(nuevo)
    }
    el.addEventListener('beforeinput', alEntrar)
    return () => el.removeEventListener('beforeinput', alEntrar)
  }, [])

  // El texto lo pone React; el cursor, al final, que es donde entra lo próximo.
  useEffect(() => {
    const el = ref.current
    if (el && document.activeElement === el) {
      el.setSelectionRange(el.value.length, el.value.length)
    }
  }, [valor])

  const vacio = estaVacio(valor)

  return (
    <label className="gap-space-xs flex cursor-text items-baseline justify-center py-2">
      <span
        className={cn(
          'text-keypad-digits transition-colors',
          vacio ? 'text-on-surface-variant/40' : 'text-on-surface-variant',
        )}
      >
        $
      </span>
      <input
        ref={ref}
        aria-label="Importe"
        inputMode="decimal"
        enterKeyHint="done"
        autoComplete="off"
        autoFocus={autoFocus}
        value={vacio ? '' : mostrar(valor)}
        placeholder="0"
        // Lo normal es que todo llegue por `beforeinput` y acá no pase nada. Si
        // el navegador igual cambió el texto —teclados que componen, como
        // algunos de Samsung—, se re-lee entero en vez de perder la tecla.
        onChange={(e) => {
          const nuevo = desdeTexto(e.currentTarget.value)
          actual.current = { ...actual.current, valor: nuevo }
          onChange(nuevo)
        }}
        // Enter en el teclado del celular cierra el teclado en vez de mandar
        // el formulario a medio llenar.
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault()
            e.currentTarget.blur()
          }
        }}
        // Ancho a medida del número para que el `$` quede pegado. A mano y no
        // con `field-sizing`, que Safari de iPhone todavía no soporta en todas
        // las versiones.
        style={{ width: `${Math.max(1, mostrar(valor).length)}ch` }}
        className={cn(
          'text-display-currency-mobile text-on-surface placeholder:text-on-surface-variant/40',
          'max-w-full bg-transparent text-left tabular-nums',
          'caret-primary outline-none',
        )}
      />
    </label>
  )
}
