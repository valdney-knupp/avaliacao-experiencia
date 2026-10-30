// Scheduled daily verification routine for experience evaluation deadlines (45 and 90 days)
// Runs daily at 07:00 (server time) via cronAdd.
// Also exposes an administrative route (POST /backend/v1/admin/run-deadline-check) for manual execution/testing.
//
// Rules implemented:
// 1. Scans active collaborators (situation = 'Em experiência' or situation != 'Desligado' && situation != 'Inativo')
// 2. Checks deadlines for 45 and 90 days:
//    - Ignores stage if an evaluation for that stage already exists (45 dias or 90 dias)
//    - Identifies:
//        * 'overdue': deadline is in the past (diffDays < 0)
//        * 'today': deadline is today (diffDays === 0)
//        * 'upcoming': deadline is within advance window (diffDays > 0 && diffDays <= advanceDays)
// 3. Strict anti-duplication:
//    - dedupe_key format: `deadline_${collabId}_${stage}_${situationType}_${refDateIso}`
//    - For overdue: `deadline_${collabId}_${stage}_overdue_${refDateIso}` (sent at most once per day for an overdue collaborator)
//    - For today: `deadline_${collabId}_${stage}_today_${refDateIso}`
//    - For upcoming: `deadline_${collabId}_${stage}_upcoming_${diffDays}d_${deadlineIso}`
//    - Checks existing record in 'notifications' by dedupe_key before inserting
// 4. Isolation & Recipients:
//    - Global recipients: active verified users with profiles ADMIN, HR, plus general_recipients from settings
//    - Worksite / Department isolation: MANAGER_WORKSITE receives if collaborator.cost_center matches user.cost_center;
//      MANAGER_DEPARTMENT receives if collaborator.sector matches user.sector
//    - Cost center email_recipients (if configured)
// 5. Resilience & Audit:
//    - Individual notification send failure does not halt routine
//    - Inactive / unverified users are strictly excluded
//    - Saves a summary in audit_logs upon completion

cronAdd('daily_deadline_check', '0 7 * * *', () => {
  // All logic must be strictly inline inside callback due to goja VM pooling
  try {
    // 1. Current reference date in UTC/Fortaleza format YYYY-MM-DD
    const now = new Date()
    const nowIso = now.toISOString().split('T')[0]
    const [nowY, nowM, nowD] = nowIso.split('-').map(Number)
    const todayUtc = Date.UTC(nowY, nowM - 1, nowD)

    // 2. Load system settings
    let advanceDays = 5
    try {
      const advRecord = $app.findFirstRecordByData('settings', 'key', 'notification_advance_days')
      const val = parseInt(advRecord.getString('value'), 10)
      if (!isNaN(val) && val > 0) {
        advanceDays = val
      }
    } catch (_) {}

    let cutoffDateIso = ''
    try {
      const cutoffRec = $app.findFirstRecordByData('settings', 'key', 'alert_cutoff_date')
      const val = cutoffRec.getString('value').trim()
      if (val && val.includes('-')) {
        cutoffDateIso = val.split(' ')[0].split('T')[0]
      }
    } catch (_) {}

    const generalEmails = []
    try {
      const genRec = $app.findFirstRecordByData('settings', 'key', 'general_recipients')
      const val = genRec.getString('value')
      if (val) {
        val.split(',').forEach((em) => {
          const clean = em.trim().toLowerCase()
          if (clean && !generalEmails.includes(clean)) {
            generalEmails.push(clean)
          }
        })
      }
    } catch (_) {}

    // 3. Load active, verified users with notification-eligible profiles
    // Allowed profiles: ADMIN, HR, MANAGER_WORKSITE, MANAGER_DEPARTMENT
    const activeUsers = []
    try {
      const usersList = $app.findRecordsByFilter(
        '_pb_users_auth_',
        'active = true && verified = true',
        '',
        1000,
        0,
      )
      const allowedProfiles = ['ADMIN', 'HR', 'MANAGER_WORKSITE', 'MANAGER_DEPARTMENT']
      for (const u of usersList) {
        const prof = u.getString('profile')
        const email = u.getString('email').trim().toLowerCase()
        if (email && allowedProfiles.includes(prof)) {
          activeUsers.push({
            id: u.id,
            email: email,
            profile: prof,
            cost_center: u.getString('cost_center'),
            sector: u.getString('sector'),
          })
        }
      }
    } catch (usersErr) {
      console.warn('[daily_deadline_check] Erro ao carregar usuários ativos: ' + usersErr)
    }

    // 4. Cost center cache
    const costCentersMap = {}
    try {
      const ccList = $app.findRecordsByFilter('cost_centers', '', '', 500, 0)
      for (const cc of ccList) {
        const rawRecipients = cc.getString('email_recipients') || ''
        const recipients = []
        rawRecipients.split(',').forEach((em) => {
          const clean = em.trim().toLowerCase()
          if (clean && !recipients.includes(clean)) {
            recipients.push(clean)
          }
        })
        costCentersMap[cc.id] = {
          name: cc.getString('name') || 'Não informado',
          recipients: recipients,
        }
      }
    } catch (_) {}

    // 5. Load active collaborators
    // We only evaluate collaborators who are active in experience
    // (situation == 'Em experiência' and NOT 'Desligado', 'Inativo', 'Efetivado')
    const collaborators = []
    try {
      const list = $app.findRecordsByFilter(
        'collaborators',
        "situation = 'Em experiência'",
        '',
        5000,
        0,
      )
      for (const c of list) {
        collaborators.push(c)
      }
    } catch (collabErr) {
      console.error('[daily_deadline_check] Erro ao carregar colaboradores: ' + collabErr)
    }

    // 6. Preload completed evaluations map { `${collabId}_45 dias`: true, `${collabId}_90 dias`: true }
    const completedEvals = {}
    try {
      const evalsList = $app.findRecordsByFilter('evaluations', '', '', 10000, 0)
      for (const ev of evalsList) {
        const cId = ev.getString('collaborator')
        const stg = ev.getString('stage')
        if (cId && stg) {
          completedEvals[`${cId}_${stg}`] = true
        }
      }
    } catch (evalsErr) {
      console.warn('[daily_deadline_check] Erro ao carregar avaliações existentes: ' + evalsErr)
    }

    // Counters for auditing
    let totalChecked = collaborators.length
    let totalEvaluatedAlerts = 0
    let totalNotificationsCreated = 0
    let totalSkippedDuplicated = 0
    let totalErrors = 0

    const notifsCol = $app.findCollectionByNameOrId('notifications')

    // Helper: format ISO date to DD/MM/AAAA
    const formatBR = (isoStr) => {
      if (!isoStr) return ''
      const clean = isoStr.split(' ')[0].split('T')[0]
      const p = clean.split('-')
      if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`
      return isoStr
    }

    // 7. Process each collaborator for 45 and 90 days
    for (const collab of collaborators) {
      const collabId = collab.id
      const collabName = collab.getString('name') || 'Sem Nome'
      const collabRole = collab.getString('role') || 'Não informada'
      const costCenterId = collab.getString('cost_center')
      const sectorId = collab.getString('sector')
      const ccInfo = costCentersMap[costCenterId] || { name: 'Não informado', recipients: [] }
      const costCenterName = ccInfo.name

      // Check stages: 45 dias and 90 dias
      const stagesToCheck = [
        { stage: '45 dias', deadlineRaw: collab.getString('deadline_45') },
        { stage: '90 dias', deadlineRaw: collab.getString('deadline_90') },
      ]

      for (const check of stagesToCheck) {
        const stage = check.stage
        const deadlineRaw = check.deadlineRaw

        // Skip if evaluation is already completed for this stage
        if (completedEvals[`${collabId}_${stage}`]) {
          continue
        }

        // If no deadline set, skip
        if (!deadlineRaw) {
          continue
        }

        const deadlineIso = deadlineRaw.split(' ')[0].split('T')[0]
        if (!deadlineIso.includes('-')) {
          continue
        }

        // Check cutoff date if configured
        if (cutoffDateIso && deadlineIso < cutoffDateIso) {
          continue
        }

        const [dY, dM, dD] = deadlineIso.split('-').map(Number)
        if (isNaN(dY) || isNaN(dM) || isNaN(dD)) {
          continue
        }

        const targetUtc = Date.UTC(dY, dM - 1, dD)
        const diffDays = Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24))

        // Determine situation
        let situationType = null
        let situationLabel = ''
        let subjectSituation = ''
        let eventName = 'approaching_deadline'

        if (diffDays < 0) {
          // Overdue
          situationType = 'overdue'
          eventName = 'overdue'
          const overdueDays = Math.abs(diffDays)
          situationLabel = `ATRASADA há ${overdueDays} dia(s) (prazo limite: ${formatBR(deadlineIso)})`
          subjectSituation = `ATRASADA há ${overdueDays} dia(s)`
        } else if (diffDays === 0) {
          // Due today
          situationType = 'today'
          eventName = 'approaching_deadline'
          situationLabel = `VENCE HOJE (${formatBR(deadlineIso)})`
          subjectSituation = 'VENCE HOJE'
        } else if (diffDays <= advanceDays) {
          // Upcoming within advanceDays window
          situationType = 'upcoming'
          eventName = 'approaching_deadline'
          situationLabel = `vence em ${diffDays} dia(s) em ${formatBR(deadlineIso)}`
          subjectSituation = `vence em ${diffDays} dia(s)`
        } else {
          // Far in the future beyond advanceDays
          continue
        }

        totalEvaluatedAlerts++

        // Build recipient email set for this specific collaborator
        const recipientEmails = new Set()

        // 1. ADMIN and HR receive everything
        for (const u of activeUsers) {
          if (u.profile === 'ADMIN' || u.profile === 'HR') {
            recipientEmails.add(u.email)
          } else if (
            u.profile === 'MANAGER_WORKSITE' &&
            u.cost_center &&
            u.cost_center === costCenterId
          ) {
            recipientEmails.add(u.email)
          } else if (u.profile === 'MANAGER_DEPARTMENT' && u.sector && u.sector === sectorId) {
            recipientEmails.add(u.email)
          }
        }

        // 2. Cost center email_recipients (if configured)
        for (const em of ccInfo.recipients) {
          recipientEmails.add(em)
        }

        // 3. General settings recipients
        for (const em of generalEmails) {
          recipientEmails.add(em)
        }

        if (recipientEmails.size === 0) {
          continue
        }

        // Email Subject and Body (PT-BR, NO CPF)
        const subject = `[Avaliação de Experiência] Prazo de ${stage}: ${collabName} — ${subjectSituation}`
        const body = `Prezados,\n\nIdentificamos a seguinte situação de prazo de avaliação de experiência:\n\n• Colaborador: ${collabName}\n• Função: ${collabRole}\n• Centro de Custo: ${costCenterName}\n• Etapa: ${stage}\n• Prazo de Avaliação: ${formatBR(deadlineIso)}\n• Situação: ${situationLabel}\n\nAcesse o sistema para registrar a avaliação ou acompanhar o processo.\n\nAvaliação de Experiência`

        // Deduplication and notification creation
        // Dedupe key semantics:
        // - For overdue: once per day per collaborator + stage + recipient -> `dl_${collabId}_${stage}_overdue_${nowIso}_${email}`
        // - For today: once per day per collaborator + stage + recipient -> `dl_${collabId}_${stage}_today_${nowIso}_${email}`
        // - For upcoming: once per remaining days interval -> `dl_${collabId}_${stage}_up_${diffDays}d_${deadlineIso}_${email}`
        for (const email of recipientEmails) {
          let dedupeKey = ''
          if (situationType === 'overdue') {
            dedupeKey = `dl_${collabId}_${stage.replace(' ', '')}_overdue_${nowIso}_${email}`
          } else if (situationType === 'today') {
            dedupeKey = `dl_${collabId}_${stage.replace(' ', '')}_today_${nowIso}_${email}`
          } else {
            dedupeKey = `dl_${collabId}_${stage.replace(' ', '')}_up${diffDays}d_${deadlineIso}_${email}`
          }

          // Anti-duplication check: check if notification already exists
          try {
            const existingNotif = $app.findFirstRecordByData(
              'notifications',
              'dedupe_key',
              dedupeKey,
            )
            if (existingNotif) {
              totalSkippedDuplicated++
              continue
            }
          } catch (_) {
            // Not found => proceed to create
          }

          try {
            const notif = new Record(notifsCol)
            notif.set('event', eventName)
            notif.set('recipient', email)
            notif.set('subject', subject)
            notif.set('body', body)
            notif.set('status', 'Pendente')
            notif.set('attempts', 0)
            notif.set('dedupe_key', dedupeKey)
            $app.save(notif)
            totalNotificationsCreated++
          } catch (notifSaveErr) {
            totalErrors++
            console.warn(
              `[daily_deadline_check] Falha ao criar notificação (${email}): ` + notifSaveErr,
            )
          }
        }
      }
    }

    // 8. Register summary in audit_logs
    try {
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const audit = new Record(auditCol)
      audit.set('entity_type', 'system')
      audit.set('entity_id', 'daily_deadline_check')
      audit.set('action', 'CRON_DEADLINE_CHECK')
      audit.set(
        'summary',
        `Rotina diária de verificação de prazos (45/90 dias) concluída com sucesso em ${nowIso}. ` +
          `Colaboradores verificados: ${totalChecked}, Alertas identificados: ${totalEvaluatedAlerts}, ` +
          `Notificações geradas: ${totalNotificationsCreated}, Puladas por duplicidade: ${totalSkippedDuplicated}, Erros: ${totalErrors}.`,
      )
      $app.save(audit)
    } catch (auditErr) {
      console.warn('[daily_deadline_check] Erro ao registrar log de auditoria: ' + auditErr)
    }

    console.log(
      `[daily_deadline_check] Concluída: ${totalNotificationsCreated} notificações criadas, ${totalSkippedDuplicated} duplicadas puladas.`,
    )
  } catch (globalErr) {
    console.error('[daily_deadline_check] Erro fatal durante a rotina diária: ' + globalErr)
  }
})

// Administrative router endpoint for manual trigger / verification
// POST /backend/v1/admin/run-deadline-check
routerAdd(
  'POST',
  '/backend/v1/admin/run-deadline-check',
  (e) => {
    // 1. Authorization: user must be authenticated with ADMIN or HR profile
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Usuário não autenticado.' })
    }

    const profile = authRecord.getString('profile')
    if (profile !== 'ADMIN' && profile !== 'HR') {
      return e.json(403, {
        error:
          'Acesso negado: apenas Administradores e Gestão de Pessoas podem disparar a verificação de prazos.',
      })
    }

    const bodyData = e.requestInfo().body || {}
    const isDryRun = Boolean(bodyData.dry_run)

    try {
      const now = new Date()
      const nowIso = now.toISOString().split('T')[0]
      const [nowY, nowM, nowD] = nowIso.split('-').map(Number)
      const todayUtc = Date.UTC(nowY, nowM - 1, nowD)

      let advanceDays = 5
      try {
        const advRecord = $app.findFirstRecordByData('settings', 'key', 'notification_advance_days')
        const val = parseInt(advRecord.getString('value'), 10)
        if (!isNaN(val) && val > 0) advanceDays = val
      } catch (_) {}

      let cutoffDateIso = ''
      try {
        const cutoffRec = $app.findFirstRecordByData('settings', 'key', 'alert_cutoff_date')
        const val = cutoffRec.getString('value').trim()
        if (val && val.includes('-')) {
          cutoffDateIso = val.split(' ')[0].split('T')[0]
        }
      } catch (_) {}

      const generalEmails = []
      try {
        const genRec = $app.findFirstRecordByData('settings', 'key', 'general_recipients')
        const val = genRec.getString('value')
        if (val) {
          val.split(',').forEach((em) => {
            const clean = em.trim().toLowerCase()
            if (clean && !generalEmails.includes(clean)) generalEmails.push(clean)
          })
        }
      } catch (_) {}

      const activeUsers = []
      try {
        const usersList = $app.findRecordsByFilter(
          '_pb_users_auth_',
          'active = true && verified = true',
          '',
          1000,
          0,
        )
        const allowedProfiles = ['ADMIN', 'HR', 'MANAGER_WORKSITE', 'MANAGER_DEPARTMENT']
        for (const u of usersList) {
          const prof = u.getString('profile')
          const email = u.getString('email').trim().toLowerCase()
          if (email && allowedProfiles.includes(prof)) {
            activeUsers.push({
              id: u.id,
              email: email,
              profile: prof,
              cost_center: u.getString('cost_center'),
              sector: u.getString('sector'),
            })
          }
        }
      } catch (usersErr) {
        console.warn('[run-deadline-check] Erro ao carregar usuários: ' + usersErr)
      }

      const costCentersMap = {}
      try {
        const ccList = $app.findRecordsByFilter('cost_centers', '', '', 500, 0)
        for (const cc of ccList) {
          const rawRecipients = cc.getString('email_recipients') || ''
          const recipients = []
          rawRecipients.split(',').forEach((em) => {
            const clean = em.trim().toLowerCase()
            if (clean && !recipients.includes(clean)) recipients.push(clean)
          })
          costCentersMap[cc.id] = {
            name: cc.getString('name') || 'Não informado',
            recipients: recipients,
          }
        }
      } catch (_) {}

      const collaborators = []
      try {
        const list = $app.findRecordsByFilter(
          'collaborators',
          "situation = 'Em experiência'",
          '',
          5000,
          0,
        )
        for (const c of list) {
          collaborators.push(c)
        }
      } catch (collabErr) {
        console.error('[run-deadline-check] Erro ao carregar colaboradores: ' + collabErr)
      }

      const completedEvals = {}
      try {
        const evalsList = $app.findRecordsByFilter('evaluations', '', '', 10000, 0)
        for (const ev of evalsList) {
          const cId = ev.getString('collaborator')
          const stg = ev.getString('stage')
          if (cId && stg) completedEvals[`${cId}_${stg}`] = true
        }
      } catch (_) {}

      let totalChecked = collaborators.length
      let totalEvaluatedAlerts = 0
      let totalNotificationsCreated = 0
      let totalSkippedDuplicated = 0
      let totalErrors = 0
      const alertsSummary = []

      const notifsCol = $app.findCollectionByNameOrId('notifications')

      const formatBR = (isoStr) => {
        if (!isoStr) return ''
        const clean = isoStr.split(' ')[0].split('T')[0]
        const p = clean.split('-')
        if (p.length === 3) return `${p[2]}/${p[1]}/${p[0]}`
        return isoStr
      }

      for (const collab of collaborators) {
        const collabId = collab.id
        const collabName = collab.getString('name') || 'Sem Nome'
        const collabRole = collab.getString('role') || 'Não informada'
        const costCenterId = collab.getString('cost_center')
        const sectorId = collab.getString('sector')
        const ccInfo = costCentersMap[costCenterId] || { name: 'Não informado', recipients: [] }
        const costCenterName = ccInfo.name

        const stagesToCheck = [
          { stage: '45 dias', deadlineRaw: collab.getString('deadline_45') },
          { stage: '90 dias', deadlineRaw: collab.getString('deadline_90') },
        ]

        for (const check of stagesToCheck) {
          const stage = check.stage
          const deadlineRaw = check.deadlineRaw

          if (completedEvals[`${collabId}_${stage}`]) continue
          if (!deadlineRaw) continue

          const deadlineIso = deadlineRaw.split(' ')[0].split('T')[0]
          if (!deadlineIso.includes('-')) continue
          if (cutoffDateIso && deadlineIso < cutoffDateIso) continue

          const [dY, dM, dD] = deadlineIso.split('-').map(Number)
          if (isNaN(dY) || isNaN(dM) || isNaN(dD)) continue

          const targetUtc = Date.UTC(dY, dM - 1, dD)
          const diffDays = Math.round((targetUtc - todayUtc) / (1000 * 60 * 60 * 24))

          let situationType = null
          let situationLabel = ''
          let subjectSituation = ''
          let eventName = 'approaching_deadline'

          if (diffDays < 0) {
            situationType = 'overdue'
            eventName = 'overdue'
            const overdueDays = Math.abs(diffDays)
            situationLabel = `ATRASADA há ${overdueDays} dia(s) (prazo limite: ${formatBR(deadlineIso)})`
            subjectSituation = `ATRASADA há ${overdueDays} dia(s)`
          } else if (diffDays === 0) {
            situationType = 'today'
            eventName = 'approaching_deadline'
            situationLabel = `VENCE HOJE (${formatBR(deadlineIso)})`
            subjectSituation = 'VENCE HOJE'
          } else if (diffDays <= advanceDays) {
            situationType = 'upcoming'
            eventName = 'approaching_deadline'
            situationLabel = `vence em ${diffDays} dia(s) em ${formatBR(deadlineIso)}`
            subjectSituation = `vence em ${diffDays} dia(s)`
          } else {
            continue
          }

          totalEvaluatedAlerts++

          const recipientEmails = new Set()
          for (const u of activeUsers) {
            if (u.profile === 'ADMIN' || u.profile === 'HR') {
              recipientEmails.add(u.email)
            } else if (
              u.profile === 'MANAGER_WORKSITE' &&
              u.cost_center &&
              u.cost_center === costCenterId
            ) {
              recipientEmails.add(u.email)
            } else if (u.profile === 'MANAGER_DEPARTMENT' && u.sector && u.sector === sectorId) {
              recipientEmails.add(u.email)
            }
          }
          for (const em of ccInfo.recipients) recipientEmails.add(em)
          for (const em of generalEmails) recipientEmails.add(em)

          if (recipientEmails.size === 0) continue

          const subject = `[Avaliação de Experiência] Prazo de ${stage}: ${collabName} — ${subjectSituation}`
          const body = `Prezados,\n\nIdentificamos a seguinte situação de prazo de avaliação de experiência:\n\n• Colaborador: ${collabName}\n• Função: ${collabRole}\n• Centro de Custo: ${costCenterName}\n• Etapa: ${stage}\n• Prazo de Avaliação: ${formatBR(deadlineIso)}\n• Situação: ${situationLabel}\n\nAcesse o sistema para registrar a avaliação ou acompanhar o processo.\n\nAvaliação de Experiência`

          if (alertsSummary.length < 20) {
            alertsSummary.push({
              collaborator: collabName,
              stage: stage,
              deadline: formatBR(deadlineIso),
              situation: situationLabel,
              recipientsCount: recipientEmails.size,
            })
          }

          for (const email of recipientEmails) {
            let dedupeKey = ''
            if (situationType === 'overdue') {
              dedupeKey = `dl_${collabId}_${stage.replace(' ', '')}_overdue_${nowIso}_${email}`
            } else if (situationType === 'today') {
              dedupeKey = `dl_${collabId}_${stage.replace(' ', '')}_today_${nowIso}_${email}`
            } else {
              dedupeKey = `dl_${collabId}_${stage.replace(' ', '')}_up${diffDays}d_${deadlineIso}_${email}`
            }

            try {
              const existingNotif = $app.findFirstRecordByData(
                'notifications',
                'dedupe_key',
                dedupeKey,
              )
              if (existingNotif) {
                totalSkippedDuplicated++
                continue
              }
            } catch (_) {}

            if (isDryRun) {
              totalNotificationsCreated++
            } else {
              try {
                const notif = new Record(notifsCol)
                notif.set('event', eventName)
                notif.set('recipient', email)
                notif.set('subject', subject)
                notif.set('body', body)
                notif.set('status', 'Pendente')
                notif.set('attempts', 0)
                notif.set('dedupe_key', dedupeKey)
                $app.save(notif)
                totalNotificationsCreated++
              } catch (notifSaveErr) {
                totalErrors++
                console.warn('[run-deadline-check] Falha ao criar notificação: ' + notifSaveErr)
              }
            }
          }
        }
      }

      // Record audit log if not a simulation
      if (!isDryRun) {
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const audit = new Record(auditCol)
          audit.set('user', authRecord.id)
          audit.set('entity_type', 'system')
          audit.set('entity_id', 'daily_deadline_check_manual')
          audit.set('action', 'CRON_DEADLINE_CHECK_MANUAL')
          audit.set(
            'summary',
            `Execução manual da rotina de verificação de prazos realizada por ${authRecord.getString('name') || authRecord.getString('email')}. ` +
              `Colaboradores verificados: ${totalChecked}, Alertas: ${totalEvaluatedAlerts}, Notificações criadas: ${totalNotificationsCreated}, Duplicadas: ${totalSkippedDuplicated}, Erros: ${totalErrors}.`,
          )
          $app.save(audit)
        } catch (_) {}
      }

      return e.json(200, {
        success: true,
        dry_run: isDryRun,
        message: isDryRun
          ? 'Simulação da verificação de prazos concluída com sucesso.'
          : 'Verificação de prazos executada com sucesso.',
        stats: {
          totalChecked: totalChecked,
          totalEvaluatedAlerts: totalEvaluatedAlerts,
          totalNotificationsCreated: totalNotificationsCreated,
          totalSkippedDuplicated: totalSkippedDuplicated,
          totalErrors: totalErrors,
        },
        sampleAlerts: alertsSummary,
      })
    } catch (err) {
      console.error('[run-deadline-check] Erro ao executar: ' + err)
      return e.json(500, { error: 'Erro ao executar verificação de prazos: ' + err })
    }
  },
  $apis.requireAuth(),
)

// ------------------------------------------------------------------------------------------------
// ROTINA DIÁRIA AGENDADA: SUSPENSÃO E NOTIFICAÇÃO DE VENCIMENTO DE CLIENTES
// Executa diariamente às 05:00 UTC (02:00 horário de Brasília)
// ------------------------------------------------------------------------------------------------
cronAdd('daily_client_suspension_check', '0 5 * * *', () => {
  try {
    const getClientFrontendUrl = () => {
      let appUrl = 'https://avaliacao-de-experiencia-67c4f.goskip.app'
      try {
        const envUrl = $os.getenv('SITE_URL')
        if (envUrl && envUrl.trim()) {
          appUrl = envUrl.trim()
        } else {
          const appUrlSetting = $app.findFirstRecordByData('settings', 'key', 'app_url')
          const val = appUrlSetting.getString('value')
          if (val && val.trim()) appUrl = val.trim()
        }
      } catch (_) {}
      if (appUrl.endsWith('/')) appUrl = appUrl.slice(0, -1)
      return appUrl
    }

    const getCheckoutUrlForPlan = (plan) => {
      let fallback = 'https://buy.stripe.com/14AdRa2IK9FJ42gfqb3Nm00'
      try {
        if (String(plan || '').toUpperCase() === 'ANUAL') {
          const setting = $app.findFirstRecordByData(
            'settings',
            'key',
            'stripe_annual_payment_link',
          )
          const val = setting.getString('value')
          if (val && val.trim()) return val.trim()
          return 'https://buy.stripe.com/aFa7sMgzAf0342ga5R3Nm02'
        } else {
          const setting = $app.findFirstRecordByData(
            'settings',
            'key',
            'stripe_monthly_payment_link',
          )
          const val = setting.getString('value')
          if (val && val.trim()) return val.trim()
        }
      } catch (_) {}
      return fallback
    }

    const formatIsoDateToBR = (isoStr) => {
      if (!isoStr) return ''
      const clean = isoStr.split(' ')[0].split('T')[0]
      const [y, m, d] = clean.split('-')
      if (!y || !m || !d) return clean
      return `${d}/${m}/${y}`
    }

    const sendRawEmail = (to, subject, textBody, htmlBody) => {
      const message = new MailerMessage({
        from: {
          address: 'valdknupp@gmail.com',
          name: $app.settings().meta.senderName || 'Avaliação de Experiência',
        },
        to: [{ address: to }],
        subject: subject,
        text: textBody,
        html: htmlBody,
      })
      $app.newMailClient().send(message)
    }

    const recordClientEmailLogAndAudit = (
      client,
      type,
      recipient,
      subject,
      paidUntilIso,
      plan,
      dedupeKey,
      status,
      errorMsg,
    ) => {
      try {
        const logsCol = $app.findCollectionByNameOrId('client_email_logs')
        const logRec = new Record(logsCol)
        logRec.set('client', client.id)
        logRec.set('recipient', recipient)
        logRec.set('type', type)
        logRec.set('subject', subject)
        logRec.set('paid_until', paidUntilIso)
        logRec.set('plan', plan)
        logRec.set('dedupe_key', dedupeKey)
        logRec.set('status', status)
        if (errorMsg) logRec.set('error_message', String(errorMsg).slice(0, 500))
        logRec.set('sent_at', new DateTime())
        $app.save(logRec)
      } catch (_) {}

      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const audit = new Record(auditCol)
        audit.set('entity_type', 'clients')
        audit.set('entity_id', client.id)
        audit.set('action', 'CLIENT_EMAIL_NOTIFICATION')
        audit.set(
          'summary',
          `E-mail de notificação (${type}) enviado para ${recipient}. Assunto: "${subject}". Status: ${status}. Vencimento: ${paidUntilIso}.`,
        )
        $app.save(audit)
      } catch (_) {}
    }

    const parseNotifiedMilestones = (client) => {
      try {
        const raw = client.getString('notified_milestones')
        if (!raw || raw === 'null' || raw === '""') return {}
        const parsed = JSON.parse(raw)
        return typeof parsed === 'object' && parsed !== null ? parsed : {}
      } catch (_) {
        return {}
      }
    }

    const saveNotifiedMilestones = (client, milestonesObj) => {
      try {
        client.set('notified_milestones', JSON.stringify(milestonesObj))
        $app.save(client)
      } catch (_) {}
    }

    const now = new Date()
    const nowIso = now.toISOString().split('T')[0]
    const [nY, nM, nD] = nowIso.split('-').map(Number)
    const todayUtc = Date.UTC(nY, nM - 1, nD)

    const clients = $app.findRecordsByFilter('clients', "status != 'blocked_manually'", '', 1000, 0)
    let totalChecked = 0
    let totalSuspended = 0
    let totalNoticesSent = 0

    for (let i = 0; i < clients.length; i++) {
      const client = clients[i]
      const clientEmail = client.getString('email').trim().toLowerCase()
      if (clientEmail === 'valdknupp@gmail.com') continue

      const paidUntilRaw = client.getString('paid_until')
      if (!paidUntilRaw) continue

      const paidUntilIso = paidUntilRaw.split(' ')[0].split('T')[0]
      const [pY, pM, pD] = paidUntilIso.split('-').map(Number)
      if (isNaN(pY) || isNaN(pM) || isNaN(pD)) continue

      totalChecked++
      const paidUntilUtc = Date.UTC(pY, pM - 1, pD)
      const diffDaysFromDue = Math.round((todayUtc - paidUntilUtc) / (1000 * 60 * 60 * 24))
      const daysUntilDue = Math.round((paidUntilUtc - todayUtc) / (1000 * 60 * 60 * 24))

      const currentStatus =
        client.getString('status') || (client.getBool('active') ? 'active' : 'suspended_overdue')
      const milestones = parseNotifiedMilestones(client)
      let milestonesChanged = false

      // 1. Avisos prévios de vencimento (7, 3 ou 1 dia antes)
      if (currentStatus === 'active') {
        const milestoneKey =
          daysUntilDue === 7
            ? 'expiring_7d'
            : daysUntilDue === 3
              ? 'expiring_3d'
              : daysUntilDue === 1
                ? 'expiring_1d'
                : null

        if (milestoneKey) {
          const dedupeKey = `${client.id}:${milestoneKey}:${paidUntilIso}`
          const alreadyNotified = !!milestones[milestoneKey + '_' + paidUntilIso]

          if (!alreadyNotified) {
            const clientName = client.getString('name') || 'Cliente'
            const plan = client.getString('plan') || 'MENSAL'
            const planLabel = plan === 'ANUAL' ? 'Anual' : plan === 'MENSAL' ? 'Mensal' : plan
            const paidUntilBR = formatIsoDateToBR(paidUntilIso)
            const checkoutUrl = getCheckoutUrlForPlan(plan)
            const appUrl = getClientFrontendUrl()
            const dayWord = daysUntilDue === 1 ? '1 dia' : `${daysUntilDue} dias`
            const subject = `Aviso de Vencimento: Seu plano ${planLabel} vence em ${dayWord} (${paidUntilBR})`

            const textBody = [
              `Olá, ${clientName}!`,
              '',
              `Este é um lembrete de que o seu plano ${planLabel} do sistema Avaliação de Experiência vencerá em ${dayWord}, na data ${paidUntilBR}.`,
              '',
              `Para manter o acesso da sua equipe ativo e sem interrupções, você pode renovar sua assinatura através do link oficial de pagamento:`,
              checkoutUrl,
              '',
              `Caso precise de suporte:`,
              `WhatsApp: (82) 99106-9350`,
              `E-mail: valdknupp@gmail.com`,
              '',
              `Acesse o sistema: ${appUrl}`,
            ].join('\n')

            const htmlBody = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E8E8E8; border-radius: 8px; background-color: #FFFFFF;">
                <div style="background-color: #111111; padding: 18px 20px; border-radius: 6px; text-align: center; margin-bottom: 24px;">
                  <h2 style="color: #54D769; margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">Avaliação de Experiência</h2>
                  <p style="color: #FFFFFF; margin: 6px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Aviso de Vencimento do Plano</p>
                </div>
                <div style="color: #333333; line-height: 1.6; font-size: 15px; margin-bottom: 24px;">
                  <p>Olá, <strong>${clientName}</strong>!</p>
                  <p>Este é um aviso amigável de que a assinatura do seu plano <strong>${planLabel}</strong> no sistema <strong>Avaliação de Experiência</strong> vencerá em <strong>${dayWord}</strong> (em <strong>${paidUntilBR}</strong>).</p>
                  <div style="background-color: #F8F9FA; border-left: 4px solid #54D769; padding: 14px 16px; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; font-size: 14px; color: #111111;">
                      <strong>Data de Vencimento:</strong> ${paidUntilBR}<br>
                      <strong>Plano Atual:</strong> ${planLabel}<br>
                      <strong>E-mail Cadastrado:</strong> ${clientEmail}
                    </p>
                  </div>
                  <p>Para garantir a continuidade das avaliações e o acesso de todos os gestores da sua equipe sem interrupções, clique no botão abaixo para renovar sua assinatura com segurança:</p>
                </div>
                <div style="text-align: center; margin: 28px 0;">
                  <a href="${checkoutUrl}" style="background-color: #54D769; color: #111111; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1); min-width: 200px;">
                    Renovar Plano Agora
                  </a>
                </div>
                <div style="margin-top: 24px; padding: 16px; background-color: #F9FAFB; border-radius: 6px; font-size: 13px; color: #555555; line-height: 1.5;">
                  <strong>Dúvidas ou suporte?</strong><br>
                  WhatsApp: <strong>(82) 99106-9350</strong><br>
                  E-mail: <a href="mailto:valdknupp@gmail.com" style="color: #111111; text-decoration: underline;">valdknupp@gmail.com</a>
                </div>
                <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #E8E8E8; font-size: 12px; color: #777777; text-align: center; line-height: 1.5;">
                  Este é um e-mail automático gerado pelo sistema Avaliação de Experiência.<br>
                  Acesso ao sistema: <a href="${appUrl}" style="color: #111111; text-decoration: underline;">${appUrl}</a>
                </div>
              </div>
            `

            try {
              sendRawEmail(clientEmail, subject, textBody, htmlBody)
              recordClientEmailLogAndAudit(
                client,
                milestoneKey,
                clientEmail,
                subject,
                paidUntilIso,
                plan,
                dedupeKey,
                'Enviado',
                null,
              )
              milestones[milestoneKey + '_' + paidUntilIso] = new Date().toISOString()
              milestonesChanged = true
              totalNoticesSent++
            } catch (err) {
              recordClientEmailLogAndAudit(
                client,
                milestoneKey,
                clientEmail,
                subject,
                paidUntilIso,
                plan,
                dedupeKey,
                'Falha',
                err,
              )
            }
          }
        }
      }

      // 2. Suspensão por vencimento (diffDaysFromDue > 1)
      if (diffDaysFromDue > 1 && currentStatus !== 'suspended_overdue') {
        client.set('active', false)
        client.set('status', 'suspended_overdue')
        $app.save(client)
        totalSuspended++

        try {
          const clientUsers = $app.findRecordsByFilter(
            '_pb_users_auth_',
            `client = '${client.id}'`,
            '',
            500,
            0,
          )
          for (let u = 0; u < clientUsers.length; u++) {
            const usr = clientUsers[u]
            if (usr.getString('email').toLowerCase() !== 'valdknupp@gmail.com') {
              usr.set('active', false)
              $app.save(usr)
            }
          }
        } catch (_) {}

        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const audit = new Record(auditCol)
          audit.set('entity_type', 'clients')
          audit.set('entity_id', client.id)
          audit.set('action', 'CLIENT_AUTO_SUSPENDED')
          audit.set(
            'summary',
            `Acesso do cliente ${client.getString('name')} (${clientEmail}) foi SUSPENSO automaticamente por vencimento do plano (vencido há ${diffDaysFromDue} dias, em ${paidUntilIso}).`,
          )
          $app.save(audit)
        } catch (_) {}

        const suspensionDedupeKey = `${client.id}:suspended_overdue:${paidUntilIso}`
        const suspensionAlreadySent = !!milestones['suspended_' + paidUntilIso]

        if (!suspensionAlreadySent) {
          const clientName = client.getString('name') || 'Cliente'
          const plan = client.getString('plan') || 'MENSAL'
          const planLabel = plan === 'ANUAL' ? 'Anual' : plan === 'MENSAL' ? 'Mensal' : plan
          const paidUntilBR = formatIsoDateToBR(paidUntilIso)
          const checkoutUrl = getCheckoutUrlForPlan(plan)
          const appUrl = getClientFrontendUrl()
          const subject = `Acesso Suspenso por Vencimento: Regularize seu plano ${planLabel}`

          const textBody = [
            `Olá, ${clientName}!`,
            '',
            `Informamos que o acesso da sua conta no sistema Avaliação de Experiência foi temporariamente suspenso devido ao vencimento do plano ${planLabel} (vencido em ${paidUntilBR}, há ${diffDaysFromDue} dia(s)).`,
            '',
            `Fique tranquilo: TODOS OS SEUS DADOS, colaboradores, avaliações e relatórios ESTÃO PRESERVADOS com total segurança.`,
            '',
            `Para reativar o acesso imediatamente, renove sua assinatura pelo link de pagamento:`,
            checkoutUrl,
            '',
            `Ou entre em contato diretamente para regularização:`,
            `WhatsApp: (82) 99106-9350`,
            `E-mail: valdknupp@gmail.com`,
            '',
            `Acesse o sistema: ${appUrl}`,
          ].join('\n')

          const htmlBody = `
            <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E8E8E8; border-radius: 8px; background-color: #FFFFFF;">
              <div style="background-color: #111111; padding: 18px 20px; border-radius: 6px; text-align: center; margin-bottom: 24px;">
                <h2 style="color: #FFB020; margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">Avaliação de Experiência</h2>
                <p style="color: #FFFFFF; margin: 6px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Acesso Suspenso por Vencimento</p>
              </div>
              <div style="color: #333333; line-height: 1.6; font-size: 15px; margin-bottom: 24px;">
                <p>Olá, <strong>${clientName}</strong>!</p>
                <p>Informamos que o acesso da sua conta e da sua equipe ao sistema <strong>Avaliação de Experiência</strong> foi temporariamente suspenso devido ao vencimento do plano <strong>${planLabel}</strong> ocorrido em <strong>${paidUntilBR}</strong>.</p>
                <div style="background-color: #FFF8E6; border-left: 4px solid #FFB020; padding: 14px 16px; margin: 20px 0; border-radius: 4px;">
                  <p style="margin: 0; font-size: 14px; color: #8A5B00;">
                    <strong>Seus dados estão 100% preservados!</strong><br>
                    Nenhum colaborador, avaliação ou histórico foi excluído. Assim que o pagamento for confirmado, o acesso é reativado na hora.
                  </p>
                </div>
                <p>Você pode regularizar o pagamento agora mesmo pelo link abaixo ou pelos canais de atendimento:</p>
              </div>
              <div style="text-align: center; margin: 28px 0;">
                <a href="${checkoutUrl}" style="background-color: #54D769; color: #111111; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1); min-width: 200px;">
                  Regularizar / Renovar Acesso
                </a>
              </div>
              <div style="margin-top: 24px; padding: 16px; background-color: #F9FAFB; border-radius: 6px; font-size: 13px; color: #333333; line-height: 1.6;">
                <strong>Canais de Contato para Regularização:</strong><br>
                WhatsApp: <strong>(82) 99106-9350</strong><br>
                E-mail: <a href="mailto:valdknupp@gmail.com" style="color: #111111; text-decoration: underline;">valdknupp@gmail.com</a>
              </div>
              <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #E8E8E8; font-size: 12px; color: #777777; text-align: center; line-height: 1.5;">
                Este é um e-mail automático gerado pelo sistema Avaliação de Experiência.<br>
                Acesso ao sistema: <a href="${appUrl}" style="color: #111111; text-decoration: underline;">${appUrl}</a>
              </div>
            </div>
          `

          try {
            sendRawEmail(clientEmail, subject, textBody, htmlBody)
            recordClientEmailLogAndAudit(
              client,
              'suspended_overdue',
              clientEmail,
              subject,
              paidUntilIso,
              plan,
              suspensionDedupeKey,
              'Enviado',
              null,
            )
            milestones['suspended_' + paidUntilIso] = new Date().toISOString()
            milestonesChanged = true
          } catch (err) {
            recordClientEmailLogAndAudit(
              client,
              'suspended_overdue',
              clientEmail,
              subject,
              paidUntilIso,
              plan,
              suspensionDedupeKey,
              'Falha',
              err,
            )
          }
        }
      }

      if (milestonesChanged) {
        saveNotifiedMilestones(client, milestones)
      }
    }

    console.log(
      `[daily_client_suspension_check] Concluído: ${totalChecked} checados, ${totalSuspended} suspensos, ${totalNoticesSent} avisos de e-mail enviados.`,
    )
  } catch (cronErr) {
    console.error('[daily_client_suspension_check] Erro durante a rotina:', cronErr)
  }
})

// Rota administrativa para o master testar ou forçar a verificação de suspensão e envio de avisos
// POST /backend/v1/admin/run-suspension-check
routerAdd(
  'POST',
  '/backend/v1/admin/run-suspension-check',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Autenticação necessária.' })
    }
    const email = authRecord.getString('email').trim().toLowerCase()
    const profile = authRecord.getString('profile')
    if (profile !== 'ADMIN' || email !== 'valdknupp@gmail.com') {
      return e.json(403, { error: 'Acesso restrito ao administrador master.' })
    }

    try {
      const getClientFrontendUrl = () => {
        let appUrl = 'https://avaliacao-de-experiencia-67c4f.goskip.app'
        try {
          const envUrl = $os.getenv('SITE_URL')
          if (envUrl && envUrl.trim()) {
            appUrl = envUrl.trim()
          } else {
            const appUrlSetting = $app.findFirstRecordByData('settings', 'key', 'app_url')
            const val = appUrlSetting.getString('value')
            if (val && val.trim()) appUrl = val.trim()
          }
        } catch (_) {}
        if (appUrl.endsWith('/')) appUrl = appUrl.slice(0, -1)
        return appUrl
      }

      const getCheckoutUrlForPlan = (plan) => {
        let fallback = 'https://buy.stripe.com/14AdRa2IK9FJ42gfqb3Nm00'
        try {
          if (String(plan || '').toUpperCase() === 'ANUAL') {
            const setting = $app.findFirstRecordByData(
              'settings',
              'key',
              'stripe_annual_payment_link',
            )
            const val = setting.getString('value')
            if (val && val.trim()) return val.trim()
            return 'https://buy.stripe.com/aFa7sMgzAf0342ga5R3Nm02'
          } else {
            const setting = $app.findFirstRecordByData(
              'settings',
              'key',
              'stripe_monthly_payment_link',
            )
            const val = setting.getString('value')
            if (val && val.trim()) return val.trim()
          }
        } catch (_) {}
        return fallback
      }

      const formatIsoDateToBR = (isoStr) => {
        if (!isoStr) return ''
        const clean = isoStr.split(' ')[0].split('T')[0]
        const [y, m, d] = clean.split('-')
        if (!y || !m || !d) return clean
        return `${d}/${m}/${y}`
      }

      const sendRawEmail = (to, subject, textBody, htmlBody) => {
        const message = new MailerMessage({
          from: {
            address: 'valdknupp@gmail.com',
            name: $app.settings().meta.senderName || 'Avaliação de Experiência',
          },
          to: [{ address: to }],
          subject: subject,
          text: textBody,
          html: htmlBody,
        })
        $app.newMailClient().send(message)
      }

      const recordClientEmailLogAndAudit = (
        client,
        type,
        recipient,
        subject,
        paidUntilIso,
        plan,
        dedupeKey,
        status,
        errorMsg,
      ) => {
        try {
          const logsCol = $app.findCollectionByNameOrId('client_email_logs')
          const logRec = new Record(logsCol)
          logRec.set('client', client.id)
          logRec.set('recipient', recipient)
          logRec.set('type', type)
          logRec.set('subject', subject)
          logRec.set('paid_until', paidUntilIso)
          logRec.set('plan', plan)
          logRec.set('dedupe_key', dedupeKey)
          logRec.set('status', status)
          if (errorMsg) logRec.set('error_message', String(errorMsg).slice(0, 500))
          logRec.set('sent_at', new DateTime())
          $app.save(logRec)
        } catch (_) {}

        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const audit = new Record(auditCol)
          audit.set('entity_type', 'clients')
          audit.set('entity_id', client.id)
          audit.set('action', 'CLIENT_EMAIL_NOTIFICATION')
          audit.set(
            'summary',
            `E-mail de notificação (${type}) enviado para ${recipient}. Assunto: "${subject}". Status: ${status}. Vencimento: ${paidUntilIso}.`,
          )
          $app.save(audit)
        } catch (_) {}
      }

      const parseNotifiedMilestones = (client) => {
        try {
          const raw = client.getString('notified_milestones')
          if (!raw || raw === 'null' || raw === '""') return {}
          const parsed = JSON.parse(raw)
          return typeof parsed === 'object' && parsed !== null ? parsed : {}
        } catch (_) {
          return {}
        }
      }

      const saveNotifiedMilestones = (client, milestonesObj) => {
        try {
          client.set('notified_milestones', JSON.stringify(milestonesObj))
          $app.save(client)
        } catch (_) {}
      }

      const now = new Date()
      const nowIso = now.toISOString().split('T')[0]
      const [nY, nM, nD] = nowIso.split('-').map(Number)
      const todayUtc = Date.UTC(nY, nM - 1, nD)

      const clients = $app.findRecordsByFilter(
        'clients',
        "status != 'blocked_manually'",
        '',
        1000,
        0,
      )

      let totalChecked = 0
      let totalSuspended = 0
      let totalNoticesSent = 0
      const suspendedList = []
      const noticesList = []

      for (let i = 0; i < clients.length; i++) {
        const client = clients[i]
        const clientEmail = client.getString('email').trim().toLowerCase()
        if (clientEmail === 'valdknupp@gmail.com') continue

        const paidUntilRaw = client.getString('paid_until')
        if (!paidUntilRaw) continue

        const paidUntilIso = paidUntilRaw.split(' ')[0].split('T')[0]
        const [pY, pM, pD] = paidUntilIso.split('-').map(Number)
        if (isNaN(pY) || isNaN(pM) || isNaN(pD)) continue

        totalChecked++
        const paidUntilUtc = Date.UTC(pY, pM - 1, pD)
        const diffDaysFromDue = Math.round((todayUtc - paidUntilUtc) / (1000 * 60 * 60 * 24))
        const daysUntilDue = Math.round((paidUntilUtc - todayUtc) / (1000 * 60 * 60 * 24))

        const currentStatus =
          client.getString('status') || (client.getBool('active') ? 'active' : 'suspended_overdue')
        const milestones = parseNotifiedMilestones(client)
        let milestonesChanged = false

        // 1. Avisos prévios de vencimento (7, 3 ou 1 dia antes)
        if (currentStatus === 'active') {
          const milestoneKey =
            daysUntilDue === 7
              ? 'expiring_7d'
              : daysUntilDue === 3
                ? 'expiring_3d'
                : daysUntilDue === 1
                  ? 'expiring_1d'
                  : null

          if (milestoneKey) {
            const dedupeKey = `${client.id}:${milestoneKey}:${paidUntilIso}`
            const alreadyNotified = !!milestones[milestoneKey + '_' + paidUntilIso]

            if (!alreadyNotified) {
              const clientName = client.getString('name') || 'Cliente'
              const plan = client.getString('plan') || 'MENSAL'
              const planLabel = plan === 'ANUAL' ? 'Anual' : plan === 'MENSAL' ? 'Mensal' : plan
              const paidUntilBR = formatIsoDateToBR(paidUntilIso)
              const checkoutUrl = getCheckoutUrlForPlan(plan)
              const appUrl = getClientFrontendUrl()
              const dayWord = daysUntilDue === 1 ? '1 dia' : `${daysUntilDue} dias`
              const subject = `Aviso de Vencimento: Seu plano ${planLabel} vence em ${dayWord} (${paidUntilBR})`

              const textBody = [
                `Olá, ${clientName}!`,
                '',
                `Este é um lembrete de que o seu plano ${planLabel} do sistema Avaliação de Experiência vencerá em ${dayWord}, na data ${paidUntilBR}.`,
                '',
                `Para manter o acesso da sua equipe ativo e sem interrupções, você pode renovar sua assinatura através do link oficial de pagamento:`,
                checkoutUrl,
                '',
                `Caso precise de suporte:`,
                `WhatsApp: (82) 99106-9350`,
                `E-mail: valdknupp@gmail.com`,
                '',
                `Acesse o sistema: ${appUrl}`,
              ].join('\n')

              const htmlBody = `
                <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E8E8E8; border-radius: 8px; background-color: #FFFFFF;">
                  <div style="background-color: #111111; padding: 18px 20px; border-radius: 6px; text-align: center; margin-bottom: 24px;">
                    <h2 style="color: #54D769; margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">Avaliação de Experiência</h2>
                    <p style="color: #FFFFFF; margin: 6px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Aviso de Vencimento do Plano</p>
                  </div>
                  <div style="color: #333333; line-height: 1.6; font-size: 15px; margin-bottom: 24px;">
                    <p>Olá, <strong>${clientName}</strong>!</p>
                    <p>Este é um aviso amigável de que a assinatura do seu plano <strong>${planLabel}</strong> no sistema <strong>Avaliação de Experiência</strong> vencerá em <strong>${dayWord}</strong> (em <strong>${paidUntilBR}</strong>).</p>
                    <div style="background-color: #F8F9FA; border-left: 4px solid #54D769; padding: 14px 16px; margin: 20px 0; border-radius: 4px;">
                      <p style="margin: 0; font-size: 14px; color: #111111;">
                        <strong>Data de Vencimento:</strong> ${paidUntilBR}<br>
                        <strong>Plano Atual:</strong> ${planLabel}<br>
                        <strong>E-mail Cadastrado:</strong> ${clientEmail}
                      </p>
                    </div>
                    <p>Para garantir a continuidade das avaliações e o acesso de todos os gestores da sua equipe sem interrupções, clique no botão abaixo para renovar sua assinatura com segurança:</p>
                  </div>
                  <div style="text-align: center; margin: 28px 0;">
                    <a href="${checkoutUrl}" style="background-color: #54D769; color: #111111; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1); min-width: 200px;">
                      Renovar Plano Agora
                    </a>
                  </div>
                  <div style="margin-top: 24px; padding: 16px; background-color: #F9FAFB; border-radius: 6px; font-size: 13px; color: #555555; line-height: 1.5;">
                    <strong>Dúvidas ou suporte?</strong><br>
                    WhatsApp: <strong>(82) 99106-9350</strong><br>
                    E-mail: <a href="mailto:valdknupp@gmail.com" style="color: #111111; text-decoration: underline;">valdknupp@gmail.com</a>
                  </div>
                  <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #E8E8E8; font-size: 12px; color: #777777; text-align: center; line-height: 1.5;">
                    Este é um e-mail automático gerado pelo sistema Avaliação de Experiência.<br>
                    Acesso ao sistema: <a href="${appUrl}" style="color: #111111; text-decoration: underline;">${appUrl}</a>
                  </div>
                </div>
              `

              try {
                sendRawEmail(clientEmail, subject, textBody, htmlBody)
                recordClientEmailLogAndAudit(
                  client,
                  milestoneKey,
                  clientEmail,
                  subject,
                  paidUntilIso,
                  plan,
                  dedupeKey,
                  'Enviado',
                  null,
                )
                milestones[milestoneKey + '_' + paidUntilIso] = new Date().toISOString()
                milestonesChanged = true
                totalNoticesSent++
                noticesList.push({
                  client: client.getString('name'),
                  email: clientEmail,
                  type: milestoneKey,
                  daysRemaining: daysUntilDue,
                  paid_until: paidUntilIso,
                })
              } catch (err) {
                recordClientEmailLogAndAudit(
                  client,
                  milestoneKey,
                  clientEmail,
                  subject,
                  paidUntilIso,
                  plan,
                  dedupeKey,
                  'Falha',
                  err,
                )
              }
            }
          }
        }

        // 2. Suspensão por vencimento (diffDaysFromDue > 1)
        if (diffDaysFromDue > 1 && currentStatus !== 'suspended_overdue') {
          client.set('active', false)
          client.set('status', 'suspended_overdue')
          $app.save(client)
          totalSuspended++

          try {
            const clientUsers = $app.findRecordsByFilter(
              '_pb_users_auth_',
              `client = '${client.id}'`,
              '',
              500,
              0,
            )
            for (let u = 0; u < clientUsers.length; u++) {
              const usr = clientUsers[u]
              if (usr.getString('email').toLowerCase() !== 'valdknupp@gmail.com') {
                usr.set('active', false)
                $app.save(usr)
              }
            }
          } catch (_) {}

          try {
            const auditCol = $app.findCollectionByNameOrId('audit_logs')
            const audit = new Record(auditCol)
            audit.set('entity_type', 'clients')
            audit.set('entity_id', client.id)
            audit.set('action', 'CLIENT_AUTO_SUSPENDED')
            audit.set(
              'summary',
              `Acesso do cliente ${client.getString('name')} (${clientEmail}) foi SUSPENSO automaticamente por vencimento do plano (vencido há ${diffDaysFromDue} dias, em ${paidUntilIso}).`,
            )
            $app.save(audit)
          } catch (_) {}

          suspendedList.push({
            id: client.id,
            name: client.getString('name'),
            email: clientEmail,
            paid_until: paidUntilIso,
            days_overdue: diffDaysFromDue,
          })

          const suspensionDedupeKey = `${client.id}:suspended_overdue:${paidUntilIso}`
          const suspensionAlreadySent = !!milestones['suspended_' + paidUntilIso]

          if (!suspensionAlreadySent) {
            const clientName = client.getString('name') || 'Cliente'
            const plan = client.getString('plan') || 'MENSAL'
            const planLabel = plan === 'ANUAL' ? 'Anual' : plan === 'MENSAL' ? 'Mensal' : plan
            const paidUntilBR = formatIsoDateToBR(paidUntilIso)
            const checkoutUrl = getCheckoutUrlForPlan(plan)
            const appUrl = getClientFrontendUrl()
            const subject = `Acesso Suspenso por Vencimento: Regularize seu plano ${planLabel}`

            const textBody = [
              `Olá, ${clientName}!`,
              '',
              `Informamos que o acesso da sua conta no sistema Avaliação de Experiência foi temporariamente suspenso devido ao vencimento do plano ${planLabel} (vencido em ${paidUntilBR}, há ${diffDaysFromDue} dia(s)).`,
              '',
              `Fique tranquilo: TODOS OS SEUS DADOS, colaboradores, avaliações e relatórios ESTÃO PRESERVADOS com total segurança.`,
              '',
              `Para reativar o acesso imediatamente, renove sua assinatura pelo link de pagamento:`,
              checkoutUrl,
              '',
              `Ou entre em contato diretamente para regularização:`,
              `WhatsApp: (82) 99106-9350`,
              `E-mail: valdknupp@gmail.com`,
              '',
              `Acesse o sistema: ${appUrl}`,
            ].join('\n')

            const htmlBody = `
              <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E8E8E8; border-radius: 8px; background-color: #FFFFFF;">
                <div style="background-color: #111111; padding: 18px 20px; border-radius: 6px; text-align: center; margin-bottom: 24px;">
                  <h2 style="color: #FFB020; margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">Avaliação de Experiência</h2>
                  <p style="color: #FFFFFF; margin: 6px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Acesso Suspenso por Vencimento</p>
                </div>
                <div style="color: #333333; line-height: 1.6; font-size: 15px; margin-bottom: 24px;">
                  <p>Olá, <strong>${clientName}</strong>!</p>
                  <p>Informamos que o acesso da sua conta e da sua equipe ao sistema <strong>Avaliação de Experiência</strong> foi temporariamente suspenso devido ao vencimento do plano <strong>${planLabel}</strong> ocorrido em <strong>${paidUntilBR}</strong>.</p>
                  <div style="background-color: #FFF8E6; border-left: 4px solid #FFB020; padding: 14px 16px; margin: 20px 0; border-radius: 4px;">
                    <p style="margin: 0; font-size: 14px; color: #8A5B00;">
                      <strong>Seus dados estão 100% preservados!</strong><br>
                      Nenhum colaborador, avaliação ou histórico foi excluído. Assim que o pagamento for confirmado, o acesso é reativado na hora.
                    </p>
                  </div>
                  <p>Você pode regularizar o pagamento agora mesmo pelo link abaixo ou pelos canais de atendimento:</p>
                </div>
                <div style="text-align: center; margin: 28px 0;">
                  <a href="${checkoutUrl}" style="background-color: #54D769; color: #111111; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1); min-width: 200px;">
                    Regularizar / Renovar Acesso
                  </a>
                </div>
                <div style="margin-top: 24px; padding: 16px; background-color: #F9FAFB; border-radius: 6px; font-size: 13px; color: #333333; line-height: 1.6;">
                  <strong>Canais de Contato para Regularização:</strong><br>
                  WhatsApp: <strong>(82) 99106-9350</strong><br>
                  E-mail: <a href="mailto:valdknupp@gmail.com" style="color: #111111; text-decoration: underline;">valdknupp@gmail.com</a>
                </div>
                <div style="margin-top: 28px; padding-top: 16px; border-top: 1px solid #E8E8E8; font-size: 12px; color: #777777; text-align: center; line-height: 1.5;">
                  Este é um e-mail automático gerado pelo sistema Avaliação de Experiência.<br>
                  Acesso ao sistema: <a href="${appUrl}" style="color: #111111; text-decoration: underline;">${appUrl}</a>
                </div>
              </div>
            `

            try {
              sendRawEmail(clientEmail, subject, textBody, htmlBody)
              recordClientEmailLogAndAudit(
                client,
                'suspended_overdue',
                clientEmail,
                subject,
                paidUntilIso,
                plan,
                suspensionDedupeKey,
                'Enviado',
                null,
              )
              milestones['suspended_' + paidUntilIso] = new Date().toISOString()
              milestonesChanged = true
            } catch (err) {
              recordClientEmailLogAndAudit(
                client,
                'suspended_overdue',
                clientEmail,
                subject,
                paidUntilIso,
                plan,
                suspensionDedupeKey,
                'Falha',
                err,
              )
            }
          }
        }

        if (milestonesChanged) {
          saveNotifiedMilestones(client, milestones)
        }
      }

      return e.json(200, {
        success: true,
        totalChecked: totalChecked,
        totalSuspended: totalSuspended,
        totalNoticesSent: totalNoticesSent,
        suspendedList: suspendedList,
        noticesList: noticesList,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao executar verificação: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
