migrate(
  (app) => {
    // 1. imports collection:
    // Apenas ADMIN tem permissão total (list, view, create, update, delete)
    // HR, Gestores e outros não têm acesso a imports
    const imports = app.findCollectionByNameOrId('imports')
    imports.listRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    imports.viewRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    imports.createRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    imports.updateRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    imports.deleteRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    app.save(imports)

    // 2. audit_logs collection:
    // Apenas ADMIN pode listar e visualizar a trilha de auditoria
    // createRule continua auth users para registrar ações do sistema
    const auditLogs = app.findCollectionByNameOrId('audit_logs')
    auditLogs.listRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    auditLogs.viewRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    auditLogs.createRule = "@request.auth.id != ''"
    auditLogs.updateRule = null
    auditLogs.deleteRule = null
    app.save(auditLogs)

    // 3. Lookups de Administração (cost_centers, sectors, evaluation_criteria, settings):
    // List e View continuam acessíveis aos autenticados (necessários para formulários e listagens)
    // Create e Update passam a aceitar ADMIN e HR (Gestão de Pessoas ganha Administração)
    // Delete permanece estrito para ADMIN
    const costCenters = app.findCollectionByNameOrId('cost_centers')
    costCenters.createRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
    costCenters.updateRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
    costCenters.deleteRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    app.save(costCenters)

    const sectors = app.findCollectionByNameOrId('sectors')
    sectors.createRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
    sectors.updateRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
    sectors.deleteRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    app.save(sectors)

    const criteria = app.findCollectionByNameOrId('evaluation_criteria')
    criteria.createRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
    criteria.updateRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
    criteria.deleteRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    app.save(criteria)

    const settings = app.findCollectionByNameOrId('settings')
    settings.createRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
    settings.updateRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
    settings.deleteRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    app.save(settings)

    // 4. users collection:
    // List e View: ADMIN e HR podem listar todos; outros visualizam apenas a si mesmos
    // Update: ADMIN e HR podem atualizar usuários; usuários podem atualizar seu próprio perfil
    // Delete: apenas ADMIN
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.listRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || id = @request.auth.id)"
    users.viewRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || id = @request.auth.id)"
    users.updateRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || id = @request.auth.id)"
    users.deleteRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    app.save(users)
  },
  (app) => {
    // Reverter para regras anteriores
    const imports = app.findCollectionByNameOrId('imports')
    imports.listRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
    imports.viewRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
    imports.createRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
    imports.updateRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    imports.deleteRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    app.save(imports)

    const auditLogs = app.findCollectionByNameOrId('audit_logs')
    auditLogs.listRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
    auditLogs.viewRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
    app.save(auditLogs)

    const costCenters = app.findCollectionByNameOrId('cost_centers')
    costCenters.createRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    costCenters.updateRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    app.save(costCenters)

    const sectors = app.findCollectionByNameOrId('sectors')
    sectors.createRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    sectors.updateRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    app.save(sectors)

    const criteria = app.findCollectionByNameOrId('evaluation_criteria')
    criteria.createRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    criteria.updateRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    app.save(criteria)

    const settings = app.findCollectionByNameOrId('settings')
    settings.createRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    settings.updateRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    app.save(settings)

    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.updateRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || id = @request.auth.id)"
    app.save(users)
  },
)
