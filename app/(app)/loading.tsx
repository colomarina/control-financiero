import { Cargando, Card, Esqueleto } from '@/components/ds'

/**
 * Fallback del Home: título del mes, las dos barras de topes, el cierre
 * estimado y el arranque de la lista de movimientos.
 *
 * Es la silueta de `page.tsx`, no un esqueleto genérico: cuando llegan los
 * datos el contenido ocupa el mismo lugar y la pantalla no salta.
 */
export default function CargandoHome() {
  return (
    <Cargando>
      <Esqueleto className="h-9 w-48" />

      <div className="gap-space-sm flex flex-col">
        {[0, 1].map((i) => (
          <Card key={i}>
            <div className="gap-space-sm flex items-baseline justify-between">
              <Esqueleto className="h-4 w-24" />
              <Esqueleto className="h-5 w-28" />
            </div>
            <Esqueleto className="h-2 w-full rounded-full" />
          </Card>
        ))}
      </div>

      <Card>
        <Esqueleto className="h-4 w-32" />
        <Esqueleto className="h-10 w-44" />
        <Esqueleto className="h-4 w-full" />
      </Card>

      <div className="gap-space-sm flex flex-col">
        <div className="px-space-xs flex items-center justify-between">
          <Esqueleto className="h-6 w-40" />
          <Esqueleto className="size-9 rounded-full" />
        </div>
        <Card className="p-space-sm gap-space-md">
          {[0, 1, 2].map((i) => (
            <div key={i} className="gap-space-sm flex items-center">
              <Esqueleto className="size-9 shrink-0 rounded-full" />
              <div className="gap-space-xs flex flex-1 flex-col">
                <Esqueleto className="h-4 w-32" />
                <Esqueleto className="h-3 w-24" />
              </div>
              <Esqueleto className="h-5 w-20 shrink-0" />
            </div>
          ))}
        </Card>
      </div>
    </Cargando>
  )
}
