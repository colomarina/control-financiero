/**
 * SIMULADOR — "¿puedo gastar esto?".
 *
 * Toma un gasto hipotético (monto, con qué se paga y, opcional, en qué
 * comercio) y contesta con un veredicto y sus motivos. No inventa reglas
 * nuevas: corre las mismas cuentas del Home —margen del tope, cierre estimado,
 * presupuesto, meta del banco— con el gasto agregado.
 *
 * El gasto simulado entra como **compra puntual**: una salida a comer es plata
 * de una vez, y metida en el ritmo diario haría parecer que se gasta eso todos
 * los días (mismo motivo que en `prediccion.ts`).
 *
 * Nada se guarda: es una consulta.
 */
import type { FormaPago, MovimientoDetalle } from '@/lib/schemas/movimiento'
import type { GastoFijoDetalle } from '@/lib/schemas/gastoFijo'
import type { LineaPresupuestoDetalle } from '@/lib/schemas/presupuesto'
import type { Tarjeta } from '@/lib/schemas/tarjeta'
import type { Cuota } from './cuotas'
import { formatoARS } from './dinero'
import { diasDelMes, type FechaISO, type Mes } from './fechas'
import { fijosPendientes } from './fijos'
import { TOPE_DE_FORMA_PAGO, gastoContraTope } from './gastos'
import { metaDelMes } from './meta'
import { margenDisponible, prediccionDelTope } from './prediccion'
import { presupuestoVsReal } from './presupuesto'
import { disponiblePorDia } from './topes'

export type Veredicto = 'si' | 'justo' | 'no'

/** Mismo semáforo que la UI, sin depender de ella. */
export type TonoMotivo = 'ok' | 'atencion' | 'mal' | 'neutro'

export interface Motivo {
  tono: TonoMotivo
  /** De qué habla: "Tope tarjeta", "Cierre estimado", "Meta Santander"... */
  tema: string
  texto: string
}

export interface Simulacion {
  veredicto: Veredicto
  titulo: string
  motivos: Motivo[]
}

/** Las formas sin tarjeta que ofrece el simulador. */
export const FORMAS_SIN_TARJETA = ['efectivo', 'transferencia', 'tarjeta_debito'] as const
type FormaSinTarjeta = (typeof FORMAS_SIN_TARJETA)[number]

/** Con qué se paga: una tarjeta (crédito) o una forma sin tarjeta. */
export type Medio =
  | { tipo: 'tarjeta'; tarjetaId: string }
  | { tipo: 'forma'; formaPago: FormaSinTarjeta }

const PREFIJO_TARJETA = 'tarjeta:'

/** El valor del selector: `tarjeta:<id>` o una forma sin tarjeta. */
export function valorDeMedio(medio: Medio): string {
  return medio.tipo === 'tarjeta' ? `${PREFIJO_TARJETA}${medio.tarjetaId}` : medio.formaPago
}

/** Lee el valor del selector. `null` si no es ninguno conocido. */
export function parsearMedio(valor: string, tarjetas: Tarjeta[]): Medio | null {
  if (valor.startsWith(PREFIJO_TARJETA)) {
    const id = valor.slice(PREFIJO_TARJETA.length)
    return tarjetas.some((t) => t.id === id) ? { tipo: 'tarjeta', tarjetaId: id } : null
  }
  return (FORMAS_SIN_TARJETA as readonly string[]).includes(valor)
    ? { tipo: 'forma', formaPago: valor as FormaSinTarjeta }
    : null
}

const TITULO: Record<Veredicto, string> = {
  si: 'Sí, entra.',
  justo: 'Entra, pero justo.',
  no: 'No entra en el tope.',
}

const NOMBRE_TOPE = { tarjeta: 'Tope tarjeta', efectivo: 'Tope efectivo' } as const

/** Un id que no choca con ningún comercio real, para el gasto sin comercio. */
const SIN_COMERCIO = '00000000-0000-4000-8000-000000000000'

export function simularGasto(args: {
  monto: number
  medio: Medio
  comercioId?: string | null
  /** Solo movimientos reales, con el histórico (como el cierre del Home). */
  movsReales: MovimientoDetalle[]
  cuotasMes: Cuota[]
  fijos: GastoFijoDetalle[]
  tarjetas: Tarjeta[]
  plan: LineaPresupuestoDetalle[]
  mes: Mes
  hoy: FechaISO
  diaActual: number
  config: {
    topeTarjetaCentavos: number
    topeEfectivoCentavos: number
    umbralCercaPct: number
    mesesHistorico: number
    metaMinimoCentavos: number
    metaColchonCentavos: number
    metaDiaCierre: number
  }
}): Simulacion {
  const { monto, medio, movsReales, cuotasMes, fijos, tarjetas, mes, diaActual, config } = args
  const $ = formatoARS

  const formaPago: FormaPago = medio.tipo === 'tarjeta' ? 'tarjeta_credito' : medio.formaPago
  const tarjeta = medio.tipo === 'tarjeta' ? tarjetas.find((t) => t.id === medio.tarjetaId) : null
  const tope = TOPE_DE_FORMA_PAGO[formaPago]
  const topeMonto = tope === 'tarjeta' ? config.topeTarjetaCentavos : config.topeEfectivoCentavos

  // El gasto hipotético, como un movimiento más: así todas las cuentas lo ven
  // igual que a uno cargado.
  const hipotetico: MovimientoDetalle = {
    id: '00000000-0000-4000-8000-00000000fff1',
    fecha: args.hoy,
    comercioId: args.comercioId ?? SIN_COMERCIO,
    importeCentavos: monto,
    formaPago,
    banco: null,
    tarjeta: null,
    nota: null,
    comercio: 'Simulado',
    categoria: 'Simulado',
    subcategoria: null,
    esFijo: false,
    puntual: true,
    tarjetaId: tarjeta?.id ?? null,
    tarjetaNombre: tarjeta?.nombre ?? null,
  }
  const conGasto = [...movsReales, hipotetico]

  const motivos: Motivo[] = []

  // 1. El tope: ¿entra en lo que queda?
  const gastado = gastoContraTope([...movsReales, ...cuotasMes], mes, tope)
  const pendientes = tope === 'tarjeta' ? fijosPendientes(fijos, movsReales, mes) : 0
  const margen = margenDisponible({ tope: topeMonto, gastadoReal: gastado, fijosPendientes: pendientes })
  const sinTope = topeMonto <= 0
  const entra = sinTope || monto <= margen

  if (sinTope) {
    motivos.push({ tono: 'neutro', tema: NOMBRE_TOPE[tope], texto: 'No hay tope configurado.' })
  } else if (entra) {
    const diasConHoy = diasDelMes(mes) - diaActual + 1
    const queda = margen - monto
    motivos.push({
      tono: 'ok',
      tema: NOMBRE_TOPE[tope],
      texto:
        `Te quedan ${$(margen)}. Después de esto, ${$(queda)} para ` +
        `${diasConHoy} ${diasConHoy === 1 ? 'día' : 'días'} ` +
        `(~${$(disponiblePorDia(queda, diasConHoy))} por día).`,
    })
  } else {
    motivos.push({
      tono: 'mal',
      tema: NOMBRE_TOPE[tope],
      texto: `Te quedan ${$(margen)}: con este gasto te pasás ${$(monto - margen)} del tope.`,
    })
  }

  // 2. El cierre estimado del mes, con el gasto adentro.
  const cierre = (movs: MovimientoDetalle[]) =>
    prediccionDelTope({
      movsReales: movs,
      cuotasMes,
      fijos,
      mes,
      tope,
      mesesHistorico: config.mesesHistorico,
      diaActual,
    }).prediccion
  const antes = cierre(movsReales)
  const despues = cierre(conGasto)
  const cierreSePasa = !sinTope && despues.status === 'proyeccion' && despues.normal > topeMonto

  if (antes.status === 'proyeccion' && despues.status === 'proyeccion') {
    motivos.push({
      tono: cierreSePasa ? 'atencion' : 'neutro',
      tema: 'Cierre estimado',
      texto:
        `Pasa de ${$(antes.normal)} a ${$(despues.normal)}` +
        (sinTope ? '.' : `; el tope es ${$(topeMonto)}.`),
    })
  } else {
    motivos.push({
      tono: 'neutro',
      tema: 'Cierre estimado',
      texto: 'Es temprano en el mes para proyectar el cierre.',
    })
  }

  // 3. El presupuesto, si el comercio está en el plan del mes.
  if (args.comercioId) {
    const fila = presupuestoVsReal(args.plan, movsReales, mes, config.umbralCercaPct).find(
      (f) => f.comercioId === args.comercioId,
    )
    if (fila && fila.planeado > 0) {
      const queda = fila.diferencia - monto
      motivos.push(
        queda >= 0
          ? {
              tono: 'ok',
              tema: `Presupuesto ${fila.comercio}`,
              texto: `Quedan ${$(Math.max(0, fila.diferencia))}; después, ${$(queda)}.`,
            }
          : {
              tono: 'atencion',
              tema: `Presupuesto ${fila.comercio}`,
              texto: `Quedan ${$(Math.max(0, fila.diferencia))}: te pasarías ${$(-queda)} del plan.`,
            },
      )
    }
  }

  // 4. La meta del banco: suma si se paga con una tarjeta de la meta; si no y
  //    la meta no llega, se avisa que el mismo gasto podría sumar.
  const argsMeta = {
    cuotasMes,
    fijos,
    tarjetas,
    mes,
    diaActual,
    mesesHistorico: config.mesesHistorico,
    minimo: config.metaMinimoCentavos,
    colchon: config.metaColchonCentavos,
    diaCierre: config.metaDiaCierre,
  }
  const metaAntes = metaDelMes({ ...argsMeta, movsReales })
  if (metaAntes && metaAntes.estado !== 'cumplida') {
    if (tarjeta?.sumaMeta) {
      const metaDespues = metaDelMes({ ...argsMeta, movsReales: conGasto })!
      motivos.push({
        tono: 'ok',
        tema: `Meta ${metaAntes.banco}`,
        texto:
          metaDespues.falta === 0
            ? 'Además, con esto llegás al mínimo.'
            : `Además te suma: faltarían ${$(metaDespues.falta)}.`,
      })
    } else if (metaAntes.estado === 'no-llega' || metaAntes.estado === 'urgente') {
      motivos.push({
        tono: 'neutro',
        tema: `Meta ${metaAntes.banco}`,
        texto: `Si lo pagás con ${metaAntes.banco}, además te suma a la meta (faltan ${$(metaAntes.falta)}).`,
      })
    }
  }

  const veredicto: Veredicto = !entra ? 'no' : cierreSePasa ? 'justo' : 'si'
  return { veredicto, titulo: TITULO[veredicto], motivos }
}
