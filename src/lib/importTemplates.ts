import { downloadXlsx, SheetDefinition, CellValue } from './excelExport'
import { EvaluationFileSlot } from './importRules'

export type ImportSlotType = 'colaboradores' | EvaluationFileSlot

export interface ImportTemplateDefinition {
  slotId: ImportSlotType
  filename: string
  sheetName: string
  columns: { header: string; width?: number }[]
  rows: CellValue[][]
  instructions?: string
}

/**
 * Retorna as definições completas de planilha modelo para cada um dos 5 slots de importação.
 * As colunas correspondem estritamente aos nomes e campos esperados pelos parsers
 * (simulateCollaboratorsSheet e simulateEvaluationSheet) e carregam linhas de exemplo
 * fictícias e realistas (contexto de construtora civil: obras vs escritório).
 */
export function getImportTemplateDefinition(slotId: ImportSlotType): ImportTemplateDefinition {
  switch (slotId) {
    case 'colaboradores':
      return {
        slotId: 'colaboradores',
        filename: 'modelo-colaboradores.xlsx',
        sheetName: 'Colaboradores',
        columns: [
          { header: 'NOME', width: 32 },
          { header: 'CPF', width: 18 },
          { header: 'CENTRO DE CUSTO', width: 26 },
          { header: 'SETOR', width: 22 },
          { header: 'CARGO', width: 24 },
          { header: 'DATA ADMISSÃO', width: 16 },
        ],
        rows: [
          [
            'JOÃO CARLOS DA SILVA (EXEMPLO)',
            '254.187.930-41',
            'BLEND',
            '', // Obra não exige setor
            'PEDREIRO',
            { type: 'date', value: '2026-01-15' },
          ],
          [
            'MARIA CLARA DOS SANTOS (EXEMPLO)',
            '834.619.250-70',
            'ESCRITÓRIO',
            'ENGENHARIA',
            'ENGENHEIRA CIVIL JÚNIOR',
            { type: 'date', value: '2026-02-01' },
          ],
          [
            'LUCAS FERREIRA MENDES (EXEMPLO)',
            '519.382.740-15',
            'SUMMIT',
            '',
            'SERVENTE DE OBRAS',
            { type: 'date', value: '2026-02-10' },
          ],
        ],
      }

    case 'obras_45':
      return {
        slotId: 'obras_45',
        filename: 'modelo-avaliacao-obras-45d.xlsx',
        sheetName: 'Avaliações Obras 45d',
        columns: [
          { header: 'NOME DO COLABORADOR', width: 34 },
          { header: 'DATA DA AVALIAÇÃO', width: 18 },
          { header: 'AVALIADOR', width: 26 },
          { header: 'DECISÃO', width: 16 },
          { header: 'JUSTIFICATIVA', width: 36 },
          { header: 'CPF', width: 18 },
          { header: 'CENTRO DE CUSTO', width: 22 },
          { header: 'DISCIPLINA E CUMPRIMENTO DE REGRAS', width: 32 },
          { header: 'QUALIDADE E PRODUTIVIDADE', width: 30 },
          { header: 'RELACIONAMENTO INTERPESSOAL E TRABALHO EM EQUIPE', width: 36 },
          { header: 'ASSIDUIDADE', width: 20 },
        ],
        rows: [
          [
            'JOÃO CARLOS DA SILVA (EXEMPLO)',
            { type: 'date', value: '2026-03-01' },
            'Eng. Roberto Almeida',
            'Prorrogar',
            'Bom desempenho na primeira fase; cumprindo normas de segurança.',
            '254.187.930-41',
            'BLEND',
            'Atende',
            'Atende',
            'Atende',
            'Atende',
          ],
          [
            'LUCAS FERREIRA MENDES (EXEMPLO)',
            { type: 'date', value: '2026-03-27' },
            'Mestre Marcos Costa',
            'Prorrogar',
            'Pontual, colaborativo com os colegas e dedicado nas tarefas.',
            '519.382.740-15',
            'SUMMIT',
            'Atende',
            'Atende',
            'Supera',
            'Atende',
          ],
        ],
      }

    case 'obras_90':
      return {
        slotId: 'obras_90',
        filename: 'modelo-avaliacao-obras-90d.xlsx',
        sheetName: 'Avaliações Obras 90d',
        columns: [
          { header: 'NOME DO COLABORADOR', width: 34 },
          { header: 'DATA DA AVALIAÇÃO', width: 18 },
          { header: 'AVALIADOR', width: 26 },
          { header: 'DECISÃO', width: 16 },
          { header: 'JUSTIFICATIVA', width: 36 },
          { header: 'CPF', width: 18 },
          { header: 'CENTRO DE CUSTO', width: 22 },
          { header: 'DISCIPLINA E CUMPRIMENTO DE REGRAS', width: 32 },
          { header: 'QUALIDADE E PRODUTIVIDADE', width: 30 },
          { header: 'RELACIONAMENTO INTERPESSOAL E TRABALHO EM EQUIPE', width: 36 },
          { header: 'ASSIDUIDADE', width: 20 },
        ],
        rows: [
          [
            'JOÃO CARLOS DA SILVA (EXEMPLO)',
            { type: 'date', value: '2026-04-15' },
            'Eng. Roberto Almeida',
            'Efetivar',
            'Aprovado para efetivação; manteve excelente rendimento e assiduidade.',
            '254.187.930-41',
            'BLEND',
            'Atende',
            'Supera',
            'Atende',
            'Atende',
          ],
          [
            'LUCAS FERREIRA MENDES (EXEMPLO)',
            { type: 'date', value: '2026-05-11' },
            'Mestre Marcos Costa',
            'Efetivar',
            'Efetivação recomendada pela equipe de produção da obra.',
            '519.382.740-15',
            'SUMMIT',
            'Atende',
            'Atende',
            'Atende',
            'Atende',
          ],
        ],
      }

    case 'escritorio_45':
      return {
        slotId: 'escritorio_45',
        filename: 'modelo-avaliacao-escritorio-45d.xlsx',
        sheetName: 'Avaliações Escritório 45d',
        columns: [
          { header: 'NOME DO COLABORADOR', width: 34 },
          { header: 'DATA DA AVALIAÇÃO', width: 18 },
          { header: 'AVALIADOR', width: 26 },
          { header: 'DECISÃO', width: 16 },
          { header: 'JUSTIFICATIVA', width: 36 },
          { header: 'CPF', width: 18 },
          { header: 'CENTRO DE CUSTO', width: 22 },
          { header: 'ENTREGA DE RESULTADOS E QUALIDADE DO TRABALHO', width: 34 },
          { header: 'CAPACIDADE TÉCNICA E CONHECIMENTO', width: 32 },
          { header: 'PROATIVIDADE', width: 20 },
          { header: 'DINAMISMO', width: 20 },
          { header: 'SOLUÇÃO DE PROBLEMAS', width: 24 },
          { header: 'RELACIONAMENTO INTERPESSOAL E TRABALHO EM EQUIPE', width: 36 },
          { header: 'POSTURA PROFISSIONAL E DISCIPLINA', width: 30 },
          { header: 'ASSIDUIDADE', width: 20 },
        ],
        rows: [
          [
            'MARIA CLARA DOS SANTOS (EXEMPLO)',
            { type: 'date', value: '2026-03-18' },
            'Fernanda Lima (Gestora)',
            'Prorrogar',
            'Boa integração com a equipe de engenharia e rápida curva de aprendizado.',
            '834.619.250-70',
            'ESCRITÓRIO',
            'Atende',
            'Supera',
            'Atende',
            'Atende',
            'Atende',
            'Supera',
            'Atende',
            'Atende',
          ],
          [
            'GABRIEL NOGUEIRA (EXEMPLO)',
            { type: 'date', value: '2026-03-25' },
            'Carlos Eduardo (Coordenador)',
            'Prorrogar',
            'Ótima postura técnica e cumprimento dos prazos dos relatórios.',
            '392.810.470-88',
            'ESCRITÓRIO',
            'Atende',
            'Atende',
            'Atende',
            'Atende',
            'Atende',
            'Atende',
            'Atende',
            'Atende',
          ],
        ],
      }

    case 'escritorio_90':
      return {
        slotId: 'escritorio_90',
        filename: 'modelo-avaliacao-escritorio-90d.xlsx',
        sheetName: 'Avaliações Escritório 90d',
        columns: [
          { header: 'NOME DO COLABORADOR', width: 34 },
          { header: 'DATA DA AVALIAÇÃO', width: 18 },
          { header: 'AVALIADOR', width: 26 },
          { header: 'DECISÃO', width: 16 },
          { header: 'JUSTIFICATIVA', width: 36 },
          { header: 'CPF', width: 18 },
          { header: 'CENTRO DE CUSTO', width: 22 },
          { header: 'ENTREGA DE RESULTADOS E QUALIDADE DO TRABALHO', width: 34 },
          { header: 'CAPACIDADE TÉCNICA E CONHECIMENTO', width: 32 },
          { header: 'PROATIVIDADE', width: 20 },
          { header: 'DINAMISMO', width: 20 },
          { header: 'SOLUÇÃO DE PROBLEMAS', width: 24 },
          { header: 'RELACIONAMENTO INTERPESSOAL E TRABALHO EM EQUIPE', width: 36 },
          { header: 'POSTURA PROFISSIONAL E DISCIPLINA', width: 30 },
          { header: 'ASSIDUIDADE', width: 20 },
        ],
        rows: [
          [
            'MARIA CLARA DOS SANTOS (EXEMPLO)',
            { type: 'date', value: '2026-05-02' },
            'Fernanda Lima (Gestora)',
            'Efetivar',
            'Efetivação plenamente recomendada; entregou projetos com excelência técnica.',
            '834.619.250-70',
            'ESCRITÓRIO',
            'Supera',
            'Supera',
            'Supera',
            'Atende',
            'Supera',
            'Supera',
            'Atende',
            'Atende',
          ],
          [
            'GABRIEL NOGUEIRA (EXEMPLO)',
            { type: 'date', value: '2026-05-09' },
            'Carlos Eduardo (Coordenador)',
            'Efetivar',
            'Efetivação aprovada; profissional confiável, comunicativo e proativo.',
            '392.810.470-88',
            'ESCRITÓRIO',
            'Atende',
            'Atende',
            'Atende',
            'Atende',
            'Atende',
            'Atende',
            'Atende',
            'Atende',
          ],
        ],
      }
  }
}

/**
 * Dispara o download da planilha modelo (.xlsx real) para o slot solicitado.
 */
export function downloadImportTemplate(slotId: ImportSlotType): void {
  const def = getImportTemplateDefinition(slotId)
  const sheets: SheetDefinition[] = [
    {
      name: def.sheetName,
      columns: def.columns,
      rows: def.rows,
    },
  ]
  downloadXlsx(def.filename, sheets)
}
