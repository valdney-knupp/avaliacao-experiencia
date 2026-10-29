// Triggered when a collaborator is created: sends notification to ADMIN, HR, and evaluation managers
onRecordAfterCreateSuccess((e) => {
  try {
    e.next()
  } catch (err) {
    console.error('Erro na cadeia do hook de colaborador:', err)
  }

  const collab = e.record
  const collabId = collab.id
  const collabName = collab.getString('name')
  const collabRole = collab.getString('role')
  const costCenterId = collab.getString('cost_center')
  const sectorId = collab.getString('sector')
  const admissionRaw = collab.getString('admission_date')
  const createdById = collab.getString('created_by')

  // Format admission date as DD/MM/AAAA
  let admissionDateBR = ''
  if (admissionRaw) {
    const datePart = admissionRaw.split(' ')[0].split('T')[0]
    const parts = datePart.split('-')
    if (parts.length === 3) {
      admissionDateBR = `${parts[2]}/${parts[1]}/${parts[0]}`
    } else {
      admissionDateBR = admissionRaw
    }
  }

  // Get cost center name and sector name
  let costCenterName = ''
  let costCenterEmails = ''
  if (costCenterId) {
    try {
      const cc = $app.findRecordById('cost_centers', costCenterId)
      costCenterName = cc.getString('name')
      costCenterEmails = cc.getString('email_recipients') || ''
    } catch (_) {}
  }

  let sectorName = ''
  if (sectorId) {
    try {
      const sec = $app.findRecordById('sectors', sectorId)
      sectorName = sec.getString('name')
    } catch (_) {}
  }

  // Get creator name/email
  let createdByName = 'Sistema / Importação'
  if (createdById) {
    try {
      const u = $app.findRecordById('_pb_users_auth_', createdById)
      createdByName = u.getString('name') || u.getString('email') || createdByName
    } catch (_) {}
  }

  // Determine recipients isolados por client:
  const recipientsSet = new Set()
  const collabClientId = collab.getString('client') || ''

  try {
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
  } catch (err) {
    console.warn('Aviso ao buscar usuários para notificação de novo colaborador: ' + err)
  }

  // Add cost center specific recipients
  if (costCenterEmails) {
    costCenterEmails.split(',').forEach((em) => {
      const clean = em.trim().toLowerCase()
      if (clean) recipientsSet.add(clean)
    })
  }

  // Add general settings recipients
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

  // Build subject and body (NO COMPLETE CPF)
  const subject = `[Novo Colaborador] ${collabName} incluído no centro ${costCenterName || 'Não informado'}`
  let body = `Prezados,\n\nUm novo colaborador foi cadastrado no sistema:\n\n• Nome: ${collabName}\n• Função: ${collabRole}\n• Centro de Custo: ${costCenterName || 'Não informado'}`
  if (sectorName) {
    body += `\n• Setor: ${sectorName}`
  }
  body += `\n• Data de Admissão: ${admissionDateBR || 'Não informada'}\n• Cadastrado por: ${createdByName}\n\nAcesse o sistema para acompanhar os prazos e avaliações.\n\nAvaliação de Experiência`

  try {
    const notifsCol = $app.findCollectionByNameOrId('notifications')
    for (const email of recipientsSet) {
      const dedupeKey = `new_${collabId}_${email}`
      try {
        const notif = new Record(notifsCol)
        notif.set('event', 'new_collaborator')
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
        console.warn('Falha ou deduplicação ao criar notificação de colaborador: ' + notifErr)
      }
    }
  } catch (err) {
    console.error('Erro geral ao processar notificações de novo colaborador: ' + err)
  }
}, 'collaborators')
