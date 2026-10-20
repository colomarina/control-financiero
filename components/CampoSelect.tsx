'use client'

import { useEffect, useRef, useState, type KeyboardEvent } from 'react'
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover'
import { Icono } from '@/components/Icono'
import { Separador, campo } from '@/components/ds'
import { siguienteIndice, buscarPorTexto } from '@/lib/core/selector'
import { cn } from '@/lib/utils'

export type OpcionSelect = { valor: string; etiqueta: string }

/** Cuánto espera el typeahead antes de olvidar lo tipeado. */
const MS_TYPEAHEAD = 600

/**
 * Desplegable de opciones, con el mismo patrón que `CampoFecha`: un trigger
 * con la clase `campo` y un `Popover` con contenido nuestro.
 *
 * El argumento es el mismo que llevó a reemplazar el `<input type="date">`: el
 * menú de un `<select>` nativo lo dibuja el sistema operativo y no hay forma de
 * vestirlo —en el escritorio sale con fondo claro y el highlight azul de
 * Windows—, mientras que acá el desplegable se ve igual en todos lados y usa la
 * paleta del design system.
 *
 * Dos intentos que ya se descartaron y no conviene repetir:
 *
 * 1. Envolver el `<select>` nativo en un `<label>` para agrandar el área
 *    táctil: tocar una etiqueta **enfoca** el select pero no abre el
 *    desplegable, así que quedaba viva solo la palabra del valor.
 * 2. Taparlo con una copia decorativa y mandarlo a `opacity-0`: el menú nativo
 *    **hereda esa opacidad** (opciones fantasma sobre fondo claro) y, al medir
 *    el control toda la fila, abría encima en vez de abajo.
 *
 * Lo que el nativo daba gratis y acá hay que poner a mano —flechas, Home/End y
 * buscar por lo que tipeás— vive puro y con test en `lib/core/selector.ts`.
 */
export function CampoSelect({
  opciones,
  titulo,
  variante = 'campo',
  icono,
  vacio,
  placeholder = 'Elegí una opción',
  valor,
  onCambio,
  name,
  defaultValue = '',
  disabled = false,
}: {
  opciones: OpcionSelect[]
  /** Qué elige. Es el nombre accesible; en la variante `filtro` se dibuja. */
  titulo: string
  /** `campo` es un campo de formulario; `filtro`, una fila que se tiñe al usarse. */
  variante?: 'campo' | 'filtro'
  /** Solo en la variante `filtro`. */
  icono?: string
  /** La opción de "sin elegir", escrita entera. Si falta, no se ofrece. */
  vacio?: string
  /** Qué dice el trigger mientras no hay nada elegido. */
  placeholder?: string
  /** Modo controlado: si viene, manda sobre el estado interno. */
  valor?: string
  onCambio?: (valor: string) => void
  /** Si viene, se renderiza un input oculto para que lo levante el `<form>`. */
  name?: string
  defaultValue?: string
  disabled?: boolean
}) {
  const [interno, setInterno] = useState(defaultValue)
  const [abierto, setAbierto] = useState(false)

  const controlado = valor !== undefined
  const actual = controlado ? valor : interno

  const lista = vacio !== undefined ? [{ valor: '', etiqueta: vacio }, ...opciones] : opciones
  const indiceElegido = lista.findIndex((o) => o.valor === actual)
  const textoElegido = indiceElegido >= 0 ? lista[indiceElegido].etiqueta : placeholder

  /** Un filtro "puesto" es el que no está en su opción vacía. */
  const activo = variante === 'filtro' && actual !== ''

  // Un botón por opción, para poder moverles el foco. Cada uno se da de baja
  // solo al desmontarse (el cleanup del ref callback de React 19), así que la
  // lista no queda con nodos viejos cuando cambian las opciones.
  const refs = useRef<(HTMLButtonElement | null)[]>([])

  // Lo tipeado hasta ahora, para buscar. Es una ref y no estado: no se dibuja,
  // y cambiarlo no tiene por qué re-renderizar la lista entera.
  const tecleado = useRef('')
  const reloj = useRef<ReturnType<typeof setTimeout> | null>(null)
  useEffect(() => () => void (reloj.current && clearTimeout(reloj.current)), [])

  function enfocar(i: number) {
    const boton = refs.current[i]
    boton?.focus()
    boton?.scrollIntoView({ block: 'nearest' })
  }

  function elegir(v: string) {
    if (!controlado) setInterno(v)
    onCambio?.(v)
    setAbierto(false)
  }

  function teclas(e: KeyboardEvent<HTMLDivElement>) {
    const foco = refs.current.findIndex((b) => b === document.activeElement)

    if (e.key === 'ArrowDown' || e.key === 'ArrowUp') {
      e.preventDefault()
      enfocar(siguienteIndice(foco, lista.length, e.key === 'ArrowDown' ? 1 : -1))
      return
    }
    if (e.key === 'Home') {
      e.preventDefault()
      enfocar(0)
      return
    }
    if (e.key === 'End') {
      e.preventDefault()
      enfocar(lista.length - 1)
      return
    }

    // Un espacio con el buscador vacío elige, como en un select nativo. Con
    // algo tipeado es una palabra más de la búsqueda ("mercado pago").
    if (e.key === ' ' && tecleado.current === '') return
    if (e.key.length !== 1 || e.ctrlKey || e.metaKey || e.altKey) return

    tecleado.current += e.key
    if (reloj.current) clearTimeout(reloj.current)
    reloj.current = setTimeout(() => {
      tecleado.current = ''
    }, MS_TYPEAHEAD)

    const i = buscarPorTexto(
      lista.map((o) => o.etiqueta),
      tecleado.current,
      foco,
    )
    if (i !== null) {
      e.preventDefault()
      enfocar(i)
    }
  }

  return (
    <>
      {name && <input type="hidden" name={name} value={actual} />}

      <Popover open={abierto} onOpenChange={setAbierto}>
        <PopoverTrigger
          type="button"
          disabled={disabled}
          // Con el valor adentro, como el de `CampoFecha`: un lector de
          // pantalla anuncia qué elige y qué está elegido en una sola frase.
          aria-label={`${titulo}: ${textoElegido}`}
          aria-haspopup="listbox"
          className={cn(
            campo,
            'gap-space-sm flex items-center text-left disabled:opacity-40',
            activo && 'border-primary/50 bg-primary/10',
          )}
        >
          {icono && (
            <Icono
              nombre={icono}
              className={cn(
                'shrink-0 text-[20px]',
                activo ? 'text-primary' : 'text-on-surface-variant',
              )}
            />
          )}

          {variante === 'filtro' && (
            <span className="text-on-surface-variant shrink-0">{titulo}</span>
          )}

          <span
            className={cn(
              'min-w-0 flex-1 truncate',
              variante === 'filtro' && 'text-right',
              activo && 'text-primary',
              indiceElegido < 0 && 'text-on-surface-variant/60',
            )}
          >
            {textoElegido}
          </span>

          <Icono
            nombre="expand_more"
            className={cn(
              'shrink-0 text-[20px] transition-transform',
              abierto && 'rotate-180',
              activo ? 'text-primary' : 'text-on-surface-variant',
            )}
          />
        </PopoverTrigger>

        <PopoverContent
          align="start"
          side="bottom"
          sideOffset={4}
          // Abajo hay más margen que arriba: la bottom-nav es fija y el menú no
          // tiene que terminar debajo de ella.
          collisionPadding={{ top: 16, bottom: 96, left: 16, right: 16 }}
          // El foco arranca en lo que está elegido, no en la primera opción.
          onOpenAutoFocus={(e) => {
            e.preventDefault()
            enfocar(indiceElegido >= 0 ? indiceElegido : 0)
          }}
          className={cn(
            'w-[var(--radix-popover-trigger-width)] gap-0 overflow-y-auto p-1',
            'max-h-[min(18rem,var(--radix-popover-content-available-height))]',
          )}
        >
          <div role="listbox" aria-label={titulo} onKeyDown={teclas}>
            {lista.map((o, i) => {
              const elegida = o.valor === actual
              return (
                <div key={o.valor}>
                  {/* La opción de "sin filtrar" se separa del resto. */}
                  {i === 1 && vacio !== undefined && <Separador />}
                  <button
                    ref={(el) => {
                      refs.current[i] = el
                      return () => {
                        refs.current[i] = null
                      }
                    }}
                    type="button"
                    role="option"
                    aria-selected={elegida}
                    onClick={() => elegir(o.valor)}
                    className={cn(
                      'px-space-sm gap-space-sm text-body-md flex min-h-11 w-full items-center',
                      'rounded-lg py-2 text-left outline-none',
                      'hover:bg-surface-container-highest focus:bg-surface-container-highest',
                      elegida ? 'text-primary' : 'text-on-surface',
                    )}
                  >
                    <span className="min-w-0 flex-1 truncate">{o.etiqueta}</span>
                    {elegida && (
                      <Icono nombre="check" className="text-primary shrink-0 text-[18px]" />
                    )}
                  </button>
                </div>
              )
            })}
          </div>
        </PopoverContent>
      </Popover>
    </>
  )
}
