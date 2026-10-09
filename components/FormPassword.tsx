'use client'

import { useRef, useTransition } from 'react'
import { toast } from 'sonner'
import { cambiarPassword } from '@/app/actions/auth'
import { Card, TituloCard, campo, botonSecundario, etiqueta } from '@/components/ds'

/**
 * Cambio de contraseña. La valida el server contra la actual (`current_password`),
 * así que no alcanza con tener la sesión abierta.
 */
export function FormPassword({ email }: { email: string }) {
  const [pendiente, startTransition] = useTransition()
  const formRef = useRef<HTMLFormElement>(null)

  function enviar(formData: FormData) {
    startTransition(async () => {
      const r = await cambiarPassword(null, formData)
      if (r?.ok) {
        toast.success(r.mensaje)
        formRef.current?.reset()
      } else if (r) {
        toast.error(r.error)
      }
    })
  }

  return (
    <form ref={formRef} action={enviar}>
      <Card>
        <TituloCard>Contraseña</TituloCard>

        {/* El mail, oculto, para que el gestor de contraseñas sepa a qué cuenta
            corresponde la que está por guardar. */}
        <input
          type="text"
          name="username"
          autoComplete="username"
          value={email}
          hidden
          readOnly
        />

        <div className="gap-space-xs flex flex-col">
          <label htmlFor="actual" className={etiqueta}>
            Actual
          </label>
          <input
            id="actual"
            name="actual"
            type="password"
            autoComplete="current-password"
            required
            className={campo}
          />
        </div>

        <div className="gap-space-xs flex flex-col">
          <label htmlFor="nueva" className={etiqueta}>
            Nueva
          </label>
          <input
            id="nueva"
            name="nueva"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className={campo}
          />
          <p className="text-body-sm text-on-surface-variant">Mínimo 8 caracteres.</p>
        </div>

        <div className="gap-space-xs flex flex-col">
          <label htmlFor="repetir" className={etiqueta}>
            Repetir la nueva
          </label>
          <input
            id="repetir"
            name="repetir"
            type="password"
            autoComplete="new-password"
            minLength={8}
            required
            className={campo}
          />
        </div>

        <button
          type="submit"
          disabled={pendiente}
          className={`${botonSecundario} disabled:opacity-40`}
        >
          {pendiente ? 'Cambiando…' : 'Cambiar contraseña'}
        </button>
      </Card>
    </form>
  )
}
