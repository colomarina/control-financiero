import { Cargando, Card, Esqueleto } from '@/components/ds'

/** Fallback de Cargar: importe, teclado, comercio y forma de pago. */
export default function CargandoCargar() {
  return (
    <Cargando>
      <Esqueleto className="h-9 w-44" />

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
