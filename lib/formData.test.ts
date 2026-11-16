import { describe, it, expect } from 'vitest'
import { texto, triestado } from './formData'

describe('texto', () => {
  it('recorta espacios', () => {
    const fd = new FormData()
    fd.set('nota', '  compré de más  ')
    expect(texto(fd, 'nota')).toBe('compré de más')
  })

  it('un campo vacío (tras recortar) es null, no string vacío', () => {
    const fd = new FormData()
    fd.set('nota', '   ')
    expect(texto(fd, 'nota')).toBeNull()
  })

  it('un campo que no vino es null', () => {
    const fd = new FormData()
    expect(texto(fd, 'nota')).toBeNull()
  })
})

describe('triestado', () => {
  const fd = (campos: Record<string, string>) => {
    const f = new FormData()
    for (const [k, v] of Object.entries(campos)) f.set(k, v)
    return f
  }

  it("'si' es true, 'no' es false", () => {
    expect(triestado(fd({ puntual: 'si' }), 'puntual')).toBe(true)
    expect(triestado(fd({ puntual: 'no' }), 'puntual')).toBe(false)
  })

  it('vacío, ausente o cualquier otra cosa es null (lo decide la app)', () => {
    expect(triestado(fd({ puntual: '' }), 'puntual')).toBeNull()
    expect(triestado(fd({}), 'puntual')).toBeNull()
    expect(triestado(fd({ puntual: 'quizás' }), 'puntual')).toBeNull()
  })
})
