/**
 * Falla de un repositorio. El detalle de Postgres va al log del servidor;
 * quien llama (y por lo tanto la pantalla) solo recibe un mensaje limpio.
 */
export function fallaDb(contexto: string, error: { message: string }): never {
  console.error('[db]', contexto, error.message)
  throw new Error(`No pude ${contexto}.`)
}
