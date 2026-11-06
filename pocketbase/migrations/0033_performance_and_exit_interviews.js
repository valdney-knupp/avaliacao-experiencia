// Migration 0033: Avaliação de Desempenho (formulários versionados) + Entrevista de Desligamento
// Coleções novas (todas com campo client para isolamento multi-tenant):
//   perf_form_versions, perf_evaluations, perf_answers
//   exit_form_versions, exit_invites, exit_answers, exit_send_attempts
// Também adiciona campos de contato (contact_email/contact_phone) em collaborators.

migrate(
  (app) => {
    const MASTER = "@request.auth.email = 'valdknupp@gmail.com'"
    const EVAL_PROFILES =
      "@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT' || @request.auth.profile = 'ADMIN_ASSISTANT'"

    const clientsCol = app.findCollectionByNameOrId('clients')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const collaboratorsCol = app.findCollectionByNameOrId('collaborators')

    const clientsId = clientsCol.id
    const usersId = usersCol.id
    const collaboratorsId = collaboratorsCol.id

    // Helper seguro para criar coleção se não existir
    function createColIfMissing(def) {
      try {
        return app.findCollectionByNameOrId(def.name)
      } catch (_) {
        const col = new Collection(def)
        app.save(col)
        return app.findCollectionByNameOrId(def.name)
      }
    }

    // Helper seguro para índice em coleção recém-criada
    function tryAddIndex(col, indexSql) {
      try {
        col.indexes = [...(col.indexes || []), indexSql]
        app.save(col)
      } catch (_) {}
    }

    // ---------- 1. perf_form_versions (depende apenas de clients) ----------
    const perfFormCol = createColIfMissing({
      name: 'perf_form_versions',
      type: 'base',
      listRule: "@request.auth.id != '' && (" + MASTER + ' || client = @request.auth.client)',
      viewRule: "@request.auth.id != '' && (" + MASTER + ' || client = @request.auth.client)',
      createRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))",
      updateRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))",
      deleteRule: MASTER,
      fields: [
        {
          name: 'form_key',
          type: 'select',
          required: true,
          values: ['NIVEL_I', 'NIVEL_II'],
          maxSelect: 1,
        },
        { name: 'version', type: 'number', required: true },
        { name: 'title', type: 'text', required: true },
        { name: 'subtitle', type: 'text' },
        { name: 'description', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Publicado', 'Pendente', 'Inativo'],
          maxSelect: 1,
        },
        { name: 'schema', type: 'json' },
        {
          name: 'client',
          type: 'relation',
          collectionId: clientsId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    tryAddIndex(
      perfFormCol,
      'CREATE INDEX IF NOT EXISTS idx_perf_form_client_key_ver ON perf_form_versions (client, form_key, version)',
    )

    // ---------- 2. exit_form_versions (depende de clients e users) ----------
    createColIfMissing({
      name: 'exit_form_versions',
      type: 'base',
      listRule: "@request.auth.id != '' && (" + MASTER + ' || client = @request.auth.client)',
      viewRule: "@request.auth.id != '' && (" + MASTER + ' || client = @request.auth.client)',
      createRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))",
      updateRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))",
      deleteRule: MASTER,
      fields: [
        { name: 'version', type: 'number', required: true },
        { name: 'title', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Publicado', 'Rascunho'],
          maxSelect: 1,
        },
        { name: 'schema', type: 'json' },
        {
          name: 'updated_by',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'client',
          type: 'relation',
          collectionId: clientsId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })

    // Agora resolve os IDs dessas duas coleções recém-criadas
    const perfFormVersionsId = app.findCollectionByNameOrId('perf_form_versions').id
    const exitFormVersionsId = app.findCollectionByNameOrId('exit_form_versions').id

    // ---------- 3. perf_evaluations (collaborators + perf_form_versions + users + clients) ----------
    const perfEvalCol = createColIfMissing({
      name: 'perf_evaluations',
      type: 'base',
      listRule: "@request.auth.id != '' && (" + MASTER + ' || client = @request.auth.client)',
      viewRule: "@request.auth.id != '' && (" + MASTER + ' || client = @request.auth.client)',
      createRule:
        "@request.auth.id != '' && (" +
        MASTER +
        ' || (client = @request.auth.client && (' +
        EVAL_PROFILES +
        ')))',
      updateRule:
        "@request.auth.id != '' && (" +
        MASTER +
        ' || (client = @request.auth.client && (' +
        EVAL_PROFILES +
        ' || responsible = @request.auth.id)))',
      deleteRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))",
      fields: [
        {
          name: 'collaborator',
          type: 'relation',
          required: true,
          collectionId: collaboratorsId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'form_version',
          type: 'relation',
          required: true,
          collectionId: perfFormVersionsId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'period_start', type: 'date' },
        { name: 'period_end', type: 'date' },
        { name: 'period_label', type: 'text' },
        {
          name: 'responsible',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'responsible_name', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Rascunho', 'Concluida'],
          maxSelect: 1,
        },
        { name: 'completed_at', type: 'date' },
        {
          name: 'created_by',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'notes', type: 'text' },
        {
          name: 'client',
          type: 'relation',
          collectionId: clientsId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    tryAddIndex(
      perfEvalCol,
      'CREATE INDEX IF NOT EXISTS idx_perf_eval_client ON perf_evaluations (client)',
    )
    tryAddIndex(
      perfEvalCol,
      'CREATE INDEX IF NOT EXISTS idx_perf_eval_collab ON perf_evaluations (collaborator)',
    )
    tryAddIndex(
      perfEvalCol,
      'CREATE INDEX IF NOT EXISTS idx_perf_eval_status ON perf_evaluations (status)',
    )

    const perfEvaluationsId = app.findCollectionByNameOrId('perf_evaluations').id

    // ---------- 4. perf_answers (perf_evaluations + clients) ----------
    const perfAnsCol = createColIfMissing({
      name: 'perf_answers',
      type: 'base',
      listRule: "@request.auth.id != '' && (" + MASTER + ' || client = @request.auth.client)',
      viewRule: "@request.auth.id != '' && (" + MASTER + ' || client = @request.auth.client)',
      createRule:
        "@request.auth.id != '' && (" +
        MASTER +
        ' || (client = @request.auth.client && (' +
        EVAL_PROFILES +
        ')))',
      updateRule:
        "@request.auth.id != '' && (" +
        MASTER +
        ' || (client = @request.auth.client && (' +
        EVAL_PROFILES +
        ')))',
      deleteRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))",
      fields: [
        {
          name: 'evaluation',
          type: 'relation',
          required: true,
          collectionId: perfEvaluationsId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'question_id', type: 'text', required: true },
        { name: 'value', type: 'json' },
        {
          name: 'client',
          type: 'relation',
          collectionId: clientsId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    tryAddIndex(
      perfAnsCol,
      'CREATE INDEX IF NOT EXISTS idx_perf_answers_eval ON perf_answers (evaluation)',
    )

    // ---------- 5. exit_invites (collaborators + exit_form_versions + users + clients) ----------
    const exitInvCol = createColIfMissing({
      name: 'exit_invites',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT')))",
      viewRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT')))",
      createRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))",
      updateRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))",
      deleteRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))",
      fields: [
        {
          name: 'collaborator',
          type: 'relation',
          required: true,
          collectionId: collaboratorsId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'form_version',
          type: 'relation',
          required: true,
          collectionId: exitFormVersionsId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'token', type: 'text', required: true },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Aguardando envio', 'Enviado', 'Respondido', 'Expirado', 'Falha no envio'],
          maxSelect: 1,
        },
        { name: 'offboarding_date', type: 'date' },
        { name: 'expires_at', type: 'date' },
        { name: 'sent_first_at', type: 'date' },
        { name: 'responded_at', type: 'date' },
        {
          name: 'created_by',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'client',
          type: 'relation',
          collectionId: clientsId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    tryAddIndex(
      exitInvCol,
      'CREATE INDEX IF NOT EXISTS idx_exit_invite_client ON exit_invites (client)',
    )
    tryAddIndex(
      exitInvCol,
      'CREATE INDEX IF NOT EXISTS idx_exit_invite_status ON exit_invites (status)',
    )
    tryAddIndex(
      exitInvCol,
      'CREATE UNIQUE INDEX IF NOT EXISTS idx_exit_invite_token ON exit_invites (token)',
    )

    const exitInvitesId = app.findCollectionByNameOrId('exit_invites').id

    // ---------- 6. exit_answers (respostas individuais: apenas ADMIN/HR) ----------
    const exitAnsCol = createColIfMissing({
      name: 'exit_answers',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))",
      viewRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))",
      createRule: null,
      updateRule: null,
      deleteRule: MASTER,
      fields: [
        {
          name: 'invite',
          type: 'relation',
          required: true,
          collectionId: exitInvitesId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'question_id', type: 'text', required: true },
        { name: 'value', type: 'json' },
        {
          name: 'client',
          type: 'relation',
          collectionId: clientsId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    tryAddIndex(
      exitAnsCol,
      'CREATE INDEX IF NOT EXISTS idx_exit_answers_invite ON exit_answers (invite)',
    )

    // ---------- 7. exit_send_attempts (histórico de tentativas por canal) ----------
    const exitAttCol = createColIfMissing({
      name: 'exit_send_attempts',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))",
      viewRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')))",
      createRule: null,
      updateRule: null,
      deleteRule: MASTER,
      fields: [
        {
          name: 'invite',
          type: 'relation',
          required: true,
          collectionId: exitInvitesId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'channel',
          type: 'select',
          required: true,
          values: ['email', 'whatsapp'],
          maxSelect: 1,
        },
        { name: 'recipient', type: 'text', required: true },
        {
          name: 'sent_by',
          type: 'relation',
          collectionId: usersId,
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Sucesso', 'Falha'],
          maxSelect: 1,
        },
        { name: 'error_message', type: 'text' },
        {
          name: 'client',
          type: 'relation',
          collectionId: clientsId,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })
    tryAddIndex(
      exitAttCol,
      'CREATE INDEX IF NOT EXISTS idx_exit_attempts_invite ON exit_send_attempts (invite)',
    )

    // ---------- 8. Contatos no cadastro de colaboradores ----------
    const collabsColToUpdate = app.findCollectionByNameOrId('collaborators')
    let colChanged = false
    if (!collabsColToUpdate.fields.getByName('contact_email')) {
      collabsColToUpdate.fields.add(new TextField({ name: 'contact_email', required: false }))
      colChanged = true
    }
    if (!collabsColToUpdate.fields.getByName('contact_phone')) {
      collabsColToUpdate.fields.add(new TextField({ name: 'contact_phone', required: false }))
      colChanged = true
    }
    if (colChanged) {
      app.save(collabsColToUpdate)
    }
  },
  (app) => {
    for (const name of [
      'exit_send_attempts',
      'exit_answers',
      'exit_invites',
      'exit_form_versions',
      'perf_answers',
      'perf_evaluations',
      'perf_form_versions',
    ]) {
      try {
        app.delete(app.findCollectionByNameOrId(name))
      } catch (_) {}
    }
  },
)
