migrate(
  (app) => {
    // 1. Permitir que qualquer usuário com perfil ADMIN liste e visualize vendas (sales)
    try {
      const salesCol = app.findCollectionByNameOrId('sales')
      const adminRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
      salesCol.listRule = adminRule
      salesCol.viewRule = adminRule
      // create/update/delete permanecem restritos ao master ou hooks
      app.save(salesCol)
    } catch (err) {
      console.warn('[0037] Erro ao ajustar regras de sales:', err)
    }

    // 2. Permitir que perfil ADMIN liste e visualize todos os clientes (clients)
    try {
      const clientsCol = app.findCollectionByNameOrId('clients')
      const adminClientsRule =
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || id = @request.auth.client)"
      clientsCol.listRule = adminClientsRule
      clientsCol.viewRule = adminClientsRule
      app.save(clientsCol)
    } catch (err) {
      console.warn('[0037] Erro ao ajustar regras de clients:', err)
    }
  },
  (app) => {
    try {
      const salesCol = app.findCollectionByNameOrId('sales')
      const masterRule =
        "@request.auth.id != '' && @request.auth.profile = 'ADMIN' && @request.auth.email = 'valdknupp@gmail.com'"
      salesCol.listRule = masterRule
      salesCol.viewRule = masterRule
      app.save(salesCol)
    } catch (_) {}

    try {
      const clientsCol = app.findCollectionByNameOrId('clients')
      const masterClientsRule =
        "@request.auth.id != '' && (@request.auth.email = 'valdknupp@gmail.com' || id = @request.auth.client)"
      clientsCol.listRule = masterClientsRule
      clientsCol.viewRule = masterClientsRule
      app.save(clientsCol)
    } catch (_) {}
  },
)
