// Hook de captura de leads da página de vendas pública e sincronização com Mailchimp
// Audiência de destino oficial: id '7b27bed6cc' ("Knupp Dados")
// Usa $connectors.executeAsOwner se o toolkit 'mailchimp' estiver habilitado no proprietário,
// ou registra localmente na coleção 'leads' de forma idempotente e segura caso pendente autorização.

routerAdd('POST', '/backend/v1/leads/capture', (e) => {
  const LIST_ID = '7b27bed6cc'

  let body = {}
  try {
    body = e.requestInfo().body || {}
  } catch (_) {
    body = {}
  }

  const rawName = typeof body.name === 'string' ? body.name.trim() : ''
  const rawEmail = typeof body.email === 'string' ? body.email.trim().toLowerCase() : ''
  const source =
    typeof body.source === 'string' && body.source.trim() ? body.source.trim() : 'sales_page'

  // Validação simples
  if (!rawName) {
    return e.json(400, {
      success: false,
      error: 'Por favor, informe seu nome completo.',
    })
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  if (!rawEmail || !emailRegex.test(rawEmail)) {
    return e.json(400, {
      success: false,
      error: 'Por favor, informe um e-mail válido.',
    })
  }

  // 1. Salvar ou atualizar na coleção 'leads'
  let leadRecord = null
  let isExistingLead = false
  try {
    const existing = $app.findRecordsByFilter(
      'leads',
      `email = '${rawEmail.replace(/'/g, "\\'")}'`,
      '-created',
      1,
      0,
    )
    if (existing && existing.length > 0) {
      leadRecord = existing[0]
      isExistingLead = true
      leadRecord.set('name', rawName)
      leadRecord.set('source', source)
      $app.save(leadRecord)
    } else {
      const col = $app.findCollectionByNameOrId('leads')
      leadRecord = new Record(col)
      leadRecord.set('name', rawName)
      leadRecord.set('email', rawEmail)
      leadRecord.set('source', source)
      leadRecord.set('status', 'pending')
      $app.save(leadRecord)
    }
  } catch (dbErr) {
    console.warn('[leads/capture] Erro ao gravar lead no banco: ' + (dbErr.message || dbErr))
  }

  // 2. Tenta sincronizar com Mailchimp via $connectors.executeAsOwner
  let mailchimpSynced = false
  let mailchimpStatus = 'not_attempted'
  let mailchimpNote = ''

  try {
    if (typeof $connectors !== 'undefined' && typeof $connectors.executeAsOwner === 'function') {
      // Extrai primeiro nome para FNAME
      const firstName = rawName.split(' ')[0] || rawName
      const lastName = rawName.split(' ').slice(1).join(' ') || ''

      const args = {
        list_id: LIST_ID,
        email_address: rawEmail,
        status: 'subscribed',
        merge_fields: {
          FNAME: firstName,
          LNAME: lastName,
        },
      }

      const res = $connectors.executeAsOwner('MAILCHIMP_ADD_LIST_MEMBER', args)

      if (res && res.successful) {
        mailchimpSynced = true
        mailchimpStatus = 'subscribed'
        mailchimpNote = 'Assinado com sucesso via Mailchimp'
      } else {
        const errMsg = res && res.error ? String(res.error) : 'Erro desconhecido'
        // Idempotência: Se o contato já existe como membro (Member Exists / 400), tratar como sucesso amigável
        const isMemberExists =
          errMsg.toLowerCase().includes('member exists') ||
          errMsg.toLowerCase().includes('already a list member') ||
          errMsg.toLowerCase().includes('already subscribed') ||
          errMsg.includes('400')

        if (isMemberExists) {
          mailchimpSynced = true
          mailchimpStatus = 'already_subscribed'
          mailchimpNote = 'Contato já existia na audiência (tratado como sucesso)'
        } else {
          mailchimpStatus = 'failed'
          mailchimpNote = 'Falha no conector Mailchimp'
          console.warn('[leads/capture] Resposta Mailchimp: ' + errMsg)
        }
      }
    } else {
      mailchimpStatus = 'pending_connector'
      mailchimpNote = 'Conector de proprietário não inicializado no ambiente'
    }
  } catch (connErr) {
    const errText = connErr ? String(connErr.message || connErr) : ''
    console.warn('[leads/capture] Exceção ao chamar conector Mailchimp: ' + errText)

    if (
      errText.toLowerCase().includes('member exists') ||
      errText.toLowerCase().includes('already subscribed')
    ) {
      mailchimpSynced = true
      mailchimpStatus = 'already_subscribed'
    } else {
      mailchimpStatus = 'connector_error'
      mailchimpNote = 'Conector aguardando autorização do proprietário'
    }
  }

  // Atualiza status do lead no banco se o registro foi criado
  if (leadRecord) {
    try {
      if (mailchimpSynced) {
        leadRecord.set('status', mailchimpStatus === 'already_subscribed' ? 'exists' : 'synced')
      } else if (mailchimpStatus === 'failed') {
        leadRecord.set('status', 'failed')
      } else {
        leadRecord.set('status', 'pending')
      }
      leadRecord.set('mailchimp_status', mailchimpStatus)
      if (mailchimpNote) leadRecord.set('notes', mailchimpNote)
      $app.save(leadRecord)
    } catch (_) {}
  }

  // Resposta sempre amigável e segura (nunca vaza segredos ou credenciais)
  return e.json(200, {
    success: true,
    message:
      isExistingLead || mailchimpStatus === 'already_subscribed'
        ? 'Obrigado! Seu e-mail já está registrado em nossa lista VIP de novidades.'
        : 'Cadastro realizado com sucesso! Você receberá nossos materiais e novidades em breve.',
    data: {
      email: rawEmail,
      status: mailchimpSynced ? 'subscribed' : 'registered',
    },
  })
})
