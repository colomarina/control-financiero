/**
 * PostgREST corta cada respuesta en 1000 filas sin avisar: una lectura larga
 * que no pagina devuelve un historial incompleto y nada falla. Esto pide
 * páginas de `tam` filas hasta que una venga con menos.
 *
 * Sin imports de Supabase: `pagina` arma la query y le agrega `.range()`.
 * Esa query tiene que llevar un `.order` estable, o las páginas se pisan.
 */
export async function leerPaginado<T>(
  pagina: (desde: number, hasta: number) => Promise<T[]>,
  tam = 1000,
): Promise<T[]> {
  const filas: T[] = []
  for (let desde = 0; ; desde += tam) {
    const lote = await pagina(desde, desde + tam - 1)
    filas.push(...lote)
    if (lote.length < tam) return filas
  }
}
