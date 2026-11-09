migrate(
  (app) => {
    // 0038: Criação da coleção 'leads' para registro e auditoria de contatos capturados na página de vendas
    try {
      app.findCollectionByNameOrId('leads')
      return // Já existe
    } catch (_) {}

    const collection = new Collection({
      name: 'leads',
      type: 'base',
      listRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      viewRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      createRule: '', // Público (página de vendas)
      updateRule: null,
      deleteRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'email', type: 'email', required: true },
        { name: 'source', type: 'text' },
        {
          name: 'status',
          type: 'select',
          values: ['pending', 'synced', 'exists', 'failed'],
          maxSelect: 1,
        },
        { name: 'mailchimp_status', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_leads_email ON leads (email)',
        'CREATE INDEX idx_leads_created ON leads (created DESC)',
      ],
    })

    app.save(collection)
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('leads')
      app.delete(col)
    } catch (_) {}
  },
)
