// Migration: Avaliação de Desempenho (formulários versionados) + Entrevista de Desligamento
// Coleções novas (todas com campo client para isolamento multi-tenant):
//   perf_form_versions, perf_evaluations, perf_answers
//   exit_form_versions, exit_invites, exit_answers
// Também adiciona campos de contato (contact_email/contact_phone) em collaborators.

const MASTER = "@request.auth.email = 'valdknupp@gmail.com'"

function ensureCollection(app, definition) {
  let col = null
  try {
    col = app.findCollectionByNameOrId(definition.name)
  } catch (_) {
    col = new Collection(definition)
    app.save(col)
  }
  return app.findCollectionByNameOrId(definition.name)
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
    const clientsCol = app.findCollectionByNameOrId('clients')

    // ---------- 1. perf_form_versions ----------
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
          collectionId: clientsCol.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })

    // ---------- 2. perf_evaluations ----------
    ensureCollection(app, {
      name: 'perf_evaluations',
      type: 'base',
      listRule: "@request.auth.id != '' && (" + MASTER + ' || client = @request.auth.client)',
      viewRule: "@request.auth.id != '' && (" + MASTER + ' || client = @request.auth.client)',
      createRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT' || @request.auth.profile = 'ADMIN_ASSISTANT')))",
      updateRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT' || @request.auth.profile = 'ADMIN_ASSISTANT' || responsible = @request.auth.id)))",
      deleteRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))",
      fields: [
        {
          name: 'collaborator',
          type: 'relation',
          required: true,
          collectionId: 'collaborators_placeholder',
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'form_version',
          type: 'relation',
          required: true,
          collectionId: 'perf_form_versions_placeholder',
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'period_start', type: 'date' },
        { name: 'period_end', type: 'date' },
        { name: 'period_label', type: 'text' },
        {
          name: 'responsible',
          type: 'relation',
          collectionId: '_pb_users_auth_placeholder',
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
          collectionId: '_pb_users_auth_placeholder',
          maxSelect: 1,
          cascadeDelete: false,
        },
        { name: 'notes', type: 'text' },
        {
          name: 'client',
          type: 'relation',
          collectionId: clientsCol.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })

    // ---------- 3. perf_answers ----------
    ensureCollection(app, {
      name: 'perf_answers',
      type: 'base',
      listRule: "@request.auth.id != '' && (" + MASTER + ' || client = @request.auth.client)',
      viewRule: "@request.auth.id != '' && (" + MASTER + ' || client = @request.auth.client)',
      createRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT' || @request.auth.profile = 'ADMIN_ASSISTANT')))",
      updateRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT' || @request.auth.profile = 'ADMIN_ASSISTANT')))",
      deleteRule:
        "@request.auth.id != '' && (" +
        MASTER +
        " || (client = @request.auth.client && @request.auth.profile = 'ADMIN'))",
      fields: [
        {
          name: 'evaluation',
          type: 'relation',
          required: true,
          collectionId: 'perf_evaluations_placeholder',
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'question_id', type: 'text', required: true },
        { name: 'value', type: 'json' },
        {
          name: 'client',
          type: 'relation',
          collectionId: clientsCol.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })

    // ---------- 4. exit_form_versions ----------
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
          collectionId: '_pb_users_auth_placeholder',
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'client',
          type: 'relation',
          collectionId: clientsCol.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })

    // ---------- 5. exit_invites ----------
    ensureCollection(app, {
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
          collectionId: 'collaborators_placeholder',
          maxSelect: 1,
          cascadeDelete: true,
        },
        {
          name: 'form_version',
          type: 'relation',
          required: true,
          collectionId: 'exit_form_versions_placeholder',
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
          collectionId: '_pb_users_auth_placeholder',
          maxSelect: 1,
          cascadeDelete: false,
        },
        {
          name: 'client',
          type: 'relation',
          collectionId: clientsCol.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })

    // ---------- 6. exit_answers (respostas individuais: apenas ADMIN/HR) ----------
    ensureCollection(app, {
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
          collectionId: 'exit_invites_placeholder',
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'question_id', type: 'text', required: true },
        { name: 'value', type: 'json' },
        {
          name: 'client',
          type: 'relation',
          collectionId: clientsCol.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })

    // ---------- 7. exit_send_attempts ----------
    ensureCollection(app, {
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
          collectionId: 'exit_invites_placeholder',
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
          collectionId: '_pb_users_auth_placeholder',
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
          collectionId: clientsCol.id,
          maxSelect: 1,
          cascadeDelete: true,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
    })

    // ---------- 8. Corrigir relations agora que todas as coleções existem ----------
    const perfEvalCol = app.findCollectionByNameOrId('perf_evaluations')
    for (const f of perfEvalCol.fields) {
      if (f.name === 'collaborator')
        f.collectionId = app.findCollectionByNameOrId('collaborators').id
      if (f.name === 'form_version')
        f.collectionId = app.findCollectionByNameOrId('perf_form_versions').id
      if (f.name === 'responsible' || f.name === 'created_by') f.collectionId = '_pb_users_auth_'
    }
    app.save(perfEvalCol)

    const perfAnsCol = app.findCollectionByNameOrId('perf_answers')
    for (const f of perfAnsCol.fields) {
      if (f.name === 'evaluation') f.collectionId = perfEvalCol.id
    }
    app.save(perfAnsCol)

    const exitInvCol = app.findCollectionByNameOrId('exit_invites')
    for (const f of exitInvCol.fields) {
      if (f.name === 'collaborator')
        f.collectionId = app.findCollectionByNameOrId('collaborators').id
      if (f.name === 'form_version')
        f.collectionId = app.findCollectionByNameOrId('exit_form_versions').id
      if (f.name === 'created_by') f.collectionId = '_pb_users_auth_'
    }
    app.save(exitInvCol)

    const exitAnsCol = app.findCollectionByNameOrId('exit_answers')
    for (const f of exitAnsCol.fields) {
      if (f.name === 'invite') f.collectionId = exitInvCol.id
    }
    app.save(exitAnsCol)

    const exitAttCol = app.findCollectionByNameOrId('exit_send_attempts')
    for (const f of exitAttCol.fields) {
      if (f.name === 'invite') f.collectionId = exitInvCol.id
      if (f.name === 'sent_by') f.collectionId = '_pb_users_auth_'
    }
    app.save(exitAttCol)

    const exitFormCol = app.findCollectionByNameOrId('exit_form_versions')
    for (const f of exitFormCol.fields) {
      if (f.name === 'updated_by') f.collectionId = '_pb_users_auth_'
    }
    app.save(exitFormCol)

    // ---------- 9. Índices ----------
    addIndexSafe(perfEvalCol, 'idx_perf_eval_client', '`client`')
    addIndexSafe(perfEvalCol, 'idx_perf_eval_collab', '`collaborator`')
    addIndexSafe(perfEvalCol, 'idx_perf_eval_status', '`status`')
    app.save(perfEvalCol)

    addIndexSafe(perfAnsCol, 'idx_perf_answers_eval', '`evaluation`')
    app.save(perfAnsCol)

    const perfFormCol = app.findCollectionByNameOrId('perf_form_versions')
    addIndexSafe(perfFormCol, 'idx_perf_form_client_key_ver', '`client`,`form_key`,`version`')
    app.save(perfFormCol)

    addIndexSafe(exitInvCol, 'idx_exit_invite_client', '`client`')
    addIndexSafe(exitInvCol, 'idx_exit_invite_status', '`status`')
    app.save(exitInvCol)

    ensureUniqueIndex(exitInvCol, 'idx_exit_invite_token', '`token`')
    app.save(exitInvCol)

    addIndexSafe(exitAnsCol, 'idx_exit_answers_invite', '`invite`')
    app.save(exitAnsCol)

    addIndexSafe(exitAttCol, 'idx_exit_attempts_invite', '`invite`')
    app.save(exitAttCol)

    // ---------- 10. Contatos no cadastro de colaboradores ----------
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
