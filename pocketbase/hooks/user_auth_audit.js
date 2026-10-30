// Hook to record user login audit and update last_accessed timestamp
onRecordAuthWithPasswordRequest((e) => {
  e.next()

  try {
    const user = e.record
    if (!user) return

    // Check if user is active or suspended
    const userEmail = user.getString('email').trim().toLowerCase()
    const isMaster = userEmail === 'valdknupp@gmail.com'

    // Master is never blocked or suspended
    if (!isMaster) {
      const clientId = user.getString('client')
      if (clientId) {
        try {
          const clientRec = $app.findRecordById('clients', clientId)
          const clientStatus = clientRec.getString('status')
          const clientActive = clientRec.getBool('active')

          if (
            clientStatus === 'suspended_overdue' ||
            (!clientActive && clientStatus === 'suspended_overdue')
          ) {
            throw new BadRequestError(
              'Acesso suspenso — regularize seu pagamento para reativar o acesso. Contato: WhatsApp (82) 99106-9350 ou valdknupp@gmail.com',
            )
          }

          if (!clientActive || clientStatus === 'blocked_manually') {
            throw new BadRequestError(
              'Acesso bloqueado pelo administrador. Contate o suporte: WhatsApp (82) 99106-9350 ou valdknupp@gmail.com',
            )
          }
        } catch (cErr) {
          // If error is BadRequestError, rethrow it
          if (cErr && cErr.status === 400) throw cErr
          if (cErr && String(cErr).includes('suspenso')) throw cErr
        }
      }

      const isActive = user.getBool('active')
      if (!isActive) {
        throw new BadRequestError(
          'Usuário inativo. Contate o suporte: WhatsApp (82) 99106-9350 ou valdknupp@gmail.com',
        )
      }
    }

    user.set('last_accessed', new DateTime())
    $app.save(user)

    // Audit log
    const auditCol = $app.findCollectionByNameOrId('audit_logs')
    const audit = new Record(auditCol)
    audit.set('user', user.id)
    audit.set('entity_type', 'users')
    audit.set('entity_id', user.id)
    audit.set('action', 'LOGIN')
    audit.set(
      'summary',
      `Login bem-sucedido para o usuário ${user.getString('email')} (Perfil: ${user.getString('profile')})`,
    )
    $app.save(audit)
  } catch (err) {
    console.error('Erro pós-autenticação: ' + err)
  }
}, 'users')
