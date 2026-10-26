migrate(
  (app) => {
    const settingsCol = app.findCollectionByNameOrId('settings')
    try {
      app.findFirstRecordByData('settings', 'key', 'app_url')
    } catch (_) {
      const r = new Record(settingsCol)
      r.set('key', 'app_url')
      r.set('value', 'https://avaliacao-de-experiencia-67c4f.goskip.app')
      app.save(r)
    }
  },
  (app) => {
    try {
      const r = app.findFirstRecordByData('settings', 'key', 'app_url')
      app.delete(r)
    } catch (_) {}
  },
)
