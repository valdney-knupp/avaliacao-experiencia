import { describe, it, expect } from 'vitest'
import { getImportTemplateDefinition, ImportSlotType } from './importTemplates'
import { buildXlsx } from './excelExport'
import { parseXlsxBuffer } from './spreadsheetReader'
import {
  simulateCollaboratorsSheet,
  simulateEvaluationSheet,
  EvaluationCriterionRecord,
} from './importRules'

describe('Import Templates (.xlsx)', () => {
  const slots: ImportSlotType[] = [
    'colaboradores',
    'obras_45',
    'obras_90',
    'escritorio_45',
    'escritorio_90',
  ]

  it('possui definição válida para todos os 5 slots de importação', () => {
    slots.forEach((slotId) => {
      const def = getImportTemplateDefinition(slotId)
      expect(def.slotId).toBe(slotId)
      expect(def.filename).toMatch(/^modelo-.*\.xlsx$/)
      expect(def.sheetName.length).toBeGreaterThan(0)
      expect(def.columns.length).toBeGreaterThan(0)
      expect(def.rows.length).toBeGreaterThanOrEqual(2) // 2-3 linhas de exemplo
      // Verifica que todas as linhas têm o mesmo número de células que o cabeçalho
      def.rows.forEach((row) => {
        expect(row.length).toBe(def.columns.length)
      })
    })
  })

  it('nomes de arquivos correspondem ao padrão descritivo solicitado', () => {
    expect(getImportTemplateDefinition('colaboradores').filename).toBe('modelo-colaboradores.xlsx')
    expect(getImportTemplateDefinition('obras_45').filename).toBe('modelo-avaliacao-obras-45d.xlsx')
    expect(getImportTemplateDefinition('obras_90').filename).toBe('modelo-avaliacao-obras-90d.xlsx')
    expect(getImportTemplateDefinition('escritorio_45').filename).toBe(
      'modelo-avaliacao-escritorio-45d.xlsx',
    )
    expect(getImportTemplateDefinition('escritorio_90').filename).toBe(
      'modelo-avaliacao-escritorio-90d.xlsx',
    )
  })

  it('todas as planilhas modelo geram .xlsx real que é lido com perfeição pelo parser de planilhas', async () => {
    for (const slotId of slots) {
      const def = getImportTemplateDefinition(slotId)
      const bytes = buildXlsx([
        {
          name: def.sheetName,
          columns: def.columns,
          rows: def.rows,
        },
      ])

      expect(bytes.length).toBeGreaterThan(500) // ZIP OpenXML válido

      const parsed = await parseXlsxBuffer(bytes.buffer as ArrayBuffer)
      expect(parsed.headers).toEqual(def.columns.map((c) => c.header))
      expect(parsed.rows.length).toBe(def.rows.length)
    }
  })

  it('o modelo de colaboradores é processado com sucesso pelo simulateCollaboratorsSheet', async () => {
    const def = getImportTemplateDefinition('colaboradores')
    const bytes = buildXlsx([
      {
        name: def.sheetName,
        columns: def.columns,
        rows: def.rows,
      },
    ])
    const parsed = await parseXlsxBuffer(bytes.buffer as ArrayBuffer)

    const costCenters = [
      { id: 'cc1', name: 'BLEND', type: 'Obra' as const },
      { id: 'cc2', name: 'ESCRITÓRIO', type: 'Escritório' as const },
      { id: 'cc3', name: 'SUMMIT', type: 'Obra' as const },
    ]
    const sectors = [{ id: 'sec1', name: 'ENGENHARIA' }]

    const { report, parsedRows } = await simulateCollaboratorsSheet(
      parsed,
      def.filename,
      costCenters,
      sectors,
      [],
    )

    expect(report.rejected).toHaveLength(0)
    expect(report.newCount).toBe(def.rows.length)
    expect(parsedRows).toHaveLength(def.rows.length)
    expect(parsedRows[0].rawName).toContain('JOÃO CARLOS DA SILVA')
    expect(parsedRows[0].costCenterName).toBe('BLEND')
  })

  it('os modelos de avaliações são processados com sucesso pelo simulateEvaluationSheet', async () => {
    const criteria: EvaluationCriterionRecord[] = [
      { id: 'c1', name: 'Disciplina e cumprimento de regras', order: 1, category: 'OBRAS' },
      { id: 'c2', name: 'Qualidade e produtividade', order: 2, category: 'OBRAS' },
      {
        id: 'c3',
        name: 'Relacionamento interpessoal e trabalho em equipe',
        order: 3,
        category: 'OBRAS',
      },
      { id: 'c4', name: 'Assiduidade', order: 4, category: 'OBRAS' },
      {
        id: 'c5',
        name: 'ENTREGA DE RESULTADOS E QUALIDADE DO TRABALHO',
        order: 1,
        category: 'ESCRITORIO',
      },
      {
        id: 'c6',
        name: 'CAPACIDADE TÉCNICA E CONHECIMENTO',
        order: 2,
        category: 'ESCRITORIO',
      },
      { id: 'c7', name: 'PROATIVIDADE', order: 3, category: 'ESCRITORIO' },
      { id: 'c8', name: 'DINAMISMO', order: 4, category: 'ESCRITORIO' },
      { id: 'c9', name: 'SOLUÇÃO DE PROBLEMAS', order: 5, category: 'ESCRITORIO' },
      {
        id: 'c10',
        name: 'RELACIONAMENTO INTERPESSOAL E TRABALHO EM EQUIPE',
        order: 6,
        category: 'ESCRITORIO',
      },
      {
        id: 'c11',
        name: 'POSTURA PROFISSIONAL E DISCIPLINA',
        order: 7,
        category: 'ESCRITORIO',
      },
      { id: 'c12', name: 'ASSIDUIDADE', order: 8, category: 'ESCRITORIO' },
    ]

    const collabs = [
      {
        id: 'collab1',
        name: 'JOÃO CARLOS DA SILVA (EXEMPLO)',
        cpf_digits: '25418793041',
        cost_center_id: 'cc1',
        cost_center_name: 'BLEND',
        admission_date: '2026-01-15',
      },
      {
        id: 'collab2',
        name: 'MARIA CLARA DOS SANTOS (EXEMPLO)',
        cpf_digits: '83461925070',
        cost_center_id: 'cc2',
        cost_center_name: 'ESCRITÓRIO',
        admission_date: '2026-02-01',
      },
      {
        id: 'collab3',
        name: 'LUCAS FERREIRA MENDES (EXEMPLO)',
        cpf_digits: '51938274015',
        cost_center_id: 'cc3',
        cost_center_name: 'SUMMIT',
        admission_date: '2026-02-10',
      },
      {
        id: 'collab4',
        name: 'GABRIEL NOGUEIRA (EXEMPLO)',
        cpf_digits: '39281047088',
        cost_center_id: 'cc2',
        cost_center_name: 'ESCRITÓRIO',
        admission_date: '2026-02-05',
      },
    ]

    const evalSlots: ImportSlotType[] = ['obras_45', 'obras_90', 'escritorio_45', 'escritorio_90']

    for (const slotId of evalSlots) {
      const def = getImportTemplateDefinition(slotId)
      const bytes = buildXlsx([
        {
          name: def.sheetName,
          columns: def.columns,
          rows: def.rows,
        },
      ])
      const parsed = await parseXlsxBuffer(bytes.buffer as ArrayBuffer)

      const { report, parsedRows } = await simulateEvaluationSheet(
        parsed,
        slotId as any,
        def.filename,
        criteria,
        collabs,
        [],
      )

      expect(report.rejected).toHaveLength(0)
      expect(report.errors).toHaveLength(0)
      expect(report.newCount).toBe(def.rows.length)
      expect(parsedRows).toHaveLength(def.rows.length)
      expect(parsedRows[0].answers.length).toBeGreaterThanOrEqual(4)
    }
  })
})
