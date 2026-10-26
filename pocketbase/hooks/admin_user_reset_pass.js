// Endpoint seguro para administradores redefinirem a senha temporária de um usuário
routerAdd(
  'POST',
  '/backend/v1/admin/users/reset-password',
  (e) => {
    // 1. Autorização: administradores ou gestão de pessoas (HR)
    const authRecord = e.auth
    const requesterProfile = authRecord ? authRecord.getString('profile') : ''
    if (!authRecord || (requesterProfile !== 'ADMIN' && requesterProfile !== 'HR')) {
      return e.json(403, {
        error:
          'Acesso negado: apenas administradores ou gestão de pessoas podem realizar esta operação.',
      })
    }

    const body = e.requestInfo().body || {}
    const targetUserId = String(body.user_id || '').trim()
    const newPassword = String(body.password || '')

    if (!targetUserId) {
      return e.json(400, { error: 'Identificador do usuário é obrigatório.' })
    }

    // Proteção contra auto-reset: impede o próprio usuário autenticado de resetar a própria senha por este endpoint
    // evitando a invalidação silenciosa do tokenKey e sessão zumbi.
    if (authRecord && targetUserId === authRecord.id) {
      return e.json(400, {
        error:
          'Você não pode redefinir sua própria senha por este painel. Utilize a função de troca de senha no seu perfil.',
      })
    }

    // Proteção da conta de sistema / Administrador mestre
    try {
      const targetCheck = $app.findRecordById('_pb_users_auth_', targetUserId)
      const targetEmail = targetCheck.getString('email').toLowerCase()
      if (targetEmail === 'valdknupp@gmail.com') {
        return e.json(403, {
          error: 'Esta conta de sistema não pode ser gerenciada pelo painel.',
        })
      }
    } catch (_) {
      // Usuário não encontrado será tratado abaixo
    }

    if (!newPassword || newPassword.length < 8) {
      return e.json(400, { error: 'A nova senha temporária deve conter no mínimo 8 caracteres.' })
    }

    try {
      const targetUser = $app.findRecordById('_pb_users_auth_', targetUserId)
      targetUser.setPassword(newPassword)
      $app.save(targetUser)

      // Registrar auditoria
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const audit = new Record(auditCol)
        audit.set('user', authRecord.id)
        audit.set('entity_type', 'users')
        audit.set('entity_id', targetUser.id)
        audit.set('action', 'RESET_PASSWORD')
        audit.set(
          'summary',
          `Senha temporária gerada por ${authRecord.getString('name') || authRecord.getString('email')} (${requesterProfile}) para o usuário ${targetUser.getString('email')}`,
        )
        $app.save(audit)
      } catch (auditErr) {
        console.error('Falha ao gravar log de auditoria: ' + auditErr)
      }

      return e.json(200, { success: true, message: 'Senha temporária definida com sucesso.' })
    } catch (err) {
      console.error('Erro ao redefinir senha do usuário: ' + err)
      return e.json(404, { error: 'Usuário não encontrado ou não foi possível atualizar a senha.' })
    }
  },
  $apis.requireAuth(),
)
