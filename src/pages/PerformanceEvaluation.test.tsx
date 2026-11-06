import { describe, it, expect } from 'vitest'
import { PERF_FORMS, NIVEL_I_SCHEMA, NIVEL_II_SCHEMA, type PerfQuestion } from '@/lib/perfForms'
import { collectQuestions } from '@/lib/perfEvaluationLogic'

describe('Fluxo de Avaliação de Desempenho (Nível I e Nível II)', () => {
  it('disponibiliza os modelos Nível I e Nível II para seleção e início', () => {
    expect(PERF_FORMS).toHaveLength(2)
    const [nivel1, nivel2] = PERF_FORMS

    expect(nivel1.key).toBe('NIVEL_I')
    expect(nivel1.schema.title).toBe('Avaliação de Desempenho — Nível I')
    expect(nivel1.pending).toBe(false)

    expect(nivel2.key).toBe('NIVEL_II')
    expect(nivel2.schema.title).toBe('Avaliação de Desempenho — Nível II')
    expect(nivel2.pending).toBe(false)
  })

  it('o modelo Nível I possui perguntas e seções completas para preenchimento', () => {
    const questions = collectQuestions(NIVEL_I_SCHEMA) as PerfQuestion[]
    expect(questions.length).toBeGreaterThan(0)
    const collabQuestion = questions.find((q) => q.id === 'q_avaliado' || q.id === 'q_colaborador')
    expect(collabQuestion).toBeDefined()
    expect(collabQuestion?.type).toBe('collaborator_select')
  })

  it('o modelo Nível II possui perguntas e seções completas para preenchimento', () => {
    const questions = collectQuestions(NIVEL_II_SCHEMA) as PerfQuestion[]
    expect(questions.length).toBeGreaterThan(0)
    const collabQuestion = questions.find((q) => q.id === 'q_avaliado' || q.id === 'q_colaborador')
    expect(collabQuestion).toBeDefined()
    expect(collabQuestion?.type).toBe('collaborator_select')
  })
})
