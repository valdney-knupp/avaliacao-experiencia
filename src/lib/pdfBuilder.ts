/**
 * Gerador de PDF 1.4 minimalista e autônomo (Zero dependências).
 * Compatível com Node.js e navegadores (Uint8Array).
 * Suporta múltiplas páginas A4, fontes Helvetica padrão, WinAnsiEncoding (acentos pt-BR),
 * caixas de texto com quebra de linha automática (word wrap), retângulos coloridos e linhas.
 */

export interface PageSize {
  width: number
  height: number
}

export const PAGE_SIZES = {
  A4: { width: 595.28, height: 841.89 },
}

interface TextDrawOp {
  kind: 'text'
  x: number
  y: number
  text: string
  size: number
  font: 'F1' | 'F2' | 'F3' // F1 = Regular, F2 = Bold, F3 = Oblique
  r: number
  g: number
  b: number
}

interface RectDrawOp {
  kind: 'rect'
  x: number
  y: number
  w: number
  h: number
  fillR?: number
  fillG?: number
  fillB?: number
  strokeR?: number
  strokeG?: number
  strokeB?: number
  strokeWidth?: number
}

interface LineDrawOp {
  kind: 'line'
  x1: number
  y1: number
  x2: number
  y2: number
  r: number
  g: number
  b: number
  width: number
}

type DrawOp = TextDrawOp | RectDrawOp | LineDrawOp

// Mapeamento de caracteres Unicode pt-BR comuns para código octal/hex WinAnsi
function encodeWinAnsiText(str: string): string {
  let out = ''
  for (let i = 0; i < str.length; i++) {
    const code = str.charCodeAt(i)
    if (code === 92) {
      // \
      out += '\\\\'
    } else if (code === 40) {
      // (
      out += '\\('
    } else if (code === 41) {
      // )
      out += '\\)'
    } else if (code >= 32 && code <= 126) {
      out += str[i]
    } else if (code >= 160 && code <= 255) {
      // Caracteres ISO-8859-1 / WinAnsi padrão (á, é, í, ó, ú, ã, õ, ç, etc.)
      const octal = code.toString(8).padStart(3, '0')
      out += `\\${octal}`
    } else {
      // Fallback para caracteres fora da faixa
      const char = str[i]
      if (char === '•') out += '\\225'
      else if (char === '—' || char === '–') out += '-'
      else if (char === '“' || char === '”') out += '"'
      else if (char === '‘' || char === '’') out += "'"
      else if (char === '…') out += '...'
      else if (char === '→') out += '->'
      else if (char === '←') out += '<-'
      else out += ' '
    }
  }
  return out
}

export class SimplePdfPage {
  private ops: DrawOp[] = []

  constructor(public readonly size: PageSize = PAGE_SIZES.A4) {}

  text(
    x: number,
    y: number,
    str: string,
    opts: {
      size?: number
      font?: 'regular' | 'bold' | 'oblique'
      color?: [number, number, number]
    } = {},
  ): void {
    const fontKey = opts.font === 'bold' ? 'F2' : opts.font === 'oblique' ? 'F3' : 'F1'
    const [r, g, b] = opts.color || [0.1, 0.1, 0.1]
    this.ops.push({
      kind: 'text',
      x,
      y,
      text: str,
      size: opts.size || 10,
      font: fontKey,
      r,
      g,
      b,
    })
  }

  rect(
    x: number,
    y: number,
    w: number,
    h: number,
    opts: {
      fillColor?: [number, number, number]
      strokeColor?: [number, number, number]
      strokeWidth?: number
    } = {},
  ): void {
    const [fr, fg, fb] = opts.fillColor || []
    const [sr, sg, sb] = opts.strokeColor || []
    this.ops.push({
      kind: 'rect',
      x,
      y,
      w,
      h,
      fillR: fr,
      fillG: fg,
      fillB: fb,
      strokeR: sr,
      strokeG: sg,
      strokeB: sb,
      strokeWidth: opts.strokeWidth,
    })
  }

  line(
    x1: number,
    y1: number,
    x2: number,
    y2: number,
    opts: { color?: [number, number, number]; width?: number } = {},
  ): void {
    const [r, g, b] = opts.color || [0.8, 0.8, 0.8]
    this.ops.push({
      kind: 'line',
      x1,
      y1,
      x2,
      y2,
      r,
      g,
      b,
      width: opts.width || 1,
    })
  }

  toContentStream(): string {
    const lines: string[] = []
    for (const op of this.ops) {
      if (op.kind === 'rect') {
        if (op.fillR !== undefined && op.strokeR !== undefined) {
          lines.push(
            `${op.fillR.toFixed(3)} ${op.fillG!.toFixed(3)} ${op.fillB!.toFixed(3)} rg`,
            `${op.strokeR.toFixed(3)} ${op.strokeG!.toFixed(3)} ${op.strokeB!.toFixed(3)} RG`,
            `${(op.strokeWidth || 1).toFixed(2)} w`,
            `${op.x.toFixed(2)} ${op.y.toFixed(2)} ${op.w.toFixed(2)} ${op.h.toFixed(2)} re`,
            'B',
          )
        } else if (op.fillR !== undefined) {
          lines.push(
            `${op.fillR.toFixed(3)} ${op.fillG!.toFixed(3)} ${op.fillB!.toFixed(3)} rg`,
            `${op.x.toFixed(2)} ${op.y.toFixed(2)} ${op.w.toFixed(2)} ${op.h.toFixed(2)} re`,
            'f',
          )
        } else if (op.strokeR !== undefined) {
          lines.push(
            `${op.strokeR.toFixed(3)} ${op.strokeG!.toFixed(3)} ${op.strokeB!.toFixed(3)} RG`,
            `${(op.strokeWidth || 1).toFixed(2)} w`,
            `${op.x.toFixed(2)} ${op.y.toFixed(2)} ${op.w.toFixed(2)} ${op.h.toFixed(2)} re`,
            'S',
          )
        }
      } else if (op.kind === 'line') {
        lines.push(
          `${op.r.toFixed(3)} ${op.g.toFixed(3)} ${op.b.toFixed(3)} RG`,
          `${op.width.toFixed(2)} w`,
          `${op.x1.toFixed(2)} ${op.y1.toFixed(2)} m`,
          `${op.x2.toFixed(2)} ${op.y2.toFixed(2)} l`,
          'S',
        )
      } else if (op.kind === 'text') {
        lines.push(
          'BT',
          `/${op.font} ${op.size.toFixed(2)} Tf`,
          `${op.r.toFixed(3)} ${op.g.toFixed(3)} ${op.b.toFixed(3)} rg`,
          `${op.x.toFixed(2)} ${op.y.toFixed(2)} Td`,
          `(${encodeWinAnsiText(op.text)}) Tj`,
          'ET',
        )
      }
    }
    return lines.join('\n')
  }
}

export class SimplePdfDocument {
  private pages: SimplePdfPage[] = []

  static base64Encode(bytes: Uint8Array): string {
    let binary = ''
    const len = bytes.byteLength
    for (let i = 0; i < len; i++) {
      binary += String.fromCharCode(bytes[i])
    }
    if (typeof btoa === 'function') {
      return btoa(binary)
    }
    return ''
  }

  addPage(size: PageSize = PAGE_SIZES.A4): SimplePdfPage {
    const p = new SimplePdfPage(size)
    this.pages.push(p)
    return p
  }

  build(): Uint8Array {
    if (this.pages.length === 0) {
      throw new Error('Nenhuma página adicionada ao documento.')
    }

    const objects: { id: number; data: Uint8Array }[] = []
    let nextId = 1
    const alloc = () => nextId++

    const catalogId = alloc()
    const pagesId = alloc()
    const fontRegularId = alloc()
    const fontBoldId = alloc()
    const fontObliqueId = alloc()

    const pageIds = this.pages.map(() => alloc())
    const contentIds = this.pages.map(() => alloc())

    const encoder = new TextEncoder()
    const addObj = (id: number, str: string, binData?: Uint8Array) => {
      if (binData) {
        const head = encoder.encode(str)
        const combined = new Uint8Array(head.length + binData.length)
        combined.set(head, 0)
        combined.set(binData, head.length)
        objects.push({ id, data: combined })
      } else {
        objects.push({ id, data: encoder.encode(str) })
      }
    }

    // 1. Catalog
    addObj(catalogId, `<< /Type /Catalog /Pages ${pagesId} 0 R >>`)

    // 2. Pages tree
    addObj(
      pagesId,
      `<< /Type /Pages /Kids [${pageIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageIds.length} >>`,
    )

    // 3. Fonts com WinAnsiEncoding para suporte pleno a acentuação em português
    addObj(
      fontRegularId,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>',
    )
    addObj(
      fontBoldId,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>',
    )
    addObj(
      fontObliqueId,
      '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Oblique /Encoding /WinAnsiEncoding >>',
    )

    // 4. Pages e seus Contents
    this.pages.forEach((page, idx) => {
      const contentStr = page.toContentStream()
      const contentBytes = encoder.encode(contentStr)

      addObj(
        pageIds[idx],
        `<< /Type /Page /Parent ${pagesId} 0 R /MediaBox [0 0 ${page.size.width.toFixed(2)} ${page.size.height.toFixed(2)}] /Resources << /Font << /F1 ${fontRegularId} 0 R /F2 ${fontBoldId} 0 R /F3 ${fontObliqueId} 0 R >> >> /Contents ${contentIds[idx]} 0 R >>`,
      )

      addObj(
        contentIds[idx],
        `<< /Length ${contentBytes.length} >>\nstream\n${contentStr}\nendstream`,
      )
    })

    // Montagem final do arquivo PDF binário
    objects.sort((a, b) => a.id - b.id)

    const chunks: Uint8Array[] = []
    let offset = 0

    const header = encoder.encode('%PDF-1.4\n%\xE2\xE3\xCF\xD3\n')
    chunks.push(header)
    offset += header.length

    const offsets: number[] = []

    for (const obj of objects) {
      offsets[obj.id] = offset
      const objHead = encoder.encode(`${obj.id} 0 obj\n`)
      const objTail = encoder.encode('\nendobj\n')

      chunks.push(objHead, obj.data, objTail)
      offset += objHead.length + obj.data.length + objTail.length
    }

    const xrefOffset = offset
    const maxId = nextId - 1

    let xrefStr = `xref\n0 ${maxId + 1}\n`
    xrefStr += '0000000000 65535 f \n'
    for (let id = 1; id <= maxId; id++) {
      const off = offsets[id] || 0
      xrefStr += `${off.toString().padStart(10, '0')} 00000 n \n`
    }

    const trailerStr = `trailer\n<< /Size ${maxId + 1} /Root ${catalogId} 0 R >>\nstartxref\n${xrefOffset}\n%%EOF\n`

    const xrefBytes = encoder.encode(xrefStr)
    const trailerBytes = encoder.encode(trailerStr)
    chunks.push(xrefBytes, trailerBytes)

    let totalLength = 0
    for (const c of chunks) totalLength += c.length
    const finalBuffer = new Uint8Array(totalLength)
    let cur = 0
    for (const c of chunks) {
      finalBuffer.set(c, cur)
      cur += c.length
    }

    return finalBuffer
  }
}
