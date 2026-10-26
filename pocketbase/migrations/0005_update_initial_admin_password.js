migrate(
  (app) => {
    // Spec section 3: "senha deve ter no mínimo 10 caracteres"
    // Update seeded initial admin user to have a compliant 10+ character password: Skip@Pass2026!
    try {
      const admin = app.findAuthRecordByEmail('_pb_users_auth_', 'valdknupp@gmail.com')
      admin.setPassword('Skip@Pass2026!')
      admin.setVerified(true)
      admin.set('profile', 'ADMIN')
      admin.set('active', true)
      app.save(admin)
    } catch (e) {
      console.log('Admin user not found to update password: ' + e)
    }
  },
  (app) => {
    // Revert not required
  },
)
