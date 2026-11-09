migrate(
  (app) => {
    const clients = app.findCollectionByNameOrId('clients')

    // Módulo Avaliação de Experiência (inclui Entrevista de Desligamento)
    if (!clients.fields.getByName('experiencia_until')) {
      clients.fields.add(new DateField({ name: 'experiencia_until', required: false }))
    }

    // Módulo Avaliação de Desempenho
    if (!clients.fields.getByName('desempenho_until')) {
      clients.fields.add(new DateField({ name: 'desempenho_until', required: false }))
    }

    app.save(clients)

    // Backfill idempotente: assinaturas legadas (paid_until) mantêm o módulo Experiência,
    // que era o único módulo existente antes da precificação por módulo.
    try {
      const legacy = app.findRecordsByFilter(
        'clients',
        "paid_until != '' && experiencia_until = ''",
        '',
        500,
        0,
      )
      for (const c of legacy) {
        c.set('experiencia_until', c.getString('paid_until'))
        app.save(c)
      }
    } catch (e) {
      console.log('[0031] backfill legado ignorado: ' + e)
    }
  },
  (app) => {
    try {
      const clients = app.findCollectionByNameOrId('clients')
      const f1 = clients.fields.getByName('experiencia_until')
      if (f1) clients.fields.remove(f1)
      const f2 = clients.fields.getByName('desempenho_until')
      if (f2) clients.fields.remove(f2)
      app.save(clients)
    } catch (_) {}
  },
)
