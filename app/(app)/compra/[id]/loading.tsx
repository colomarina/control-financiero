import { Cargando, Card, Esqueleto } from '@/components/ds'

/**
 * Fallback de `/compra/[id]`: la silueta de esta pantalla puntual —hero de la
 * cuota, barra de avance y el bloque del mes a mes— y no una genérica, para
 * que no salte nada cuando llega la compra.
 */
export default function CargandoCompra() {
  return (
    <Cargando>
      <header className="gap-space-xs flex flex-col">
        <Esqueleto className="h-7 w-48" />
        <Esqueleto className="h-4 w-56" />
      </header>

      <Card>
        <Esqueleto className="h-4 w-32" />
        <Esqueleto className="mx-auto h-10 w-36" />
        <Esqueleto className="h-2 w-full rounded-full" />
        <Esqueleto className="h-4 w-full" />
        <Esqueleto className="h-4 w-2/3" />
      </Card>

      <Card>
        <Esqueleto className="h-4 w-24" />
        <div className="gap-space-xs flex flex-col">
          {Array.from({ length: 5 }, (_, i) => (
            <Esqueleto key={i} className="h-12" />
          ))}
        </div>
      </Card>

      <Card>
        <Esqueleto className="h-4 w-20" />
        <Esqueleto className="mx-auto h-12 w-40" />
        <div className="gap-space-sm grid grid-cols-3">
          {Array.from({ length: 12 }, (_, i) => (
            <Esqueleto key={i} className="h-14" />
          ))}
        </div>
      </Card>

      <Card>
        <Esqueleto className="h-4 w-24" />
        <div className="gap-space-sm grid grid-cols-2">
          {Array.from({ length: 6 }, (_, i) => (
            <Esqueleto key={i} className="h-12" />
          ))}
        </div>
        <Esqueleto className="h-11 w-full" />
      </Card>
    </Cargando>
  )
}
