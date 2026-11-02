migrate(
  (app) => {
    let manualsCol
    try {
      manualsCol = app.findCollectionByNameOrId('system_assets')
    } catch (_) {
      manualsCol = new Collection({
        name: 'system_assets',
        type: 'base',
        listRule: '', // público para leitura/download
        viewRule: '',
        createRule: '', // permite upload inicial do manual do usuário
        updateRule: '',
        deleteRule: null,
        fields: [
          { name: 'name', type: 'text', required: true },
          { name: 'key', type: 'text', required: true },
          {
            name: 'file',
            type: 'file',
            required: false,
            maxSize: 52428800, // 50MB
            mimeTypes: [
              'application/pdf',
              'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
            ],
          },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: ['CREATE UNIQUE INDEX idx_system_assets_key ON system_assets (key)'],
      })
      app.save(manualsCol)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('system_assets')
      app.delete(col)
    } catch (_) {}
  },
)
