import type { CompraCuotasDetalle } from '@/lib/schemas/compraCuotas'
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import { sumar } from './dinero'
import { mesesEntre, mesDe, sumarMeses, diasDelMes, diaDe } from './fechas'
import type { Mes, FechaISO } from './fechas'

/**
 * Compras en cuotas: la derivación.
 *
 * La base guarda la compra una sola vez ("12 cuotas de $48.500"); las cuotas
 * individuales nunca se guardan. Este módulo las deriva mes a mes, y las
 * **materializa como objetos que cumplen `MovimientoDetalle`**, con una
 * propiedad extra (`cuota`) de marca. Ese es el truco entero: como una cuota
 * derivada *es* un movimiento en su forma, el resto de `lib/core` (topes,
 * agregados, filtros, historial) sigue funcionando sobre listas mezcladas de
 * movimientos reales y cuotas sin que haya que tocar nada ahí.
 */

/** La marca que distingue una cuota derivada de un movimiento real. */
export interface MarcaCuota {
  compraId: string
  numero: number
  total: number
}

/** Una cuota derivada. Cumple `MovimientoDetalle`: todo `lib/core` la procesa igual. */
export type Cuota = MovimientoDetalle & { cuota: MarcaCuota }

/** Type guard por presencia de la marca. */
export function esCuota(m: MovimientoDetalle): m is Cuota {
  return 'cuota' in m
}

/**
 * A qué pantalla navega al tocar `m`: la compra que la generó si es una
 * cuota derivada, el movimiento real si no. Una cuota tiene `id` sintético
 * (`cuota:<compraId>:<numero>`) y nunca es una fila de `/movimiento/[id]`
 * —ni existe ahí, ni es un uuid—. Vive acá, pura y con test, porque la
 * deciden dos listas distintas (`ListaMovimientos` en el Home,
 * `BuscadorMovimientos` en el Historial) y las dos tienen que llevar al
 * mismo lugar al tocar la misma fila: que una duplicara esta cuenta y la
 * otra no es justo el bug que hay que no volver a tener.
 */
export function rutaDeMovimiento(m: MovimientoDetalle): string {
  return esCuota(m) ? `/compra/${m.cuota.compraId}` : `/movimiento/${m.id}`
}

/**
 * Qué número de cuota (1-based) le toca a `compra` en `mes`, o `null` si ese
 * mes queda antes de la compra o después de la última cuota.
 */
export function numeroDeCuota(compra: CompraCuotasDetalle, mes: Mes): number | null {
  const d = mesesEntre(mesDe(compra.fecha), mes)
  if (d < 0 || d >= compra.cuotas) return null
  return d + 1
}

/** El total del plan: la cuota multiplicada por la cantidad, nunca guardado. */
export function totalPlan(compra: CompraCuotasDetalle): number {
  return compra.importeCuotaCentavos * compra.cuotas
}

/** El mes de la última cuota. */
export function mesFinal(compra: CompraCuotasDetalle): Mes {
  return sumarMeses(mesDe(compra.fecha), compra.cuotas - 1)
}

/**
 * Cuántas cuotas ya transcurrieron a la altura de `mes`, contando el mes
 * actual como transcurrido. Nunca negativo ni por encima del total: antes de
 * la compra es 0, después de la última cuota se clava en `compra.cuotas`.
 */
export function cuotasTranscurridas(compra: CompraCuotasDetalle, mes: Mes): number {
  const d = mesesEntre(mesDe(compra.fecha), mes)
  return Math.max(0, Math.min(d + 1, compra.cuotas))
}

/**
 * ¿Se puede dejar el plan en `nuevasCuotas`? El piso son las ya transcurridas:
 * bajarlo por debajo borraría meses que ya cerraron. Subirlo siempre se puede.
 */
export function puedeReducirA(compra: CompraCuotasDetalle, nuevasCuotas: number, mes: Mes): boolean {
  return nuevasCuotas >= cuotasTranscurridas(compra, mes)
}

/**
 * La fecha de la cuota de `mes`: mismo día de la compra, recortado a los
 * días que tenga ese mes (la cuota de enero 31 cae el 28/29 en febrero).
 * Se arma a mano como string, nunca por `Date`.
 */
export function fechaDeCuota(compra: CompraCuotasDetalle, mes: Mes): FechaISO {
  const dia = Math.min(diaDe(compra.fecha), diasDelMes(mes))
  return `${mes}-${String(dia).padStart(2, '0')}`
}

/** Materializa la cuota `numero` de `compra` para `mes` como un `Cuota`. */
function cuotaDe(compra: CompraCuotasDetalle, mes: Mes, numero: number): Cuota {
  return {
    id: `cuota:${compra.id}:${numero}`,
    fecha: fechaDeCuota(compra, mes),
    comercioId: compra.comercioId,
    importeCentavos: compra.importeCuotaCentavos,
    formaPago: compra.formaPago,
    banco: compra.banco,
    tarjeta: compra.tarjeta,
    nota: compra.nota,
    comercio: compra.comercio,
    categoria: compra.categoria,
    subcategoria: compra.subcategoria,
    esFijo: compra.esFijo,
    cuota: { compraId: compra.id, numero, total: compra.cuotas },
  }
}

/**
 * Todas las cuotas de `compras` que caen entre `desde` y `hasta` (inclusive),
 * mes a mes. Si `hasta` es anterior a `desde` no hay rango: `[]`.
 */
export function cuotasEntre(compras: CompraCuotasDetalle[], desde: Mes, hasta: Mes): Cuota[] {
  const rango = mesesEntre(desde, hasta)
  if (rango < 0) return []

  const resultado: Cuota[] = []
  for (let i = 0; i <= rango; i++) {
    const mes = sumarMeses(desde, i)
    for (const compra of compras) {
      const numero = numeroDeCuota(compra, mes)
      if (numero !== null) resultado.push(cuotaDe(compra, mes, numero))
    }
  }
  return resultado
}

/** Las cuotas de `compras` que caen en un único mes. */
export function cuotasDelMes(compras: CompraCuotasDetalle[], mes: Mes): Cuota[] {
  return cuotasEntre(compras, mes, mes)
}

/** Un plan en cuotas que sigue vivo en `mes`, con lo que ya pagó y lo que le falta. */
export interface PlanActivo {
  compra: CompraCuotasDetalle
  numero: number
  importe: number
  restantes: number
  faltaPagar: number
  mesFinal: Mes
}

/** Los planes que siguen vivos en `mes`, en el orden de `compras`. */
export function planesActivos(compras: CompraCuotasDetalle[], mes: Mes): PlanActivo[] {
  const activos: PlanActivo[] = []
  for (const compra of compras) {
    const numero = numeroDeCuota(compra, mes)
    if (numero === null) continue
    const restantes = compra.cuotas - numero
    activos.push({
      compra,
      numero,
      importe: compra.importeCuotaCentavos,
      restantes,
      faltaPagar: restantes * compra.importeCuotaCentavos,
      mesFinal: mesFinal(compra),
    })
  }
  return activos
}

/** Cuánto hay comprometido en un mes, y en cuántos planes. */
export interface MesComprometido {
  mes: Mes
  total: number
  planes: number
}

/**
 * Los próximos `n` meses (contando `desde`) con lo comprometido en cuotas
 * de `compras`. Siempre devuelve `n` meses, aunque no haya nada ese mes.
 */
export function proximosMeses(compras: CompraCuotasDetalle[], desde: Mes, n: number): MesComprometido[] {
  return Array.from({ length: n }, (_, i) => {
    const mes = sumarMeses(desde, i)
    const activas = compras.filter((compra) => numeroDeCuota(compra, mes) !== null)
    return {
      mes,
      total: sumar(...activas.map((compra) => compra.importeCuotaCentavos)),
      planes: activas.length,
    }
  })
}

/** Lo que el formulario de alta muestra antes de guardar la compra. */
export interface ResumenPlan {
  total: number
  desde: Mes
  hasta: Mes
}

/** Resume una compra en cuotas a partir de sus datos crudos (sin `id` todavía). */
export function resumenPlan(importeCuotaCentavos: number, cuotas: number, fechaCompra: FechaISO): ResumenPlan {
  const desde = mesDe(fechaCompra)
  return {
    total: importeCuotaCentavos * cuotas,
    desde,
    hasta: sumarMeses(desde, cuotas - 1),
  }
}
