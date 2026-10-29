migrate(
  (app) => {
    // 1. Criar coleção 'clients' para gerenciar compradores e empresas (multi-tenant)
    let clientsCol = null
    try {
      clientsCol = app.findCollectionByNameOrId('clients')
    } catch (_) {
      clientsCol = new Collection({
        name: 'clients',
        type: 'base',
        // Acesso restrito ao master ou leitura do próprio registro pelo tenant
        listRule:
          "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || id = @request.auth.client)",
        viewRule:
          "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || id = @request.auth.client)",
        createRule: "@request.auth.id != '' && @request.auth.email = 'valdknupp@gmail.com'",
        updateRule: "@request.auth.id != '' && @request.auth.email = 'valdknupp@gmail.com'",
        deleteRule: "@request.auth.id != '' && @request.auth.email = 'valdknupp@gmail.com'",
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'email', type: 'email', required: true },
          {
            name: 'plan',
            type: 'select',
            required: true,
            values: ['MENSAL', 'ANUAL', 'OUTRO'],
            maxSelect: 1,
          },
          { name: 'active', type: 'bool' },
          { name: 'notes', type: 'text' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE INDEX idx_clients_email ON clients (email)'],
      })
      app.save(clientsCol)
    }

    const clients = app.findCollectionByNameOrId('clients')

    // 2. Adicionar campo 'client' em 'users'
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    if (!usersCol.fields.getByName('client')) {
      usersCol.fields.add(
        new RelationField({
          name: 'client',
          collectionId: clients.id,
          required: false,
          maxSelect: 1,
          cascadeDelete: false,
        }),
      )
      // Ajustar regras de users para isolamento multi-tenant
      // Master (valdknupp@gmail.com) vê todos
      // Compradores/usuários de um tenant só veem usuários do mesmo tenant
      usersCol.listRule =
        "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client != '' && client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || id = @request.auth.id)))"
      usersCol.viewRule =
        "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client != '' && client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || id = @request.auth.id)))"
      usersCol.updateRule =
        "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client != '' && client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || id = @request.auth.id)))"
      usersCol.deleteRule =
        "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client != '' && client = @request.auth.client && @request.auth.profile = 'ADMIN'))"
      app.save(usersCol)
    }

    // 3. Atualizar cost_centers
    const costCentersCol = app.findCollectionByNameOrId('cost_centers')
    if (!costCentersCol.fields.getByName('client')) {
      costCentersCol.fields.add(
        new RelationField({
          name: 'client',
          collectionId: clients.id,
          required: false,
          maxSelect: 1,
          cascadeDelete: true,
        }),
      )
    }
    // Remover índice único de nome simples para permitir nomes iguais em clientes diferentes
    try {
      costCentersCol.removeIndex('idx_cost_centers_name')
    } catch (_) {}
    try {
      costCentersCol.addIndex('idx_cost_centers_client_name', false, 'client,name', '')
    } catch (_) {}
    costCentersCol.listRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || client = @request.auth.client)"
    costCentersCol.viewRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || client = @request.auth.client)"
    costCentersCol.createRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))"
    costCentersCol.updateRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))"
    costCentersCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))"
    app.save(costCentersCol)

    // 4. Atualizar sectors
    const sectorsCol = app.findCollectionByNameOrId('sectors')
    if (!sectorsCol.fields.getByName('client')) {
      sectorsCol.fields.add(
        new RelationField({
          name: 'client',
          collectionId: clients.id,
          required: false,
          maxSelect: 1,
          cascadeDelete: true,
        }),
      )
    }
    try {
      sectorsCol.removeIndex('idx_sectors_name')
    } catch (_) {}
    try {
      sectorsCol.addIndex('idx_sectors_client_name', false, 'client,name', '')
    } catch (_) {}
    sectorsCol.listRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || client = @request.auth.client)"
    sectorsCol.viewRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || client = @request.auth.client)"
    sectorsCol.createRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))"
    sectorsCol.updateRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))"
    sectorsCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))"
    app.save(sectorsCol)

    // 5. Atualizar evaluation_criteria
    const criteriaCol = app.findCollectionByNameOrId('evaluation_criteria')
    if (!criteriaCol.fields.getByName('client')) {
      criteriaCol.fields.add(
        new RelationField({
          name: 'client',
          collectionId: clients.id,
          required: false,
          maxSelect: 1,
          cascadeDelete: true,
        }),
      )
    }
    try {
      criteriaCol.addIndex('idx_criteria_client', false, 'client', '')
    } catch (_) {}
    criteriaCol.listRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || client = @request.auth.client || client = null)"
    criteriaCol.viewRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || client = @request.auth.client || client = null)"
    criteriaCol.createRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))"
    criteriaCol.updateRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))"
    criteriaCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))"
    app.save(criteriaCol)

    // 6. Atualizar collaborators
    const collabsCol = app.findCollectionByNameOrId('collaborators')
    if (!collabsCol.fields.getByName('client')) {
      collabsCol.fields.add(
        new RelationField({
          name: 'client',
          collectionId: clients.id,
          required: false,
          maxSelect: 1,
          cascadeDelete: true,
        }),
      )
    }
    try {
      collabsCol.addIndex('idx_collab_client', false, 'client', '')
    } catch (_) {}
    collabsCol.listRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || (@request.auth.profile = 'MANAGER_WORKSITE' && cost_center = @request.auth.cost_center) || (@request.auth.profile = 'MANAGER_DEPARTMENT' && sector = @request.auth.sector) || @request.auth.profile = 'VIEWER' || @request.auth.profile = 'ADMIN_ASSISTANT')))"
    collabsCol.viewRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || (@request.auth.profile = 'MANAGER_WORKSITE' && cost_center = @request.auth.cost_center) || (@request.auth.profile = 'MANAGER_DEPARTMENT' && sector = @request.auth.sector) || @request.auth.profile = 'VIEWER' || @request.auth.profile = 'ADMIN_ASSISTANT')))"
    collabsCol.createRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'ADMIN_ASSISTANT')))"
    collabsCol.updateRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'ADMIN_ASSISTANT')))"
    collabsCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))"
    app.save(collabsCol)

    // 7. Atualizar evaluations
    const evalsCol = app.findCollectionByNameOrId('evaluations')
    if (!evalsCol.fields.getByName('client')) {
      evalsCol.fields.add(
        new RelationField({
          name: 'client',
          collectionId: clients.id,
          required: false,
          maxSelect: 1,
          cascadeDelete: true,
        }),
      )
    }
    try {
      evalsCol.addIndex('idx_eval_client', false, 'client', '')
    } catch (_) {}
    evalsCol.listRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || client = @request.auth.client)"
    evalsCol.viewRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || client = @request.auth.client)"
    evalsCol.createRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT' || @request.auth.profile = 'ADMIN_ASSISTANT')))"
    evalsCol.updateRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))"
    evalsCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))"
    app.save(evalsCol)

    // 8. Atualizar evaluation_answers
    const answersCol = app.findCollectionByNameOrId('evaluation_answers')
    if (!answersCol.fields.getByName('client')) {
      answersCol.fields.add(
        new RelationField({
          name: 'client',
          collectionId: clients.id,
          required: false,
          maxSelect: 1,
          cascadeDelete: true,
        }),
      )
    }
    try {
      answersCol.addIndex('idx_answers_client', false, 'client', '')
    } catch (_) {}
    answersCol.listRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || client = @request.auth.client)"
    answersCol.viewRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || client = @request.auth.client)"
    answersCol.createRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT' || @request.auth.profile = 'ADMIN_ASSISTANT')))"
    answersCol.updateRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))"
    answersCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))"
    app.save(answersCol)

    // 9. Atualizar imports
    const importsCol = app.findCollectionByNameOrId('imports')
    if (!importsCol.fields.getByName('client')) {
      importsCol.fields.add(
        new RelationField({
          name: 'client',
          collectionId: clients.id,
          required: false,
          maxSelect: 1,
          cascadeDelete: true,
        }),
      )
    }
    try {
      importsCol.addIndex('idx_imports_client', false, 'client', '')
    } catch (_) {}
    importsCol.listRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))"
    importsCol.viewRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))"
    importsCol.createRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))"
    importsCol.updateRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))"
    importsCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))"
    app.save(importsCol)

    // 10. Atualizar audit_logs
    const auditLogsCol = app.findCollectionByNameOrId('audit_logs')
    if (!auditLogsCol.fields.getByName('client')) {
      auditLogsCol.fields.add(
        new RelationField({
          name: 'client',
          collectionId: clients.id,
          required: false,
          maxSelect: 1,
          cascadeDelete: true,
        }),
      )
    }
    try {
      auditLogsCol.addIndex('idx_audit_client', false, 'client', '')
    } catch (_) {}
    auditLogsCol.listRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))"
    auditLogsCol.viewRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))"
    auditLogsCol.createRule = "@request.auth.id != ''"
    app.save(auditLogsCol)

    // 11. Atualizar notifications
    const notifsCol = app.findCollectionByNameOrId('notifications')
    if (!notifsCol.fields.getByName('client')) {
      notifsCol.fields.add(
        new RelationField({
          name: 'client',
          collectionId: clients.id,
          required: false,
          maxSelect: 1,
          cascadeDelete: true,
        }),
      )
    }
    try {
      notifsCol.addIndex('idx_notifs_client', false, 'client', '')
    } catch (_) {}
    notifsCol.listRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || client = @request.auth.client)"
    notifsCol.viewRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || client = @request.auth.client)"
    notifsCol.createRule = "@request.auth.id != ''"
    notifsCol.updateRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || client = @request.auth.client)"
    notifsCol.deleteRule =
      "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))"
    app.save(notifsCol)
  },
  (app) => {
    // Reversão
    try {
      const col = app.findCollectionByNameOrId('clients')
      app.delete(col)
    } catch (_) {}
  },
)
