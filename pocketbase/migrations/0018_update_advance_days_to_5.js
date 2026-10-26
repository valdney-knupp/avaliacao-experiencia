migrate(
  (app) => {
    try {
      const record = app.findFirstRecordByData('settings', 'key', 'notification_advance_days')
      record.set('value', '5')
      app.save(record)
    } catch (_) {
      // If it does not exist, create it
      try {
        const settingsCol = app.findCollectionByNameOrId('settings')
        const record = new Record(settingsCol)
        record.set('key', 'notification_advance_days')
        record.set('value', '5')
        app.save(record)
      } catch (e) {
        console.warn('Erro ao criar notification_advance_days em 0018: ' + e)
      }
    }
  },
  (app) => {
    try {
      const record = app.findFirstRecordByData('settings', 'key', 'notification_advance_days')
      record.set('value', '15')
      app.save(record)
    } catch (_) {}
  },
)
