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
