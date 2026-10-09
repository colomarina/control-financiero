/**
 * Migra el Excel "Control_Financiero.xlsx" a `supabase/seed.sql`.
 *
 *   node scripts/migrar-excel.ts <ruta-al-xlsx> [salida.sql]
 *
 * No usa dependencias: un .xlsx es un ZIP de XML, y el ZIP se lee con `zlib`.
 *
 * Lee las hojas Categorias, Movimientos, Gastos Fijos, Historial Presupuestos
 * y Configuracion, y escupe INSERTs. Los importes salen en centavos, las
 * fechas como DATE y las formas de pago traducidas al enum.
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { inflateRawSync } from 'node:zlib'
import { randomUUID } from 'node:crypto'
import { FORMA_PAGO_DESDE_EXCEL, type FormaPago } from '../lib/schemas/movimiento.ts'

// ---------------------------------------------------------------------------
// Lector de ZIP mínimo (solo lo que necesita un .xlsx: store e inflate)
// ---------------------------------------------------------------------------
function leerZip(buf: Buffer): Map<string, string> {
  // End Of Central Directory: se busca desde el final por la firma.
  let eocd = -1
  for (let i = buf.length - 22; i >= 0 && i > buf.length - 65557; i--) {
    if (buf.readUInt32LE(i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('No parece un archivo ZIP/XLSX válido.')

  const cantidad = buf.readUInt16LE(eocd + 10)
  let p = buf.readUInt32LE(eocd + 16)
  const salida = new Map<string, string>()

  for (let i = 0; i < cantidad; i++) {
    if (buf.readUInt32LE(p) !== 0x02014b50) throw new Error('Central directory corrupto.')
    const metodo = buf.readUInt16LE(p + 10)
    const tamComprimido = buf.readUInt32LE(p + 20)
    const nombreLen = buf.readUInt16LE(p + 28)
    const extraLen = buf.readUInt16LE(p + 30)
    const comentarioLen = buf.readUInt16LE(p + 32)
    const offsetLocal = buf.readUInt32LE(p + 42)
    const nombre = buf.toString('utf8', p + 46, p + 46 + nombreLen)

    // El header local tiene sus propios largos de nombre/extra.
    const lNombreLen = buf.readUInt16LE(offsetLocal + 26)
    const lExtraLen = buf.readUInt16LE(offsetLocal + 28)
    const inicio = offsetLocal + 30 + lNombreLen + lExtraLen
    const crudo = buf.subarray(inicio, inicio + tamComprimido)

    if (nombre.endsWith('.xml') || nombre.endsWith('.rels')) {
      salida.set(nombre, (metodo === 0 ? crudo : inflateRawSync(crudo)).toString('utf8'))
    }
    p += 46 + nombreLen + extraLen + comentarioLen
  }
  return salida
}

// ---------------------------------------------------------------------------
// Lectura de celdas
// ---------------------------------------------------------------------------
function desescapar(s: string): string {
  return s.replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'").replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(+d))
    .replace(/&amp;/g, '&')
}

type Celda = (col: string, fila: number) => string | null

function abrirLibro(ruta: string) {
  const archivos = leerZip(readFileSync(ruta))
  const leer = (n: string) => {
    const x = archivos.get(n)
    if (!x) throw new Error(`Falta ${n} dentro del xlsx.`)
    return x
  }

  const compartidas: string[] = []
  for (const si of leer('xl/sharedStrings.xml').split('<si>').slice(1)) {
    const chunk = si.split('</si>')[0]
    let t = ''
    for (const m of chunk.matchAll(/<t[^>]*>([\s\S]*?)<\/t>/g)) t += m[1]
    compartidas.push(desescapar(t))
  }

  // nombre de hoja -> archivo
  const rels: Record<string, string> = {}
  for (const m of leer('xl/_rels/workbook.xml.rels')
    .matchAll(/Id="([^"]+)"[^>]*Target="(worksheets\/[^"]+)"/g)) rels[m[1]] = m[2]

  const porNombre: Record<string, string> = {}
  for (const m of leer('xl/workbook.xml').matchAll(/<sheet\s([^>]*)\/>/g)) {
    const nombre = /name="([^"]+)"/.exec(m[1])?.[1]
    const rid = /r:id="([^"]+)"/.exec(m[1])?.[1]
    if (nombre && rid && rels[rid]) porNombre[desescapar(nombre)] = rels[rid]
  }

  return function hoja(nombre: string): Celda {
    const archivo = porNombre[nombre]
    if (!archivo) throw new Error(`No encontré la hoja "${nombre}".`)
    const xml = leer(`xl/${archivo}`)
    const celdas = new Map<string, string>()
    for (const m of xml.matchAll(
      /<c r="([A-Z]+\d+)"([^>]*)\/?>([\s\S]*?)(?:<\/c>|(?=<c |<\/row>))/g)) {
      const [, ref, attrs, cuerpo] = m
      const tipo = /t="([^"]+)"/.exec(attrs)?.[1]
      const v = /<v>([\s\S]*?)<\/v>/.exec(cuerpo)
      const inline = /<is>[\s\S]*?<t[^>]*>([\s\S]*?)<\/t>/.exec(cuerpo)
      let valor: string | null = null
      if (tipo === 's' && v) valor = compartidas[+v[1]]
      else if (tipo === 'inlineStr' && inline) valor = desescapar(inline[1])
      else if (v) valor = desescapar(v[1])
      if (valor !== null && valor !== '') celdas.set(ref, valor)
    }
    return (col, fila) => celdas.get(`${col}${fila}`) ?? null
  }
}

// ---------------------------------------------------------------------------
// Conversiones del dominio
// ---------------------------------------------------------------------------
/** Serial de Excel -> "YYYY-MM-DD". La época de Excel es 1899-12-30. */
function serialAFecha(n: string): string {
  return new Date(Math.round(Number(n)) * 86400000 + Date.UTC(1899, 11, 30))
    .toISOString().slice(0, 10)
}
const centavos = (n: string | number | null) => Math.round(Number(n ?? 0) * 100)
const sql = (s: string | null) => (s === null ? 'null' : `'${s.replace(/'/g, "''")}'`)
/**
 * Clave para cruzar nombres entre hojas: sin mayúsculas, sin tildes y sin
 * espacios de más. El Excel tiene "Natación" en Historial Presupuestos y
 * "Natacion" en el catálogo; son el mismo comercio.
 */
const norm = (s: string) =>
  s.trim().toLowerCase().normalize('NFD').replace(/\p{Diacritic}/gu, '').replace(/\s+/g, ' ')

// ---------------------------------------------------------------------------
// Migración
// ---------------------------------------------------------------------------
const entrada = process.argv[2]
const salida = process.argv[3] ?? 'supabase/seed.sql'
if (!entrada) {
  console.error('Uso: node scripts/migrar-excel.ts <ruta-al-xlsx> [salida.sql]')
  process.exit(1)
}

const hoja = abrirLibro(entrada)
const avisos: string[] = []

// --- comercios (hoja Categorias) ---
const cat = hoja('Categorias')
const comercios: Array<{
  id: string; nombre: string; categoria: string; subcategoria: string | null; esFijo: boolean
}> = []
const porNombre = new Map<string, (typeof comercios)[number]>()

for (let f = 6; f <= 300; f++) {
  const nombre = cat('B', f)?.trim()
  if (!nombre) continue
  if (porNombre.has(norm(nombre))) {
    avisos.push(`Comercio duplicado en el catálogo, se ignora la repetición: "${nombre}".`)
    continue
  }
  const c = {
    id: randomUUID(),
    nombre,
    categoria: cat('C', f)?.trim() || 'Otros',
    subcategoria: cat('D', f)?.trim() || null,
    esFijo: (cat('E', f)?.trim() ?? 'No') === 'Sí',
  }
  comercios.push(c)
  porNombre.set(norm(nombre), c)
}

/** Resuelve un comercio por nombre; si no existe lo crea al vuelo y avisa. */
function comercioDe(nombre: string, origen: string) {
  const hit = porNombre.get(norm(nombre))
  if (hit) return hit
  const nuevo = {
    id: randomUUID(), nombre, categoria: 'Otros', subcategoria: null, esFijo: false,
  }
  comercios.push(nuevo)
  porNombre.set(norm(nombre), nuevo)
  avisos.push(`"${nombre}" (${origen}) no estaba en el catálogo: se crea con categoría "Otros".`)
  return nuevo
}

// --- movimientos ---
const mv = hoja('Movimientos')
const movimientos: Array<{
  fecha: string; comercioId: string; centavos: number; formaPago: FormaPago
  banco: string | null; tarjeta: string | null; nota: string | null
}> = []

for (let f = 5; f <= 1000; f++) {
  const fecha = mv('A', f)
  const comercio = mv('E', f)?.trim()
  const importe = mv('H', f)
  if (!fecha || !comercio || importe === null) continue

  const centavosImporte = centavos(importe)
  if (centavosImporte <= 0) {
    avisos.push(`Fila ${f} de Movimientos: importe ${importe}, se omite (la base exige > 0).`)
    continue
  }

  const textoForma = mv('J', f)?.trim() ?? ''
  const formaPago = FORMA_PAGO_DESDE_EXCEL[textoForma]
  if (!formaPago) {
    avisos.push(`Fila ${f} de Movimientos: forma de pago desconocida "${textoForma}", se omite.`)
    continue
  }

  const tarjeta = mv('D', f)?.trim() ?? null
  movimientos.push({
    fecha: serialAFecha(fecha),
    comercioId: comercioDe(comercio, 'Movimientos').id,
    centavos: centavosImporte,
    formaPago,
    banco: mv('C', f)?.trim() || null,
    tarjeta: tarjeta && tarjeta !== 'N/A' ? tarjeta : null,
    nota: mv('K', f)?.trim() || null,
  })
}

// --- gastos fijos ---
const gf = hoja('Gastos Fijos')
const fijos: Array<{ comercioId: string; estimado: number; vencimiento: string | null }> = []
for (let f = 6; f <= 35; f++) {
  const concepto = gf('B', f)?.trim()
  if (!concepto) continue
  fijos.push({
    comercioId: comercioDe(concepto, 'Gastos Fijos').id,
    estimado: centavos(gf('C', f)),
    vencimiento: gf('D', f)?.trim() || null,
  })
}

// --- presupuesto (hoja Historial Presupuestos) ---
const hp = hoja('Historial Presupuestos')
const columnas = 'CDEFGHIJKLMNOPQRSTUVWXYZ'.split('')
  .map((c) => ({ col: c, mes: hp(c, 5)?.trim() }))
  .filter((x): x is { col: string; mes: string } => !!x.mes && /^\d{4}-\d{2}$/.test(x.mes))

const presupuesto: Array<{ mes: string; comercioId: string; planeado: number }> = []
for (let f = 6; f <= 40; f++) {
  const concepto = hp('B', f)?.trim()
  if (!concepto || concepto === 'TOTAL') continue
  const comercio = comercioDe(concepto, 'Historial Presupuestos')
  for (const { col, mes } of columnas) {
    const v = hp(col, f)
    if (v === null) continue
    presupuesto.push({ mes, comercioId: comercio.id, planeado: centavos(v) })
  }
}

// --- config ---
const cfg = hoja('Configuracion')
const config = {
  topeTarjeta: centavos(cfg('C', 14)),
  topeEfectivo: centavos(cfg('C', 15)),
  sueldo: centavos(cfg('C', 5)),
  objetivoGasto: centavos(cfg('C', 6)),
  ahorroUsd: Math.round(Number(cfg('C', 8) ?? 0)),
  cotizacionUsd: centavos(cfg('C', 9)),
}

// ---------------------------------------------------------------------------
// seed.sql
// ---------------------------------------------------------------------------
const L: string[] = []
L.push('-- ============================================================================')
L.push('-- seed.sql — generado por scripts/migrar-excel.ts')
L.push(`-- Origen: ${entrada}`)
L.push(`-- Generado: ${new Date().toISOString()}`)
L.push('--')
L.push('-- Correr DESPUÉS de schema.sql y DESPUÉS de haber entrado una vez a la app')
L.push('-- (hace falta que exista el usuario en auth.users).')
L.push('--')
L.push('-- Es seguro: si ya hay movimientos cargados, aborta sin tocar nada.')
L.push('-- ============================================================================')
L.push('')
L.push('do $$')
L.push('declare')
L.push('  v_user uuid;')
L.push('begin')
L.push('  -- App de un solo usuario: tomamos el primero que haya en auth.users.')
L.push('  select id into v_user from auth.users order by created_at limit 1;')
L.push("  if v_user is null then")
L.push("    raise exception 'No hay usuarios en auth.users. Creá tu usuario en el dashboard de Supabase (Authentication > Users) y volvé a correr esto.';")
L.push('  end if;')
L.push('')
L.push('  if exists (select 1 from movimientos where user_id = v_user) then')
L.push("    raise exception 'Ya hay movimientos para este usuario. Borralos antes de re-importar.';")
L.push('  end if;')
L.push('')

L.push(`  -- ${comercios.length} comercios`)
L.push('  insert into comercios (id, user_id, nombre, categoria, subcategoria, es_fijo) values')
L.push(comercios.map((c) =>
  `    ('${c.id}', v_user, ${sql(c.nombre)}, ${sql(c.categoria)}, ${sql(c.subcategoria)}, ${c.esFijo})`
).join(',\n') + '\n  on conflict do nothing;')
L.push('')

L.push(`  -- ${movimientos.length} movimientos`)
L.push('  insert into movimientos (user_id, fecha, comercio_id, importe_centavos, forma_pago, banco, tarjeta, nota) values')
L.push(movimientos.map((m) =>
  `    (v_user, '${m.fecha}', '${m.comercioId}', ${m.centavos}, '${m.formaPago}', ${sql(m.banco)}, ${sql(m.tarjeta)}, ${sql(m.nota)})`
).join(',\n') + ';')
L.push('')

L.push(`  -- ${fijos.length} gastos fijos`)
L.push('  insert into gastos_fijos (user_id, comercio_id, importe_estimado_centavos, vencimiento) values')
L.push(fijos.map((f) =>
  `    (v_user, '${f.comercioId}', ${f.estimado}, ${sql(f.vencimiento)})`
).join(',\n') + '\n  on conflict do nothing;')
L.push('')

L.push(`  -- ${presupuesto.length} filas de presupuesto`)
L.push('  insert into presupuesto (user_id, mes, comercio_id, planeado_centavos) values')
L.push(presupuesto.map((p) =>
  `    (v_user, '${p.mes}', '${p.comercioId}', ${p.planeado})`
).join(',\n') + '\n  on conflict do nothing;')
L.push('')

L.push('  -- configuración')
L.push('  insert into config (user_id, tope_tarjeta_centavos, tope_efectivo_centavos,')
L.push('                      sueldo_centavos, objetivo_gasto_mensual_centavos,')
L.push('                      objetivo_ahorro_usd, cotizacion_usd_centavos)')
L.push(`  values (v_user, ${config.topeTarjeta}, ${config.topeEfectivo}, ${config.sueldo},`)
L.push(`          ${config.objetivoGasto}, ${config.ahorroUsd}, ${config.cotizacionUsd})`)
L.push('  on conflict (user_id) do nothing;')
L.push('')
L.push("  raise notice 'Importación lista.';")
L.push('end $$;')
L.push('')

writeFileSync(salida, L.join('\n'), 'utf8')

const totalPorMes = new Map<string, number>()
for (const m of movimientos) {
  const mes = m.fecha.slice(0, 7)
  totalPorMes.set(mes, (totalPorMes.get(mes) ?? 0) + m.centavos)
}

console.log(`✔ ${salida}`)
console.log(`  comercios    ${comercios.length}`)
console.log(`  movimientos  ${movimientos.length}`)
console.log(`  gastos fijos ${fijos.length}`)
console.log(`  presupuesto  ${presupuesto.length} filas (${columnas.map((c) => c.mes).join(', ')})`)
console.log('  total por mes:')
for (const [mes, c] of [...totalPorMes].sort()) {
  console.log(`    ${mes}  $${(c / 100).toLocaleString('es-AR')}`)
}
if (avisos.length) {
  console.log(`\n⚠ ${avisos.length} aviso(s):`)
  for (const a of avisos) console.log(`  - ${a}`)
}
