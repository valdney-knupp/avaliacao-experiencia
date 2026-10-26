import { describe, it, expect } from 'vitest'
import { buildXlsx, dateToExcelSerial, SheetDefinition } from './excelExport'

describe('Excel Generator (.xlsx / OpenXML)', () => {
  it('serializes ISO and BR dates to correct Excel serial numbers', () => {
    // 2026-02-01 (01/02/2026)
    const serialIso = dateToExcelSerial('2026-02-01')
    const serialBr = dateToExcelSerial('01/02/2026')
    expect(serialIso).toBe(serialBr)
    expect(serialIso).toBeGreaterThan(45000)

    // Check specific known serial: 1900-01-01 is 1 in Excel 1900 system (with leap year bug UTC 1899-12-30)
    // 2026-01-01:
    const serial2026Jan1 = dateToExcelSerial('2026-01-01')
    expect(serial2026Jan1).toBe(46023)
  })

  it('builds a valid ZIP archive starting with PK 0x03 0x04 header and containing OpenXML parts', () => {
    const sheets: SheetDefinition[] = [
      {
        name: 'Teste',
        columns: [
          { header: 'Colaborador', width: 25 },
          { header: 'Data Admissão', width: 18 },
          { header: 'Pontos', width: 12 },
        ],
        rows: [
          ['João Silva', { type: 'date', value: '2026-01-15' }, { type: 'number', value: 95 }],
          ['Maria Santos', { type: 'date', value: '12/08/2026' }, 100],
        ],
      },
    ]

    const bytes = buildXlsx(sheets)
    expect(bytes).toBeInstanceOf(Uint8Array)
    expect(bytes.length).toBeGreaterThan(500)

    // Check ZIP standard magic bytes: 'P', 'K', 0x03, 0x04
    expect(bytes[0]).toBe(0x50) // 'P'
    expect(bytes[1]).toBe(0x4b) // 'K'
    expect(bytes[2]).toBe(0x03)
    expect(bytes[3]).toBe(0x04)

    // Decode byte stream to verify required OpenXML file entries exist
    const textDecoder = new TextDecoder('utf-8', { fatal: false })
    const content = textDecoder.decode(bytes)

    expect(content).toContain('[Content_Types].xml')
    expect(content).toContain('_rels/.rels')
    expect(content).toContain('xl/_rels/workbook.xml.rels')
    expect(content).toContain('xl/styles.xml')
    expect(content).toContain('xl/workbook.xml')
    expect(content).toContain('xl/worksheets/sheet1.xml')

    // Verify style sheet contains formatCode DD/MM/YYYY and numFmtId 165
    expect(content).toContain('formatCode="DD/MM/YYYY"')
    expect(content).toContain('numFmtId="165"')

    // Verify worksheet has cell style 2 for dates with real serials and style 1 for headers
    expect(content).toContain('s="1"')
    expect(content).toContain('s="2"')
    expect(content).toContain('s="3"')

    // Verify End of Central Directory signature: 'P', 'K', 0x05, 0x06
    const len = bytes.length
    let foundEocd = false
    for (let i = len - 22; i >= 0; i--) {
      if (
        bytes[i] === 0x50 &&
        bytes[i + 1] === 0x4b &&
        bytes[i + 2] === 0x05 &&
        bytes[i + 3] === 0x06
      ) {
        foundEocd = true
        break
      }
    }
    expect(foundEocd).toBe(true)
  })
})
