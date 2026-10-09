import Link from 'next/link'
import { Card, botonPrimario } from '@/components/ds'
import { Icono } from '@/components/Icono'

/**
 * Lo que se ve cuando un movimiento no existe: o se borró en otra pestaña, o
 * el link quedó viejo. (El RLS hace que un movimiento ajeno también caiga acá,
 * que es lo correcto: no confirma que exista.)
 */
export default function NoEncontrado() {
  return (
    <div className="gap-space-lg flex flex-col">
      <Card className="gap-space-md items-center text-center">
        <span className="bg-surface-container-highest text-on-surface-variant grid size-14 place-items-center rounded-full">
          <Icono nombre="search_off" className="text-[28px]" />
        </span>

        <div className="gap-space-xs flex flex-col">
          <h1 className="text-headline-sm text-on-surface">No encontré eso</h1>
          <p className="text-body-sm text-on-surface-variant">
            Puede que lo hayas borrado, o que el link esté viejo.
          </p>
        </div>

        <Link href="/" className={botonPrimario}>
          <Icono nombre="home" className="text-[20px]" />
          Ir al inicio
        </Link>
      </Card>
    </div>
  )
}
