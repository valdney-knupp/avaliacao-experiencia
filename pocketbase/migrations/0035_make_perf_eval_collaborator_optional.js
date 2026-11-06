migrate(
  (app) => {
    // Torna o campo 'collaborator' opcional na coleção 'perf_evaluations'
    // para permitir a criação do rascunho antes da seleção do colaborador no formulário.
    const col = app.findCollectionByNameOrId('perf_evaluations')
    const collaboratorField = col.fields.getByName('collaborator')
    if (collaboratorField) {
      collaboratorField.required = false
      app.save(col)
    }
  },
  (app) => {
    try {
      const col = app.findCollectionByNameOrId('perf_evaluations')
      const collaboratorField = col.fields.getByName('collaborator')
      if (collaboratorField) {
        collaboratorField.required = true
        app.save(col)
      }
    } catch (_) {}
  },
)
