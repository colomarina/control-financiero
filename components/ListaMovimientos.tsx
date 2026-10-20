import Link from 'next/link'
import { formatoARS } from '@/lib/core/dinero'
import { diaDe } from '@/lib/core/fechas'
import { ETIQUETA_FORMA_PAGO, type MovimientoDetalle } from '@/lib/schemas/movimiento'
import { Card, ItemLista, Separador, Monto } from '@/components/ds'

/**
 * Ícono por categoría. Material Symbols, como pide el design system.
 * Lo que no está en el mapa cae en un ícono genérico.
 */
const ICONO_CATEGORIA: Record<string, string> = {
  Supermercado: 'shopping_cart',
  Nutricion: 'restaurant',
  Restaurantes: 'restaurant_menu',
  Servicios: 'bolt',
  Expensas: 'home',
  Salud: 'health_and_safety',
  Seguros: 'shield',
  Auto: 'directions_car',
  Deportes: 'fitness_center',
  Streaming: 'play_circle',
  Animales: 'pets',
  Hogar: 'chair',
  Impuestos: 'receipt_long',
  Tecnología: 'devices',
  Indumentaria: 'checkroom',
  Inversion: 'trending_up',
  Dommum: 'cleaning_services',
}

export function iconoDe(categoria: string): string {
  return ICONO_CATEGORIA[categoria] ?? 'payments'
}

/** La lista del Home: qué, dónde y cuánto, agrupado por día. */
export function ListaMovimientos({ movimientos }: { movimientos: MovimientoDetalle[] }) {
  const porDia = new Map<string, MovimientoDetalle[]>()
  for (const m of movimientos) {
    const lista = porDia.get(m.fecha)
    if (lista) lista.push(m)
    else porDia.set(m.fecha, [m])
  }

  return (
    <div className="gap-space-md flex flex-col">
      {[...porDia].map(([fecha, delDia]) => (
        <div key={fecha} className="gap-space-sm flex flex-col">
          <h3 className="text-label-caps text-on-surface-variant px-space-xs uppercase">
            Día {diaDe(fecha)}
          </h3>

          <Card className="p-space-sm gap-0">
            {delDia.map((m, i) => (
              <div key={m.id}>
                {i > 0 && <Separador />}
                {/* Tocar un movimiento lo abre para editar o borrar. */}
                <Link
                  href={`/movimiento/${m.id}`}
                  // `active:` y no solo `hover:`: en el celular no hay hover, y
                  // el destello al tocar es lo único que confirma el toque
                  // antes de que aparezca el esqueleto de la otra pantalla.
                  className="hover:bg-surface-container-high active:bg-surface-container-highest block rounded-lg transition-colors"
                >
                  <ItemLista
                    icono={iconoDe(m.categoria)}
                    tonoIcono={m.esFijo ? 'neutro' : 'ok'}
                    titulo={m.comercio}
                    detalle={`${m.categoria}${m.subcategoria ? ` · ${m.subcategoria}` : ''} · ${ETIQUETA_FORMA_PAGO[m.formaPago]}`}
                    derecha={<Monto>{formatoARS(m.importeCentavos)}</Monto>}
                  />
                </Link>
              </div>
            ))}
          </Card>
        </div>
      ))}
    </div>
  )
}
