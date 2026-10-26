/**
 * Pure evaluation and deadline classification logic.
 * Mirrors exactly the logic implemented in pocketbase/hooks/daily_deadline_check.js
 * to ensure mathematical and business correctness across test and backend runtime.
 */

export interface CollaboratorCandidate {
  id: string
  name: string
  role?: string
  situation: 'Em experiência' | 'Efetivado' | 'Desligado' | 'Inativo'
  cost_center?: string
  sector?: string
  deadline_45?: string | null
  deadline_90?: string | null
}

export interface UserCandidate {
  id: string
  email: string
  name?: string
  profile: 'ADMIN' | 'HR' | 'MANAGER_WORKSITE' | 'MANAGER_DEPARTMENT' | 'ADMIN_ASSISTANT' | 'VIEWER'
  active: boolean
  verified: boolean
  cost_center?: string
  sector?: string
}

export interface CostCenterInfo {
  id: string
  name: string
  recipients: string[]
}

export type SituationType = 'overdue' | 'today' | 'upcoming'

export interface DeadlineAlert {
  collaboratorId: string
  collaboratorName: string
  stage: '45 dias' | '90 dias'
  deadlineIso: string
  diffDays: number
  situationType: SituationType
  situationLabel: string
  subjectSituation: string
  eventName: 'approaching_deadline' | 'overdue'
  recipients: string[]
}

export interface NotificationItem {
  dedupeKey: string
  recipient: string
  event: string
  subject: string
  body: string
}

export interface EvaluateDeadlinesOptions {
  todayIso: string // YYYY-MM-DD
  advanceDays?: number
  cutoffDateIso?: string
  generalRecipients?: string[]
}

export function formatBR(isoStr?: string | null): string {
  if (!isoStr) return ''
  const clean = isoStr.split(' ')[0].split('T')[0]
  const p = clean.split('-')
  if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`
  return isoStr
}

export function evaluateDeadlineStatus(
  deadlineIso: string,
  todayIso: string,
  advanceDays = 5,
  cutoffDateIso = '',
): {
  eligible: boolean
  diffDays: number
  situationType?: SituationType
  situationLabel?: string
  subjectSituation?: string
  eventName?: 'approaching_deadline' | 'overdue'
} {
  if (!deadlineIso || !deadlineIso.includes('-')) {
    return { eligible: false, diffDays: 0 }
  }

  const cleanDeadline = deadlineIso.split(' ')[0].split('T')[0]
  if (cutoffDateIso && cleanDeadline < cutoffDateIso) {
    return { eligible: false, diffDays: 0 }
  }

  const [tY, tM, tD] = todayIso.split('-').map(Number)
  const [dY, dM, dD] = cleanDeadline.split('-').map(Number)

  if (isNaN(tY) || isNaN(tM) || isNaN(tD) || isNaN(dY) || isNaN(dM) || isNaN(dD)) {
    return { eligible: false, diffDays: 0 }
  }

  const todayUtc = Date.UTC(tY, tM - 1, tD)
  const targetUtc = Date.UTC(dY, dM - 1, dD)
  const diffDays = Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    const overdueDays = Math.abs(diffDays)
    return {
      eligible: true,
      diffDays,
      situationType: 'overdue',
      situationLabel: `ATRASADA há ${overdueDays} dia(s) (prazo limite: ${formatBR(cleanDeadline)})`,
      subjectSituation: `ATRASADA há ${overdueDays} dia(s)`,
      eventName: 'overdue',
    }
  }

  if (diffDays === 0) {
    return {
      eligible: true,
      diffDays,
      situationType: 'today',
      situationLabel: `VENCE HOJE (${formatBR(cleanDeadline)})`,
      subjectSituation: 'VENCE HOJE',
      eventName: 'approaching_deadline',
    }
  }

  if (diffDays <= advanceDays) {
    return {
      eligible: true,
      diffDays,
      situationType: 'upcoming',
      situationLabel: `vence em ${diffDays} dia(s) em ${formatBR(cleanDeadline)}`,
      subjectSituation: `vence em ${diffDays} dia(s)`,
      eventName: 'approaching_deadline',
    }
  }

  return { eligible: false, diffDays }
}

export function buildRecipients(
  collaborator: CollaboratorCandidate,
  users: UserCandidate[],
  costCenterMap: Record<string, CostCenterInfo> = {},
  generalRecipients: string[] = [],
): string[] {
  const recipientEmails = new Set<string>()

  // 1. Users: ONLY active AND verified with allowed profiles
  const allowedProfiles = ['ADMIN', 'HR', 'MANAGER_WORKSITE', 'MANAGER_DEPARTMENT']
  for (const u of users) {
    if (!u.active || !u.verified) continue
    const email = (u.email || '').trim().toLowerCase()
    if (!email || !allowedProfiles.includes(u.profile)) continue

    if (u.profile === 'ADMIN' || u.profile === 'HR') {
      recipientEmails.add(email)
    } else if (
      u.profile === 'MANAGER_WORKSITE' &&
      u.cost_center &&
      collaborator.cost_center &&
      u.cost_center === collaborator.cost_center
    ) {
      recipientEmails.add(email)
    } else if (
      u.profile === 'MANAGER_DEPARTMENT' &&
      u.sector &&
      collaborator.sector &&
      u.sector === collaborator.sector
    ) {
      recipientEmails.add(email)
    }
  }

  // 2. Cost center email_recipients
  if (collaborator.cost_center && costCenterMap[collaborator.cost_center]) {
    for (const em of costCenterMap[collaborator.cost_center].recipients) {
      const clean = em.trim().toLowerCase()
      if (clean) recipientEmails.add(clean)
    }
  }

  // 3. General recipients
  for (const em of generalRecipients) {
    const clean = em.trim().toLowerCase()
    if (clean) recipientEmails.add(clean)
  }

  return Array.from(recipientEmails)
}

export function generateDedupeKey(
  collaboratorId: string,
  stage: '45 dias' | '90 dias',
  situationType: SituationType,
  diffDays: number,
  todayIso: string,
  deadlineIso: string,
  recipientEmail: string,
): string {
  const stageSlug = stage.replace(/\s+/g, '')
  const cleanEmail = recipientEmail.trim().toLowerCase()

  if (situationType === 'overdue') {
    return `dl_${collaboratorId}_${stageSlug}_overdue_${todayIso}_${cleanEmail}`
  }
  if (situationType === 'today') {
    return `dl_${collaboratorId}_${stageSlug}_today_${todayIso}_${cleanEmail}`
  }
  return `dl_${collaboratorId}_${stageSlug}_up${diffDays}d_${deadlineIso}_${cleanEmail}`
}

export function processDailyDeadlineCheck(params: {
  collaborators: CollaboratorCandidate[]
  completedEvaluations: Set<string> // `${collabId}_45 dias`, etc.
  users: UserCandidate[]
  costCenterMap?: Record<string, CostCenterInfo>
  existingDedupeKeys?: Set<string>
  options: EvaluateDeadlinesOptions
}): {
  alerts: DeadlineAlert[]
  notifications: NotificationItem[]
  skippedDuplicatesCount: number
  totalCheckedCollaborators: number
} {
  const {
    collaborators,
    completedEvaluations,
    users,
    costCenterMap = {},
    existingDedupeKeys = new Set<string>(),
    options,
  } = params

  const advanceDays = options.advanceDays ?? 5
  const cutoffDateIso = options.cutoffDateIso ?? ''
  const generalRecipients = options.generalRecipients ?? []
  const todayIso = options.todayIso

  const alerts: DeadlineAlert[] = []
  const notifications: NotificationItem[] = []
  let skippedDuplicatesCount = 0

  // Filter only collaborators who are currently in experience
  const activeCollaborators = collaborators.filter((c) => c.situation === 'Em experiência')

  for (const collab of activeCollaborators) {
    const stages: Array<{ stage: '45 dias' | '90 dias'; deadline?: string | null }> = [
      { stage: '45 dias', deadline: collab.deadline_45 },
      { stage: '90 dias', deadline: collab.deadline_90 },
    ]

    for (const check of stages) {
      const evalKey = `${collab.id}_${check.stage}`
      if (completedEvaluations.has(evalKey)) {
        // Skip stage if already completed
        continue
      }

      if (!check.deadline) continue

      const status = evaluateDeadlineStatus(check.deadline, todayIso, advanceDays, cutoffDateIso)

      if (!status.eligible || !status.situationType || !status.eventName) {
        continue
      }

      const recipients = buildRecipients(collab, users, costCenterMap, generalRecipients)
      if (recipients.length === 0) continue

      const cleanDeadline = check.deadline.split(' ')[0].split('T')[0]

      const alert: DeadlineAlert = {
        collaboratorId: collab.id,
        collaboratorName: collab.name,
        stage: check.stage,
        deadlineIso: cleanDeadline,
        diffDays: status.diffDays,
        situationType: status.situationType,
        situationLabel: status.situationLabel!,
        subjectSituation: status.subjectSituation!,
        eventName: status.eventName,
        recipients,
      }
      alerts.push(alert)

      const subject = `[Avaliação de Experiência] Prazo de ${check.stage}: ${collab.name} — ${status.subjectSituation}`
      const costCenterName =
        collab.cost_center && costCenterMap[collab.cost_center]
          ? costCenterMap[collab.cost_center].name
          : 'Não informado'

      const body = `Prezados,\n\nIdentificamos a seguinte situação de prazo de avaliação de experiência:\n\n• Colaborador: ${collab.name}\n• Função: ${collab.role || 'Não informada'}\n• Centro de Custo: ${costCenterName}\n• Etapa: ${check.stage}\n• Prazo de Avaliação: ${formatBR(cleanDeadline)}\n• Situação: ${status.situationLabel}\n\nAcesse o sistema para registrar a avaliação ou acompanhar o processo.\n\nAvaliação de Experiência`

      for (const email of recipients) {
        const dedupeKey = generateDedupeKey(
          collab.id,
          check.stage,
          status.situationType,
          status.diffDays,
          todayIso,
          cleanDeadline,
          email,
        )

        if (existingDedupeKeys.has(dedupeKey)) {
          skippedDuplicatesCount++
          continue
        }

        existingDedupeKeys.add(dedupeKey)
        notifications.push({
          dedupeKey,
          recipient: email,
          event: status.eventName,
          subject,
          body,
        })
      }
    }
  }

  return {
    alerts,
    notifications,
    skippedDuplicatesCount,
    totalCheckedCollaborators: activeCollaborators.length,
  }
}
