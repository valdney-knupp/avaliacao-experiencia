import { describe, it, expect } from 'vitest'
import {
  matchCriterionId,
  convertAnswerValue,
  convertDecisionValue,
  matchEvaluationToCollaborator,
  simulateEvaluationSheet,
  simulateCollaboratorsSheet,
  safeCellStr,
  isRowCompletelyEmpty,
  EvaluationCriterionRecord,
} from './importRules'
import { ParsedSheet } from './spreadsheetReader'

describe('Domain Rules: Importação Histórica e Unificação de Avaliações', () => {
  const criteria: EvaluationCriterionRecord[] = [
    { id: 'c1', name: 'Disciplina e cumprimento de regras', order: 1 },
    { id: 'c2', name: 'Qualidade e produtividade', order: 2 },
    { id: 'c3', name: 'Relacionamento interpessoal e trabalho em equipe', order: 3 },
    { id: 'c4', name: 'Assiduidade', order: 4 },
  ]

  it('reconhece aliases históricos dos critérios', () => {
    // 1. DISCIPLINA / POSTURA PROFISSIONAL E DISCIPLINA
    expect(matchCriterionId('POSTURA PROFISSIONAL E DISCIPLINA', criteria)?.id).toBe('c1')
    expect(matchCriterionId('DISCIPLINA', criteria)?.id).toBe('c1')

    // 2. QUALIDADE E PRODUTIVIDADE / ENTREGA DE RESULTADOS
    expect(matchCriterionId('ENTREGA DE RESULTADOS', criteria)?.id).toBe('c2')
    expect(matchCriterionId('PRODUTIVIDADE', criteria)?.id).toBe('c2')

    // 3. RELACIONAMENTO E TRABALHO EM EQUIPE / RELACIONAMENTO INTERPESSOAL
    expect(matchCriterionId('TRABALHO EM EQUIPE', criteria)?.id).toBe('c3')
    expect(matchCriterionId('RELACIONAMENTO INTERPESSOAL', criteria)?.id).toBe('c3')

    // 4. ASSIDUIDADE / FREQUENCIA
    expect(matchCriterionId('ASSIDUIDADE', criteria)?.id).toBe('c4')
  })

  it('converte respostas com precisão e sinaliza inferências e erros', () => {
    // Empty or SELECIONE -> Atende (MEETS) with inferred=true
    const r1 = convertAnswerValue('')
    expect(r1.normalized).toBe('MEETS')
    expect(r1.inferred).toBe(true)

    const r2 = convertAnswerValue('SELECIONE')
    expect(r2.normalized).toBe('MEETS')
    expect(r2.inferred).toBe(true)

    // ATENDE -> MEETS
    const r3 = convertAnswerValue('ATENDE')
    expect(r3.normalized).toBe('MEETS')
    expect(r3.inferred).toBe(false)

    // Contendo PARCIAL -> PARTIALLY_MEETS
    const r4 = convertAnswerValue('ATENDE PARCIALMENTE')
    expect(r4.normalized).toBe('PARTIALLY_MEETS')

    // NÃO ATENDE -> DOES_NOT_MEET
    const r5 = convertAnswerValue('NÃO ATENDE')
    expect(r5.normalized).toBe('DOES_NOT_MEET')

    // SUPERA / EXCEDE -> EXCEEDS
    const r6 = convertAnswerValue('SUPERA AS EXPECTATIVAS')
    expect(r6.normalized).toBe('EXCEEDS')

    // Unknown value does not convert silently
    const r7 = convertAnswerValue('VALOR_ESTRANHO_XYZ')
    expect(r7.normalized).toBeNull()
    expect(r7.error).toBeDefined()
  })

  it('converte decisões respeitando as etapas de 45 e 90 dias', () => {
    // DESLIGAR / ENCERRAR -> TERMINATE (resulting: Desligado)
    const d1 = convertDecisionValue('DESLIGAR', '45 dias')
    expect(d1.decision).toBe('TERMINATE')
    expect(d1.resultingSituation).toBe('Desligado')

    const d2 = convertDecisionValue('ENCERRAR CONTRATO', '90 dias')
    expect(d2.decision).toBe('TERMINATE')
    expect(d2.resultingSituation).toBe('Desligado')

    // 45 dias positive / empty -> EXTEND (Em experiência)
    const d3 = convertDecisionValue('ATENDE', '45 dias')
    expect(d3.decision).toBe('EXTEND')
    expect(d3.resultingSituation).toBe('Em experiência')

    // 90 dias positive / empty -> EFFECTIVATE (Efetivado)
    const d4 = convertDecisionValue('ATENDE', '90 dias')
    expect(d4.decision).toBe('EFFECTIVATE')
    expect(d4.resultingSituation).toBe('Efetivado')
  })

  it('associa colaborador com segurança e bloqueia homônimos ambíguos', () => {
    const collabs = [
      {
        id: 'c1',
        name: 'Carlos Alberto Santos',
        cpf_digits: '11122233344',
        cost_center_id: 'cc1',
        cost_center_name: 'BLEND',
        admission_date: '2026-01-10',
      },
      {
        id: 'c2',
        name: 'Carlos Alberto Santos',
        cpf_digits: '55566677788',
        cost_center_id: 'cc2',
        cost_center_name: 'ESCRITÓRIO',
        admission_date: '2026-02-01',
      },
      {
        id: 'c3',
        name: 'Maria Silva',
        cpf_digits: '99988877766',
        cost_center_id: 'cc1',
        cost_center_name: 'BLEND',
        admission_date: '2026-03-01',
      },
    ]

    // 1. Single match by name
    const m1 = matchEvaluationToCollaborator('Maria Silva', '', '', '', collabs)
    expect(m1.collaborator?.id).toBe('c3')

    // 2. Homonym ambiguous without cost center or CPF
    const m2 = matchEvaluationToCollaborator('Carlos Alberto Santos', '', '', '', collabs)
    expect(m2.collaborator).toBeNull()
    expect(m2.matchMethod).toBe('unmatched')
    expect(m2.warning).toContain('Homônimo')

    // 3. Disambiguation by Cost Center
    const m3 = matchEvaluationToCollaborator('Carlos Alberto Santos', '', 'BLEND', '', collabs)
    expect(m3.collaborator?.id).toBe('c1')

    // 4. Match by CPF
    const m4 = matchEvaluationToCollaborator(
      'Carlos Alberto Santos',
      '55566677788',
      '',
      '',
      collabs,
    )
    expect(m4.collaborator?.id).toBe('c2')
  })

  it('safeCellStr e isRowCompletelyEmpty tratam tipos primitivos com segurança', () => {
    expect(safeCellStr(undefined)).toBe('')
    expect(safeCellStr(null)).toBe('')
    expect(safeCellStr('')).toBe('')
    expect(safeCellStr('   teste   ')).toBe('teste')
    expect(safeCellStr(123)).toBe('123')
    expect(safeCellStr(0)).toBe('0')

    expect(isRowCompletelyEmpty([])).toBe(true)
    expect(isRowCompletelyEmpty(['', null, undefined, '   '])).toBe(true)
    expect(isRowCompletelyEmpty(['', 'Carlos', ''])).toBe(false)
  })

  it('simulateEvaluationSheet tolera células null/undefined, linhas vazias no meio/fim e colunas faltantes (cenário Slot 3 OBRAS_90D)', async () => {
    const collabs = [
      {
        id: 'collab1',
        name: 'JOÃO BATISTA DA SILVA',
        cpf_digits: '12345678901',
        cost_center_id: 'cc1',
        cost_center_name: 'OBRA RESERVA',
        admission_date: '2025-10-01',
      },
      {
        id: 'collab2',
        name: 'MARIA APARECIDA LIMA',
        cpf_digits: '98765432100',
        cost_center_id: 'cc1',
        cost_center_name: 'OBRA RESERVA',
        admission_date: '2025-10-15',
      },
    ]

    // Simula linhas reais vindas de planilha com nulls/undefined intercalados,
    // comprimentos desiguais de linha, linhas totalmente em branco no meio e no final
    const testSheet: ParsedSheet = {
      headers: [
        'NOME DO COLABORADOR',
        'DATA DA AVALIACAO',
        'AVALIADOR',
        'DECISAO',
        'JUSTIFICATIVA',
        'DISCIPLINA',
        'QUALIDADE',
        'COLUNA_EXTRA_INEXISTENTE',
      ],
      rows: [
        // Linha 1: Linha completa
        [
          'JOÃO BATISTA DA SILVA',
          '15/01/2026',
          'Engenheiro Marcos',
          'Efetivar',
          'Excelente desempenho',
          'Atende',
          'Supera',
          'dado qualquer',
        ],
        // Linha 2: Linha totalmente nula / vazia no meio da planilha (deve ser ignorada sem erro)
        [null as any, undefined as any, '', '   ', null as any],
        // Linha 3: Linha com células ausentes (curta: menos colunas que os headers) e undefineds
        ['MARIA APARECIDA LIMA', undefined as any, undefined as any, 'Efetivar'],
        // Linha 4: Linha totalmente vazia
        [],
        // Linha 5: Linha apenas com strings vazias
        ['', '', '', '', ''],
      ],
    }

    const { report, parsedRows } = await simulateEvaluationSheet(
      testSheet,
      'obras_90',
      'OBRAS_90D.xlsx',
      criteria,
      collabs,
      [],
    )

    // A simulação não deve lançar erro nem rejeitar as linhas vazias
    expect(report.errors).toHaveLength(0)
    expect(report.rejected).toHaveLength(0)
    expect(report.newCount).toBe(2)
    expect(parsedRows).toHaveLength(2)

    expect(parsedRows[0].rawCollabName).toBe('JOÃO BATISTA DA SILVA')
    expect(parsedRows[0].decision).toBe('EFFECTIVATE')
    expect(parsedRows[0].resultingSituation).toBe('Efetivado')

    expect(parsedRows[1].rawCollabName).toBe('MARIA APARECIDA LIMA')
    expect(parsedRows[1].decision).toBe('EFFECTIVATE')
    expect(parsedRows[1].wasDateInferred).toBe(true) // Data ausente na planilha, inferida pela admissão
  })

  it('simulateCollaboratorsSheet tolera linhas nulas/vazias e células undefined defensivamente', async () => {
    const costCenters = [{ id: 'cc1', name: 'OBRA RESERVA', type: 'Obra' as const }]
    const sectors: any[] = []

    const testSheet: ParsedSheet = {
      headers: ['NOME', 'CPF', 'CENTRO DE CUSTO', 'SETOR', 'CARGO', 'ADMISSAO'],
      rows: [
        ['PEDRO HENRIQUE ROCHA', '111.444.777-35', 'OBRA RESERVA', '', 'PEDREIRO', '01/11/2025'],
        // Linha nula intercalada
        [null as any, undefined as any, null as any, '', ''],
        // Linha vazia
        [],
      ],
    }

    const { report, parsedRows } = await simulateCollaboratorsSheet(
      testSheet,
      'BD_INCLUSAO-COLABORADOR.xlsx',
      costCenters,
      sectors,
      [],
    )

    expect(report.rejected).toHaveLength(0)
    expect(report.newCount).toBe(1)
    expect(parsedRows).toHaveLength(1)
    expect(parsedRows[0].rawName).toBe('PEDRO HENRIQUE ROCHA')
  })
})
