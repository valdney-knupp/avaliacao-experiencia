migrate(
  (app) => {
    // 1. Adicionar campo client_email_notifs na coleção clients se não existir
    const clientsCol = app.findCollectionByNameOrId('clients')
    if (!clientsCol.fields.getByName('notified_milestones')) {
      clientsCol.fields.add(
        new JSONField({
          name: 'notified_milestones',
          required: false,
          maxSize: 524288,
        }),
      )
      app.save(clientsCol)
    }

    // 2. Criar coleção client_email_logs para histórico detalhado e rastreio de auditoria/interface
    let emailLogsCol
    try {
      emailLogsCol = app.findCollectionByNameOrId('client_email_logs')
    } catch (_) {
      emailLogsCol = new Collection({
        name: 'client_email_logs',
        type: 'base',
        listRule: "@request.auth.id != '' && @request.auth.email = 'valdknupp@gmail.com'",
        viewRule: "@request.auth.id != '' && @request.auth.email = 'valdknupp@gmail.com'",
        createRule: null,
        updateRule: null,
        deleteRule: null,
        fields: [
          {
            name: 'client',
            type: 'relation',
            required: true,
            collectionId: clientsCol.id,
            cascadeDelete: true,
            maxSelect: 1,
          },
          { name: 'recipient', type: 'text', required: true },
          {
            name: 'type',
            type: 'select',
            required: true,
            values: [
              'expiring_7d',
              'expiring_3d',
              'expiring_1d',
              'suspended_overdue',
              'reactivated_payment',
            ],
            maxSelect: 1,
          },
          { name: 'subject', type: 'text', required: true },
          { name: 'paid_until', type: 'text' },
          { name: 'plan', type: 'text' },
          { name: 'dedupe_key', type: 'text', required: true },
          {
            name: 'status',
            type: 'select',
            required: true,
            values: ['Enviado', 'Falha'],
            maxSelect: 1,
          },
          { name: 'error_message', type: 'text' },
          { name: 'sent_at', type: 'date' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE UNIQUE INDEX idx_client_email_logs_dedupe ON client_email_logs (dedupe_key)',
          'CREATE INDEX idx_client_email_logs_client ON client_email_logs (client)',
          'CREATE INDEX idx_client_email_logs_type ON client_email_logs (type)',
        ],
      })
      app.save(emailLogsCol)
    }
  },
  (app) => {
    try {
      const emailLogsCol = app.findCollectionByNameOrId('client_email_logs')
      app.delete(emailLogsCol)
    } catch (_) {}

    try {
      const clientsCol = app.findCollectionByNameOrId('clients')
      const f = clientsCol.fields.getByName('notified_milestones')
      if (f) {
        clientsCol.fields.remove(f)
        app.save(clientsCol)
      }
    } catch (_) {}
  },
)
