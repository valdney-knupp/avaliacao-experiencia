// Endpoint administrativo seguro para gerenciamento de usuários
// Permite que administradores autenticados criem e redefinam senhas de usuários
// respeitando todas as regras de negócio do sistema.

routerAdd(
  'POST',
  '/backend/v1/admin/users',
  (e) => {
    // 1. Autorização: usuários autenticados com perfil ADMIN ou HR (Gestão de Pessoas)
    const authRecord = e.auth
    const requesterProfile = authRecord ? authRecord.getString('profile') : ''
    if (!authRecord || (requesterProfile !== 'ADMIN' && requesterProfile !== 'HR')) {
      return e.json(403, {
        error:
          'Acesso negado: apenas administradores ou gestão de pessoas podem realizar esta operação.',
      })
    }

    const body = e.requestInfo().body || {}
    const rawEmail = String(body.email || '')
    const cleanEmail = rawEmail.trim().toLowerCase()
    const name = String(body.name || '').trim()
    const profile = String(body.profile || '').trim()

    if (cleanEmail === 'valdknupp@gmail.com') {
      return e.json(403, {
        error: 'Esta conta de sistema não pode ser criada ou alterada pelo painel.',
      })
    }
    const password = String(body.password || '')
    const costCenterId = body.cost_center ? String(body.cost_center).trim() : null
    const sectorId = body.sector ? String(body.sector).trim() : null
    const active = body.active !== false

    // Se a requisição veio do master, ele pode informar explicitamente o clientId alvo.
    // Se veio de um admin de cliente, o clientId DEVE ser o clientId do usuário logado.
    const isMaster = authRecord.getString('email').trim().toLowerCase() === 'valdknupp@gmail.com'
    const targetClientId = isMaster
      ? body.client
        ? String(body.client).trim()
        : null
      : authRecord.getString('client') || null

    // 2. Validações básicas
    if (!cleanEmail || !name) {
      return e.json(400, { error: 'Nome e e-mail são obrigatórios.' })
    }

    if (cleanEmail === 'valdknupp@gmail.com') {
      return e.json(403, {
        error: 'Esta conta de sistema não pode ser gerenciada pelo painel.',
      })
    }

    // Validação de formato de email e ausência de espaços
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(cleanEmail)) {
      return e.json(400, { error: 'Formato de e-mail inválido.' })
    }

    // Perfis válidos (incluindo MANAGER unificado e legados para compatibilidade)
    const validProfiles = [
      'ADMIN',
      'HR',
      'MANAGER',
      'MANAGER_WORKSITE',
      'MANAGER_DEPARTMENT',
      'ADMIN_ASSISTANT',
      'VIEWER',
    ]
    if (!validProfiles.includes(profile)) {
      return e.json(400, { error: 'Perfil de usuário inválido.' })
    }

    // Regra de senha: mínimo 8 caracteres
    if (!password || password.length < 8) {
      return e.json(400, { error: 'A senha inicial deve ter no mínimo 8 caracteres.' })
    }

    // 3. Regras de negócio por perfil
    // Gestor (MANAGER) pode ser associado a obra, setor ou ambos (pelo menos um se fornecido)
    if (profile === 'MANAGER') {
      if (!costCenterId && !sectorId) {
        return e.json(400, {
          error:
            'Gestor deve estar associado a um centro de custo (Obra) ou a um setor do escritório.',
        })
      }
      if (costCenterId) {
        try {
          const cc = $app.findRecordById('cost_centers', costCenterId)
          if (!cc.getBool('active')) {
            return e.json(400, { error: 'O centro de custo selecionado está inativo.' })
          }
          if (cc.getString('type') !== 'Obra') {
            return e.json(400, {
              error: 'O centro de custo vinculado ao Gestor deve ser do tipo "Obra".',
            })
          }
        } catch (_) {
          return e.json(400, { error: 'Centro de custo informado não foi encontrado.' })
        }
      }
      if (sectorId) {
        try {
          const sec = $app.findRecordById('sectors', sectorId)
          if (!sec.getBool('active')) {
            return e.json(400, { error: 'O setor selecionado está inativo.' })
          }
        } catch (_) {
          return e.json(400, { error: 'Setor informado não foi encontrado.' })
        }
      }
    }

    // Gestor de Obra (legado) e Assistente Administrativo exigem centro de custo ativo do tipo Obra
    if (profile === 'MANAGER_WORKSITE' || profile === 'ADMIN_ASSISTANT') {
      const roleLabel =
        profile === 'ADMIN_ASSISTANT' ? 'Assistente Administrativo' : 'Gestor de Obra'
      if (!costCenterId) {
        return e.json(400, {
          error: `${roleLabel} deve estar associado a um centro de custo do tipo Obra.`,
        })
      }
      try {
        const cc = $app.findRecordById('cost_centers', costCenterId)
        if (!cc.getBool('active')) {
          return e.json(400, { error: 'O centro de custo selecionado está inativo.' })
        }
        if (cc.getString('type') !== 'Obra') {
          return e.json(400, {
            error: `O centro de custo vinculado ao ${roleLabel} deve ser do tipo "Obra".`,
          })
        }
      } catch (_) {
        return e.json(400, { error: 'Centro de custo informado não foi encontrado.' })
      }
    }

    // Gestor de Setor (legado) exige setor ativo
    if (profile === 'MANAGER_DEPARTMENT') {
      if (!sectorId) {
        return e.json(400, {
          error: 'Gestor de Setor deve estar associado a um setor do escritório.',
        })
      }
      try {
        const sec = $app.findRecordById('sectors', sectorId)
        if (!sec.getBool('active')) {
          return e.json(400, { error: 'O setor selecionado está inativo.' })
        }
      } catch (_) {
        return e.json(400, { error: 'Setor informado não foi encontrado.' })
      }
    }

    // Administrador, HR e Consulta não exigem centro nem setor
    const resolvedCostCenter =
      profile === 'MANAGER' || profile === 'MANAGER_WORKSITE' || profile === 'ADMIN_ASSISTANT'
        ? costCenterId
        : null
    const resolvedSector =
      profile === 'MANAGER' || profile === 'MANAGER_DEPARTMENT' ? sectorId : null

    // 4. Verificação de e-mail único
    try {
      const existing = $app.findAuthRecordByEmail('_pb_users_auth_', cleanEmail)
      if (existing) {
        return e.json(400, { error: 'Já existe um usuário cadastrado com este e-mail.' })
      }
    } catch (_) {
      // Nenhum usuário com este email — prossegue
    }

    // 5. Criação do usuário
    try {
      const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
      const newRecord = new Record(usersCol)
      newRecord.setEmail(cleanEmail)
      newRecord.setPassword(password)
      newRecord.setVerified(true)
      newRecord.set('name', name)
      newRecord.set('profile', profile)
      newRecord.set('cost_center', resolvedCostCenter)
      newRecord.set('sector', resolvedSector)
      newRecord.set('active', active)
      newRecord.set('client', targetClientId)

      $app.save(newRecord)

      // Registrar auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const audit = new Record(auditCol)
        audit.set('user', authRecord.id)
        audit.set('entity_type', 'users')
        audit.set('entity_id', newRecord.id)
        audit.set('action', 'CREATE_USER')
        audit.set(
          'summary',
          `Novo usuário criado via painel por ${authRecord.getString('name') || authRecord.getString('email')} (${requesterProfile}): ${cleanEmail} (Perfil: ${profile})`,
        )
        $app.save(audit)
      } catch (auditErr) {
        console.error('Falha ao gravar log de auditoria: ' + auditErr)
      }

      return e.json(201, {
        id: newRecord.id,
        name: newRecord.getString('name'),
        email: newRecord.getString('email'),
        profile: newRecord.getString('profile'),
        cost_center: newRecord.getString('cost_center'),
        sector: newRecord.getString('sector'),
        active: newRecord.getBool('active'),
        client: newRecord.getString('client'),
      })
    } catch (createErr) {
      console.error('Erro ao salvar novo usuário: ' + createErr)
      return e.json(500, {
        error: 'Não foi possível cadastrar o usuário. Tente novamente mais tarde.',
      })
    }
  },
  $apis.requireAuth(),
)
