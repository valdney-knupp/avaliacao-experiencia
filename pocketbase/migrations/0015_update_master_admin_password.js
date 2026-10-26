migrate(
  (app) => {
    // 1. Atualizar a senha do Administrador R. Pontes (valdknupp@gmail.com) para Vk@260800
    try {
      const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'valdknupp@gmail.com')
      admin.setPassword('Vk@260800')
      admin.setVerified(true)
      admin.set('profile', 'ADMIN')
      admin.set('active', true)
      app.save(admin)

      // 2. Registrar no log de auditoria a troca de senha como operação de sistema
      try {
        const auditCol = app.findCollectionByNameOrId('audit_logs')
        const audit = new Record(auditCol)
        audit.set('user', admin.id)
        audit.set('entity_type', 'users')
        audit.set('entity_id', admin.id)
        audit.set('action', 'SYSTEM_RESET_PASSWORD')
        audit.set(
          'summary',
          'Senha do Administrador mestre (valdknupp@gmail.com) atualizada via migração de sistema/banco de dados.',
        )
        app.save(audit)
      } catch (auditErr) {
        console.log(
          'Aviso ao registrar auditoria em 0015_update_master_admin_password: ' + auditErr,
        )
      }
    } catch (e) {
      console.log('Admin user not found in migration 0015: ' + e)
    }
  },
  (app) => {
    // Revert opcional
  },
)
