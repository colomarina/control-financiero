import { Cargando, Card, Esqueleto } from '@/components/ds'

/** Fallback de Historial: promedio, buscador, gráfico y mes a mes. */
export default function CargandoHistorial() {
  return (
    <Cargando>
      <div className="gap-space-xs flex flex-col">
        <Esqueleto className="h-9 w-40" />
        <Esqueleto className="h-4 w-36" />
      </div>

      <Card>
        <Esqueleto className="h-4 w-36" />
        <Esqueleto className="h-10 w-48" />
      </Card>

      <div className="gap-space-sm flex flex-col">
        <Esqueleto className="h-6 w-24" />
        <Card className="gap-space-sm">
          <Esqueleto className="h-11 w-full" />
          <div className="gap-space-sm grid grid-cols-2">
            <Esqueleto className="h-11" />
            <Esqueleto className="h-11" />
          </div>
        </Card>
      </div>

      <div className="gap-space-sm flex flex-col">
        <Esqueleto className="h-6 w-28" />
        <Card>
          <Esqueleto className="h-48 w-full" />
        </Card>
      </div>
    </Cargando>
  )
}
