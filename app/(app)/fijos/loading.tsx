import { Cargando, Card, Esqueleto } from '@/components/ds'

/** Fallback de Fijos: cuánto falta pagar y el checklist. */
export default function CargandoFijos() {
  return (
    <Cargando>
      <Esqueleto className="h-9 w-48" />

      <Card>
        <Esqueleto className="h-4 w-28" />
        <Esqueleto className="h-10 w-44" />
        <Esqueleto className="h-2 w-full rounded-full" />
      </Card>

      <Card className="p-space-sm gap-space-md">
        {[0, 1, 2, 3, 4].map((i) => (
          <div key={i} className="gap-space-sm flex items-center">
            <Esqueleto className="size-9 shrink-0 rounded-full" />
            <div className="gap-space-xs flex flex-1 flex-col">
              <Esqueleto className="h-4 w-28" />
              <Esqueleto className="h-3 w-20" />
            </div>
            <Esqueleto className="h-5 w-20 shrink-0" />
          </div>
        ))}
      </Card>
    </Cargando>
  )
}
