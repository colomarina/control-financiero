import { Cargando, Card, Esqueleto } from '@/components/ds'

/**
 * Fallback de Fijos y cuotas: la card de arriba, "Gastos fijos" **abierta** y
 * "Cuotas" plegada.
 *
 * La primera sección se dibuja abierta porque así la renderiza la página: un
 * esqueleto con las dos plegadas reservaba dos renglones donde después
 * aparecían el banner y el checklist entero, y al llegar los datos la pantalla
 * saltaba varios cientos de píxeles. El esqueleto tiene que reservar la forma
 * final, no la más cómoda de escribir.
 */
export default function CargandoFijos() {
  return (
    <Cargando>
      <div className="gap-space-xs flex flex-col">
        <Esqueleto className="h-9 w-48" />
        <Esqueleto className="h-4 w-28" />
      </div>

      <Card>
        <Esqueleto className="h-4 w-28" />
        <Esqueleto className="h-10 w-44" />
        <Esqueleto className="h-2 w-full rounded-full" />
        <Esqueleto className="h-4 w-56" />
      </Card>

      {/* "Gastos fijos", abierta: encabezado, el banner y unas filas. */}
      <Card className="gap-space-md">
        <div className="gap-space-sm flex items-center">
          <Esqueleto className="h-6 max-w-32 flex-1" />
          <Esqueleto className="h-4 w-24" />
          <Esqueleto className="size-5 shrink-0 rounded-full" />
        </div>
        <Esqueleto className="h-16 w-full" />
        <div className="flex flex-col">
          {[0, 1, 2, 3].map((i) => (
            <Esqueleto key={i} className="h-14 w-full" />
          ))}
        </div>
        <Esqueleto className="h-11 w-full" />
      </Card>

      {/* "Cuotas", plegada. */}
      <Esqueleto className="h-14 w-full rounded-xl" />
    </Cargando>
  )
}
