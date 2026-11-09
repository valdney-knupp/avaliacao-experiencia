// Endpoint administrativo exclusivo para liberação e gestão de acessos de clientes compradores (Multi-tenant)
// Apenas o usuário master valdknupp@gmail.com com perfil ADMIN pode acessar e gerenciar compradores.

// 1. Criar novo cliente e usuário comprador com acesso pronto
routerAdd(
  'POST',
  '/backend/v1/admin/clients',
  (e) => {
    const authRecord = e.auth
    const requesterEmail = authRecord ? authRecord.getString('email').trim().toLowerCase() : ''
    const requesterProfile = authRecord ? authRecord.getString('profile') : ''

    if (!authRecord || requesterProfile !== 'ADMIN' || requesterEmail !== 'valdknupp@gmail.com') {
      return e.json(403, {
        error: 'Acesso negado: apenas o usuário master pode gerenciar a liberação de acessos.',
      })
    }

    const body = e.requestInfo().body || {}
    const clientName = String(body.name || '').trim()
    const cleanEmail = String(body.email || '')
      .trim()
      .toLowerCase()
    const password = String(body.password || '')
    const plan = String(body.plan || 'MENSAL')
      .trim()
      .toUpperCase()
    const notes = String(body.notes || '').trim()
    const active = body.active !== false
    const paidUntil = body.paid_until ? String(body.paid_until).trim() : null
    const experienciaUntil =
      body.experiencia_until !== undefined
        ? body.experiencia_until
          ? String(body.experiencia_until).trim()
          : null
        : undefined
    const desempenhoUntil =
      body.desempenho_until !== undefined
        ? body.desempenho_until
          ? String(body.desempenho_until).trim()
          : null
        : undefined
    const explicitStatus = body.status ? String(body.status).trim() : null

    if (!clientName || !cleanEmail) {
      return e.json(400, { error: 'Nome do cliente/empresa e e-mail são obrigatórios.' })
    }

    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) {
      return e.json(400, { error: 'Formato de e-mail inválido.' })
    }

    if (cleanEmail === 'valdknupp@gmail.com') {
      return e.json(400, { error: 'O e-mail informado já é a conta master de sistema.' })
    }

    if (!password || password.length < 8) {
      return e.json(400, { error: 'A senha inicial deve ter no mínimo 8 caracteres.' })
    }

    // Verificar se já existe usuário com este e-mail
    try {
      const existingUser = $app.findAuthRecordByEmail('_pb_users_auth_', cleanEmail)
      if (existingUser) {
        return e.json(400, { error: 'Já existe um usuário no sistema com este e-mail.' })
      }
    } catch (_) {}

    try {
      // 1. Criar registro na coleção 'clients'
      const clientsCol = $app.findCollectionByNameOrId('clients')
      const clientRec = new Record(clientsCol)
      clientRec.set('name', clientName)
      clientRec.set('email', cleanEmail)
      clientRec.set('plan', ['MENSAL', 'ANUAL', 'OUTRO'].includes(plan) ? plan : 'MENSAL')
      clientRec.set('active', active)
      clientRec.set('notes', notes)
      if (paidUntil) {
        clientRec.set('paid_until', paidUntil)
      } else {
        // Se ativo e sem data informada, define vencimento padrão pelo plano
        const now = new Date()
        const daysToAdd = plan === 'ANUAL' ? 365 : 30
        now.setDate(now.getDate() + daysToAdd)
        clientRec.set('paid_until', now.toISOString().split('T')[0])
      }

      // Validades específicas por módulo:
      // Se não foram informadas explicitamente, herdam a validade de paid_until
      const targetExp =
        experienciaUntil !== undefined ? experienciaUntil : clientRec.getString('paid_until')
      const targetDes =
        desempenhoUntil !== undefined ? desempenhoUntil : clientRec.getString('paid_until')
      if (targetExp) clientRec.set('experiencia_until', targetExp)
      if (targetDes) clientRec.set('desempenho_until', targetDes)

      const initialStatus = explicitStatus || (active ? 'active' : 'blocked_manually')
      clientRec.set('status', initialStatus)
      $app.save(clientRec)

      // 2. Criar usuário administrador para o comprador vinculado a este client
      const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
      const userRec = new Record(usersCol)
      userRec.setEmail(cleanEmail)
      userRec.setPassword(password)
      userRec.setVerified(true)
      userRec.set('name', clientName)
      userRec.set('profile', 'ADMIN') // Administrador do próprio tenant
      userRec.set('client', clientRec.id)
      userRec.set('active', active)
      $app.save(userRec)

      // 3. Inicializar critérios de avaliação herdados para este cliente inline
      try {
        const criteriaCol = $app.findCollectionByNameOrId('evaluation_criteria')
        const allDefault = [
          {
            order: 1,
            name: 'Disciplina e cumprimento de regras',
            description:
              'Pontualidade, respeito às normas de segurança, postura e conduta ética no ambiente de trabalho.',
            category: 'OBRAS',
          },
          {
            order: 2,
            name: 'Qualidade e produtividade',
            description:
              'Rendimento, precisão na execução das tarefas, atenção aos detalhes e entrega nos prazos estipulados.',
            category: 'OBRAS',
          },
          {
            order: 3,
            name: 'Relacionamento interpessoal e trabalho em equipe',
            description:
              'Comunicação respeitosa, colaboração com colegas e liderança, disposição para cooperar.',
            category: 'OBRAS',
          },
          {
            order: 4,
            name: 'Assiduidade',
            description:
              'Frequência regular, ausência de faltas injustificadas e cumprimento da jornada contratual.',
            category: 'OBRAS',
          },
          {
            order: 1,
            name: 'ENTREGA DE RESULTADOS E QUALIDADE DO TRABALHO',
            description:
              'Capacidade de cumprir prazos, atingir metas com precisão e entregar resultados com excelência e qualidade técnica.',
            category: 'ESCRITORIO',
          },
          {
            order: 2,
            name: 'CAPACIDADE TÉCNICA E CONHECIMENTO',
            description:
              'Domínio das rotinas, processos, ferramentas e conhecimentos técnicos exigidos para a função desempenhada.',
            category: 'ESCRITORIO',
          },
          {
            order: 3,
            name: 'PROATIVIDADE',
            description:
              'Iniciativa para antecipar necessidades, propor soluções e atuar de forma autônoma e preventiva.',
            category: 'ESCRITORIO',
          },
          {
            order: 4,
            name: 'DINAMISMO',
            description:
              'Agilidade na resolução de demandas, adaptabilidade a mudanças de prioridade e ritmo de trabalho produtivo.',
            category: 'ESCRITORIO',
          },
          {
            order: 5,
            name: 'SOLUÇÃO DE PROBLEMAS',
            description:
              'Habilidade de identificar causas, analisar cenários críticos e propor alternativas eficazes e seguras.',
            category: 'ESCRITORIO',
          },
          {
            order: 6,
            name: 'RELACIONAMENTO INTERPESSOAL E TRABALHO EM EQUIPE',
            description:
              'Comunicação clara e respeitosa, colaboração mútua, escuta ativa e facilidade de integração em equipe.',
            category: 'ESCRITORIO',
          },
          {
            order: 7,
            name: 'POSTURA PROFISSIONAL E DISCIPLINA',
            description:
              'Ética profissional, responsabilidade com normas, pontualidade, discrição e respeito às diretrizes da empresa.',
            category: 'ESCRITORIO',
          },
          {
            order: 8,
            name: 'ASSIDUIDADE',
            description:
              'Frequência regular, ausência de faltas injustificadas e estrito cumprimento da jornada contratual de trabalho.',
            category: 'ESCRITORIO',
          },
        ]

        for (let i = 0; i < allDefault.length; i++) {
          const item = allDefault[i]
          const rec = new Record(criteriaCol)
          rec.set('name', item.name)
          rec.set('description', item.description)
          rec.set('order', item.order)
          rec.set('category', item.category)
          rec.set('sector', null)
          rec.set('client', clientRec.id)
          rec.set('active', true)
          $app.save(rec)
        }
      } catch (seedErr) {
        console.warn('Aviso ao inicializar critérios do cliente: ' + seedErr)
      }

      // 4. Auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const audit = new Record(auditCol)
        audit.set('user', authRecord.id)
        audit.set('entity_type', 'clients')
        audit.set('entity_id', clientRec.id)
        audit.set('action', 'CREATE_CLIENT_ACCESS')
        audit.set(
          'summary',
          `Acesso de comprador liberado por ${authRecord.getString('email')}: ${clientName} (${cleanEmail}), Plano: ${plan}`,
        )
        $app.save(audit)
      } catch (auditErr) {
        console.warn('Aviso ao registrar auditoria de liberação: ' + auditErr)
      }

      return e.json(201, {
        id: clientRec.id,
        name: clientRec.getString('name'),
        email: clientRec.getString('email'),
        plan: clientRec.getString('plan'),
        active: clientRec.getBool('active'),
        status: clientRec.getString('status'),
        paid_until: clientRec.getString('paid_until'),
        experiencia_until: clientRec.getString('experiencia_until'),
        desempenho_until: clientRec.getString('desempenho_until'),
        notes: clientRec.getString('notes'),
        created: clientRec.getString('created'),
        buyer_user_id: userRec.id,
      })
    } catch (err) {
      console.error('Erro ao criar cliente e usuário comprador: ' + err)
      return e.json(500, {
        error: 'Erro interno ao liberar acesso do comprador: ' + String(err),
      })
    }
  },
  $apis.requireAuth(),
)

// 2. Editar dados do cliente (renomear, alterar plano, notas, situação ativo/bloqueado)
routerAdd(
  'POST',
  '/backend/v1/admin/clients/{id}/update',
  (e) => {
    const authRecord = e.auth
    const requesterEmail = authRecord ? authRecord.getString('email').trim().toLowerCase() : ''
    const requesterProfile = authRecord ? authRecord.getString('profile') : ''

    if (!authRecord || requesterProfile !== 'ADMIN' || requesterEmail !== 'valdknupp@gmail.com') {
      return e.json(403, {
        error: 'Acesso negado: apenas o usuário master pode gerenciar a liberação de acessos.',
      })
    }

    const clientId = e.request.pathValue('id')
    if (!clientId) {
      return e.json(400, { error: 'ID do cliente é obrigatório.' })
    }

    let clientRec = null
    try {
      clientRec = $app.findRecordById('clients', clientId)
    } catch (_) {
      return e.json(404, { error: 'Cliente não encontrado.' })
    }

    const body = e.requestInfo().body || {}
    const clientName = body.name ? String(body.name).trim() : null
    const plan = body.plan ? String(body.plan).trim().toUpperCase() : null
    const notes = body.notes !== undefined ? String(body.notes).trim() : null
    const active = body.active !== undefined ? body.active === true : null
    const paidUntil =
      body.paid_until !== undefined ? (body.paid_until ? String(body.paid_until).trim() : '') : null
    const experienciaUntil =
      body.experiencia_until !== undefined
        ? body.experiencia_until
          ? String(body.experiencia_until).trim()
          : ''
        : null
    const desempenhoUntil =
      body.desempenho_until !== undefined
        ? body.desempenho_until
          ? String(body.desempenho_until).trim()
          : ''
        : null
    const explicitStatus = body.status ? String(body.status).trim() : null
    const newPassword = body.password ? String(body.password) : null

    if (clientName) clientRec.set('name', clientName)
    if (plan && ['MENSAL', 'ANUAL', 'OUTRO'].includes(plan)) clientRec.set('plan', plan)
    if (notes !== null) clientRec.set('notes', notes)
    if (paidUntil !== null) clientRec.set('paid_until', paidUntil || null)
    if (experienciaUntil !== null) clientRec.set('experiencia_until', experienciaUntil || null)
    if (desempenhoUntil !== null) clientRec.set('desempenho_until', desempenhoUntil || null)

    if (explicitStatus) {
      clientRec.set('status', explicitStatus)
      if (explicitStatus === 'active') {
        clientRec.set('active', true)
      } else {
        clientRec.set('active', false)
      }
    } else if (active !== null) {
      clientRec.set('active', active)
      if (active) {
        clientRec.set('status', 'active')
      } else {
        clientRec.set('status', 'blocked_manually')
      }
    }

    try {
      $app.save(clientRec)

      // Atualizar status / senha do usuário comprador principal se aplicável
      const clientEmail = clientRec.getString('email').toLowerCase()
      try {
        const buyerUser = $app.findAuthRecordByEmail('_pb_users_auth_', clientEmail)
        if (clientName) buyerUser.set('name', clientName)
        if (active !== null) buyerUser.set('active', active)
        if (newPassword && newPassword.length >= 8) {
          buyerUser.setPassword(newPassword)
        }
        $app.save(buyerUser)
      } catch (_) {}

      // Se foi bloqueado, bloquear todos os usuários subordinados daquele cliente
      if (active === false) {
        try {
          const clientUsers = $app.findRecordsByFilter(
            '_pb_users_auth_',
            `client = '${clientId}'`,
            '',
            500,
            0,
          )
          for (const u of clientUsers) {
            u.set('active', false)
            $app.save(u)
          }
        } catch (_) {}
      }

      // Auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const audit = new Record(auditCol)
        audit.set('user', authRecord.id)
        audit.set('entity_type', 'clients')
        audit.set('entity_id', clientRec.id)
        audit.set('action', 'UPDATE_CLIENT_ACCESS')
        audit.set(
          'summary',
          `Acesso do cliente ${clientRec.getString('name')} (${clientEmail}) atualizado (Ativo: ${clientRec.getBool('active')}, Plano: ${clientRec.getString('plan')})`,
        )
        $app.save(audit)
      } catch (_) {}

      return e.json(200, {
        id: clientRec.id,
        name: clientRec.getString('name'),
        email: clientRec.getString('email'),
        plan: clientRec.getString('plan'),
        active: clientRec.getBool('active'),
        status: clientRec.getString('status'),
        paid_until: clientRec.getString('paid_until'),
        experiencia_until: clientRec.getString('experiencia_until'),
        desempenho_until: clientRec.getString('desempenho_until'),
        notes: clientRec.getString('notes'),
        updated: clientRec.getString('updated'),
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao atualizar dados do cliente: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)

// 3. Excluir acesso de comprador e seus dados do cliente
routerAdd(
  'POST',
  '/backend/v1/admin/clients/{id}/delete',
  (e) => {
    const authRecord = e.auth
    const requesterEmail = authRecord ? authRecord.getString('email').trim().toLowerCase() : ''
    const requesterProfile = authRecord ? authRecord.getString('profile') : ''

    if (!authRecord || requesterProfile !== 'ADMIN' || requesterEmail !== 'valdknupp@gmail.com') {
      return e.json(403, {
        error: 'Acesso negado: apenas o usuário master pode excluir acessos de clientes.',
      })
    }

    const clientId = e.request.pathValue('id')
    if (!clientId) {
      return e.json(400, { error: 'ID do cliente é obrigatório.' })
    }

    let clientRec = null
    try {
      clientRec = $app.findRecordById('clients', clientId)
    } catch (_) {
      return e.json(404, { error: 'Cliente não encontrado.' })
    }

    const clientName = clientRec.getString('name')
    const clientEmail = clientRec.getString('email')

    try {
      // 1. Apagar respostas de avaliações do cliente
      try {
        const answers = $app.findRecordsByFilter(
          'evaluation_answers',
          `client = '${clientId}'`,
          '',
          10000,
          0,
        )
        for (const a of answers) $app.delete(a)
      } catch (_) {}

      // 2. Apagar avaliações do cliente
      try {
        const evals = $app.findRecordsByFilter('evaluations', `client = '${clientId}'`, '', 5000, 0)
        for (const ev of evals) $app.delete(ev)
      } catch (_) {}

      // 3. Apagar colaboradores do cliente
      try {
        const collabs = $app.findRecordsByFilter(
          'collaborators',
          `client = '${clientId}'`,
          '',
          5000,
          0,
        )
        for (const c of collabs) $app.delete(c)
      } catch (_) {}

      // 4. Apagar critérios do cliente
      try {
        const crits = $app.findRecordsByFilter(
          'evaluation_criteria',
          `client = '${clientId}'`,
          '',
          1000,
          0,
        )
        for (const cr of crits) $app.delete(cr)
      } catch (_) {}

      // 5. Apagar setores e centros de custo do cliente
      try {
        const secs = $app.findRecordsByFilter('sectors', `client = '${clientId}'`, '', 1000, 0)
        for (const s of secs) $app.delete(s)
      } catch (_) {}

      try {
        const ccs = $app.findRecordsByFilter('cost_centers', `client = '${clientId}'`, '', 1000, 0)
        for (const cc of ccs) $app.delete(cc)
      } catch (_) {}

      // 6. Apagar importações, notificações e logs do cliente
      try {
        const imps = $app.findRecordsByFilter('imports', `client = '${clientId}'`, '', 1000, 0)
        for (const imp of imps) $app.delete(imp)
      } catch (_) {}

      try {
        const notifs = $app.findRecordsByFilter(
          'notifications',
          `client = '${clientId}'`,
          '',
          5000,
          0,
        )
        for (const n of notifs) $app.delete(n)
      } catch (_) {}

      // 7. Apagar todos os usuários pertencentes a este cliente (exceto conta master)
      try {
        const users = $app.findRecordsByFilter(
          '_pb_users_auth_',
          `client = '${clientId}'`,
          '',
          1000,
          0,
        )
        for (const u of users) {
          if (u.getString('email').toLowerCase() !== 'valdknupp@gmail.com') {
            $app.delete(u)
          }
        }
      } catch (_) {}

      // 8. Apagar o registro do cliente
      $app.delete(clientRec)

      // 9. Auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const audit = new Record(auditCol)
        audit.set('user', authRecord.id)
        audit.set('entity_type', 'clients')
        audit.set('entity_id', clientId)
        audit.set('action', 'DELETE_CLIENT_ACCESS')
        audit.set(
          'summary',
          `Acesso e dados completos do comprador ${clientName} (${clientEmail}) foram excluídos por ${authRecord.getString('email')}`,
        )
        $app.save(audit)
      } catch (_) {}

      return e.json(200, {
        success: true,
        message: 'Acesso do cliente e todos os seus dados foram excluídos com sucesso.',
      })
    } catch (err) {
      console.error('Erro ao excluir cliente: ' + err)
      return e.json(500, { error: 'Falha ao excluir cliente: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
