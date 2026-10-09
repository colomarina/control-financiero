import { Cargando, Esqueleto } from '@/components/ds'

/** Fallback de Configuración: las cinco secciones plegadas. */
export default function CargandoConfig() {
  return (
    <Cargando>
      <Esqueleto className="h-9 w-52" />
      {[0, 1, 2, 3, 4].map((i) => (
        <Esqueleto key={i} className="h-14 w-full rounded-xl" />
      ))}
    </Cargando>
  )
}
