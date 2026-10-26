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
