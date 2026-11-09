migrate(
  (app) => {
    // 0040_unify_manager_profiles.js
    // Unifica os perfis MANAGER_WORKSITE e MANAGER_DEPARTMENT em um perfil único 'MANAGER' (Gestor).
    // Mantém compatibilidade e regras de acesso idempotentes sem perda de dados.

    // 1. Atualizar valores permitidos no campo 'profile' da coleção users
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const profileField = usersCol.fields.getByName('profile')
      if (profileField) {
        // Garantir que MANAGER e os legados estejam no enum para não falhar validações
        const currentVals = profileField.values || []
        const newVals = [
          'ADMIN',
          'HR',
          'MANAGER',
          'MANAGER_WORKSITE',
          'MANAGER_DEPARTMENT',
          'ADMIN_ASSISTANT',
          'VIEWER',
        ]
        profileField.values = Array.from(new Set([...currentVals, ...newVals]))
        app.save(usersCol)
      }
    } catch (err) {
      console.warn('[0040] Erro ao atualizar campo profile em users:', err)
    }

    // 2. Migrar contas existentes de MANAGER_WORKSITE e MANAGER_DEPARTMENT para MANAGER
    try {
      const usersToMigrate = app.findRecordsByFilter(
        '_pb_users_auth_',
        "profile = 'MANAGER_WORKSITE' || profile = 'MANAGER_DEPARTMENT'",
        '',
        1000,
        0,
      )

      for (let i = 0; i < usersToMigrate.length; i++) {
        const u = usersToMigrate[i]
        u.set('profile', 'MANAGER')
        app.save(u)
      }
    } catch (err) {
      console.warn('[0040] Erro ao migrar registros de usuários para MANAGER:', err)
    }

    // 3. Atualizar regras de acesso da coleção 'collaborators' para incluir 'MANAGER'
    try {
      const col = app.findCollectionByNameOrId('collaborators')
      const managerFilter =
        "(@request.auth.profile = 'MANAGER' && (cost_center = @request.auth.cost_center || sector = @request.auth.sector || (@request.auth.cost_center = '' && @request.auth.sector = ''))) || (@request.auth.profile = 'MANAGER_WORKSITE' && cost_center = @request.auth.cost_center) || (@request.auth.profile = 'MANAGER_DEPARTMENT' && sector = @request.auth.sector)"

      col.listRule = `@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || ${managerFilter} || @request.auth.profile = 'VIEWER' || @request.auth.profile = 'ADMIN_ASSISTANT')))`
      col.viewRule = col.listRule

      col.createRule =
        "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT' || @request.auth.profile = 'ADMIN_ASSISTANT')))"
      col.updateRule = col.createRule

      app.save(col)
    } catch (err) {
      console.warn('[0040] Erro ao atualizar regras de collaborators:', err)
    }

    // 4. Atualizar regras da coleção 'evaluations'
    try {
      const col = app.findCollectionByNameOrId('evaluations')
      col.createRule =
        "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT' || @request.auth.profile = 'ADMIN_ASSISTANT')))"
      col.updateRule =
        "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT' || @request.auth.profile = 'ADMIN_ASSISTANT' || responsible = @request.auth.id)))"
      app.save(col)
    } catch (err) {
      console.warn('[0040] Erro ao atualizar regras de evaluations:', err)
    }

    // 5. Atualizar regras da coleção 'perf_evaluations'
    try {
      const col = app.findCollectionByNameOrId('perf_evaluations')
      const evalProfiles =
        "@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT' || @request.auth.profile = 'ADMIN_ASSISTANT'"

      col.createRule =
        "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (" +
        evalProfiles +
        ')))'
      col.updateRule =
        "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (" +
        evalProfiles +
        ' || responsible = @request.auth.id)))'
      app.save(col)
    } catch (err) {
      console.warn('[0040] Erro ao atualizar regras de perf_evaluations:', err)
    }

    // 6. Atualizar regras da coleção 'exit_invites'
    try {
      const col = app.findCollectionByNameOrId('exit_invites')
      col.listRule =
        "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT')))"
      col.viewRule = col.listRule
      app.save(col)
    } catch (err) {
      console.warn('[0040] Erro ao atualizar regras de exit_invites:', err)
    }
  },
  (app) => {
    // Reversão
    try {
      const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
      const profileField = usersCol.fields.getByName('profile')
      if (profileField) {
        profileField.values = [
          'ADMIN',
          'HR',
          'MANAGER_WORKSITE',
          'MANAGER_DEPARTMENT',
          'ADMIN_ASSISTANT',
          'VIEWER',
        ]
        app.save(usersCol)
      }
    } catch (_) {}
  },
)
