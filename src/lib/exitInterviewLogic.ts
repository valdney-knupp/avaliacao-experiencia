/**
 * Lógica do módulo Entrevista de Desligamento (testável sem rede).
 * Taxa de resposta: convites com ≥1 tentativa bem-sucedida; cada convite conta UMA vez.
 */

export type ExitInviteStatus =
  | 'Aguardando envio'
  | 'Enviado'
  | 'Respondido'
  | 'Expirado'
  | 'Falha no envio'

export interface ExitAttemptLite {
  id: string
  channel: string
  status: string
  recipient: string
  error_message?: string
  created?: string
}

export interface ExitInviteLite {
  id: string
  status: string
  expires_at?: string
  responded_at?: string
  sent_first_at?: string
  offboarding_date?: string
  collaborator?: string
  expand?: Record<string, unknown>
}

export interface ExitInviteMetrics {
  total: number
  sent: number
  responded: number
  pending: number
  expired: number
  failed: number
  responseRate: number
}

/**
 * Métricas por convite (não por tentativa):
 * - enviados: convites com pelo menos uma tentativa bem-sucedida (status Enviado ou Respondido);
 * - pendentes: enviados ainda sem resposta e dentro do prazo;
 * - expirados: enviados, sem resposta, com prazo vencido;
 * - falha: sem nenhum envio bem-sucedido;
 * - taxa = respondidos / enviados.
 */
export function computeExitInviteMetrics(
  invites: Array<{ invite: ExitInviteLite; attempts: ExitAttemptLite[] }>,
): ExitInviteMetrics {
  const total = invites.length
  let sent = 0
  let responded = 0
  let pending = 0
  let expired = 0
  let failed = 0
  const now = new Date().getTime()

  for (const { invite, attempts } of invites) {
    const anySuccess = attempts.some((a) => a.status === 'Sucesso')
    if (invite.status === 'Respondido') {
      responded++
      sent++
      continue
    }
    if (anySuccess) {
      sent++
      const exp = invite.expires_at ? new Date(invite.expires_at).getTime() : null
      if (exp && exp < now) expired++
      else pending++
      continue
    }
    if (invite.status === 'Expirado') {
      expired++
      continue
    }
    failed++
  }

  return {
    total,
    sent,
    responded,
    pending,
    expired,
    failed,
    responseRate: sent > 0 ? responded / sent : 0,
  }
}

/** Agrupa respostas fechadas por pergunta: label -> contagem por opção. */
export function buildClosedAnswerDistribution(
  questions: Array<{ id: string; label: string; options?: string[]; type: string }>,
  answers: Array<{ question_id: string; value: string | null }>,
): Map<string, Map<string, number>> {
  const result = new Map<string, Map<string, number>>()
  const byQuestion = new Map<string, string[]>()
  for (const a of answers) {
    let vals: string[] = []
    try {
      const parsed = a.value ? JSON.parse(a.value) : null
      vals = Array.isArray(parsed)
        ? parsed.map(String)
        : parsed !== null && parsed !== undefined
          ? [String(parsed)]
          : []
    } catch {
      vals = a.value ? [String(a.value)] : []
    }
    const list = byQuestion.get(a.question_id) || []
    list.push(...vals)
    byQuestion.set(a.question_id, list)
  }
  for (const q of questions) {
    if (q.type !== 'radio' && q.type !== 'checkbox') continue
    const counts = new Map<string, number>()
    for (const opt of q.options || []) counts.set(opt, 0)
    for (const v of byQuestion.get(q.id) || []) {
      counts.set(v, (counts.get(v) || 0) + 1)
    }
    result.set(q.id, counts)
  }
  return result
}

/** Média das escalas por pergunta. */
export function buildScaleAverages(
  questions: Array<{ id: string; label: string; type: string }>,
  answers: Array<{ question_id: string; value: string | null }>,
): Map<string, { avg: number; count: number }> {
  const sums = new Map<string, { sum: number; count: number }>()
  for (const a of answers) {
    const q = questions.find((x) => x.id === a.question_id)
    if (!q || q.type !== 'scale') continue
    let n = NaN
    try {
      const parsed = a.value ? JSON.parse(a.value) : null
      n = typeof parsed === 'number' ? parsed : parseFloat(String(parsed))
    } catch {
      n = parseFloat(String(a.value))
    }
    if (Number.isFinite(n)) {
      const cur = sums.get(q.id) || { sum: 0, count: 0 }
      cur.sum += n
      cur.count += 1
      sums.set(q.id, cur)
    }
  }
  const out = new Map<string, { avg: number; count: number }>()
  for (const [id, { sum, count }] of sums) out.set(id, { avg: count ? sum / count : 0, count })
  return out
}

/** Evolução mensal (YYYY-MM) por data do primeiro envio bem-sucedido e por data de conclusão. */
export function buildMonthlyEvolution(
  invites: Array<{ invite: ExitInviteLite; attempts: ExitAttemptLite[] }>,
): { month: string; sent: number; responded: number }[] {
  const months = new Map<string, { sent: number; responded: number }>()
  const bump = (month: string, key: 'sent' | 'responded') => {
    if (!month) return
    const cur = months.get(month) || { sent: 0, responded: 0 }
    cur[key]++
    months.set(month, cur)
  }
  for (const { invite, attempts } of invites) {
    const firstSuccess = attempts
      .filter((a) => a.status === 'Sucesso' && (a.created || ''))
      .map((a) => a.created as string)
      .sort()[0]
    if (firstSuccess) bump(firstSuccess.slice(0, 7), 'sent')
    if (invite.status === 'Respondido' && invite.responded_at)
      bump(invite.responded_at.slice(0, 7), 'responded')
  }
  return Array.from(months.entries())
    .map(([month, v]) => ({ month, ...v }))
    .sort((a, b) => a.month.localeCompare(b.month))
}
