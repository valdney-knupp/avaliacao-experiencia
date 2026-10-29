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
      // 3. Execução da limpeza respeitando multi-tenancy:
      // Se for o master valdknupp@gmail.com sem client especificado, limpa todas as coleções operacionais.
      // Se for um administrador de cliente, limpa APENAS os dados do cliente dele!
      const requesterEmail = authRecord.getString('email').trim().toLowerCase()
      const isMaster = requesterEmail === 'valdknupp@gmail.com'
      const clientScope = isMaster
        ? body.client
          ? String(body.client).trim()
          : null
        : authRecord.getString('client') || null

      let answersCount = 0
      let evalsCount = 0
      let collabsCount = 0
      let importsCount = 0
      let notifsCount = 0

      if (!clientScope && isMaster) {
        // Truncar geral do sistema (apenas quando master solicita globalmente)
        try {
          answersCount = $app.countRecords('evaluation_answers')
          $app.truncateCollection($app.findCollectionByNameOrId('evaluation_answers'))
        } catch (err) {
          console.warn('Aviso ao truncar evaluation_answers: ' + err)
        }

        try {
          evalsCount = $app.countRecords('evaluations')
          $app.truncateCollection($app.findCollectionByNameOrId('evaluations'))
        } catch (err) {
          console.warn('Aviso ao truncar evaluations: ' + err)
        }

        try {
          collabsCount = $app.countRecords('collaborators')
          $app.truncateCollection($app.findCollectionByNameOrId('collaborators'))
        } catch (err) {
          console.warn('Aviso ao truncar collaborators: ' + err)
        }

        try {
          importsCount = $app.countRecords('imports')
          $app.truncateCollection($app.findCollectionByNameOrId('imports'))
        } catch (err) {
          console.warn('Aviso ao truncar imports: ' + err)
        }

        try {
          notifsCount = $app.countRecords('notifications')
          $app.truncateCollection($app.findCollectionByNameOrId('notifications'))
        } catch (err) {
          console.warn('Aviso ao truncar notifications: ' + err)
        }
      } else if (clientScope) {
        // Limpar apenas registros vinculados ao client informado
        try {
          const answers = $app.findRecordsByFilter(
            'evaluation_answers',
            `client = '${clientScope}'`,
            '',
            50000,
            0,
          )
          for (const a of answers) {
            $app.delete(a)
            answersCount++
          }
        } catch (_) {}

        try {
          const evals = $app.findRecordsByFilter(
            'evaluations',
            `client = '${clientScope}'`,
            '',
            50000,
            0,
          )
          for (const ev of evals) {
            $app.delete(ev)
            evalsCount++
          }
        } catch (_) {}

        try {
          const collabs = $app.findRecordsByFilter(
            'collaborators',
            `client = '${clientScope}'`,
            '',
            50000,
            0,
          )
          for (const c of collabs) {
            $app.delete(c)
            collabsCount++
          }
        } catch (_) {}

        try {
          const imps = $app.findRecordsByFilter(
            'imports',
            `client = '${clientScope}'`,
            '',
            10000,
            0,
          )
          for (const im of imps) {
            $app.delete(im)
            importsCount++
          }
        } catch (_) {}

        try {
          const notifs = $app.findRecordsByFilter(
            'notifications',
            `client = '${clientScope}'`,
            '',
            20000,
            0,
          )
          for (const n of notifs) {
            $app.delete(n)
            notifsCount++
          }
        } catch (_) {}
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
