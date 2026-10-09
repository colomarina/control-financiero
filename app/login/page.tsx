'use client'

import { useActionState } from 'react'
import { iniciarSesion, type EstadoAuth } from '@/app/actions/auth'
import { Icono } from '@/components/Icono'

export default function LoginPage() {
  const [estado, accion, pendiente] = useActionState<EstadoAuth, FormData>(
    iniciarSesion,
    null,
  )

  const campo =
    'bg-surface-container-high text-on-surface placeholder:text-on-surface-variant/60 ' +
    'border-outline-variant focus:border-primary focus:ring-primary/30 w-full rounded-lg ' +
    'border px-space-sm py-2.5 text-body-md outline-none focus:ring-2'

  return (
    <main className="px-margin-mobile flex min-h-dvh items-center justify-center">
      <form action={accion} className="gap-space-lg flex w-full max-w-md flex-col">
        <div className="gap-space-sm flex flex-col items-center text-center">
          <span className="bg-primary/15 text-primary grid size-14 place-items-center rounded-full">
            <Icono nombre="savings" className="text-[28px]" />
          </span>
          <h1 className="text-headline-lg-mobile text-on-surface">Control Financiero</h1>
          <p className="text-body-sm text-on-surface-variant">Entrá para ver tus gastos.</p>
        </div>

        <div className="gap-space-md flex flex-col">
          <div className="gap-space-xs flex flex-col">
            <label htmlFor="email" className="text-label-caps text-on-surface-variant uppercase">
              Mail
            </label>
            <input
              id="email"
              name="email"
              type="email"
              inputMode="email"
              autoComplete="username"
              required
              autoFocus
              className={campo}
            />
          </div>

          <div className="gap-space-xs flex flex-col">
            <label htmlFor="password" className="text-label-caps text-on-surface-variant uppercase">
              Contraseña
            </label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              required
              className={campo}
            />
          </div>
        </div>

        {estado?.error && (
          <p role="alert" className="text-body-sm text-error text-center">
            {estado.error}
          </p>
        )}

        <button
          type="submit"
          disabled={pendiente}
          className="bg-primary text-on-primary text-body-lg h-12 w-full rounded-lg font-medium transition-transform active:scale-95 disabled:opacity-40"
        >
          {pendiente ? 'Entrando…' : 'Entrar'}
        </button>
      </form>
    </main>
  )
}
