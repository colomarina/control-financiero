import { describe, expect, it } from 'vitest'
import { leerPaginado } from './paginar'

/** Un `pagina` falso sobre [0..n-1] que anota los rangos pedidos. */
function falso(n: number) {
  const todo = Array.from({ length: n }, (_, i) => i)
  const llamadas: [number, number][] = []
  const pagina = async (desde: number, hasta: number) => {
    llamadas.push([desde, hasta])
    return todo.slice(desde, hasta + 1)
  }
  return { todo, llamadas, pagina }
}

describe('leerPaginado', () => {
  it('trae todo cuando hay menos de una página', async () => {
    const { todo, llamadas, pagina } = falso(3)
    expect(await leerPaginado(pagina)).toEqual(todo)
    expect(llamadas).toHaveLength(1)
  })

  it('pide una página más cuando la última viene llena', async () => {
    const { todo, llamadas, pagina } = falso(2000)
    expect(await leerPaginado(pagina)).toEqual(todo)
    expect(llamadas).toHaveLength(3)
  })

  it('junta páginas parciales en orden', async () => {
    const { todo, llamadas, pagina } = falso(2500)
    expect(await leerPaginado(pagina)).toEqual(todo)
    expect(llamadas).toHaveLength(3)
  })

  it('respeta los rangos inclusive de PostgREST', async () => {
    const { llamadas, pagina } = falso(2000)
    await leerPaginado(pagina)
    expect(llamadas).toEqual([
      [0, 999],
      [1000, 1999],
      [2000, 2999],
    ])
  })

  it('propaga el error de una página', async () => {
    let n = 0
    const pagina = async () => {
      if (++n === 2) throw new Error('boom')
      return Array.from({ length: 1000 }, (_, i) => i)
    }
    await expect(leerPaginado(pagina)).rejects.toThrow('boom')
  })
})
