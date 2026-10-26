migrate(
  (app) => {
    // Garantir que a senha do usuário Administrador principal seja restabelecida
    // para a credencial conhecida após a redefinição acidental que causou a sessão zumbi.
    try {
      const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'valdknupp@gmail.com')
      admin.setPassword('Skip@Pass2026!')
      admin.setVerified(true)
      admin.set('profile', 'ADMIN')
      admin.set('active', true)
      app.save(admin)
    } catch (e) {
      console.log('Admin user not found in migration 0014: ' + e)
    }
  },
  (app) => {
    // Revert not required
  },
)
