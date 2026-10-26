/**
 * Zero-dependency OpenXML (.xlsx) file generator.
 * Produces genuine .xlsx (ZIP PK standard archive containing XML parts)
 * with true Excel Date cells formatted as DD/MM/AAAA.
 */

// CRC-32 table
const CRC_TABLE = new Uint32Array(256)
for (let i = 0; i < 256; i++) {
  let c = i
  for (let k = 0; k < 8; k++) {
    c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
  }
  CRC_TABLE[i] = c >>> 0
}

function crc32(buf: Uint8Array): number {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc = (crc >>> 8) ^ CRC_TABLE[(crc ^ buf[i]) & 0xff]
  }
  return (crc ^ 0xffffffff) >>> 0
}

interface ZipEntry {
  name: string
  data: Uint8Array
}

/**
 * Creates an uncompressed (Store) ZIP archive from an array of files.
 * Excel fully supports uncompressed / store ZIP archives.
 */
function createZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder()
  const parts: Uint8Array[] = []
  const centralHeaders: Uint8Array[] = []
  let offset = 0

  const now = new Date()
  const dosTime =
    ((now.getHours() << 11) | (now.getMinutes() << 5) | Math.floor(now.getSeconds() / 2)) & 0xffff
  const dosDate =
    (((now.getFullYear() - 1980) << 9) | ((now.getMonth() + 1) << 5) | now.getDate()) & 0xffff

  for (const entry of entries) {
    const nameBytes = encoder.encode(entry.name)
    const crc = crc32(entry.data)
    const size = entry.data.length

    // Local file header (30 bytes + name length)
    const localHeader = new Uint8Array(30 + nameBytes.length)
    const lv = new DataView(localHeader.buffer)
    lv.setUint32(0, 0x04034b50, true) // signature
    lv.setUint16(4, 20, true) // version needed: 2.0
    lv.setUint16(6, 0x0800, true) // general purpose bit flag (UTF-8)
    lv.setUint16(8, 0, true) // compression method: 0 (store)
    lv.setUint16(10, dosTime, true)
    lv.setUint16(12, dosDate, true)
    lv.setUint32(14, crc, true)
    lv.setUint32(18, size, true) // compressed size
    lv.setUint32(22, size, true) // uncompressed size
    lv.setUint16(26, nameBytes.length, true)
    lv.setUint16(28, 0, true) // extra field length
    localHeader.set(nameBytes, 30)

    parts.push(localHeader, entry.data)

    // Central directory header (46 bytes + name length)
    const centralHeader = new Uint8Array(46 + nameBytes.length)
    const cv = new DataView(centralHeader.buffer)
    cv.setUint32(0, 0x02014b50, true) // signature
    cv.setUint16(4, 20, true) // version made by
    cv.setUint16(6, 20, true) // version needed
    cv.setUint16(8, 0x0800, true) // UTF-8
    cv.setUint16(10, 0, true) // compression: store
    cv.setUint16(12, dosTime, true)
    cv.setUint16(14, dosDate, true)
    cv.setUint32(16, crc, true)
    cv.setUint32(20, size, true)
    cv.setUint32(24, size, true)
    cv.setUint16(28, nameBytes.length, true)
    cv.setUint16(30, 0, true) // extra length
    cv.setUint16(32, 0, true) // comment length
    cv.setUint16(34, 0, true) // disk start
    cv.setUint16(36, 0, true) // internal attr
    cv.setUint32(38, 0, true) // external attr
    cv.setUint32(42, offset, true) // local header offset
    centralHeader.set(nameBytes, 46)

    centralHeaders.push(centralHeader)

    offset += localHeader.length + size
  }

  const centralDirOffset = offset
  let centralDirSize = 0
  for (const ch of centralHeaders) {
    centralDirSize += ch.length
    parts.push(ch)
  }

  // End of central directory record (22 bytes)
  const eocd = new Uint8Array(22)
  const ev = new DataView(eocd.buffer)
  ev.setUint32(0, 0x06054b50, true)
  ev.setUint16(4, 0, true) // disk number
  ev.setUint16(6, 0, true) // disk with central dir
  ev.setUint16(8, entries.length, true) // total entries on disk
  ev.setUint16(10, entries.length, true) // total entries
  ev.setUint32(12, centralDirSize, true)
  ev.setUint32(16, centralDirOffset, true)
  ev.setUint16(20, 0, true) // comment length

  parts.push(eocd)

  // Combine into single Uint8Array
  let totalLength = 0
  for (const p of parts) totalLength += p.length
  const result = new Uint8Array(totalLength)
  let cur = 0
  for (const p of parts) {
    result.set(p, cur)
    cur += p.length
  }
  return result
}

/**
 * Escapes XML special characters for OpenXML text content.
 */
function escapeXml(str: string): string {
  if (!str) return ''
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;')
}

/**
 * Converts a date representation (YYYY-MM-DD, DD/MM/YYYY or Date object)
 * to an Excel serial day number (1900 date system, taking the 1900 leap-year bug into account).
 */
export function dateToExcelSerial(dateVal: string | Date | null | undefined): number | null {
  if (!dateVal) return null
  let y = 0
  let m = 0
  let d = 0

  if (dateVal instanceof Date) {
    if (isNaN(dateVal.getTime())) return null
    y = dateVal.getFullYear()
    m = dateVal.getMonth() + 1
    d = dateVal.getDate()
  } else {
    const s = String(dateVal).trim()
    const isoMatch = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
    if (isoMatch) {
      y = parseInt(isoMatch[1], 10)
      m = parseInt(isoMatch[2], 10)
      d = parseInt(isoMatch[3], 10)
    } else {
      const brMatch = s.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
      if (brMatch) {
        d = parseInt(brMatch[1], 10)
        m = parseInt(brMatch[2], 10)
        y = parseInt(brMatch[3], 10)
      } else {
        return null
      }
    }
  }

  if (y < 1900 || m < 1 || m > 12 || d < 1 || d > 31) return null

  // UTC timestamp for UTC midnight of given date
  const utcDate = Date.UTC(y, m - 1, d)
  const utc18991230 = Date.UTC(1899, 11, 30) // Excel epoch accounting for 1900 leap year bug
  const diffDays = Math.round((utcDate - utc18991230) / (24 * 60 * 60 * 1000))
  return diffDays > 0 ? diffDays : null
}

/**
 * Converts column 0-based index to Excel column name (0 -> A, 27 -> AB)
 */
function colIndexToName(index: number): string {
  let name = ''
  let i = index
  while (i >= 0) {
    name = String.fromCharCode((i % 26) + 65) + name
    i = Math.floor(i / 26) - 1
  }
  return name
}

export type CellValue =
  | string
  | number
  | null
  | undefined
  | { type: 'date'; value: string | Date | null | undefined }
  | { type: 'number'; value: number | null | undefined }
  | { type: 'string'; value: string }

export interface SheetDefinition {
  name: string
  columns: { header: string; width?: number }[]
  rows: CellValue[][]
}

/**
 * Generates an OpenXML .xlsx file buffer containing sheets with custom styles:
 * Style index 0: Normal text / number
 * Style index 1: Header (bold, gray fill)
 * Style index 2: Date cell formatted strictly as DD/MM/AAAA (custom numFmt 165: "DD/MM/YYYY")
 */
export function buildXlsx(sheets: SheetDefinition[]): Uint8Array {
  const encoder = new TextEncoder()
  const entries: ZipEntry[] = []

  // 1. [Content_Types].xml
  let sheetOverrides = ''
  for (let i = 1; i <= sheets.length; i++) {
    sheetOverrides += `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`
  }
  const contentTypesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
  ${sheetOverrides}
</Types>`
  entries.push({ name: '[Content_Types].xml', data: encoder.encode(contentTypesXml) })

  // 2. _rels/.rels
  const rootRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`
  entries.push({ name: '_rels/.rels', data: encoder.encode(rootRelsXml) })

  // 3. xl/_rels/workbook.xml.rels
  let workbookRels = `<Relationship Id="rIdStyles" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>`
  for (let i = 1; i <= sheets.length; i++) {
    workbookRels += `<Relationship Id="rIdSheet${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`
  }
  const workbookRelsXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  ${workbookRels}
</Relationships>`
  entries.push({ name: 'xl/_rels/workbook.xml.rels', data: encoder.encode(workbookRelsXml) })

  // 4. xl/styles.xml
  // Defines:
  // numFmt 165: DD/MM/YYYY
  // Font 0: Regular Calibri 11
  // Font 1: Bold Calibri 11
  // Fill 0: none
  // Fill 1: gray125
  // Fill 2: light gray #F2F4F8 for headers
  // CellXfs:
  // xf 0: default
  // xf 1: Header (font 1, fill 2, border)
  // xf 2: Date formatted DD/MM/AAAA (numFmtId 165)
  // xf 3: Date formatted DD/MM/AAAA centered
  const stylesXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <numFmts count="1">
    <numFmt numFmtId="165" formatCode="DD/MM/YYYY"/>
  </numFmts>
  <fonts count="2">
    <font>
      <sz val="11"/>
      <color theme="1"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
    <font>
      <b val="1"/>
      <sz val="11"/>
      <color rgb="FF111827"/>
      <name val="Calibri"/>
      <family val="2"/>
    </font>
  </fonts>
  <fills count="3">
    <fill><patternFill patternType="none"/></fill>
    <fill><patternFill patternType="gray125"/></fill>
    <fill>
      <patternFill patternType="solid">
        <fgColor rgb="FFF3F4F6"/>
        <bgColor indexed="64"/>
      </patternFill>
    </fill>
  </fills>
  <borders count="2">
    <border>
      <left/><right/><top/><bottom/><diagonal/>
    </border>
    <border>
      <left style="thin"><color rgb="FFE5E7EB"/></left>
      <right style="thin"><color rgb="FFE5E7EB"/></right>
      <top style="thin"><color rgb="FFE5E7EB"/></top>
      <bottom style="thin"><color rgb="FFE5E7EB"/></bottom>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="4">
    <!-- 0: Default general cell -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1"/>
    <!-- 1: Header cell -->
    <xf numFmtId="0" fontId="1" fillId="2" borderId="1" xfId="0" applyFont="1" applyFill="1" applyBorder="1">
      <alignment horizontal="center" vertical="center" wrapText="1"/>
    </xf>
    <!-- 2: Real Excel Date cell with DD/MM/AAAA -->
    <xf numFmtId="165" fontId="0" fillId="0" borderId="1" xfId="0" applyNumberFormat="1" applyBorder="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
    <!-- 3: Number integer/currency/quantity centered -->
    <xf numFmtId="0" fontId="0" fillId="0" borderId="1" xfId="0" applyBorder="1">
      <alignment horizontal="center" vertical="center"/>
    </xf>
  </cellXfs>
  <cellStyles count="1">
    <cellStyle name="Normal" xfId="0" builtinId="0"/>
  </cellStyles>
</styleSheet>`
  entries.push({ name: 'xl/styles.xml', data: encoder.encode(stylesXml) })

  // 5. xl/workbook.xml
  let sheetTags = ''
  for (let i = 1; i <= sheets.length; i++) {
    sheetTags += `<sheet name="${escapeXml(sheets[i - 1].name)}" sheetId="${i}" r:id="rIdSheet${i}"/>`
  }
  const workbookXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    ${sheetTags}
  </sheets>
</workbook>`
  entries.push({ name: 'xl/workbook.xml', data: encoder.encode(workbookXml) })

  // 6. xl/worksheets/sheetN.xml
  for (let sIdx = 0; sIdx < sheets.length; sIdx++) {
    const sheet = sheets[sIdx]
    let sheetColsXml = ''
    if (sheet.columns && sheet.columns.length > 0) {
      sheetColsXml = '<cols>'
      for (let cIdx = 0; cIdx < sheet.columns.length; cIdx++) {
        const colDef = sheet.columns[cIdx]
        const colWidth = colDef.width || Math.max(14, colDef.header.length + 4)
        sheetColsXml += `<col min="${cIdx + 1}" max="${cIdx + 1}" width="${colWidth}" customWidth="1"/>`
      }
      sheetColsXml += '</cols>'
    }

    let sheetDataXml = '<sheetData>'

    // Row 1: Headers
    let headerCells = ''
    for (let cIdx = 0; cIdx < sheet.columns.length; cIdx++) {
      const colName = colIndexToName(cIdx)
      const cellRef = `${colName}1`
      const val = escapeXml(sheet.columns[cIdx].header)
      headerCells += `<c r="${cellRef}" s="1" t="inlineStr"><is><t>${val}</t></is></c>`
    }
    sheetDataXml += `<row r="1" ht="28" customHeight="1">${headerCells}</row>`

    // Data Rows (starting from row 2)
    for (let rIdx = 0; rIdx < sheet.rows.length; rIdx++) {
      const rowNumber = rIdx + 2
      const row = sheet.rows[rIdx]
      let rowCells = ''

      for (let cIdx = 0; cIdx < sheet.columns.length; cIdx++) {
        const colName = colIndexToName(cIdx)
        const cellRef = `${colName}${rowNumber}`
        const cellVal = row[cIdx]

        if (cellVal === null || cellVal === undefined || cellVal === '') {
          // Empty cell with border
          rowCells += `<c r="${cellRef}" s="0"/>`
          continue
        }

        // Date cell check
        let isDate = false
        let dateValue: string | Date | null | undefined = null

        if (typeof cellVal === 'object' && cellVal !== null && 'type' in cellVal) {
          if (cellVal.type === 'date') {
            isDate = true
            dateValue = cellVal.value
          } else if (cellVal.type === 'number') {
            const num = cellVal.value
            if (num === null || num === undefined || isNaN(num)) {
              rowCells += `<c r="${cellRef}" s="0"/>`
            } else {
              rowCells += `<c r="${cellRef}" s="3"><v>${num}</v></c>`
            }
            continue
          } else {
            const txt = escapeXml(String(cellVal.value ?? ''))
            rowCells += `<c r="${cellRef}" s="0" t="inlineStr"><is><t>${txt}</t></is></c>`
            continue
          }
        }

        if (isDate) {
          const serial = dateToExcelSerial(dateValue)
          if (serial !== null) {
            // Real Excel Date cell: style 2 (numFmt 165 DD/MM/YYYY) and numeric serial value
            rowCells += `<c r="${cellRef}" s="2"><v>${serial}</v></c>`
          } else {
            // Fallback to text if date is unparseable
            const fallbackStr = escapeXml(String(dateValue || '-'))
            rowCells += `<c r="${cellRef}" s="0" t="inlineStr"><is><t>${fallbackStr}</t></is></c>`
          }
        } else if (typeof cellVal === 'number') {
          rowCells += `<c r="${cellRef}" s="3"><v>${cellVal}</v></c>`
        } else {
          const textVal = escapeXml(String(cellVal))
          rowCells += `<c r="${cellRef}" s="0" t="inlineStr"><is><t>${textVal}</t></is></c>`
        }
      }

      sheetDataXml += `<row r="${rowNumber}" ht="20" customHeight="1">${rowCells}</row>`
    }

    sheetDataXml += '</sheetData>'

    const worksheetXml = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheetViews>
    <sheetView tabSelected="${sIdx === 0 ? '1' : '0'}" workbookViewId="0">
      <pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/>
    </sheetView>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="16"/>
  ${sheetColsXml}
  ${sheetDataXml}
</worksheet>`

    entries.push({
      name: `xl/worksheets/sheet${sIdx + 1}.xml`,
      data: encoder.encode(worksheetXml),
    })
  }

  return createZip(entries)
}

/**
 * Initiates browser download of an .xlsx workbook.
 */
export function downloadXlsx(filename: string, sheets: SheetDefinition[]): void {
  const bytes = buildXlsx(sheets)
  const blob = new Blob([bytes.buffer as ArrayBuffer], {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  })
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename.endsWith('.xlsx') ? filename : `${filename}.xlsx`
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}
