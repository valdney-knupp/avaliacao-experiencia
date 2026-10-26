import { describe, it, expect } from 'vitest'

/**
 * Pure evaluation logic matching pocketbase/hooks/daily_deadline_check.js
 */
export interface CollaboratorEvalInput {
  id: string
  name: string
  role: string
  cost_center: string
  sector?: string
  situation: string
  deadline_45?: string | null
  deadline_90?: string | null
}

export interface ExistingEvalInput {
  collaborator: string
  stage: '45 dias' | '90 dias'
}

export interface UserInput {
  id: string
  email: string
  profile: 'ADMIN' | 'HR' | 'MANAGER_WORKSITE' | 'MANAGER_DEPARTMENT' | 'ADMIN_ASSISTANT' | 'VIEWER'
  active: boolean
  verified: boolean
  cost_center?: string
  sector?: string
}

export interface CostCenterInput {
  id: string
  name: string
  email_recipients?: string
}

export interface DeadlineCheckOptions {
  referenceDateIso: string // YYYY-MM-DD
  advanceDays: number
  cutoffDateIso?: string
  generalRecipients?: string[]
}

export interface AlertResult {
  collabId: string
  collabName: string
  stage: '45 dias' | '90 dias'
  deadlineIso: string
  situationType: 'overdue' | 'today' | 'upcoming'
  diffDays: number
  recipientEmails: string[]
  dedupeKeys: Record<string, string> // email -> dedupeKey
}

export function evaluateDeadlines(
  collaborators: CollaboratorEvalInput[],
  existingEvaluations: ExistingEvalInput[],
  users: UserInput[],
  costCenters: CostCenterInput[],
  options: DeadlineCheckOptions,
): AlertResult[] {
  const { referenceDateIso, advanceDays, cutoffDateIso, generalRecipients = [] } = options

  const [refY, refM, refD] = referenceDateIso.split('-').map(Number)
  const todayUtc = Date.UTC(refY, refM - 1, refD)

  // Pre-index completed evaluations
  const completedMap = new Set<string>()
  for (const ev of existingEvaluations) {
    completedMap.add(`${ev.collaborator}_${ev.stage}`)
  }

  // Pre-index active verified users
  const activeEligibleUsers = users.filter(
    (u) =>
      u.active &&
      u.verified &&
      ['ADMIN', 'HR', 'MANAGER_WORKSITE', 'MANAGER_DEPARTMENT'].includes(u.profile),
  )

  // Pre-index cost centers
  const ccMap = new Map<string, { name: string; recipients: string[] }>()
  for (const cc of costCenters) {
    const recs = (cc.email_recipients || '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean)
    ccMap.set(cc.id, { name: cc.name, recipients: recs })
  }

  const results: AlertResult[] = []

  for (const collab of collaborators) {
    // Only active experience collaborators
    if (collab.situation === 'Desligado' || collab.situation === 'Inativo') {
      continue
    }

    const stages: Array<{ stage: '45 dias' | '90 dias'; deadline?: string | null }> = [
      { stage: '45 dias', deadline: collab.deadline_45 },
      { stage: '90 dias', deadline: collab.deadline_90 },
    ]

    for (const item of stages) {
      const stage = item.stage
      const deadlineRaw = item.deadline

      // 1. Skip if already completed
      if (completedMap.has(`${collab.id}_${stage}`)) {
        continue
      }

      if (!deadlineRaw) {
        continue
      }

      const deadlineIso = deadlineRaw.split(' ')[0].split('T')[0]
      if (!deadlineIso.includes('-')) continue

      if (cutoffDateIso && deadlineIso < cutoffDateIso) {
        continue
      }

      const [dY, dM, dD] = deadlineIso.split('-').map(Number)
      if (isNaN(dY) || isNaN(dM) || isNaN(dD)) continue

      const targetUtc = Date.UTC(dY, dM - 1, dD)
      const diffDays = Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24))

      let situationType: 'overdue' | 'today' | 'upcoming' | null = null

      if (diffDays < 0) {
        situationType = 'overdue'
      } else if (diffDays === 0) {
        situationType = 'today'
      } else if (diffDays <= advanceDays) {
        situationType = 'upcoming'
      } else {
        continue
      }

      // Compute recipients
      const recipientSet = new Set<string>()

      for (const u of activeEligibleUsers) {
        const email = u.email.trim().toLowerCase()
        if (u.profile === 'ADMIN' || u.profile === 'HR') {
          recipientSet.add(email)
        } else if (
          u.profile === 'MANAGER_WORKSITE' &&
          u.cost_center &&
          u.cost_center === collab.cost_center
        ) {
          recipientSet.add(email)
        } else if (u.profile === 'MANAGER_DEPARTMENT' && u.sector && u.sector === collab.sector) {
          recipientSet.add(email)
        }
      }

      const cc = ccMap.get(collab.cost_center)
      if (cc) {
        for (const em of cc.recipients) recipientSet.add(em)
      }

      for (const em of generalRecipients) {
        recipientSet.add(em.trim().toLowerCase())
      }

      if (recipientSet.size === 0) continue

      const recipientEmails = Array.from(recipientSet)
      const dedupeKeys: Record<string, string> = {}

      for (const email of recipientEmails) {
        const stageSlug = stage.replace(' ', '')
        if (situationType === 'overdue') {
          dedupeKeys[email] = `dl_${collab.id}_${stageSlug}_overdue_${referenceDateIso}_${email}`
        } else if (situationType === 'today') {
          dedupeKeys[email] = `dl_${collab.id}_${stageSlug}_today_${referenceDateIso}_${email}`
        } else {
          dedupeKeys[email] = `dl_${collab.id}_${stageSlug}_up${diffDays}d_${deadlineIso}_${email}`
        }
      }

      results.push({
        collabId: collab.id,
        collabName: collab.name,
        stage,
        deadlineIso,
        situationType,
        diffDays,
        recipientEmails,
        dedupeKeys,
      })
    }
  }

  return results
}

describe('Rotina Diária de Verificação de Prazos (daily_deadline_check)', () => {
  const mockCostCenters: CostCenterInput[] = [
    { id: 'cc1', name: 'OBRA BLEND', email_recipients: 'obra.blend@rpontes.com.br' },
    { id: 'cc2', name: 'OBRA SUMMIT', email_recipients: 'obra.summit@rpontes.com.br' },
  ]

  const mockUsers: UserInput[] = [
    {
      id: 'u_admin',
      email: 'admin@rpontes.com.br',
      profile: 'ADMIN',
      active: true,
      verified: true,
    },
    {
      id: 'u_hr',
      email: 'gp@rpontes.com.br',
      profile: 'HR',
      active: true,
      verified: true,
    },
    {
      id: 'u_mgr_blend',
      email: 'gestor.blend@rpontes.com.br',
      profile: 'MANAGER_WORKSITE',
      active: true,
      verified: true,
      cost_center: 'cc1',
    },
    {
      id: 'u_mgr_summit',
      email: 'gestor.summit@rpontes.com.br',
      profile: 'MANAGER_WORKSITE',
      active: true,
      verified: true,
      cost_center: 'cc2',
    },
    {
      id: 'u_inactive_admin',
      email: 'inativo@rpontes.com.br',
      profile: 'ADMIN',
      active: false,
      verified: true,
    },
    {
      id: 'u_unverified_hr',
      email: 'unverified@rpontes.com.br',
      profile: 'HR',
      active: true,
      verified: false,
    },
  ]

  const refDate = '2026-10-15'

  it('identifica corretamente prazo que vence hoje, prazo futuro no intervalo e prazo atrasado', () => {
    const collabs: CollaboratorEvalInput[] = [
      {
        id: 'c_today',
        name: 'Carlos Hoje',
        role: 'Pedreiro',
        cost_center: 'cc1',
        situation: 'Em experiência',
        deadline_45: '2026-10-15', // Vence hoje
        deadline_90: '2026-11-29', // Mais de 15 dias (45 dias no futuro)
      },
      {
        id: 'c_upcoming',
        name: 'Lucas Futuro',
        role: 'Servente',
        cost_center: 'cc1',
        situation: 'Em experiência',
        deadline_45: '2026-10-20', // Vence em 5 dias
        deadline_90: '2026-12-04', // Futuro distante
      },
      {
        id: 'c_overdue',
        name: 'João Atrasado',
        role: 'Carpinteiro',
        cost_center: 'cc2',
        situation: 'Em experiência',
        deadline_45: '2026-10-10', // Atrasado há 5 dias
        deadline_90: '2026-11-24', // Mais de 15 dias
      },
    ]

    const alerts = evaluateDeadlines(collabs, [], mockUsers, mockCostCenters, {
      referenceDateIso: refDate,
      advanceDays: 15,
      generalRecipients: ['notificacoes@rpontes.com.br'],
    })

    expect(alerts).toHaveLength(3)

    const todayAlert = alerts.find((a) => a.collabId === 'c_today')!
    expect(todayAlert).toBeDefined()
    expect(todayAlert.situationType).toBe('today')
    expect(todayAlert.diffDays).toBe(0)

    const upcomingAlert = alerts.find((a) => a.collabId === 'c_upcoming')!
    expect(upcomingAlert).toBeDefined()
    expect(upcomingAlert.situationType).toBe('upcoming')
    expect(upcomingAlert.diffDays).toBe(5)

    const overdueAlert = alerts.find((a) => a.collabId === 'c_overdue')!
    expect(overdueAlert).toBeDefined()
    expect(overdueAlert.situationType).toBe('overdue')
    expect(overdueAlert.diffDays).toBe(-5)
  })

  it('ignora etapas de 45 ou 90 dias que já possuem avaliação concluída', () => {
    const collabs: CollaboratorEvalInput[] = [
      {
        id: 'c_evaluated_45',
        name: 'Marcos Avaliado 45',
        role: 'Armador',
        cost_center: 'cc1',
        situation: 'Em experiência',
        deadline_45: '2026-10-10', // Estaria atrasado
        deadline_90: '2026-10-25', // Vence em 10 dias (próximo!)
      },
    ]

    const existing: ExistingEvalInput[] = [
      {
        collaborator: 'c_evaluated_45',
        stage: '45 dias',
      },
    ]

    const alerts = evaluateDeadlines(collabs, existing, mockUsers, mockCostCenters, {
      referenceDateIso: refDate,
      advanceDays: 15,
    })

    // Deve ignorar o 45 dias pois já tem avaliação; deve alertar apenas o 90 dias
    expect(alerts).toHaveLength(1)
    expect(alerts[0].stage).toBe('90 dias')
    expect(alerts[0].situationType).toBe('upcoming')
  })

  it('ignora colaboradores desligados ou inativos', () => {
    const collabs: CollaboratorEvalInput[] = [
      {
        id: 'c_desligado',
        name: 'Pedro Desligado',
        role: 'Pintor',
        cost_center: 'cc1',
        situation: 'Desligado',
        deadline_45: '2026-10-15',
      },
      {
        id: 'c_inativo',
        name: 'Ana Inativa',
        role: 'Eletricista',
        cost_center: 'cc1',
        situation: 'Inativo',
        deadline_45: '2026-10-15',
      },
    ]

    const alerts = evaluateDeadlines(collabs, [], mockUsers, mockCostCenters, {
      referenceDateIso: refDate,
      advanceDays: 15,
    })

    expect(alerts).toHaveLength(0)
  })

  it('respeita o isolamento por obra e nunca envia para usuários inativos ou não verificados', () => {
    const collabs: CollaboratorEvalInput[] = [
      {
        id: 'c_blend',
        name: 'Colaborador Blend',
        role: 'Pedreiro',
        cost_center: 'cc1', // Obra Blend
        situation: 'Em experiência',
        deadline_45: '2026-10-15',
      },
    ]

    const alerts = evaluateDeadlines(collabs, [], mockUsers, mockCostCenters, {
      referenceDateIso: refDate,
      advanceDays: 15,
      generalRecipients: ['geral@rpontes.com.br'],
    })

    expect(alerts).toHaveLength(1)
    const alert = alerts[0]

    // Destinatários esperados:
    // - admin@rpontes.com.br (ADMIN ativo e verificado)
    // - gp@rpontes.com.br (HR ativo e verificado)
    // - gestor.blend@rpontes.com.br (MANAGER_WORKSITE da cc1)
    // - obra.blend@rpontes.com.br (e-mail configurado no centro cc1)
    // - geral@rpontes.com.br (generalRecipients)
    expect(alert.recipientEmails).toContain('admin@rpontes.com.br')
    expect(alert.recipientEmails).toContain('gp@rpontes.com.br')
    expect(alert.recipientEmails).toContain('gestor.blend@rpontes.com.br')
    expect(alert.recipientEmails).toContain('obra.blend@rpontes.com.br')
    expect(alert.recipientEmails).toContain('geral@rpontes.com.br')

    // NÃO deve conter o gestor da outra obra (cc2)
    expect(alert.recipientEmails).not.toContain('gestor.summit@rpontes.com.br')
    // NÃO deve conter usuários inativos ou não verificados
    expect(alert.recipientEmails).not.toContain('inativo@rpontes.com.br')
    expect(alert.recipientEmails).not.toContain('unverified@rpontes.com.br')
  })

  it('gera dedupe_keys consistentes e determinísticas que impedem envio duplo no mesmo dia', () => {
    const collabs: CollaboratorEvalInput[] = [
      {
        id: 'c1',
        name: 'Teste Dedupe',
        role: 'Pedreiro',
        cost_center: 'cc1',
        situation: 'Em experiência',
        deadline_45: '2026-10-15', // Vence hoje
      },
    ]

    const run1 = evaluateDeadlines(collabs, [], mockUsers, mockCostCenters, {
      referenceDateIso: refDate,
      advanceDays: 15,
    })

    const run2 = evaluateDeadlines(collabs, [], mockUsers, mockCostCenters, {
      referenceDateIso: refDate,
      advanceDays: 15,
    })

    expect(run1[0].dedupeKeys).toEqual(run2[0].dedupeKeys)
    expect(run1[0].dedupeKeys['admin@rpontes.com.br']).toBe(
      'dl_c1_45dias_today_2026-10-15_admin@rpontes.com.br',
    )
  })

  it('valida a nova janela de 5 dias: alerta gerado com 5 dias ou menos e NÃO gerado com 6 dias de antecedência', () => {
    const collabs: CollaboratorEvalInput[] = [
      {
        id: 'c_5d',
        name: 'Vence em 5 dias',
        role: 'Pedreiro',
        cost_center: 'cc1',
        situation: 'Em experiência',
        deadline_45: '2026-10-20', // diffDays = 5 (refDate = 2026-10-15)
      },
      {
        id: 'c_6d',
        name: 'Vence em 6 dias',
        role: 'Carpinteiro',
        cost_center: 'cc1',
        situation: 'Em experiência',
        deadline_45: '2026-10-21', // diffDays = 6 (fora da janela de 5 dias)
      },
      {
        id: 'c_today',
        name: 'Vence hoje',
        role: 'Servente',
        cost_center: 'cc1',
        situation: 'Em experiência',
        deadline_45: '2026-10-15', // diffDays = 0
      },
      {
        id: 'c_overdue',
        name: 'Atrasado',
        role: 'Eletricista',
        cost_center: 'cc1',
        situation: 'Em experiência',
        deadline_45: '2026-10-14', // diffDays = -1
      },
    ]

    const alerts = evaluateDeadlines(collabs, [], mockUsers, mockCostCenters, {
      referenceDateIso: refDate,
      advanceDays: 5,
    })

    const alertIds = alerts.map((a) => a.collabId)
    // 5 dias deve ser emitido
    expect(alertIds).toContain('c_5d')
    // 6 dias NÃO deve ser emitido
    expect(alertIds).not.toContain('c_6d')
    // Hoje e atrasado continuam sendo emitidos normalmente
    expect(alertIds).toContain('c_today')
    expect(alertIds).toContain('c_overdue')
  })
})
