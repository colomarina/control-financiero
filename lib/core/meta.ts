/**
 * META DE CONSUMO CON TARJETA — el mínimo que pide el banco por resumen.
 *
 * Santander bonifica la cuenta si entre Visa y Amex se consume un mínimo por
 * resumen. **La meta no es gastar más**: es elegir con qué tarjeta se paga lo
 * que igual se iba a gastar (la carnicería con Santander en vez de en
 * efectivo). Por eso esto nunca sugiere comprar algo nuevo ni usar otra
 * tarjeta, y pasarse del mínimo no es un problema de la meta: eso ya lo avisa
 * el tope de tarjeta.
 *
 * Cuentan los gastos de las tarjetas `sumaMeta`: compras, débitos automáticos
 * y cuotas. Se cuenta por mes calendario (el resumen cierra entre el 24 y el
 * 27 y se paga a principio del mes siguiente, así que es casi lo mismo); el
 * colchón cubre la diferencia. Solo la alerta de "pagá con Santander" mira el
 * día de cierre aproximado: lo que se compra después cae en el resumen
 * siguiente.
 *
 * El cierre estimado es el mismo modelo del tope (`prediccionDelTope`), corrido
 * solo sobre los gastos de estas tarjetas.
 */
import type { MovimientoDetalle } from '@/lib/schemas/movimiento'
import type { GastoFijoDetalle } from '@/lib/schemas/gastoFijo'
import type { Tarjeta } from '@/lib/schemas/tarjeta'
import type { Cuota } from './cuotas'
import { formatoARS } from './dinero'
import { mesesAnteriores, type Mes } from './fechas'
import { fijosPendientes } from './fijos'
import { TOPE_DE_FORMA_PAGO, gastoContraTope, movimientosDelMes } from './gastos'
import { prediccionDelTope } from './prediccion'
import { ultimaTarjetaPorComercio } from './tarjetas'

/** Cuántos días antes del cierre se enciende la alerta roja. */
export const DIAS_ALERTA_CIERRE = 3

/** Cuántos comercios se sugieren para pasar a la tarjeta. */
const MAX_SUGERENCIAS = 3

/** Primera que se cumple, en este orden. */
export type EstadoMeta =
  | 'cumplida' // lo gastado ya llegó
  | 'cubierta' // los débitos y cuotas que faltan completan el mínimo
  | 'urgente' // cierra en pocos días y no se llega
  | 'temprano' // todavía no hay con qué proyectar
  | 'en-camino' // al ritmo actual llega
  | 'no-llega' // al ritmo actual no llega

export interface Sugerencia {
  comercio: string
  /** Lo que se gasta por mes en ese comercio en efectivo o transferencia. */
  promedioMensual: number
}

export interface Meta {
  estado: EstadoMeta
  /** "Santander". Si las tarjetas de la meta son de varios bancos, unidos. */
  banco: string
  minimo: number
  /** Mínimo + colchón: lo que hay que alcanzar para darla por cumplida. */
  objetivo: number
  gastado: number
  /** Gastado + débitos automáticos que faltan llegar. */
  comprometido: number
  /** Lo que falta para el objetivo, contando lo comprometido. Nunca negativo. */
  falta: number
  /** Cierre del mes al ritmo actual; `null` si es temprano para proyectar. */
  cierreEstimado: number | null
  /** Días hasta el cierre aproximado del resumen. Negativo si ya pasó. */
  diasAlCierre: number
  sugerencias: Sugerencia[]
  titulo: string
  detalle: string
}

/**
 * Los comercios que se suelen pagar en efectivo o transferencia, con su
 * promedio mensual en los meses históricos. Son los candidatos a pasar a la
 * tarjeta: plata que igual se gasta, solo cambia el medio.
 */
export function comerciosParaPasar(
  movsReales: MovimientoDetalle[],
  mes: Mes,
  mesesHistorico: number,
): Sugerencia[] {
  const meses = mesesAnteriores(mes, mesesHistorico)
  const total = new Map<string, number>()
  for (const m of meses.flatMap((x) => movimientosDelMes(movsReales, x))) {
    if (TOPE_DE_FORMA_PAGO[m.formaPago] !== 'efectivo') continue
    total.set(m.comercio, (total.get(m.comercio) ?? 0) + m.importeCentavos)
  }
  return [...total]
    .map(([comercio, suma]) => ({ comercio, promedioMensual: Math.round(suma / meses.length) }))
    .sort((a, b) => b.promedioMensual - a.promedioMensual)
    .slice(0, MAX_SUGERENCIAS)
}

/**
 * La meta del mes. `null` si no hay meta configurada (mínimo en 0) o ninguna
 * tarjeta suma.
 *
 * `movsReales` son solo movimientos (con el histórico), como en la predicción
 * del tope; las cuotas del mes van aparte y entran únicamente al gastado.
 */
export function metaDelMes(args: {
  movsReales: MovimientoDetalle[]
  cuotasMes: Cuota[]
  fijos: GastoFijoDetalle[]
  tarjetas: Tarjeta[]
  mes: Mes
  diaActual: number
  mesesHistorico: number
  minimo: number
  colchon: number
  diaCierre: number
}): Meta | null {
  const { movsReales, cuotasMes, fijos, tarjetas, mes, diaActual, mesesHistorico } = args
  const deLaMeta = tarjetas.filter((t) => t.sumaMeta)
  if (args.minimo <= 0 || deLaMeta.length === 0) return null

  const ids = new Set(deLaMeta.map((t) => t.id))
  const suma = (m: MovimientoDetalle) => m.tarjetaId != null && ids.has(m.tarjetaId)
  const movsMeta = movsReales.filter(suma)
  const cuotasMeta = cuotasMes.filter(suma)

  // Un fijo pendiente pesa en la meta si su comercio se viene pagando con
  // una de estas tarjetas: es un débito automático que va a caer ahí.
  const ultima = ultimaTarjetaPorComercio(movsReales, tarjetas)
  const fijosMeta = fijos.filter((f) => ids.has(ultima[f.comercioId] ?? ''))

  const gastado = gastoContraTope([...movsMeta, ...cuotasMeta], mes, 'tarjeta')
  const comprometido = gastado + fijosPendientes(fijosMeta, movsMeta, mes)
  const objetivo = args.minimo + args.colchon
  const falta = Math.max(0, objetivo - comprometido)
  const diasAlCierre = args.diaCierre - diaActual

  const { prediccion } = prediccionDelTope({
    movsReales: movsMeta,
    cuotasMes: cuotasMeta,
    fijos: fijosMeta,
    mes,
    tope: 'tarjeta',
    mesesHistorico,
    diaActual,
  })
  const cierreEstimado = prediccion.status === 'proyeccion' ? prediccion.normal : null

  const banco = [...new Set(deLaMeta.map((t) => t.banco))].join(' y ')
  const sugerencias = comerciosParaPasar(movsReales, mes, mesesHistorico)
  const base = {
    banco,
    minimo: args.minimo,
    objetivo,
    gastado,
    comprometido,
    falta,
    cierreEstimado,
    diasAlCierre,
    sugerencias,
  }
  const $ = formatoARS

  if (gastado >= objetivo) {
    return {
      ...base,
      estado: 'cumplida',
      titulo: 'Mínimo cumplido ✓',
      detalle: `Llevás ${$(gastado)} con ${banco}; el mínimo es ${$(args.minimo)}.`,
    }
  }

  if (falta === 0) {
    return {
      ...base,
      estado: 'cubierta',
      titulo: 'Llegás sin cambiar nada',
      detalle: `Con los débitos automáticos que faltan cerrás en ${$(comprometido)}.`,
    }
  }

  if (diasAlCierre <= DIAS_ALERTA_CIERRE) {
    const cuando =
      diasAlCierre > 1
        ? `Cierra en ${diasAlCierre} días`
        : diasAlCierre === 1
          ? 'Cierra mañana'
          : diasAlCierre === 0
            ? 'Cierra hoy'
            : 'Ya cerró o está por cerrar'
    return {
      ...base,
      estado: 'urgente',
      titulo: `${cuando} y faltan ${$(falta)}`,
      detalle: `Lo que pagues estos días, pagalo con ${banco}.`,
    }
  }

  if (cierreEstimado === null) {
    return {
      ...base,
      estado: 'temprano',
      titulo: `Faltan ${$(falta)} para el mínimo`,
      detalle: 'Es temprano en el mes para proyectar el cierre.',
    }
  }

  if (cierreEstimado >= objetivo) {
    return {
      ...base,
      estado: 'en-camino',
      titulo: 'Vas bien',
      detalle: `Al ritmo actual cerrás en ~${$(cierreEstimado)}.`,
    }
  }

  const faltaAlCierre = objetivo - cierreEstimado
  const pasar =
    sugerencias.length > 0
      ? ` Pasá a ${banco} lo que solés pagar en efectivo: ` +
        `${sugerencias.map((s) => `${s.comercio} (~${$(s.promedioMensual)})`).join(', ')}.`
      : ''
  return {
    ...base,
    estado: 'no-llega',
    titulo: 'Al ritmo actual no llegás',
    detalle: `Cerrarías en ~${$(cierreEstimado)}: faltarían ${$(faltaAlCierre)}.${pasar}`,
  }
}
