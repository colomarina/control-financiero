'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { z } from 'zod'
import { crearCliente } from '@/lib/db/client'

const credencialesSchema = z.object({
  email: z.email('Ese mail no parece válido'),
  password: z.string().min(1, 'Poné tu contraseña'),
})

export type EstadoAuth = { error: string } | null

export async function iniciarSesion(
  _estado: EstadoAuth,
  formData: FormData,
): Promise<EstadoAuth> {
  const parsed = credencialesSchema.safeParse({
    email: formData.get('email'),
    password: formData.get('password'),
  })

  if (!parsed.success) {
    return { error: parsed.error.issues[0].message }
  }

  const supabase = await crearCliente()
  const { error } = await supabase.auth.signInWithPassword(parsed.data)

  if (error) {
    // No distinguimos "mail inexistente" de "contraseña mal": filtrar eso le
    // dice a cualquiera qué mails están registrados.
    return { error: 'Mail o contraseña incorrectos.' }
  }

  revalidatePath('/', 'layout')
  redirect('/')
}

export async function cerrarSesion() {
  const supabase = await crearCliente()
  await supabase.auth.signOut()
  revalidatePath('/', 'layout')
  redirect('/login')
}

// ---------------------------------------------------------------------------
// Cambio de contraseña
// ---------------------------------------------------------------------------

export type EstadoPassword =
  | { ok: true; mensaje: string }
  | { ok: false; error: string }
  | null

const passwordSchema = z
  .object({
    actual: z.string().min(1, 'Poné tu contraseña actual'),
    nueva: z.string().min(8, 'La nueva tiene que tener al menos 8 caracteres'),
    repetir: z.string().min(1, 'Repetí la contraseña nueva'),
  })
  .refine((d) => d.nueva === d.repetir, {
    message: 'Las dos contraseñas nuevas no coinciden',
    path: ['repetir'],
  })
  .refine((d) => d.nueva !== d.actual, {
    message: 'La contraseña nueva tiene que ser distinta de la actual',
    path: ['nueva'],
  })

export async function cambiarPassword(
  _estado: EstadoPassword,
  formData: FormData,
): Promise<EstadoPassword> {
  const parsed = passwordSchema.safeParse({
    actual: formData.get('actual'),
    nueva: formData.get('nueva'),
    repetir: formData.get('repetir'),
  })

  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0].message }
  }

  const supabase = await crearCliente()

  // `current_password` hace que Supabase valide la contraseña vieja del lado
  // del servidor: sin esto, cualquiera con la sesión abierta (un celular que
  // quedó desbloqueado) podría cambiarla sin saberla.
  const { error } = await supabase.auth.updateUser({
    password: parsed.data.nueva,
    current_password: parsed.data.actual,
  })

  if (error) {
    return { ok: false, error: 'No pude cambiarla. ¿La contraseña actual está bien?' }
  }

  return { ok: true, mensaje: 'Contraseña actualizada.' }
}
