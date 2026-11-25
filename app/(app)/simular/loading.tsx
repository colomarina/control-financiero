import { Cargando, Card, Esqueleto } from '@/components/ds'

/** Fallback del simulador: el encabezado y el formulario de tres campos. */
export default function CargandoSimulador() {
  return (
    <Cargando>
      <div className="gap-space-xs flex flex-col">
        <Esqueleto className="h-8 w-40" />
        <Esqueleto className="h-4 w-64" />
      </div>
      <Card className="gap-space-md">
        <Esqueleto className="h-12 w-full" />
        <Esqueleto className="h-12 w-full" />
        <Esqueleto className="h-12 w-full" />
        <Esqueleto className="h-12 w-full rounded-full" />
      </Card>
    </Cargando>
  )
}
