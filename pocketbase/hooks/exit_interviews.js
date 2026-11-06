// Hooks e rotas do módulo Entrevista de Desligamento
// - POST /backend/v1/exit-invites/send   (envio por e-mail, histórico por canal)
// - POST /backend/v1/exit-invites/submit (resposta pública SEM login, por token)
// - Expiração automática: cron diário marca convites vencidos como 'Expirado'
//
// Segurança: o token é opaco (hex 48), único por convite, e a rota pública só
// revela o formulário daquele convite (sem e-mails, sem outros dados do tenant).

// ------------------------------------------------------------------
// Envio de convite (por canal). Registra tentativa em exit_send_attempts.
// ATENÇÃO: Toda a lógica fica INLINE dentro do callback para compatibilidade
// com o pool de JSVM do PocketBase (declarações top-level causam ReferenceError).
// ------------------------------------------------------------------
routerAdd('POST', '/backend/v1/exit-invites/send', (e) => {
  const MASTER_EMAIL = 'valdknupp@gmail.com'
  const auth = e.auth

  const isAuthorized = (() => {
    if (!auth) return false
    const email = auth.getString('email')
    if (email === MASTER_EMAIL) return true
    const profile = auth.getString('profile')
    return profile === 'ADMIN' || profile === 'HR'
  })()

  if (!isAuthorized) {
    return e.json(403, { error: 'Você não tem permissão para enviar entrevistas de desligamento.' })
  }

  const data = e.requestInfo().body || {}
  const inviteId = data.invite || ''
  const channels = Array.isArray(data.channels) ? data.channels : []

  if (!inviteId) return e.json(400, { error: 'Convite não informado.' })
  if (channels.length === 0)
    return e.json(400, { error: 'Selecione pelo menos um canal de envio (e-mail e/ou WhatsApp).' })

  let invite
  try {
    invite = $app.findRecordById('exit_invites', inviteId)
  } catch (_) {
    return e.json(404, { error: 'Convite não encontrado.' })
  }

  // Isolamento por tenant (servidor)
  const invClient = invite.getString('client')
  const authClient = auth.getString('client')
  const isMaster = auth.getString('email') === MASTER_EMAIL
  if (!isMaster && invClient && authClient && invClient !== authClient) {
    return e.json(403, { error: 'Convite pertence a outro cliente.' })
  }
  if (!isMaster && !authClient && invClient) {
    return e.json(403, { error: 'Convite pertence a outro cliente.' })
  }

  // Bloqueia envio após resposta concluída
  if (invite.getString('status') === 'Respondido') {
    return e.json(409, { error: 'Esta entrevista já foi respondida. Não é possível reenviar.' })
  }

  const collabId = invite.getString('collaborator')
  let collab = null
  try {
    collab = $app.findRecordById('collaborators', collabId)
  } catch (_) {
    return e.json(404, { error: 'Colaborador não encontrado.' })
  }

  // Carrega a versão do formulário usada no convite
  let formTitle = 'Entrevista de Desligamento'
  try {
    const fv = $app.findRecordById('exit_form_versions', invite.getString('form_version'))
    formTitle = fv.getString('title') || formTitle
  } catch (_) {}

  let appUrl = 'https://avaliacao-de-experiencia-67c4f.goskip.app'
  try {
    const envUrl = $os.getenv('SITE_URL')
    if (envUrl && envUrl.trim()) {
      appUrl = envUrl.trim()
    } else {
      const s = $app.findFirstRecordByData('settings', 'key', 'app_url')
      const v = s.getString('value')
      if (v && v.trim()) appUrl = v.trim()
    }
  } catch (_) {}
  if (appUrl.endsWith('/')) appUrl = appUrl.slice(0, -1)

  const token = invite.getString('token')
  const link = `${appUrl}/entrevista/${token}`

  const expiresRaw = invite.getString('expires_at')
  let expiresBR = ''
  if (expiresRaw) {
    const p = expiresRaw.split(' ')[0].split('T')[0].split('-')
    if (p.length === 3) expiresBR = `${p[2]}/${p[1]}/${p[0]}`
  }

  const collabName = collab.getString('name') || 'Colaborador'
  let attemptsRow = null
  try {
    attemptsRow = $app.findCollectionByNameOrId('exit_send_attempts')
  } catch (_) {}

  const results = []

  // ---------- canal: e-mail ----------
  if (channels.includes('email')) {
    const email = (data.email || collab.getString('contact_email') || '').trim().toLowerCase()
    if (!email) {
      results.push({
        channel: 'email',
        status: 'Falha',
        recipient: '',
        error: 'Sem e-mail cadastrado para o colaborador.',
      })
    } else {
      let emailOk = false
      let emailErr = ''
      try {
        const msg = new MailerMessage({
          from: {
            address: $app.settings().meta.senderAddress || 'naoresponda@avaliacao.com.br',
            name: $app.settings().meta.senderName || 'Sistema de Avaliação de Experiência',
          },
          to: [{ address: email }],
          subject: `Entrevista de Desligamento — ${collabName}`,
          text:
            `Prezado(a) ${collabName},\n\nConvidamos você a responder a Entrevista de Desligamento.\n` +
            (expiresBR ? `Prazo para responder: ${expiresBR}\n` : '') +
            `Acesse o link abaixo pelo celular ou computador (não é necessário login):\n\n${link}\n\n` +
            `Agradecemos a sua colaboração.\n\nSistema de Avaliação de Experiência`,
          html:
            `<div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;padding:24px;border:1px solid #E8E8E8;border-radius:8px;background:#FFFFFF;">` +
            `<div style="background:#111111;padding:18px 20px;border-radius:6px;text-align:center;margin-bottom:24px;">` +
            `<h2 style="color:#54D769;margin:0;font-size:20px;font-weight:bold;">Sistema de Avaliação de Experiência</h2>` +
            `<p style="color:#FFFFFF;margin:6px 0 0 0;font-size:13px;text-transform:uppercase;letter-spacing:1px;">Entrevista de Desligamento</p></div>` +
            `<div style="color:#333333;line-height:1.6;font-size:15px;margin-bottom:28px;">` +
            `<p>Prezado(a) <strong>${collabName}</strong>,</p>` +
            `<p>Convidamos você a responder a <strong>Entrevista de Desligamento</strong>.` +
            (expiresBR ? ` O prazo para responder é <strong>${expiresBR}</strong>.` : '') +
            `</p><p>A resposta é individual e confidencial, feita pelo link abaixo — pelo celular ou computador, <strong>sem necessidade de login</strong>.</p></div>` +
            `<div style="text-align:center;margin:30px 0;">` +
            `<a href="${link}" style="background-color:#54D769;color:#111111;padding:14px 28px;text-decoration:none;border-radius:6px;font-weight:bold;font-size:15px;display:inline-block;">Responder entrevista</a></div>` +
            `<div style="margin-top:32px;padding-top:16px;border-top:1px solid #E8E8E8;font-size:12px;color:#777777;text-align:center;line-height:1.5;">` +
            `Se o botão não funcionar, copie e cole este link no navegador:<br><a href="${link}" style="color:#111111;">${link}</a></div></div>`,
        })
        $app.newMailClient().send(msg)
        emailOk = true
      } catch (err) {
        emailErr = String(err)
      }

      const attempt = new Record(attemptsRow)
      attempt.set('invite', invite.id)
      attempt.set('channel', 'email')
      attempt.set('recipient', email)
      attempt.set('status', emailOk ? 'Sucesso' : 'Falha')
      if (!emailOk) attempt.set('error_message', emailErr)
      if (auth) attempt.set('sent_by', auth.id)
      const invClient2 = invite.getString('client')
      if (invClient2) attempt.set('client', invClient2)
      $app.save(attempt)

      results.push({
        channel: 'email',
        status: emailOk ? 'Sucesso' : 'Falha',
        recipient: email,
        error: emailErr,
      })
    }
  }

  // ---------- canal: whatsapp (não configurado nesta versão) ----------
  if (channels.includes('whatsapp')) {
    const phone = (data.phone || collab.getString('contact_phone') || '').trim()
    results.push({
      channel: 'whatsapp',
      status: 'Falha',
      recipient: phone,
      error: 'Canal WhatsApp ainda não configurado no sistema (integração não ativa).',
    })
  }

  const emailOkAny = results.some((r) => r.channel === 'email' && r.status === 'Sucesso')
  const whatsappOkAny = results.some((r) => r.channel === 'whatsapp' && r.status === 'Sucesso')
  const anyOk = emailOkAny || whatsappOkAny
  const allOk = results.every((r) => r.status === 'Sucesso')

  if (anyOk) {
    invite.set('status', 'Enviado')
    if (!invite.getString('sent_first_at')) invite.set('sent_first_at', new DateTime())
    $app.save(invite)
  }

  // Auditoria
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const audit = new Record(auditCol)
    if (auth) {
      audit.set('user', auth.id)
      const invClient3 = invite.getString('client')
      if (invClient3) audit.set('client', invClient3)
    }
    audit.set('entity_type', 'exit_invites')
    audit.set('entity_id', invite.id)
    audit.set('action', 'SEND_EXIT_INVITE')
    audit.set(
      'summary',
      `Envio de Entrevista de Desligamento para ${collabName}: ${results
        .map((r) => `${r.channel}=${r.status}`)
        .join(', ')}`,
    )
    $app.save(audit)
  } catch (_) {}

  return e.json(anyOk ? 200 : 422, {
    ok: anyOk,
    all_ok: allOk,
    results,
    link,
  })
})

// ------------------------------------------------------------------
// Resposta pública (sem login): token + respostas
// ------------------------------------------------------------------
routerAdd('GET', '/backend/v1/exit-invites/answer', (e) => {
  const token = e.requestInfo().query.token || ''
  if (!token) return e.json(400, { error: 'Token ausente.' })

  let invite
  try {
    invite = $app.findFirstRecordByData('exit_invites', 'token', token)
  } catch (_) {
    return e.json(404, { error: 'Convite não encontrado ou link inválido.' })
  }

  const now = new DateTime()
  if (invite.getString('status') === 'Respondido') {
    return e.json(409, { error: 'Esta entrevista já foi respondida.' })
  }
  if (invite.getString('status') === 'Expirado') {
    return e.json(410, { error: 'O prazo para responder esta entrevista já expirou.' })
  }
  const expires = invite.getString('expires_at')
  if (expires && new Date(now.toISOString()) > new Date(expires)) {
    invite.set('status', 'Expirado')
    $app.save(invite)
    return e.json(410, { error: 'O prazo para responder esta entrevista já expirou.' })
  }

  // Carrega a versão do formulário vinculada a este convite
  let form = null
  try {
    form = $app.findRecordById('exit_form_versions', invite.getString('form_version'))
  } catch (_) {
    return e.json(500, { error: 'Formulário não configurado para este convite.' })
  }

  let schema = {}
  try {
    schema = form.getString('schema') ? JSON.parse(form.getString('schema')) : { sections: [] }
  } catch (_) {
    schema = { sections: [] }
  }

  return e.json(200, {
    invite_id: invite.id,
    status: invite.getString('status'),
    form: {
      title: form.getString('title'),
      schema,
      version: form.getInt('version'),
    },
  })
})

routerAdd('POST', '/backend/v1/exit-invites/answer', (e) => {
  const data = e.requestInfo().body || {}
  const token = data.token || ''
  const answers = Array.isArray(data.answers) ? data.answers : []
  if (!token) return e.json(400, { error: 'Token ausente.' })

  let invite
  try {
    invite = $app.findFirstRecordByData('exit_invites', 'token', token)
  } catch (_) {
    return e.json(404, { error: 'Convite não encontrado ou link inválido.' })
  }

  if (invite.getString('status') === 'Respondido') {
    return e.json(409, { error: 'Esta entrevista já foi respondida.' })
  }
  if (invite.getString('status') === 'Expirado') {
    return e.json(410, { error: 'O prazo para responder esta entrevista já expirou.' })
  }

  let schema = { sections: [] }
  let requiredIds = []
  try {
    const fv = $app.findRecordById('exit_form_versions', invite.getString('form_version'))
    schema = fv.getString('schema') ? JSON.parse(fv.getString('schema')) : { sections: [] }
    for (const s of schema.sections || []) {
      for (const q of s.questions || []) {
        if (q.required) requiredIds.push(q.id)
      }
    }
  } catch (_) {}

  const answeredIds = new Set(answers.map((a) => a.question_id))
  const missing = requiredIds.filter((id) => !answeredIds.has(id))
  if (missing.length > 0) {
    return e.json(422, { error: 'Perguntas obrigatórias não respondidas.', missing })
  }

  // Cria respostas
  const answersCol = $app.findCollectionByNameOrId('exit_answers')
  const invClient = invite.getString('client')
  const now = new DateTime()
  for (const a of answers) {
    const rec = new Record(answersCol)
    rec.set('invite', invite.id)
    rec.set('question_id', a.question_id)
    rec.set('value', a.value === undefined || a.value === null ? '' : JSON.stringify(a.value))
    if (invClient) rec.set('client', invClient)
    $app.save(rec)
  }

  invite.set('status', 'Respondido')
  invite.set('responded_at', now)
  $app.save(invite)

  // Auditoria
  try {
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const audit = new Record(auditCol)
    audit.set('entity_type', 'exit_invites')
    audit.set('entity_id', invite.id)
    audit.set('action', 'EXIT_INTERVIEW_SUBMITTED')
    audit.set('summary', `Entrevista de desligamento respondida (convite ${invite.id})`)
    const invClient2 = invite.getString('client')
    if (invClient2) audit.set('client', invClient2)
    $app.save(audit)
  } catch (_) {}

  return e.json(200, { ok: true })
})

// ------------------------------------------------------------------
// Cron diário: marca convites vencidos como 'Expirado'
// ------------------------------------------------------------------
cronAdd('exit_invite_expiry_check', '30 7 * * *', () => {
  try {
    const nowIso = new Date().toISOString()
    const list = $app.findRecordsByFilter(
      'exit_invites',
      "status = 'Enviado' && expires_at != '' && expires_at < @now",
      '',
      5000,
      0,
    )
    for (const inv of list) {
      const exp = inv.getString('expires_at')
      if (!exp) continue
      if (new Date(exp) < new Date(nowIso)) {
        inv.set('status', 'Expirado')
        $app.save(inv)
      }
    }
  } catch (err) {
    console.error('[exit_invite_expiry_check] Erro: ' + err)
  }
})
