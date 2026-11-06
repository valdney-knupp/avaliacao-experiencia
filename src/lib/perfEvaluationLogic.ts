/**
 * Lógica compartilhada do módulo "Avaliação de Desempenho" (testável sem rede).
 */

export type PerfStatus = 'Rascunho' | 'Concluida'

export interface PerfFormVersionLite {
  id: string
  form_key: string
  version: number
  title: string
  status: string
  schema?: string | object | null
}

export interface PerfAnswerInput {
  question_id: string
  value: string
}

/** Perguntas do formulário, na ordem das seções. */
export function collectQuestions(schema: { sections?: { questions?: unknown[] }[] }): unknown[] {
  const out: unknown[] = []
  for (const s of schema?.sections || []) {
    for (const q of s?.questions || []) out.push(q)
  }
  return out
}

/**
 * Valida os obrigatórios. Retorna a lista de labels não respondidos.
 * Perguntas com showIf são exigidas apenas se a condição for atendida.
 */
export function validateRequiredAnswers(
  questions: Array<{
    id: string
    label: string
    required?: boolean
    showIf?: { question: string; values: string[] }
  }>,
  answers: PerfAnswerInput[],
): string[] {
  const byId = new Map(answers.map((a) => [a.question_id, a.value]))
  const missing: string[] = []
  for (const q of questions) {
    if (q.showIf) {
      const parentValue = byId.get(q.showIf.question) || ''
      const parentValues = parentValue ? JSON.parse(parentValue) : null
      const flat = Array.isArray(parentValues)
        ? parentValues
        : parentValue
          ? [String(parentValues)]
          : []
      const matched = flat.some((v) => q.showIf!.values.includes(String(v)))
      if (!matched) continue
    }
    if (!q.required) continue
    const v = byId.get(q.id)
    if (v === undefined || v === null || v === '' || v === '[]') missing.push(q.label)
  }
  return missing
}

export function isQuestionVisible(
  q: { showIf?: { question: string; values: string[] } },
  answers: Map<string, string[]>,
): boolean {
  if (!q.showIf) return true
  const vals = answers.get(q.showIf.question) || []
  return vals.some((v) => q.showIf!.values.includes(v))
}

export function parseAnswerValue(raw: string | null | undefined): string[] {
  if (!raw) return []
  try {
    const parsed = JSON.parse(raw)
    if (Array.isArray(parsed)) return parsed.map(String)
    return [String(parsed)]
  } catch {
    return raw ? [String(raw)] : []
  }
}

export function periodLabel(
  start?: string | null,
  end?: string | null,
  fallback?: string | null,
): string {
  if (fallback && fallback.trim()) return fallback.trim()
  const fmt = (iso?: string | null) => {
    if (!iso) return ''
    const p = iso.split(' ')[0].split('T')[0].split('-')
    return p.length === 3 ? `${p[2]}/${p[1]}/${p[0]}` : ''
  }
  const a = fmt(start)
  const b = fmt(end)
  if (a && b) return `${a} a ${b}`
  return a || b || 'Período não informado'
}

/** Converte o schema (string JSON ou objeto) em objeto. */
export function parseSchema<T>(raw: string | object | null | undefined): T | null {
  if (!raw) return null
  if (typeof raw === 'object') return raw as T
  try {
    return JSON.parse(raw) as T
  } catch {
    return null
  }
}
