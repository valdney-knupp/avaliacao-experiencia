// Triggered when an evaluation is created: updates collaborator situation, creates audit log, creates notifications
onRecordAfterCreateSuccess((e) => {
  e.next()
  const evalRecord = e.record
  const collabId = evalRecord.getString('collaborator')
  const stage = evalRecord.getString('stage')
  const decision = evalRecord.getString('decision')
  const evaluatorId = evalRecord.getString('evaluator')

  if (!collabId) {
    return
  }

  let collaborator = null
  try {
    collaborator = $app.findRecordById('collaborators', collabId)
  } catch (err) {
    console.error('Colaborador não encontrado para a avaliação: ' + err)
    return
  }

  // Determine new situation
  // EXTEND (45d) -> Em experiência
  // TERMINATE (45d) -> Desligado
  // EFFECTIVATE (90d) -> Efetivado
  // TERMINATE (90d) -> Desligado
  let newSituation = 'Em experiência'
  if (decision === 'EXTEND') {
    newSituation = 'Em experiência'
  } else if (decision === 'TERMINATE') {
    newSituation = 'Desligado'
  } else if (decision === 'EFFECTIVATE') {
    newSituation = 'Efetivado'
  }

  collaborator.set('situation', newSituation)
  try {
    $app.save(collaborator)
  } catch (saveErr) {
    console.error('Erro ao atualizar situação do colaborador: ' + saveErr)
  }

  // 1. Audit log
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const audit = new Record(auditCol)
    if (evaluatorId) {
      audit.set('user', evaluatorId)
    }
    audit.set('entity_type', 'evaluations')
    audit.set('entity_id', evalRecord.id)
    audit.set('action', 'CREATE_EVALUATION')
    audit.set(
      'summary',
      `Avaliação de ${stage} realizada para o colaborador ${collaborator.getString('name')} - Decisão: ${decision} (Situação: ${newSituation})`,
    )
    $app.save(audit)
  } catch (auditErr) {
    console.error('Erro ao registrar auditoria de avaliação: ' + auditErr)
  }

  // 2. Notifications
  try {
    const notifsCol = $app.findCollectionByNameOrId('notifications')

    // Determine recipients isolados por client:
    const recipientsSet = new Set()
    const collabClientId = collaborator.getString('client') || evalRecord.getString('client') || ''

    try {
      // Filtrar apenas usuários ativos do MESMO cliente
      const filterExpr = collabClientId
        ? `active = true && client = '${collabClientId}'`
        : 'active = true'
      const activeUsers = $app.findRecordsByFilter('_pb_users_auth_', filterExpr, '', 1000, 0)
      const allowedProfiles = ['ADMIN', 'HR', 'MANAGER_WORKSITE', 'MANAGER_DEPARTMENT']
      for (const u of activeUsers) {
        const p = u.getString('profile')
        const em = u.getString('email').trim().toLowerCase()
        if (em && allowedProfiles.includes(p)) {
          recipientsSet.add(em)
        }
      }
    } catch (usersErr) {
      console.warn('Aviso ao buscar usuários para notificação de avaliação: ' + usersErr)
    }

    const costCenterId = collaborator.getString('cost_center')
    let costCenterName = ''
    if (costCenterId) {
      try {
        const cc = $app.findRecordById('cost_centers', costCenterId)
        costCenterName = cc.getString('name')
        const emails = cc.getString('email_recipients')
        if (emails) {
          emails.split(',').forEach((em) => {
            const clean = em.trim().toLowerCase()
            if (clean) recipientsSet.add(clean)
          })
        }
      } catch (_) {}
    }

    try {
      const genRec = $app.findFirstRecordByData('settings', 'key', 'general_recipients')
      const val = genRec.getString('value')
      if (val) {
        val.split(',').forEach((em) => {
          const clean = em.trim().toLowerCase()
          if (clean) recipientsSet.add(clean)
        })
      }
    } catch (_) {}

    // Obter dados do avaliador
    let evaluatorName = 'Sistema / Não informado'
    if (evaluatorId) {
      try {
        const evUser = $app.findRecordById('_pb_users_auth_', evaluatorId)
        evaluatorName = evUser.getString('name') || evUser.getString('email') || evaluatorName
      } catch (_) {}
    }

    // Formatar data da avaliação em DD/MM/AAAA
    let evalDateBR = ''
    const evalAtRaw = evalRecord.getString('evaluated_at')
    if (evalAtRaw) {
      const datePart = evalAtRaw.split(' ')[0].split('T')[0]
      const parts = datePart.split('-')
      if (parts.length === 3) {
        evalDateBR = `${parts[2]}/${parts[1]}/${parts[0]}`
      } else {
        evalDateBR = evalAtRaw
      }
    }

    const collabName = collaborator.getString('name')
    const collabRole = collaborator.getString('role')
    let eventName = stage === '45 dias' ? 'eval_45_done' : 'eval_90_done'
    let eventLabel =
      stage === '45 dias' ? 'Avaliação de 45 dias concluída' : 'Avaliação de 90 dias concluída'

    // Rótulos amigáveis de decisão:
    // Prorrogar até 90 dias / Encerrar contrato (se 45d) ou Desligar (se 90d) / Efetivar
    let decisionLabel = decision
    if (decision === 'EXTEND') {
      decisionLabel = 'Prorrogar até 90 dias'
    } else if (decision === 'EFFECTIVATE') {
      decisionLabel = 'Efetivar'
    } else if (decision === 'TERMINATE') {
      decisionLabel = stage === '45 dias' ? 'Encerrar contrato' : 'Desligar'
    }

    // Responsável pela avaliação (campos responsible_name e responsible_role)
    const respName = (evalRecord.getString('responsible_name') || '').trim()
    const respRole = (evalRecord.getString('responsible_role') || '').trim()

    let responsibleLines = ''
    if (respName) {
      responsibleLines += `• Nome do Responsável pela avaliação: ${respName}\n`
      if (respRole) {
        responsibleLines += `• Função do Responsável: ${respRole}\n`
      }
    }

    const subject = `[Avaliação de Experiência] ${eventLabel}: ${collabName}`
    const body = `Prezados,\n\nA avaliação de ${stage} do colaborador foi concluída no sistema:\n\n• Colaborador: ${collabName}\n• Função: ${collabRole}\n• Centro de Custo: ${costCenterName || 'Não informado'}\n• Etapa: ${stage}\n• Decisão: ${decisionLabel}\n${responsibleLines}• Avaliador: ${evaluatorName}\n• Data da Avaliação: ${evalDateBR || 'Não informada'}\n• Nova situação: ${newSituation}\n\nAcesse o sistema para verificar os detalhes da avaliação.\n\nAvaliação de Experiência`

    for (const email of recipientsSet) {
      const dedupeKey = `${collabId}_${stage}_${email}_${evalRecord.id}`
      try {
        const notif = new Record(notifsCol)
        notif.set('event', eventName)
        notif.set('recipient', email)
        notif.set('subject', subject)
        notif.set('body', body)
        notif.set('status', 'Pendente')
        notif.set('attempts', 0)
        notif.set('dedupe_key', dedupeKey)
        if (collabClientId) {
          notif.set('client', collabClientId)
        }
        $app.save(notif)
      } catch (notifErr) {
        console.warn('Falha ou deduplicação ao criar notificação: ' + notifErr)
      }
    }
  } catch (outerErr) {
    console.error('Erro geral no disparo de notificações: ' + outerErr)
  }
}, 'evaluations')
