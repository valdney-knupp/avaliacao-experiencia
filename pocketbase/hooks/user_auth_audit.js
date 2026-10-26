// Hook to record user login audit and update last_accessed timestamp
onRecordAuthWithPasswordRequest((e) => {
  e.next()

  try {
    const user = e.record
    if (!user) return

    // Check if user is active
    const isActive = user.getBool('active')
    if (!isActive) {
      throw new BadRequestError('Usuário inativo. Contate o administrador.')
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
