migrate(
  (app) => {
    const clientsCol = app.findCollectionByNameOrId('clients')

    if (!clientsCol.fields.getByName('paid_until')) {
      clientsCol.fields.add(
        new DateField({
          name: 'paid_until',
          required: false,
        }),
      )
    }

    if (!clientsCol.fields.getByName('status')) {
      clientsCol.fields.add(
        new SelectField({
          name: 'status',
          required: false,
          values: ['active', 'suspended_overdue', 'blocked_manually'],
          maxSelect: 1,
        }),
      )
    }

    // Adiciona índice em paid_until para consultas rápidas do cron
    try {
      clientsCol.addIndex('idx_clients_paid_until', false, 'paid_until', '')
    } catch (_) {}

    try {
      clientsCol.addIndex('idx_clients_status', false, 'status', '')
    } catch (_) {}

    app.save(clientsCol)

    // Backfill inicial idempotente para clientes já cadastrados (se houver)
    try {
      const records = app.findRecordsByFilter('clients', '', '', 500, 0)
      for (let i = 0; i < records.length; i++) {
        const r = records[i]
        let changed = false
        if (!r.getString('status')) {
          const isActive = r.getBool('active')
          r.set('status', isActive ? 'active' : 'blocked_manually')
          changed = true
        }
        if (changed) {
          app.save(r)
        }
      }
    } catch (_) {}
  },
  (app) => {
    try {
      const clientsCol = app.findCollectionByNameOrId('clients')
      try {
        clientsCol.removeIndex('idx_clients_paid_until')
      } catch (_) {}
      try {
        clientsCol.removeIndex('idx_clients_status')
      } catch (_) {}
      const f1 = clientsCol.fields.getByName('paid_until')
      if (f1) clientsCol.fields.remove(f1)
      const f2 = clientsCol.fields.getByName('status')
      if (f2) clientsCol.fields.remove(f2)
      app.save(clientsCol)
    } catch (_) {}
  },
)
