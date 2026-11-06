import { describe, it, expect } from 'vitest'
import {
  collectQuestions,
  validateRequiredAnswers,
  isQuestionVisible,
  parseAnswerValue,
  periodLabel,
  parseSchema,
} from './perfEvaluationLogic'
import { NIVEL_I_SCHEMA, NIVEL_II_SCHEMA, PERF_FORMS } from './perfForms'

const questions = [
  { id: 'q1', label: 'Período', required: true },
  { id: 'q2', label: 'Nota', required: true },
  { id: 'q3', label: 'Especifique', required: true, showIf: { question: 'q2', values: ['Outra'] } },
  { id: 'q4', label: 'Observações', required: false },
]

describe('perfEvaluationLogic', () => {
  it('collectQuestions percorre todas as seções', () => {
    const schema = {
      sections: [{ questions: [{ id: 'a' }] }, { questions: [{ id: 'b' }, { id: 'c' }] }],
    }
    expect(collectQuestions(schema)).toHaveLength(3)
  })

  it('validateRequiredAnswers detecta faltantes', () => {
    expect(validateRequiredAnswers(questions, [{ question_id: 'q1', value: '2026' }])).toEqual([
      'Nota',
    ])
  })

  it('validateRequiredAnswers ignora showIf não atendido', () => {
    const answers = [
      { question_id: 'q1', value: '2026' },
      { question_id: 'q2', value: '5' },
    ]
    expect(validateRequiredAnswers(questions, answers)).toEqual([])
  })

  it('validateRequiredAnswers exige showIf atendido', () => {
    const answers = [
      { question_id: 'q1', value: '2026' },
      { question_id: 'q2', value: JSON.stringify(['Outra']) },
    ]
    expect(validateRequiredAnswers(questions, answers)).toEqual(['Especifique'])
  })

  it('isQuestionVisible responde conforme o showIf', () => {
    const q = { showIf: { question: 'q2', values: ['Outra'] } }
    expect(isQuestionVisible(q, new Map([['q2', ['Outra']]]))).toBe(true)
    expect(isQuestionVisible(q, new Map([['q2', ['Sim']]]))).toBe(false)
    expect(isQuestionVisible({}, new Map())).toBe(true)
  })

  it('parseAnswerValue lida com JSON e texto puro', () => {
    expect(parseAnswerValue('["A","B"]')).toEqual(['A', 'B'])
    expect(parseAnswerValue('texto')).toEqual(['texto'])
    expect(parseAnswerValue(null)).toEqual([])
  })

  it('periodLabel formata intervalo em pt-BR', () => {
    expect(periodLabel('2026-01-01 00:00:00', '2026-06-30 00:00:00')).toBe(
      '01/01/2026 a 30/06/2026',
    )
    expect(periodLabel(null, null, '1º semestre')).toBe('1º semestre')
    expect(periodLabel(null, null)).toBe('Período não informado')
  })

  it('parseSchema aceita string JSON e objeto', () => {
    expect(parseSchema<{ a: number }>('{"a":1}')).toEqual({ a: 1 })
    expect(parseSchema<{ a: number }>({ a: 1 })).toEqual({ a: 1 })
    expect(parseSchema('não é json')).toBeNull()
    expect(parseSchema(null)).toBeNull()
  })

  it('valida estrutura do modelo Nível I (sem dados de respostas)', () => {
    expect(NIVEL_I_SCHEMA.title).toBe('Avaliação de Desempenho — Nível I')
    expect(NIVEL_I_SCHEMA.sections).toHaveLength(2)
    const allQ = collectQuestions(NIVEL_I_SCHEMA) as any[]
    // 3 de identificação + 5 competências + 5 comentários = 13 perguntas
    expect(allQ).toHaveLength(13)
    const requiredQ = allQ.filter((q) => q.required)
    // 3 identificação + 5 competências obrigatórias
    expect(requiredQ).toHaveLength(8)
    // Opções de escala presentes
    const domProcessos = allQ.find((q) => q.id === 'q_dominio_processos')
    expect(domProcessos?.options).toHaveLength(4)
    expect(domProcessos?.options[0]).toContain('ATENDE')
    expect(domProcessos?.options[1]).toContain('ATENDE PARCIALMENTE')
    expect(domProcessos?.options[2]).toContain('NÃO ATENDE')
    expect(domProcessos?.options[3]).toContain('SUPERA')
  })

  it('valida estrutura do modelo Nível II (3 seções temáticas + identificação)', () => {
    expect(NIVEL_II_SCHEMA.title).toBe('Avaliação de Desempenho — Nível II')
    expect(NIVEL_II_SCHEMA.sections).toHaveLength(4)
    expect(NIVEL_II_SCHEMA.sections.map((s) => s.title)).toEqual([
      'Identificação',
      'CLIMA ORGANIZACIONAL',
      'CRESCIMENTO',
      'PERFORMANCE e RESULTADOS',
    ])
    const allQ = collectQuestions(NIVEL_II_SCHEMA) as any[]
    // 3 identificação + 4 clima + 4 crescimento + 5 performance = 16 perguntas
    expect(allQ).toHaveLength(16)
    // Competências escalares: 3 clima + 3 crescimento + 4 performance = 10
    const radioQ = allQ.filter((q) => q.type === 'radio')
    expect(radioQ).toHaveLength(10)
    // Comentários: 3
    const textareas = allQ.filter((q) => q.type === 'textarea')
    expect(textareas).toHaveLength(3)
  })

  it('modelos em PERF_FORMS estão ativos e não pendentes', () => {
    expect(PERF_FORMS).toHaveLength(2)
    expect(PERF_FORMS[0].pending).toBe(false)
    expect(PERF_FORMS[1].pending).toBe(false)
  })
})
