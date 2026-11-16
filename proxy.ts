import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'

/**
 * Corre antes de cada request: refresca la sesión de Supabase y manda al login
 * a quien no la tenga.
 *
 * (En Next 16 esto se llama `proxy`; era `middleware` hasta la 15.)
 */
export async function proxy(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value)
          }
          response = NextResponse.next({ request })
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options)
          }
        },
      },
    },
  )

  // getClaims() valida la firma del JWT en local: con claves asimétricas (ES256)
  // la verifica contra el JWKS cacheado, sin ir al servidor de auth. Sigue sin
  // ser getSession(), que solo lee la cookie y no valida nada.
  const { data } = await supabase.auth.getClaims()
  const user = data?.claims?.sub ?? null

  const esLogin = request.nextUrl.pathname.startsWith('/login')

  if (!user && !esLogin) {
    const url = request.nextUrl.clone()
    url.pathname = '/login'
    return NextResponse.redirect(url)
  }

  if (user && esLogin) {
    const url = request.nextUrl.clone()
    url.pathname = '/'
    return NextResponse.redirect(url)
  }

  return response
}

export const config = {
  matcher: [
    /*
     * Todo menos los estáticos y las imágenes.
     *
     * `manifest.webmanifest` y `sw.js` tienen que quedar afuera sí o sí: el
     * navegador los pide por su cuenta (el manifest muchas veces sin cookies),
     * y si les contesta un redirect al login la app deja de ser instalable.
     */
    '/((?!_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|.*\.(?:svg|png|jpg|jpeg|gif|webp)$).*)',
  ],
}
