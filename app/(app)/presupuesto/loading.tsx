import { Cargando, Card, Esqueleto } from '@/components/ds'

/** Fallback de Presupuesto: selector de mes, totales y las líneas del plan. */
export default function CargandoPresupuesto() {
  return (
    <Cargando>
      <div className="gap-space-sm flex flex-col">
        <Esqueleto className="h-9 w-44" />
        <Esqueleto className="h-14 w-full rounded-xl" />
      </div>

      <Card className="items-center">
        <Esqueleto className="h-4 w-28" />
        <Esqueleto className="h-10 w-40" />
        <Esqueleto className="h-2 w-full rounded-full" />
      </Card>

      <Card className="p-space-sm gap-space-md">
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className="gap-space-xs flex flex-col">
            <div className="flex items-baseline justify-between">
              <Esqueleto className="h-4 w-28" />
              <Esqueleto className="h-4 w-24" />
            </div>
            <Esqueleto className="h-2 w-full rounded-full" />
          </div>
        ))}
      </Card>
    </Cargando>
  )
}
