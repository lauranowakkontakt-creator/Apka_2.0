// Minimalny czytnik .xlsx — bez zależności.
//
// Plik .xlsx to ZIP z kilkoma XML-ami. Czytamy tylko to, czego potrzebuje
// import: listę arkuszy, wspólne napisy i wartości komórek. Bez formatowania,
// bez formuł (bierzemy zapisany wynik). Rozpakowanie przez DecompressionStream
// ('deflate-raw') — jest w przeglądarkach (Safari 16.4+) i w Node 18+.
//
// Wynik: [{ name, rows: string[][] }]. Liczby zostają liczbami zapisanymi jako
// tekst ("-33.24", "45087") — data w Excelu to numer dnia, parseDate z
// budgetImport rozpoznaje go sama.

const u16 = (b, o) => b[o] | (b[o + 1] << 8)
const u32 = (b, o) => (b[o] | (b[o + 1] << 8) | (b[o + 2] << 16) | (b[o + 3] << 24)) >>> 0

async function inflateRaw(bytes) {
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

// ZIP → { ścieżka: Uint8Array } (tylko wybrane pliki, żeby nie rozpakowywać obrazków)
export async function unzip(bytes, want = () => true) {
  let eocd = -1
  for (let i = bytes.length - 22; i >= Math.max(0, bytes.length - 65557); i--) {
    if (u32(bytes, i) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('To nie jest plik .xlsx (brak struktury ZIP).')
  const count = u16(bytes, eocd + 10)
  let p = u32(bytes, eocd + 16)
  const dec = new TextDecoder()
  const out = {}
  for (let n = 0; n < count; n++) {
    if (u32(bytes, p) !== 0x02014b50) break
    const method = u16(bytes, p + 10)
    const csize = u32(bytes, p + 20)
    const nameLen = u16(bytes, p + 28), extraLen = u16(bytes, p + 30), commLen = u16(bytes, p + 32)
    const local = u32(bytes, p + 42)
    const name = dec.decode(bytes.subarray(p + 46, p + 46 + nameLen))
    p += 46 + nameLen + extraLen + commLen
    if (!want(name)) continue
    const start = local + 30 + u16(bytes, local + 26) + u16(bytes, local + 28)
    const data = bytes.subarray(start, start + csize)
    if (method === 0) out[name] = data
    else if (method === 8) out[name] = await inflateRaw(data)
    else throw new Error(`Nieobsługiwana kompresja w pliku (${method}).`)
  }
  return out
}

const ENT = { amp: '&', lt: '<', gt: '>', quot: '"', apos: "'" }
export const xmlText = (s) => s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e) => {
  if (e[0] === '#') return String.fromCodePoint(e[1] === 'x' || e[1] === 'X' ? parseInt(e.slice(2), 16) : Number(e.slice(1)))
  return ENT[e] ?? m
})

// Tekst z <si>/<is>: łączy wszystkie <t> (tekst sformatowany ma kilka
// kawałków), pomija <rPh> (fonetyka z japońskich wersji Excela).
function richText(xml) {
  const clean = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, '')
  let s = ''
  for (const m of clean.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>/g)) s += m[1]
  return xmlText(s)
}

export function parseSharedStrings(xml) {
  if (!xml) return []
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map(m => m[1] ? richText(m[1]) : '')
}

// "AB12" → 27 (indeks kolumny od 0)
export function colIndex(ref) {
  const letters = ref.match(/^[A-Z]+/)?.[0] || 'A'
  let n = 0
  for (const ch of letters) n = n * 26 + (ch.charCodeAt(0) - 64)
  return n - 1
}

export function parseSheet(xml, shared) {
  const rows = []
  for (const rm of xml.matchAll(/<row\b[^>]*?(?:\/>|>([\s\S]*?)<\/row>)/g)) {
    const row = []
    if (rm[1]) {
      for (const cm of rm[1].matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
        const attrs = cm[1], body = cm[2] || ''
        const ref = attrs.match(/\br="([A-Z]+)\d+"/)?.[1]
        const t = attrs.match(/\bt="(\w+)"/)?.[1]
        const idx = ref ? colIndex(ref) : row.length
        const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1]
        let val = ''
        if (t === 's') val = shared[Number(v)] ?? ''
        else if (t === 'inlineStr') val = richText(body.match(/<is>([\s\S]*?)<\/is>/)?.[1] || '')
        else if (t === 'b') val = v === '1' ? 'TRUE' : 'FALSE'
        else if (v != null) val = xmlText(v)
        while (row.length < idx) row.push('')
        row[idx] = String(val).trim()
      }
    }
    if (row.some(c => c !== '')) rows.push(row)
  }
  return rows
}

// Cały skoroszyt: arkusze w kolejności z workbook.xml.
export async function readXlsx(bytes) {
  const files = await unzip(bytes, n => /^xl\/(workbook\.xml|_rels\/workbook\.xml\.rels|sharedStrings\.xml|worksheets\/[^/]+\.xml)$/.test(n))
  const dec = new TextDecoder()
  const txt = (n) => files[n] ? dec.decode(files[n]) : ''
  const wb = txt('xl/workbook.xml')
  if (!wb) throw new Error('To nie jest plik .xlsx (brak skoroszytu).')
  const rels = {}
  for (const m of txt('xl/_rels/workbook.xml.rels').matchAll(/<Relationship\b([^>]*)\/?>/g)) {
    const id = m[1].match(/\bId="([^"]+)"/)?.[1]
    const target = m[1].match(/\bTarget="([^"]+)"/)?.[1]
    if (id && target) rels[id] = target.replace(/^\/?(xl\/)?/, 'xl/')
  }
  const shared = parseSharedStrings(txt('xl/sharedStrings.xml'))
  const sheets = []
  for (const m of wb.matchAll(/<sheet\b([^>]*)\/?>/g)) {
    const name = xmlText(m[1].match(/\bname="([^"]*)"/)?.[1] || '')
    const rid = m[1].match(/\br:id="([^"]+)"/)?.[1]
    const path = rels[rid]
    if (!path || !files[path]) continue
    sheets.push({ name, rows: parseSheet(dec.decode(files[path]), shared) })
  }
  return sheets
}

export const isZip = (bytes) => bytes.length > 4 && bytes[0] === 0x50 && bytes[1] === 0x4b && bytes[2] === 0x03 && bytes[3] === 0x04
