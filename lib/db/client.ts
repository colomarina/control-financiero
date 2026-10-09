import 'server-only'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

/**
 * Cliente de Supabase para el server (Server Components y Server Actions).
 *
 * Nadie fuera de `/lib/db` debería importar esto: las páginas y las actions
 * hablan con los repositorios, no con supabase-js.
 */

function env(nombre: string): string {
  const v = process.env[nombre]
  if (!v) {
    throw new Error(
      `Falta la variable de entorno ${nombre}. ` +
        'Copiá .env.example a .env.local y completá las claves de Supabase.',
    )
  }
  return v
}

export async function crearCliente() {
  const cookieStore = await cookies()

  return createServerClient(
    env('NEXT_PUBLIC_SUPABASE_URL'),
    env('NEXT_PUBLIC_SUPABASE_ANON_KEY'),
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options)
            }
          } catch {
            // Los Server Components no pueden escribir cookies. El refresh de
            // sesión lo hace `proxy.ts`, así que acá se puede ignorar.
          }
        },
      },
    },
  )
}

/**
 * El usuario de la sesión actual, o `null`.
 * Usa `getUser()` (valida contra el servidor de auth), nunca `getSession()`,
 * que solo lee la cookie y se puede falsificar.
 */
export async function usuarioActual() {
  const supabase = await crearCliente()
  const { data } = await supabase.auth.getUser()
  return data.user
}

/** El id del usuario, o explota. Para los repositorios, que siempre necesitan uno. */
export async function usuarioRequerido(): Promise<string> {
  const user = await usuarioActual()
  if (!user) throw new Error('No hay sesión activa.')
  return user.id
}
