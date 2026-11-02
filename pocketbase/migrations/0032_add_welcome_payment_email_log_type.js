migrate(
  (app) => {
    // 1. Atualizar campo 'type' na coleção client_email_logs para incluir 'welcome_payment'
    try {
      const emailLogsCol = app.findCollectionByNameOrId('client_email_logs')
      const typeField = emailLogsCol.fields.getByName('type')
      if (typeField) {
        const currentValues = typeField.values || []
        if (!currentValues.includes('welcome_payment')) {
          typeField.values = [...currentValues, 'welcome_payment']
          app.save(emailLogsCol)
        }
      }
    } catch (e) {
      console.warn('[Migration 0032] Erro ao atualizar client_email_logs:', e)
    }
  },
  (app) => {
    try {
      const emailLogsCol = app.findCollectionByNameOrId('client_email_logs')
      const typeField = emailLogsCol.fields.getByName('type')
      if (typeField && typeField.values) {
        typeField.values = typeField.values.filter((v) => v !== 'welcome_payment')
        app.save(emailLogsCol)
      }
    } catch (_) {}
  },
)
