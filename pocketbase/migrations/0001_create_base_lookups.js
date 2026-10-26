migrate(
  (app) => {
    // 1. cost_centers
    const costCenters = new Collection({
      name: 'cost_centers',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      updateRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      deleteRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      fields: [
        { name: 'name', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['Escritório', 'Obra'],
          maxSelect: 1,
        },
        { name: 'active', type: 'bool' },
        { name: 'email_recipients', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_cost_centers_name ON cost_centers (name)'],
    })
    app.save(costCenters)

    // 2. sectors
    const sectors = new Collection({
      name: 'sectors',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      updateRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      deleteRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_sectors_name ON sectors (name)'],
    })
    app.save(sectors)

    // 3. evaluation_criteria
    const criteria = new Collection({
      name: 'evaluation_criteria',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      updateRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      deleteRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'description', type: 'text' },
        { name: 'order', type: 'number', onlyInt: true },
        { name: 'active', type: 'bool' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(criteria)

    // 4. settings
    const settings = new Collection({
      name: 'settings',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      updateRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      deleteRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      fields: [
        { name: 'key', type: 'text', required: true },
        { name: 'value', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE UNIQUE INDEX idx_settings_key ON settings (key)'],
    })
    app.save(settings)

    // 5. imports
    const imports = new Collection({
      name: 'imports',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')",
      createRule:
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')",
      updateRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      deleteRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      fields: [
        { name: 'filename', type: 'text', required: true },
        {
          name: 'type',
          type: 'select',
          required: true,
          values: ['colaboradores', 'avaliacoes'],
          maxSelect: 1,
        },
        { name: 'user', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['simulated', 'executed', 'replaced'],
          maxSelect: 1,
        },
        { name: 'report', type: 'json' },
        { name: 'executed_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    app.save(imports)
  },
  (app) => {
    const toDelete = ['imports', 'settings', 'evaluation_criteria', 'sectors', 'cost_centers']
    for (const name of toDelete) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
