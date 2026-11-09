migrate(
  (app) => {
    // 0039_restrict_sales_and_admin_to_owner.js
    // Garante que a coleção 'sales' seja visível e gerenciável SOMENTE pelo dono/administrador master (valdknupp@gmail.com)
    try {
      const salesCol = app.findCollectionByNameOrId('sales')
      const ownerRule =
        "@request.auth.id != '' && @request.auth.profile = 'ADMIN' && @request.auth.email = 'valdknupp@gmail.com'"
      salesCol.listRule = ownerRule
      salesCol.viewRule = ownerRule
      salesCol.createRule = ownerRule
      salesCol.updateRule = ownerRule
      salesCol.deleteRule = ownerRule
      app.save(salesCol)
    } catch (err) {
      console.warn('[0039] Aviso ao ajustar regras da coleção sales:', err)
    }

    // Garante que a listagem de compradores/clientes (clients) e liberação de acessos seja restrita:
    // O dono master (valdknupp@gmail.com) vê todos os clientes.
    // Qualquer outro usuário autenticado vinculado a um cliente (id = @request.auth.client) só pode ver o próprio registro do seu cliente.
    // NENHUM outro perfil ou admin de terceiro lista a base global de clientes.
    try {
      const clientsCol = app.findCollectionByNameOrId('clients')
      const ownerOrSelfClientRule =
        "@request.auth.id != '' && ((@request.auth.profile = 'ADMIN' && @request.auth.email = 'valdknupp@gmail.com') || id = @request.auth.client)"
      clientsCol.listRule = ownerOrSelfClientRule
      clientsCol.viewRule = ownerOrSelfClientRule
      // create/update/delete permanecem restritos ao master dono ou rotas de backend (hooks)
      clientsCol.createRule =
        "@request.auth.id != '' && @request.auth.profile = 'ADMIN' && @request.auth.email = 'valdknupp@gmail.com'"
      clientsCol.updateRule =
        "@request.auth.id != '' && @request.auth.profile = 'ADMIN' && @request.auth.email = 'valdknupp@gmail.com'"
      clientsCol.deleteRule =
        "@request.auth.id != '' && @request.auth.profile = 'ADMIN' && @request.auth.email = 'valdknupp@gmail.com'"
      app.save(clientsCol)
    } catch (err) {
      console.warn('[0039] Aviso ao ajustar regras da coleção clients:', err)
    }

    // Coleção client_email_logs: restrita exclusivamente ao dono master
    try {
      const emailLogsCol = app.findCollectionByNameOrId('client_email_logs')
      const ownerRule =
        "@request.auth.id != '' && @request.auth.profile = 'ADMIN' && @request.auth.email = 'valdknupp@gmail.com'"
      emailLogsCol.listRule = ownerRule
      emailLogsCol.viewRule = ownerRule
      app.save(emailLogsCol)
    } catch (err) {
      console.warn('[0039] Aviso ao ajustar regras da coleção client_email_logs:', err)
    }

    // Configurações de stripe/preços/vendas protegidas para alteração somente pelo dono
    try {
      const settingsCol = app.findCollectionByNameOrId('settings')
      settingsCol.updateRule =
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR') && (key !~ 'stripe' || @request.auth.email = 'valdknupp@gmail.com')"
      app.save(settingsCol)
    } catch (err) {
      console.warn('[0039] Aviso ao ajustar regras da coleção settings:', err)
    }
  },
  (app) => {
    // Reverter para regras anteriores se necessário
    try {
      const salesCol = app.findCollectionByNameOrId('sales')
      salesCol.listRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
      salesCol.viewRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
      app.save(salesCol)
    } catch (_) {}

    try {
      const clientsCol = app.findCollectionByNameOrId('clients')
      clientsCol.listRule =
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || id = @request.auth.client)"
      clientsCol.viewRule =
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || id = @request.auth.client)"
      app.save(clientsCol)
    } catch (_) {}
  },
)
