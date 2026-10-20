import { describe, it, expect } from 'vitest'
import { siguienteIndice, buscarPorTexto } from './selector'

// Las categorías reales de la app, que son las que hacen falta ordenar y buscar.
const ETIQUETAS = [
  'Todas las categorías',
  'Animales',
  'Auto',
  'Nutrición',
  'Restaurantes',
  'Salud',
  'Seguros',
  'Servicios',
]

describe('siguienteIndice', () => {
  it('avanza y retrocede de a uno', () => {
    expect(siguienteIndice(2, 8, 1)).toBe(3)
    expect(siguienteIndice(2, 8, -1)).toBe(1)
  })

  it('da la vuelta en los extremos', () => {
    expect(siguienteIndice(7, 8, 1)).toBe(0)
    expect(siguienteIndice(0, 8, -1)).toBe(7)
  })

  it('sin nada enfocado, bajando empieza en la primera y subiendo en la última', () => {
    expect(siguienteIndice(-1, 8, 1)).toBe(0)
    expect(siguienteIndice(-1, 8, -1)).toBe(7)
  })

  it('una lista vacía no tiene índice', () => {
    expect(siguienteIndice(-1, 0, 1)).toBe(-1)
  })

  it('con una sola opción se queda en ella', () => {
    expect(siguienteIndice(0, 1, 1)).toBe(0)
    expect(siguienteIndice(0, 1, -1)).toBe(0)
  })
})

describe('buscarPorTexto', () => {
  it('encuentra por el principio de la etiqueta', () => {
    expect(buscarPorTexto(ETIQUETAS, 'res')).toBe(4)
    expect(buscarPorTexto(ETIQUETAS, 'au')).toBe(2)
  })

  it('ignora acentos y mayúsculas', () => {
    expect(buscarPorTexto(ETIQUETAS, 'nutricion')).toBe(3)
    expect(buscarPorTexto(ETIQUETAS, 'NUTRI')).toBe(3)
  })

  it('no busca en el medio de la palabra', () => {
    expect(buscarPorTexto(ETIQUETAS, 'guros')).toBeNull()
  })

  it('arranca después de donde está el foco', () => {
    expect(buscarPorTexto(ETIQUETAS, 's', 4)).toBe(5)
    expect(buscarPorTexto(ETIQUETAS, 's', 5)).toBe(6)
  })

  it('da la vuelta si no quedan coincidencias adelante', () => {
    expect(buscarPorTexto(ETIQUETAS, 's', 7)).toBe(5)
  })

  // Lo que hace el select del sistema: "sss" no busca "sss".
  it('repetir la misma tecla cicla entre las que empiezan con ella', () => {
    expect(buscarPorTexto(ETIQUETAS, 'ss', 5)).toBe(6)
    expect(buscarPorTexto(ETIQUETAS, 'sss', 6)).toBe(7)
  })

  it('pero dos letras distintas sí afinan la búsqueda', () => {
    expect(buscarPorTexto(ETIQUETAS, 'se', 0)).toBe(6)
  })

  it('sin texto no busca nada', () => {
    expect(buscarPorTexto(ETIQUETAS, '')).toBeNull()
    expect(buscarPorTexto(ETIQUETAS, '  ')).toBeNull()
  })

  it('una lista vacía no devuelve índice', () => {
    expect(buscarPorTexto([], 'a')).toBeNull()
  })
})
