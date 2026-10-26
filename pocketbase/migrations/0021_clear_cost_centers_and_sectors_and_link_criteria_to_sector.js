migrate(
  (app) => {
    // 1. Zerar os cadastros de centro de custo e de setores no banco de forma idempotente
    try {
      const ccCol = app.findCollectionByNameOrId('cost_centers')
      app.truncateCollection(ccCol)
      console.log('Coleção cost_centers zerada com sucesso.')
    } catch (err) {
      console.log('Aviso ao zerar cost_centers: ' + err)
    }

    try {
      const secCol = app.findCollectionByNameOrId('sectors')
      app.truncateCollection(secCol)
      console.log('Coleção sectors zerada com sucesso.')
    } catch (err) {
      console.log('Aviso ao zerar sectors: ' + err)
    }

    // 2. Adicionar campo relation 'sector' na coleção evaluation_criteria para vincular critérios a setores específicos
    const criteriaCol = app.findCollectionByNameOrId('evaluation_criteria')
    if (!criteriaCol.fields.getByName('sector')) {
      const sectorsCol = app.findCollectionByNameOrId('sectors')
      criteriaCol.fields.add(
        new RelationField({
          name: 'sector',
          collectionId: sectorsCol.id,
          cascadeDelete: false,
          maxSelect: 1,
          required: false,
        }),
      )
      app.save(criteriaCol)
      console.log("Campo relation 'sector' adicionado a evaluation_criteria.")
    }
  },
  (app) => {
    // Reversão no-op
  },
)
