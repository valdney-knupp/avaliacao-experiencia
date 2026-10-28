migrate(
  (app) => {
    // 1. Restringir coleção 'sales' exclusivamente para o usuário master valdknupp@gmail.com
    try {
      const salesCol = app.findCollectionByNameOrId('sales')
      const masterRule =
        "@request.auth.id != '' && @request.auth.profile = 'ADMIN' && @request.auth.email = 'valdknupp@gmail.com'"
      salesCol.listRule = masterRule
      salesCol.viewRule = masterRule
      salesCol.updateRule = masterRule
      salesCol.deleteRule = masterRule
      app.save(salesCol)
    } catch (err) {
      console.warn('Aviso ao ajustar regras da coleção sales:', err)
    }

    // 2. Proteger settings de preços e stripe contra alteração por qualquer usuário que não seja o master
    // Regra de update: administradores gerais podem alterar settings comuns, mas settings que iniciam com 'stripe_'
    // só podem ser alteradas se o e-mail for valdknupp@gmail.com
    try {
      const settingsCol = app.findCollectionByNameOrId('settings')
      settingsCol.updateRule =
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR') && (key !~ 'stripe' || @request.auth.email = 'valdknupp@gmail.com')"
      app.save(settingsCol)
    } catch (err) {
      console.warn('Aviso ao ajustar regras da coleção settings:', err)
    }
  },
  (app) => {
    try {
      const salesCol = app.findCollectionByNameOrId('sales')
      salesCol.listRule =
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
      salesCol.viewRule =
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
      salesCol.updateRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
      salesCol.deleteRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
      app.save(salesCol)
    } catch (_) {}

    try {
      const settingsCol = app.findCollectionByNameOrId('settings')
      settingsCol.updateRule =
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
      app.save(settingsCol)
    } catch (_) {}
  },
)
