import { describe, it, expect } from 'vitest'
import { texto } from './formData'

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
