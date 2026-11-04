import { Cargando, Card, Esqueleto } from '@/components/ds'

/** Fallback de Fijos y cuotas: la card de arriba y las dos secciones plegadas. */
export default function CargandoFijos() {
  return (
    <Cargando>
      <Esqueleto className="h-9 w-48" />

      <Card>
        <Esqueleto className="h-4 w-28" />
        <Esqueleto className="h-10 w-44" />
        <Esqueleto className="h-2 w-full rounded-full" />
      </Card>

      <Esqueleto className="h-14 w-full rounded-xl" />
      <Esqueleto className="h-14 w-full rounded-xl" />
    </Cargando>
  )
}
