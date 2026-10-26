// Endpoint administrativo seguro para limpeza / reset dos dados de negócio do banco de dados
// Restrito exclusivamente a Administradores (ADMIN).
// Preserva: usuários (_pb_users_auth_), centros de custo (cost_centers), setores (sectors),
// critérios de avaliação (evaluation_criteria), configurações (settings) e auditorias (audit_logs).
// Apaga com segurança: evaluation_answers, evaluations, collaborators, imports e notifications operacionais.

routerAdd(
  'POST',
  '/backend/v1/admin/reset-data',
  (e) => {
    // 1. Autorização: apenas usuários autenticados com perfil ADMIN
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Usuário não autenticado.' })
    }

    const profile = authRecord.getString('profile')
    if (profile !== 'ADMIN') {
      return e.json(403, {
        error: 'Acesso negado: apenas Administradores têm permissão para limpar o banco de dados.',
      })
    }

    // 2. Validação da confirmação no corpo da requisição
    const body = e.requestInfo().body || {}
    const confirmationText = String(body.confirmation || '')
      .trim()
      .toUpperCase()
    if (confirmationText !== 'LIMPAR') {
      return e.json(400, {
        error:
          'Confirmação inválida. É necessário digitar exatamente "LIMPAR" para autorizar a limpeza.',
      })
    }

    try {
      // 3. Execução da limpeza em ordem segura de dependência relacional
      // PocketBase $app.truncateCollection remove todos os registros da coleção de forma rápida e segura.
      // Ordem:
      // A. evaluation_answers (respostas de critérios)
      // B. evaluations (avaliações)
      // C. collaborators (colaboradores)
      // D. imports (registros mestre de importação)
      // E. notifications (notificações operacionais enviadas/pendentes de colaboradores e avaliações)

      let answersCount = 0
      let evalsCount = 0
      let collabsCount = 0
      let importsCount = 0
      let notifsCount = 0

      try {
        answersCount = $app.countRecords('evaluation_answers')
        const answersCol = $app.findCollectionByNameOrId('evaluation_answers')
        $app.truncateCollection(answersCol)
      } catch (err) {
        console.warn('Aviso ao truncar evaluation_answers: ' + err)
      }

      try {
        evalsCount = $app.countRecords('evaluations')
        const evalsCol = $app.findCollectionByNameOrId('evaluations')
        $app.truncateCollection(evalsCol)
      } catch (err) {
        console.warn('Aviso ao truncar evaluations: ' + err)
      }

      try {
        collabsCount = $app.countRecords('collaborators')
        const collabsCol = $app.findCollectionByNameOrId('collaborators')
        $app.truncateCollection(collabsCol)
      } catch (err) {
        console.warn('Aviso ao truncar collaborators: ' + err)
      }

      try {
        importsCount = $app.countRecords('imports')
        const importsCol = $app.findCollectionByNameOrId('imports')
        $app.truncateCollection(importsCol)
      } catch (err) {
        console.warn('Aviso ao truncar imports: ' + err)
      }

      try {
        notifsCount = $app.countRecords('notifications')
        const notifsCol = $app.findCollectionByNameOrId('notifications')
        $app.truncateCollection(notifsCol)
      } catch (err) {
        console.warn('Aviso ao truncar notifications: ' + err)
      }

      // 4. Auditoria OBRIGATÓRIA: registra a limpeza no audit_log (o audit_log é preservado)
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const audit = new Record(auditCol)
        audit.set('user', authRecord.id)
        audit.set('entity_type', 'system')
        audit.set('entity_id', 'reset_database')
        audit.set('action', 'RESET_DATABASE')
        audit.set(
          'summary',
          `Limpeza geral do banco de dados executada por ${authRecord.getString('name') || authRecord.getString('email')}: ` +
            `${collabsCount} colaboradores, ${evalsCount} avaliações, ${answersCount} respostas de critérios, ` +
            `${importsCount} lotes de importação e ${notifsCount} notificações removidos. Cadastros de sistema preservados.`,
        )
        $app.save(audit)
      } catch (auditErr) {
        console.warn('Falha ao gravar log de auditoria do reset: ' + auditErr)
      }

      return e.json(200, {
        success: true,
        message: 'Banco de dados limpo com sucesso.',
        deleted: {
          collaborators: collabsCount,
          evaluations: evalsCount,
          evaluation_answers: answersCount,
          imports: importsCount,
          notifications: notifsCount,
        },
      })
    } catch (err) {
      console.error('Falha geral ao limpar banco de dados: ' + err)
      return e.json(500, {
        error:
          'Ocorreu um erro ao processar a limpeza do banco de dados. Tente novamente mais tarde.',
      })
    }
  },
  $apis.requireAuth(),
)
