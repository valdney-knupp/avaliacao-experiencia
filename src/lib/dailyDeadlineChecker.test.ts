import { describe, it, expect } from 'vitest'
import {
  evaluateDeadlineStatus,
  buildRecipients,
  generateDedupeKey,
  processDailyDeadlineCheck,
  CollaboratorCandidate,
  UserCandidate,
  CostCenterInfo,
} from './dailyDeadlineChecker'

describe('Daily Deadline Check — Logic & Anti-duplication', () => {
  const referenceToday = '2026-10-02'

  describe('1. Classification of stages (overdue, today, upcoming, far future)', () => {
    it('classifies deadline today (diffDays === 0)', () => {
      const res = evaluateDeadlineStatus('2026-10-02', referenceToday, 15)
      expect(res.eligible).toBe(true)
      expect(res.diffDays).toBe(0)
      expect(res.situationType).toBe('today')
      expect(res.situationLabel).toContain('VENCE HOJE (02/10/2026)')
      expect(res.subjectSituation).toBe('VENCE HOJE')
      expect(res.eventName).toBe('approaching_deadline')
    })

    it('classifies upcoming deadline within advance days window (e.g. 5 days remaining with 5-day window)', () => {
      // Exactly 5 days: eligible with default advanceDays = 5
      const res5 = evaluateDeadlineStatus('2026-10-07', referenceToday)
      expect(res5.eligible).toBe(true)
      expect(res5.diffDays).toBe(5)
      expect(res5.situationType).toBe('upcoming')
      expect(res5.situationLabel).toContain('vence em 5 dia(s) em 07/10/2026')
      expect(res5.subjectSituation).toBe('vence em 5 dia(s)')
      expect(res5.eventName).toBe('approaching_deadline')
    })

    it('emits warning at 5 days or less and does NOT emit warning at 6 days with default 5-day window', () => {
      // 5 days remaining -> eligible
      const res5 = evaluateDeadlineStatus('2026-10-07', referenceToday) // diffDays = 5
      expect(res5.eligible).toBe(true)
      expect(res5.diffDays).toBe(5)

      // 6 days remaining -> NOT eligible (beyond 5 days window)
      const res6 = evaluateDeadlineStatus('2026-10-08', referenceToday) // diffDays = 6
      expect(res6.eligible).toBe(false)
      expect(res6.diffDays).toBe(6)

      // 4 days remaining -> eligible
      const res4 = evaluateDeadlineStatus('2026-10-06', referenceToday) // diffDays = 4
      expect(res4.eligible).toBe(true)
      expect(res4.diffDays).toBe(4)

      // 0 days (today) -> eligible
      const res0 = evaluateDeadlineStatus('2026-10-02', referenceToday) // diffDays = 0
      expect(res0.eligible).toBe(true)
      expect(res0.situationType).toBe('today')

      // overdue (-1 day) -> eligible
      const resPast = evaluateDeadlineStatus('2026-10-01', referenceToday) // diffDays = -1
      expect(resPast.eligible).toBe(true)
      expect(resPast.situationType).toBe('overdue')
    })

    it('classifies overdue deadline in the past (diffDays < 0)', () => {
      const res = evaluateDeadlineStatus('2026-09-28', referenceToday, 15)
      expect(res.eligible).toBe(true)
      expect(res.diffDays).toBe(-4)
      expect(res.situationType).toBe('overdue')
      expect(res.situationLabel).toContain('ATRASADA há 4 dia(s) (prazo limite: 28/09/2026)')
      expect(res.subjectSituation).toBe('ATRASADA há 4 dia(s)')
      expect(res.eventName).toBe('overdue')
    })

    it('ignores deadlines far in the future beyond advanceDays window', () => {
      const res = evaluateDeadlineStatus('2026-11-20', referenceToday, 5)
      expect(res.eligible).toBe(false)
      expect(res.diffDays).toBeGreaterThan(15)
    })

    it('respects alert cutoff date if configured', () => {
      // Deadline before cutoff is ignored
      const resOld = evaluateDeadlineStatus('2025-12-01', referenceToday, 15, '2026-01-01')
      expect(resOld.eligible).toBe(false)

      // Deadline on or after cutoff is evaluated
      const resValid = evaluateDeadlineStatus('2026-02-01', referenceToday, 15, '2026-01-01')
      expect(resValid.eligible).toBe(true)
      expect(resValid.situationType).toBe('overdue')
    })
  })

  describe('2. Recipient resolution and security filtering', () => {
    const mockUsers: UserCandidate[] = [
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
        id: 'u_unverified',
        email: 'unverified@rpontes.com.br',
        profile: 'HR',
        active: true,
        verified: false, // NOT verified
      },
      {
        id: 'u_inactive',
        email: 'inactive@rpontes.com.br',
        profile: 'ADMIN',
        active: false, // Inactive
        verified: true,
      },
      {
        id: 'u_mgr_obras1',
        email: 'obra1_mgr@rpontes.com.br',
        profile: 'MANAGER_WORKSITE',
        active: true,
        verified: true,
        cost_center: 'cc_obra1',
      },
      {
        id: 'u_mgr_obras2',
        email: 'obra2_mgr@rpontes.com.br',
        profile: 'MANAGER_WORKSITE',
        active: true,
        verified: true,
        cost_center: 'cc_obra2',
      },
      {
        id: 'u_mgr_rh_sector',
        email: 'rh_sector_mgr@rpontes.com.br',
        profile: 'MANAGER_DEPARTMENT',
        active: true,
        verified: true,
        sector: 'sec_rh',
      },
      {
        id: 'u_mgr_ti_sector',
        email: 'ti_sector_mgr@rpontes.com.br',
        profile: 'MANAGER_DEPARTMENT',
        active: true,
        verified: true,
        sector: 'sec_ti',
      },
    ]

    const costCenterMap: Record<string, CostCenterInfo> = {
      cc_obra1: {
        id: 'cc_obra1',
        name: 'Obra Sunrise',
        recipients: ['eng.sunrise@rpontes.com.br', 'mestre.sunrise@rpontes.com.br'],
      },
      cc_obra2: {
        id: 'cc_obra2',
        name: 'Obra Blend',
        recipients: ['eng.blend@rpontes.com.br'],
      },
    }

    it('includes ADMIN + HR (active & verified only), isolated manager for worksite 1, CC recipients, and general settings', () => {
      const collab: CollaboratorCandidate = {
        id: 'collab_1',
        name: 'João Pedro',
        situation: 'Em experiência',
        cost_center: 'cc_obra1',
        sector: 'sec_rh',
      }

      const recipients = buildRecipients(collab, mockUsers, costCenterMap, [
        'diretoria@rpontes.com.br',
      ])

      // Should include:
      expect(recipients).toContain('admin@rpontes.com.br')
      expect(recipients).toContain('gp@rpontes.com.br')
      expect(recipients).toContain('obra1_mgr@rpontes.com.br')
      expect(recipients).toContain('rh_sector_mgr@rpontes.com.br')
      expect(recipients).toContain('eng.sunrise@rpontes.com.br')
      expect(recipients).toContain('mestre.sunrise@rpontes.com.br')
      expect(recipients).toContain('diretoria@rpontes.com.br')

      // Should NOT include unverified or inactive users
      expect(recipients).not.toContain('unverified@rpontes.com.br')
      expect(recipients).not.toContain('inactive@rpontes.com.br')

      // Should NOT include managers of other worksites or other sectors
      expect(recipients).not.toContain('obra2_mgr@rpontes.com.br')
      expect(recipients).not.toContain('ti_sector_mgr@rpontes.com.br')
    })
  })

  describe('3. Deduplication key mechanics', () => {
    it('generates consistent deduplication keys', () => {
      const overdueKey = generateDedupeKey(
        'c123',
        '45 dias',
        'overdue',
        -2,
        '2026-10-02',
        '2026-09-30',
        'User@domain.com',
      )
      expect(overdueKey).toBe('dl_c123_45dias_overdue_2026-10-02_user@domain.com')

      const todayKey = generateDedupeKey(
        'c123',
        '45 dias',
        'today',
        0,
        '2026-10-02',
        '2026-10-02',
        'user@domain.com',
      )
      expect(todayKey).toBe('dl_c123_45dias_today_2026-10-02_user@domain.com')

      const upcomingKey = generateDedupeKey(
        'c123',
        '90 dias',
        'upcoming',
        7,
        '2026-10-02',
        '2026-10-09',
        'user@domain.com',
      )
      expect(upcomingKey).toBe('dl_c123_90dias_up7d_2026-10-09_user@domain.com')
    })
  })

  describe('4. Full selection process (active collaborators, completed evals, duplicates)', () => {
    const mockUsers: UserCandidate[] = [
      {
        id: 'u_admin',
        email: 'admin@rpontes.com.br',
        profile: 'ADMIN',
        active: true,
        verified: true,
      },
    ]

    const collaborators: CollaboratorCandidate[] = [
      {
        id: 'c_active_due_today',
        name: 'Carlos Vence Hoje',
        situation: 'Em experiência',
        deadline_45: '2026-10-02',
        deadline_90: '2026-11-16',
      },
      {
        id: 'c_active_overdue',
        name: 'Marcos Atrasado',
        situation: 'Em experiência',
        deadline_45: '2026-09-25', // Overdue by 7 days
        deadline_90: '2026-11-09',
      },
      {
        id: 'c_active_upcoming',
        name: 'Ana Vence Em Breve',
        situation: 'Em experiência',
        deadline_45: '2026-10-10', // Upcoming 8 days
        deadline_90: '2026-11-24',
      },
      {
        id: 'c_completed_45',
        name: 'Juliana Avaliada 45d',
        situation: 'Em experiência',
        deadline_45: '2026-09-20', // Overdue date, but already evaluated!
        deadline_90: '2026-11-04',
      },
      {
        id: 'c_efetivado',
        name: 'Roberto Efetivado',
        situation: 'Efetivado', // Not in experience
        deadline_45: '2026-09-20',
        deadline_90: '2026-11-04',
      },
      {
        id: 'c_desligado',
        name: 'Lucas Desligado',
        situation: 'Desligado', // Dismissed
        deadline_45: '2026-09-20',
        deadline_90: '2026-11-04',
      },
      {
        id: 'c_inativo',
        name: 'Pedro Inativo',
        situation: 'Inativo',
        deadline_45: '2026-09-20',
        deadline_90: '2026-11-04',
      },
    ]

    it('skips inactive, dismissed, and effectivated collaborators', () => {
      const completed = new Set<string>()
      const result = processDailyDeadlineCheck({
        collaborators,
        completedEvaluations: completed,
        users: mockUsers,
        options: { todayIso: referenceToday, advanceDays: 15 },
      })

      // Checked only the 4 active collaborators
      expect(result.totalCheckedCollaborators).toBe(4)

      const namesWithAlerts = result.alerts.map((a) => a.collaboratorName)
      expect(namesWithAlerts).not.toContain('Roberto Efetivado')
      expect(namesWithAlerts).not.toContain('Lucas Desligado')
      expect(namesWithAlerts).not.toContain('Pedro Inativo')
    })

    it('skips stage if an evaluation for that stage already exists', () => {
      const completed = new Set<string>(['c_completed_45_45 dias'])
      const result = processDailyDeadlineCheck({
        collaborators,
        completedEvaluations: completed,
        users: mockUsers,
        options: { todayIso: referenceToday, advanceDays: 15 },
      })

      const alertsForCompletedCollab = result.alerts.filter(
        (a) => a.collaboratorId === 'c_completed_45',
      )
      // 45 dias was skipped because completed!
      expect(alertsForCompletedCollab.some((a) => a.stage === '45 dias')).toBe(false)
    })

    it('guarantees anti-duplication: second execution with existing keys re-sends nothing', () => {
      const completed = new Set<string>()
      const existingKeys = new Set<string>()

      // 1st run
      const run1 = processDailyDeadlineCheck({
        collaborators,
        completedEvaluations: completed,
        users: mockUsers,
        existingDedupeKeys: existingKeys,
        options: { todayIso: referenceToday, advanceDays: 15 },
      })

      expect(run1.notifications.length).toBeGreaterThan(0)
      expect(run1.skippedDuplicatesCount).toBe(0)

      // 2nd run with the populated existingKeys
      const run2 = processDailyDeadlineCheck({
        collaborators,
        completedEvaluations: completed,
        users: mockUsers,
        existingDedupeKeys: existingKeys, // Now has run1's keys
        options: { todayIso: referenceToday, advanceDays: 15 },
      })

      // Zero new notifications created, all duplicates skipped!
      expect(run2.notifications.length).toBe(0)
      expect(run2.skippedDuplicatesCount).toBe(run1.notifications.length)
    })

    it('formats PT-BR message without CPF and includes button reference', () => {
      const completed = new Set<string>()
      const result = processDailyDeadlineCheck({
        collaborators,
        completedEvaluations: completed,
        users: mockUsers,
        options: { todayIso: referenceToday, advanceDays: 15 },
      })

      for (const n of result.notifications) {
        // Must be in PT-BR
        expect(n.subject).toContain('[Avaliação de Experiência]')
        expect(n.body).toContain('Acesse o sistema para registrar a avaliação')
        expect(n.body).toContain('Avaliação de Experiência')
        // Must NOT contain CPF (CPF hash, digits or label)
        expect(n.body).not.toMatch(/\b\d{3}\.\d{3}\.\d{3}-\d{2}\b/)
        expect(n.body).not.toContain('CPF')
      }
    })
  })
})
