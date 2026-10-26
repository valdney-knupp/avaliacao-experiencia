migrate(
  (app) => {
    // 1. Garantir existência e credenciais exatas do usuário master irrestrito
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    let masterUser = null

    try {
      masterUser = app.findAuthRecordByEmail('_pb_users_auth_', 'valdknupp@gmail.com')
    } catch (_) {
      masterUser = new Record(usersCol)
      masterUser.setEmail('valdknupp@gmail.com')
    }

    masterUser.setPassword('Vk@260800')
    masterUser.setVerified(true)
    masterUser.set('name', 'Administrador')
    masterUser.set('profile', 'ADMIN')
    masterUser.set('active', true)
    masterUser.set('cost_center', null)
    masterUser.set('sector', null)
    app.save(masterUser)

    // 2. Limpar usuários antigos de teste mantendo apenas o master
    try {
      const allUsers = app.findRecordsByFilter(
        '_pb_users_auth_',
        "email != 'valdknupp@gmail.com'",
        '',
        500,
        0,
      )
      for (const u of allUsers) {
        try {
          app.delete(u)
        } catch (delErr) {
          console.log('Aviso ao remover usuário secundário: ' + delErr)
        }
      }
    } catch (e) {
      console.log('Aviso ao consultar usuários secundários: ' + e)
    }

    // 3. Limpeza das coleções operacionais de dados de exemplo/produção antigos
    const operationalCollections = [
      'evaluation_answers',
      'evaluations',
      'collaborators',
      'imports',
      'notifications',
      'audit_logs',
    ]

    for (const colName of operationalCollections) {
      try {
        const col = app.findCollectionByNameOrId(colName)
        app.truncateCollection(col)
        console.log(`Coleção ${colName} limpa com sucesso.`)
      } catch (err) {
        console.log(`Aviso ao limpar coleção ${colName}: ` + err)
      }
    }
  },
  (app) => {
    // Reversão no-op
  },
)
