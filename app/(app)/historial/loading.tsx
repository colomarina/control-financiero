import { Cargando, Card, Esqueleto } from '@/components/ds'

/**
 * Fallback de Historial: el promedio y las cuatro secciones plegadas.
 *
 * Reserva la forma real de la pantalla —secciones cerradas, no su contenido—
 * para que al llegar los datos nada salte de lugar.
 */
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
        <Esqueleto className="h-4 w-full" />
      </Card>

      {/* Las cuatro secciones: título a la izquierda, contador a la derecha. */}
      {[0, 1, 2, 3].map((i) => (
        <Card key={i} className="p-space-md">
          <div className="gap-space-sm flex items-center">
            <Esqueleto className="h-6 flex-1 max-w-32" />
            <Esqueleto className="h-4 w-24" />
            <Esqueleto className="size-5 shrink-0 rounded-full" />
          </div>
        </Card>
      ))}
    </Cargando>
  )
}
