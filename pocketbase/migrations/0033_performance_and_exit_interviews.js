// Migration: Avaliação de Desempenho (formulários versionados) + Entrevista de Desligamento
// Coleções novas (todas com campo client para isolamento multi-tenant):
//   perf_form_versions, perf_evaluations, perf_answers
//   exit_form_versions, exit_invites, exit_answers, exit_send_attempts
// Também adiciona campos de contato (contact_email/contact_phone) em collaborators.
//
// ORDEM IMPORTANTE: toda coleção é criada DEPOIS de suas referências já existirem
// (clients, users e collaborators já existem no schema base). Nenhum placeholder.

const MASTER = "@request.auth.email = 'valdknupp@gmail.com'"

function ensureCollection(app, definition) {
  try {
    app.findCollectionByNameOrId(definition.name)
    return app.findCollectionByNameOrId(definition.name)
  } catch (_) {
    const col = new Collection(definition)
    app.save(col)
    return app.findCollectionByNameOrId(definition.name)
  }
}

function addFieldIfMissing(app, collectionName, field) {
  const col = app.findCollectionByNameOrId(collectionName)
  if (!col.fields.getByName(field.name)) {
    col.fields.add(field)
    app.save(col)
  }
}

function addIndexSafe(col, name, colsExpr) {
  const expr = 'CREATE INDEX IF NOT EXISTS `' + name + '` ON `' + col.name + '` (' + colsExpr + ')'
  try {
    col.addIndex(expr)
  } catch (_) {}
}

function ensureUniqueIndex(col, name, colsExpr) {
  const expr =
    'CREATE UNIQUE INDEX IF NOT EXISTS `' + name + '` ON `' + col.name + '` (' + colsExpr + ')'
  try {
    col.addIndex(expr)
  } catch (_) {}
}

migrate(
  (app) => {
    // Coleções pré-existentes referenciadas
    const clientsCol = app.findCollectionByNameOrId('clients')
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    const collaboratorsCol = app.findCollectionByNameOrId('collaborators')

    const clientsId = clientsCol.id
    const usersId = usersCol.id
    const collaboratorsId = collaboratorsCol.id

    const EVAL_PROFILES =
      "@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT' || @request.auth.profile = 'ADMIN_ASSISTANT'"

    // ---------- 1. perf_form_versions (só depende de clients) ----------
    ensureCollection(app, {
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

    // ---------- 2. exit_form_versions (clients + users) ----------
    ensureCollection(app, {
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

    // ---------- 3. perf_evaluations (collaborators + perf_form_versions + users + clients) ----------
    const perfFormVersionsCol = app.findCollectionByNameOrId('perf_form_versions')
    const perfEvaluationsCol = ensureCollection(app, {
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
          collectionId: perfFormVersionsCol.id,
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

    // ---------- 4. perf_answers (perf_evaluations + clients) ----------
    const perfAnswersCol = ensureCollection(app, {
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
          collectionId: perfEvaluationsCol.id,
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

    // ---------- 5. exit_invites (collaborators + exit_form_versions + users + clients) ----------
    const exitFormVersionsCol = app.findCollectionByNameOrId('exit_form_versions')
    const exitInvitesCol = ensureCollection(app, {
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
          collectionId: exitFormVersionsCol.id,
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

    // ---------- 6. exit_answers (respostas individuais: apenas ADMIN/HR) ----------
    const exitAnswersCol = ensureCollection(app, {
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
          collectionId: exitInvitesCol.id,
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

    // ---------- 7. exit_send_attempts (histórico de tentativas por canal) ----------
    const exitAttemptsCol = ensureCollection(app, {
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
          collectionId: exitInvitesCol.id,
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

    // ---------- 8. Índices ----------
    addIndexSafe(perfEvaluationsCol, 'idx_perf_eval_client', '`client`')
    addIndexSafe(perfEvaluationsCol, 'idx_perf_eval_collab', '`collaborator`')
    addIndexSafe(perfEvaluationsCol, 'idx_perf_eval_status', '`status`')
    app.save(perfEvaluationsCol)

    addIndexSafe(perfAnswersCol, 'idx_perf_answers_eval', '`evaluation`')
    app.save(perfAnswersCol)

    const perfFormCol = app.findCollectionByNameOrId('perf_form_versions')
    addIndexSafe(perfFormCol, 'idx_perf_form_client_key_ver', '`client`,`form_key`,`version`')
    app.save(perfFormCol)

    addIndexSafe(exitInvitesCol, 'idx_exit_invite_client', '`client`')
    addIndexSafe(exitInvitesCol, 'idx_exit_invite_status', '`status`')
    ensureUniqueIndex(exitInvitesCol, 'idx_exit_invite_token', '`token`')
    app.save(exitInvitesCol)

    addIndexSafe(exitAnswersCol, 'idx_exit_answers_invite', '`invite`')
    app.save(exitAnswersCol)

    addIndexSafe(exitAttemptsCol, 'idx_exit_attempts_invite', '`invite`')
    app.save(exitAttemptsCol)

    // ---------- 9. Contatos no cadastro de colaboradores ----------
    addFieldIfMissing(app, 'collaborators', { name: 'contact_email', type: 'text' })
    addFieldIfMissing(app, 'collaborators', { name: 'contact_phone', type: 'text' })
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
