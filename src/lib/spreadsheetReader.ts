/**
 * Zero-dependency OpenXML (.xlsx), HTML table, and CSV reader for browser and tests.
 * Supports:
 * - Genuine .xlsx files created by Microsoft Excel, LibreOffice, Google Sheets, or scripts.
 * - Robust ZIP archive parsing via End of Central Directory (EOCD) & Central Directory headers
 *   as well as fallback to Local File Headers.
 * - Supports Deflate (via browser/Node DecompressionStream) and Stored (uncompressed) files.
 * - Handles ZIP streaming archives with Data Descriptors (bit 3 set).
 * - Identifies worksheets through xl/workbook.xml + xl/_rels/workbook.xml.rels or by scanning xl/worksheets/*.
 * - Parses shared strings, inline strings, formatted numbers/dates, boolean and string types.
 * - Graceful fallback if a file with extension .xlsx or .xls is actually an HTML table or CSV/TSV.
 * - Clear, descriptive error messages explaining what went wrong and which sheet/file failed.
 */

export interface ParsedSheet {
  headers: string[]
  rows: string[][]
}

/**
 * Parses CSV or TSV text, handling quotes, commas, semicolons, tabs, and CRLF.
 */
export function parseCSV(text: string): ParsedSheet {
  // Strip UTF-8 BOM if present
  let cleanText = text
  if (cleanText.charCodeAt(0) === 0xfeff) {
    cleanText = cleanText.slice(1)
  }

  const lines: string[][] = []
  let currentRow: string[] = []
  let currentCell = ''
  let insideQuotes = false
  let detectedSep: string | null = null

  // Pre-detect delimiter from the first 5 lines if possible
  const sampleLines = cleanText.split(/\r?\n/).slice(0, 5).filter(Boolean)
  const firstLine = sampleLines[0] || ''
  const semicolonCount = (firstLine.match(/;/g) || []).length
  const commaCount = (firstLine.match(/,/g) || []).length
  const tabCount = (firstLine.match(/\t/g) || []).length

  if (tabCount > semicolonCount && tabCount > commaCount) {
    detectedSep = '\t'
  } else if (semicolonCount >= commaCount) {
    detectedSep = ';'
  } else {
    detectedSep = ','
  }

  for (let i = 0; i < cleanText.length; i++) {
    const char = cleanText[i]
    const nextChar = cleanText[i + 1]

    if (char === '"') {
      if (insideQuotes && nextChar === '"') {
        currentCell += '"'
        i++ // Skip escaped quote
      } else {
        insideQuotes = !insideQuotes
      }
    } else if (char === detectedSep && !insideQuotes) {
      currentRow.push(currentCell.trim())
      currentCell = ''
    } else if ((char === '\r' || char === '\n') && !insideQuotes) {
      if (char === '\r' && nextChar === '\n') {
        i++
      }
      currentRow.push(currentCell.trim())
      if (currentRow.some((c) => c.length > 0)) {
        lines.push(currentRow)
      }
      currentRow = []
      currentCell = ''
    } else {
      currentCell += char
    }
  }

  if (currentCell.length > 0 || currentRow.length > 0) {
    currentRow.push(currentCell.trim())
    if (currentRow.some((c) => c.length > 0)) {
      lines.push(currentRow)
    }
  }

  if (lines.length === 0) {
    return { headers: [], rows: [] }
  }

  const headers = (lines[0] || []).map((h) => (h != null ? String(h).trim() : ''))
  const rows = lines
    .slice(1)
    .filter((r) => Array.isArray(r) && r.some((c) => c != null && String(c).trim().length > 0))
    .map((r) => r.map((c) => (c != null ? String(c).trim() : '')))
  return { headers, rows }
}

/**
 * Parses simple HTML table markup (often saved with .xls or .xlsx extension by legacy systems).
 */
export function parseHtmlTable(html: string): ParsedSheet | null {
  if (!/<table\b[^>]*>/i.test(html)) {
    return null
  }

  const rows: string[][] = []
  const rowRegex = /<tr\b[^>]*>([\s\S]*?)<\/tr>/gi
  let rowMatch: RegExpExecArray | null

  while ((rowMatch = rowRegex.exec(html)) !== null) {
    const rowContent = rowMatch[1]
    const cellRegex = /<(?:td|th)\b[^>]*>([\s\S]*?)<\/(?:td|th)>/gi
    let cellMatch: RegExpExecArray | null
    const cells: string[] = []

    while ((cellMatch = cellRegex.exec(rowContent)) !== null) {
      let cellText = cellMatch[1]
      // Strip nested HTML tags
      cellText = cellText.replace(/<[^>]+>/g, '')
      // Decode basic HTML entities
      cellText = cellText
        .replace(/&nbsp;/g, ' ')
        .replace(/&amp;/g, '&')
        .replace(/&lt;/g, '<')
        .replace(/&gt;/g, '>')
        .replace(/&quot;/g, '"')
        .replace(/&#39;/g, "'")
        .trim()
      cells.push(cellText)
    }

    if (cells.some((c) => c.length > 0)) {
      rows.push(cells)
    }
  }

  if (rows.length === 0) return null

  const headers = (rows[0] || []).map((h) => (h != null ? String(h).trim() : ''))
  const dataRows = rows
    .slice(1)
    .filter((r) => Array.isArray(r) && r.some((c) => c != null && String(c).trim().length > 0))
    .map((r) => r.map((c) => (c != null ? String(c).trim() : '')))
  return { headers, rows: dataRows }
}

interface ZipEntry {
  name: string
  compressionMethod: number
  compressedData: Uint8Array
  uncompressedSize: number
}

/**
 * Deflate decompression using browser/runtime native DecompressionStream.
 */
async function decompressDeflate(data: Uint8Array, entryName = ''): Promise<Uint8Array> {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('DecompressionStream não suportado neste navegador/ambiente.')
  }

  if (data.length === 0) {
    return new Uint8Array(0)
  }

  // Safe buffer copy to prevent shared ArrayBuffer detachment / view issues
  const safeData = new Uint8Array(data.byteLength)
  safeData.set(data)

  const decompressPromise = (async () => {
    // Try 'deflate-raw' (standard in raw ZIP entries), fallback to 'deflate' (zlib-wrapped)
    let lastErr: unknown
    for (const format of ['deflate-raw', 'deflate'] as const) {
      try {
        const ds = new DecompressionStream(format)
        const responseStream = new Response(safeData).body
        if (responseStream) {
          const decompressedStream = responseStream.pipeThrough(ds)
          const res = new Response(decompressedStream)
          const ab = await res.arrayBuffer()
          return new Uint8Array(ab)
        }

        const writer = ds.writable.getWriter()
        const writePromise = writer.write(safeData).then(() => writer.close())
        const readPromise = new Response(ds.readable).arrayBuffer()
        const [, ab] = await Promise.all([writePromise, readPromise])
        return new Uint8Array(ab)
      } catch (err) {
        lastErr = err
        // continue to try alternate format if first fails
      }
    }
    throw new Error(
      `Falha ao descompactar entrada "${entryName}": ${lastErr instanceof Error ? lastErr.message : String(lastErr)}`,
    )
  })()

  // Timeout guard: 10 seconds max per entry decompression
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `Tempo limite excedido (10s) na descompressão da entrada "${entryName || 'XML'}" do arquivo Excel.`,
        ),
      )
    }, 10000)
  })

  try {
    return await Promise.race([decompressPromise, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}

/**
 * Locates the End of Central Directory Record (EOCD) by scanning backwards from the end.
 * Standard EOCD signature is 0x06054b50 (PK\x05\x06).
 */
function findEndOfCentralDirectory(bytes: Uint8Array): {
  cdOffset: number
  cdSize: number
  totalEntries: number
} | null {
  const minEOCDSize = 22
  if (bytes.length < minEOCDSize) return null

  const maxCommentSize = 65535
  const maxSearch = Math.min(bytes.length, minEOCDSize + maxCommentSize)
  const start = bytes.length - minEOCDSize
  const stop = bytes.length - maxSearch
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)

  let iterations = 0
  const MAX_ITERATIONS = 70000

  for (let i = start; i >= stop && iterations < MAX_ITERATIONS; i--, iterations++) {
    if (view.getUint32(i, true) === 0x06054b50) {
      const totalEntries = view.getUint16(i + 10, true)
      const cdSize = view.getUint32(i + 12, true)
      const cdOffset = view.getUint32(i + 16, true)
      return { cdOffset, cdSize, totalEntries }
    }
  }

  return null
}

/**
 * Parses zip entries by navigating the standard Central Directory headers (0x02014b50).
 * This handles archives with data descriptors (bit 3) and variable-length extra fields.
 */
function parseZipViaCentralDirectory(bytes: Uint8Array): ZipEntry[] | null {
  const eocd = findEndOfCentralDirectory(bytes)
  if (!eocd) return null

  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entries: ZipEntry[] = []
  let cdOffset = eocd.cdOffset

  const maxEntries = Math.min(eocd.totalEntries, 5000)
  for (let i = 0; i < maxEntries; i++) {
    if (cdOffset + 46 > bytes.length) break
    const sig = view.getUint32(cdOffset, true)
    if (sig !== 0x02014b50) {
      break
    }

    const compMethod = view.getUint16(cdOffset + 10, true)
    const compressedSize = view.getUint32(cdOffset + 20, true)
    const uncompressedSize = view.getUint32(cdOffset + 24, true)
    const nameLen = view.getUint16(cdOffset + 28, true)
    const extraLen = view.getUint16(cdOffset + 30, true)
    const commentLen = view.getUint16(cdOffset + 32, true)
    const localHeaderOffset = view.getUint32(cdOffset + 42, true)

    if (cdOffset + 46 + nameLen > bytes.length) break
    const nameBytes = bytes.slice(cdOffset + 46, cdOffset + 46 + nameLen)
    const name = new TextDecoder('utf-8').decode(nameBytes).replace(/\\/g, '/')

    // Locate data in local header
    if (localHeaderOffset + 30 <= bytes.length) {
      const localSig = view.getUint32(localHeaderOffset, true)
      if (localSig === 0x04034b50) {
        const localNameLen = view.getUint16(localHeaderOffset + 26, true)
        const localExtraLen = view.getUint16(localHeaderOffset + 28, true)
        const dataStart = localHeaderOffset + 30 + localNameLen + localExtraLen

        if (dataStart + compressedSize <= bytes.length) {
          const compressedData = bytes.slice(dataStart, dataStart + compressedSize)
          entries.push({
            name,
            compressionMethod: compMethod,
            compressedData,
            uncompressedSize,
          })
        }
      }
    }

    const step = 46 + nameLen + extraLen + commentLen
    if (step <= 0) break // Guard against zero-step infinite loop
    cdOffset += step
  }

  return entries.length > 0 ? entries : null
}

/**
 * Fallback ZIP entry parser: iterates local file headers (0x04034b50) sequentially.
 * Works when compressedSize in local header is non-zero (archives without bit 3 streaming).
 */
function parseZipViaLocalHeaders(bytes: Uint8Array): ZipEntry[] {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength)
  const entries: ZipEntry[] = []
  let offset = 0

  let localIterations = 0
  const MAX_LOCAL_ENTRIES = 5000

  while (offset + 30 <= bytes.length && localIterations < MAX_LOCAL_ENTRIES) {
    localIterations++
    const sig = view.getUint32(offset, true)
    if (sig !== 0x04034b50) {
      break
    }

    const flags = view.getUint16(offset + 6, true)
    const compMethod = view.getUint16(offset + 8, true)
    const compressedSize = view.getUint32(offset + 18, true)
    const uncompressedSize = view.getUint32(offset + 22, true)
    const nameLen = view.getUint16(offset + 26, true)
    const extraLen = view.getUint16(offset + 28, true)

    // If bit 3 is set and compressedSize is 0, sequential local scanning cannot determine data length
    if ((flags & 0x08) !== 0 && compressedSize === 0) {
      break
    }

    const nameBytes = bytes.slice(offset + 30, offset + 30 + nameLen)
    const name = new TextDecoder('utf-8').decode(nameBytes).replace(/\\/g, '/')

    const dataStart = offset + 30 + nameLen + extraLen
    if (dataStart + compressedSize > bytes.length) {
      break
    }
    const compressedData = bytes.slice(dataStart, dataStart + compressedSize)

    entries.push({
      name,
      compressionMethod: compMethod,
      compressedData,
      uncompressedSize,
    })

    const nextOffset = dataStart + compressedSize
    if (nextOffset <= offset) {
      break // Prevent infinite loop if sizes are zero/invalid
    }
    offset = nextOffset
  }

  return entries
}

/**
 * Extracts and decodes text for a named ZIP entry.
 */
async function getZipEntryText(entries: ZipEntry[], targetName: string): Promise<string | null> {
  const normalizedTarget = targetName.replace(/^\//, '').toLowerCase()
  const entry = entries.find((e) => e.name.replace(/^\//, '').toLowerCase() === normalizedTarget)
  if (!entry) return null

  let uncompressedBytes: Uint8Array
  if (entry.compressionMethod === 0) {
    uncompressedBytes = entry.compressedData
  } else if (entry.compressionMethod === 8) {
    uncompressedBytes = await decompressDeflate(entry.compressedData, entry.name)
  } else {
    throw new Error(
      `Método de compressão ZIP não suportado (${entry.compressionMethod}) na entrada "${entry.name}".`,
    )
  }

  return new TextDecoder('utf-8').decode(uncompressedBytes)
}

/**
 * Converts Excel serial day number to DD/MM/AAAA string.
 */
export function excelSerialToDateBR(serial: number): string | null {
  if (isNaN(serial) || serial <= 0) return null
  // 1900 date system leap year bug: day 60 is phantom 1900-02-29
  // Excel treats 1 = 1900-01-01
  const utc18991230 = Date.UTC(1899, 11, 30)
  const utcDate = new Date(utc18991230 + Math.round(serial) * 86400000)
  if (isNaN(utcDate.getTime())) return null

  const y = utcDate.getUTCFullYear()
  const m = String(utcDate.getUTCMonth() + 1).padStart(2, '0')
  const d = String(utcDate.getUTCDate()).padStart(2, '0')
  return `${d}/${m}/${y}`
}

/**
 * Extracts shared strings from xl/sharedStrings.xml
 */
function unescapeXml(text: string): string {
  if (!text) return ''
  return text
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&apos;/g, "'")
}

/**
 * Extracts shared strings from xl/sharedStrings.xml
 */
function extractSharedStrings(xmlStr: string): string[] {
  const strings: string[] = []
  if (!xmlStr) return strings

  const siRegex = /<si\b[^>]*>([\s\S]*?)<\/si>/g
  let siMatch: RegExpExecArray | null
  let maxCount = 200000 // Upper safety boundary for huge sheets

  while ((siMatch = siRegex.exec(xmlStr)) !== null && maxCount-- > 0) {
    const siContent = siMatch[1]
    const tRegex = /<t\b[^>]*>([\s\S]*?)<\/t>/g
    let tMatch: RegExpExecArray | null
    let cellText = ''
    let prevIndex = -1
    let tLimit = 500
    while ((tMatch = tRegex.exec(siContent)) !== null && tLimit-- > 0) {
      if (tMatch.index === prevIndex) {
        tRegex.lastIndex++
      }
      prevIndex = tMatch.index
      cellText += tMatch[1]
    }
    strings.push(unescapeXml(cellText))
  }

  return strings
}

/**
 * Extracts cell column index from ref (e.g., "A1" -> 0, "B1" -> 1, "AA2" -> 26)
 */
function cellRefToColIndex(ref: string): number {
  const match = ref.match(/^([A-Z]+)/i)
  if (!match) return 0
  const letters = match[1].toUpperCase()
  let col = 0
  for (let i = 0; i < letters.length; i++) {
    col = col * 26 + (letters.charCodeAt(i) - 64)
  }
  return col - 1
}

/**
 * Parses a worksheet XML content (e.g. xl/worksheets/sheet1.xml).
 */
function parseWorksheetXml(
  sheetXml: string,
  sharedStrings: string[],
  dateFormatXfIndices: Set<number>,
): string[][] {
  const rows: string[][] = []
  // Matches both non-empty <row ...>...</row> and self-closing <row .../>
  const rowRegex = /<row\b([^>]*?)(?:\/>|>([\s\S]*?)<\/row>)/g
  let rowMatch: RegExpExecArray | null
  let maxRows = 100000

  while ((rowMatch = rowRegex.exec(sheetXml)) !== null && maxRows-- > 0) {
    const rowContent = rowMatch[2] || ''
    if (!rowContent) continue

    // Matches both <c ...>...</c> and self-closing <c .../>
    const cellRegex = /<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g
    let cellMatch: RegExpExecArray | null
    const rowCells: { col: number; val: string }[] = []
    let maxCol = -1
    let cellLimit = 1000

    while ((cellMatch = cellRegex.exec(rowContent)) !== null && cellLimit-- > 0) {
      const attrs = cellMatch[1] || ''
      const inner = cellMatch[2] || ''

      const refMatch = attrs.match(/r="([A-Z0-9]+)"/i)
      const ref = refMatch ? refMatch[1] : ''
      const colIdx = cellRefToColIndex(ref)
      if (colIdx > maxCol) maxCol = colIdx

      const typeMatch = attrs.match(/t="([^"]+)"/)
      const cellType = typeMatch ? typeMatch[1] : ''

      const sMatch = attrs.match(/s="(\d+)"/)
      const styleIdx = sMatch ? parseInt(sMatch[1], 10) : -1

      let val = ''
      if (cellType === 's') {
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/)
        if (vMatch) {
          const sIdx = parseInt(vMatch[1], 10)
          val = sharedStrings[sIdx] ?? ''
        }
      } else if (cellType === 'inlineStr') {
        const tMatch = inner.match(/<t\b[^>]*>([\s\S]*?)<\/t>/)
        if (tMatch) {
          val = unescapeXml(tMatch[1])
        }
      } else if (cellType === 'b') {
        // Boolean cell
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/)
        val = vMatch && vMatch[1].trim() === '1' ? 'SIM' : 'NÃO'
      } else if (cellType === 'str') {
        // Formula string result
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/)
        val = vMatch ? unescapeXml(vMatch[1]) : ''
      } else {
        const vMatch = inner.match(/<v>([\s\S]*?)<\/v>/)
        if (vMatch) {
          const rawV = vMatch[1].trim()
          if (dateFormatXfIndices.has(styleIdx)) {
            const numVal = parseFloat(rawV)
            if (!isNaN(numVal) && numVal > 1000) {
              const dateStr = excelSerialToDateBR(numVal)
              val = dateStr || rawV
            } else {
              val = rawV
            }
          } else {
            val = rawV
          }
        }
      }

      rowCells.push({ col: colIdx, val })
    }

    if (maxCol >= 0 && maxCol < 500) {
      const fullRow = new Array(maxCol + 1).fill('')
      for (const cell of rowCells) {
        if (cell.col <= maxCol) {
          fullRow[cell.col] = cell.val
        }
      }
      rows.push(fullRow)
    }
  }

  return rows
}

/**
 * Inspects styles.xml to find which cellXf indices correspond to date formats (DD/MM/YYYY, etc.)
 */
function findDateStyleIndices(stylesXml: string): Set<number> {
  const dateXfs = new Set<number>()
  if (!stylesXml) return dateXfs

  // Built-in date numFmtIds in Excel: 14, 15, 16, 17, 22
  const dateNumFmtIds = new Set<number>([14, 15, 16, 17, 22])

  // Custom numFmts
  const customNumFmtRegex = /<numFmt\b[^>]*numFmtId="(\d+)"[^>]*formatCode="([^"]+)"/g
  let customMatch: RegExpExecArray | null
  while ((customMatch = customNumFmtRegex.exec(stylesXml)) !== null) {
    const id = parseInt(customMatch[1], 10)
    const code = customMatch[2].toLowerCase()
    if (code.includes('yy') || code.includes('dd') || code.includes('mm')) {
      dateNumFmtIds.add(id)
    }
  }

  // Find cellXfs
  const cellXfsMatch = stylesXml.match(/<cellXfs\b[^>]*>([\s\S]*?)<\/cellXfs>/)
  if (!cellXfsMatch) return dateXfs

  const xfRegex = /<xf\b([^>]*)/g
  let xfMatch: RegExpExecArray | null
  let idx = 0
  while ((xfMatch = xfRegex.exec(cellXfsMatch[1])) !== null) {
    const attrs = xfMatch[1]
    const numFmtMatch = attrs.match(/numFmtId="(\d+)"/)
    if (numFmtMatch) {
      const nId = parseInt(numFmtMatch[1], 10)
      if (dateNumFmtIds.has(nId)) {
        dateXfs.add(idx)
      }
    }
    idx++
  }

  return dateXfs
}

/**
 * Resolves worksheet entry paths from xl/workbook.xml and xl/_rels/workbook.xml.rels.
 * Returns paths in sheet declaration order.
 */
async function resolveSheetPaths(entries: ZipEntry[]): Promise<string[]> {
  const sheetPaths: string[] = []

  const workbookXml = await getZipEntryText(entries, 'xl/workbook.xml')
  const workbookRelsXml = await getZipEntryText(entries, 'xl/_rels/workbook.xml.rels')

  if (workbookXml) {
    // Map rId -> target file from workbook.xml.rels
    const relsMap = new Map<string, string>()
    if (workbookRelsXml) {
      const relRegex = /<Relationship\b[^>]*Id="([^"]+)"[^>]*Target="([^"]+)"/g
      let relMatch: RegExpExecArray | null
      while ((relMatch = relRegex.exec(workbookRelsXml)) !== null) {
        let target = relMatch[2]
        if (!target.startsWith('/') && !target.startsWith('xl/')) {
          target = 'xl/' + target.replace(/^\.?\//, '')
        } else {
          target = target.replace(/^\//, '')
        }
        relsMap.set(relMatch[1], target)
      }
    }

    // Extract sheets in order: <sheet name="..." sheetId="..." r:id="rId1" />
    const sheetTagRegex = /<sheet\b([^>]+)/g
    let sheetTagMatch: RegExpExecArray | null
    while ((sheetTagMatch = sheetTagRegex.exec(workbookXml)) !== null) {
      const attrs = sheetTagMatch[1]
      const rIdMatch = attrs.match(/r:id="([^"]+)"/i) || attrs.match(/id="([^"]+)"/i)
      if (rIdMatch) {
        const target = relsMap.get(rIdMatch[1])
        if (target) {
          sheetPaths.push(target)
        }
      }
      const sheetIdMatch = attrs.match(/sheetId="(\d+)"/i)
      if (sheetIdMatch && (!rIdMatch || !relsMap.get(rIdMatch[1]))) {
        sheetPaths.push(`xl/worksheets/sheet${sheetIdMatch[1]}.xml`)
      }
    }
  }

  // Also discover any sheets physically present in xl/worksheets/
  for (const entry of entries) {
    const norm = entry.name.replace(/^\//, '').toLowerCase()
    if (norm.startsWith('xl/worksheets/') && norm.endsWith('.xml')) {
      if (!sheetPaths.some((p) => p.toLowerCase() === norm)) {
        sheetPaths.push(entry.name)
      }
    }
  }

  return sheetPaths
}

/**
 * Parses an Excel (.xlsx) file buffer.
 */
export async function parseXlsxBuffer(buffer: ArrayBuffer): Promise<ParsedSheet> {
  const bytes = new Uint8Array(buffer)

  // Quick check: does it look like a text file or HTML table masquerading as .xlsx?
  if (bytes.length >= 4) {
    const firstChars = new TextDecoder('utf-8', { fatal: false }).decode(bytes.slice(0, 100))
    if (
      firstChars.includes('<html') ||
      firstChars.includes('<table') ||
      firstChars.includes('<!DOCTYPE html')
    ) {
      const fullText = new TextDecoder('utf-8').decode(bytes)
      const htmlSheet = parseHtmlTable(fullText)
      if (htmlSheet && htmlSheet.headers.length > 0) {
        return htmlSheet
      }
    }
  }

  // Parse ZIP entries: try Central Directory first (standard, robust), then local headers
  let entries = parseZipViaCentralDirectory(bytes)
  if (!entries || entries.length === 0) {
    entries = parseZipViaLocalHeaders(bytes)
  }

  if (!entries || entries.length === 0) {
    // If not a valid zip, maybe it's CSV or HTML?
    const asText = new TextDecoder('utf-8', { fatal: false }).decode(bytes)
    const htmlTry = parseHtmlTable(asText)
    if (htmlTry && htmlTry.headers.length > 0) {
      return htmlTry
    }
    const csvTry = parseCSV(asText)
    if (csvTry.headers.length > 1 && csvTry.rows.length > 0) {
      return csvTry
    }
    throw new Error('Arquivo XLSX inválido ou corrompido: estrutura ZIP não reconhecida.')
  }

  // 1. Get shared strings
  const sharedStringsXml = await getZipEntryText(entries, 'xl/sharedStrings.xml')
  const sharedStrings = sharedStringsXml ? extractSharedStrings(sharedStringsXml) : []

  // 2. Get styles to detect date cells
  const stylesXml = await getZipEntryText(entries, 'xl/styles.xml')
  const dateStyleIndices = stylesXml ? findDateStyleIndices(stylesXml) : new Set<number>()

  // 3. Resolve all worksheet paths
  const sheetPaths = await resolveSheetPaths(entries)
  if (sheetPaths.length === 0) {
    throw new Error(
      'Nenhuma planilha encontrada dentro do arquivo Excel (sem arquivos em xl/worksheets/).',
    )
  }

  // Try parsing sheets in order until one with data is found
  for (const sheetPath of sheetPaths) {
    const sheetXml = await getZipEntryText(entries, sheetPath)
    if (!sheetXml) continue

    const allRows = parseWorksheetXml(sheetXml, sharedStrings, dateStyleIndices)
    if (allRows.length > 0) {
      const headers = (allRows[0] || []).map((h) => (h != null ? String(h).trim() : ''))
      const rows = allRows
        .slice(1)
        .filter((r) => Array.isArray(r) && r.some((c) => c != null && String(c).trim().length > 0))
        .map((r) => r.map((c) => (c != null ? String(c).trim() : '')))
      return { headers, rows }
    }
  }

  // If sheets were found but empty
  return { headers: [], rows: [] }
}

/**
 * Universal file reader: reads File as XLSX or CSV according to extension or content.
 */
export async function parseSpreadsheetFile(file: File, timeoutMs = 30000): Promise<ParsedSheet> {
  const parsePromise = (async () => {
    const normName = file.name.toLowerCase()
    const isXlsx =
      normName.endsWith('.xlsx') || normName.endsWith('.xlsm') || normName.endsWith('.xls')

    if (isXlsx) {
      const buffer = await file.arrayBuffer()
      return await parseXlsxBuffer(buffer)
    }

    // Default to CSV / text
    const text = await file.text()
    // Check if it's an HTML table saved as .csv
    const htmlTry = parseHtmlTable(text)
    if (htmlTry && htmlTry.headers.length > 0) {
      return htmlTry
    }

    return parseCSV(text)
  })()

  // Guard timeout on entire file parsing
  let timer: ReturnType<typeof setTimeout> | undefined
  const timeoutPromise = new Promise<never>((_, reject) => {
    timer = setTimeout(() => {
      reject(
        new Error(
          `Tempo limite de processamento (${timeoutMs / 1000}s) excedido para o arquivo "${file.name}". Verifique se o arquivo não está corrompido ou com formato não suportado.`,
        ),
      )
    }, timeoutMs)
  })

  try {
    return await Promise.race([parsePromise, timeoutPromise])
  } finally {
    if (timer) clearTimeout(timer)
  }
}
