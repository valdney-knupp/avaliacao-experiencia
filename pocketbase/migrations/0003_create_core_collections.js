migrate(
  (app) => {
    const costCenters = app.findCollectionByNameOrId('cost_centers')
    const sectors = app.findCollectionByNameOrId('sectors')
    const criteria = app.findCollectionByNameOrId('evaluation_criteria')
    const imports = app.findCollectionByNameOrId('imports')

    // 1. collaborators
    const collaborators = new Collection({
      name: 'collaborators',
      type: 'base',
      // Access rules: ADMIN and HR can view/list all; MANAGER_WORKSITE only for their cost_center; MANAGER_DEPARTMENT only for their sector
      listRule:
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || (@request.auth.profile = 'MANAGER_WORKSITE' && cost_center = @request.auth.cost_center) || (@request.auth.profile = 'MANAGER_DEPARTMENT' && sector = @request.auth.sector) || @request.auth.profile = 'VIEWER')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || (@request.auth.profile = 'MANAGER_WORKSITE' && cost_center = @request.auth.cost_center) || (@request.auth.profile = 'MANAGER_DEPARTMENT' && sector = @request.auth.sector) || @request.auth.profile = 'VIEWER')",
      createRule:
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')",
      deleteRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      fields: [
        { name: 'name', type: 'text', required: true },
        { name: 'cpf_hash', type: 'text', required: true },
        { name: 'cpf_encrypted', type: 'text', required: true },
        {
          name: 'cost_center',
          type: 'relation',
          required: true,
          collectionId: costCenters.id,
          maxSelect: 1,
        },
        { name: 'sector', type: 'relation', collectionId: sectors.id, maxSelect: 1 },
        { name: 'role', type: 'text', required: true },
        { name: 'admission_date', type: 'date', required: true },
        { name: 'deadline_45', type: 'date' },
        { name: 'deadline_90', type: 'date' },
        {
          name: 'situation',
          type: 'select',
          required: true,
          values: ['Em experiência', 'Efetivado', 'Desligado', 'Inativo'],
          maxSelect: 1,
        },
        { name: 'created_by', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'import_reference', type: 'relation', collectionId: imports.id, maxSelect: 1 },
        { name: 'import_line', type: 'number', onlyInt: true },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_collab_situation ON collaborators (situation)',
        'CREATE INDEX idx_collab_cost_center ON collaborators (cost_center)',
        'CREATE INDEX idx_collab_admission_date ON collaborators (admission_date)',
        'CREATE INDEX idx_collab_cpf_hash ON collaborators (cpf_hash)',
      ],
    })
    app.save(collaborators)

    // 2. evaluations
    const evaluations = new Collection({
      name: 'evaluations',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')",
      deleteRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      fields: [
        {
          name: 'collaborator',
          type: 'relation',
          required: true,
          collectionId: collaborators.id,
          maxSelect: 1,
        },
        {
          name: 'stage',
          type: 'select',
          required: true,
          values: ['45 dias', '90 dias'],
          maxSelect: 1,
        },
        {
          name: 'evaluator',
          type: 'relation',
          required: true,
          collectionId: '_pb_users_auth_',
          maxSelect: 1,
        },
        {
          name: 'decision',
          type: 'select',
          required: true,
          values: ['EXTEND', 'TERMINATE', 'EFFECTIVATE'],
          maxSelect: 1,
        },
        { name: 'justification', type: 'text' },
        { name: 'notes', type: 'text' },
        { name: 'evaluated_at', type: 'date', required: true },
        { name: 'origin', type: 'select', values: ['manual', 'import'], maxSelect: 1 },
        { name: 'import_reference', type: 'relation', collectionId: imports.id, maxSelect: 1 },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_eval_collaborator ON evaluations (collaborator)',
        'CREATE INDEX idx_eval_stage ON evaluations (stage)',
        'CREATE INDEX idx_eval_evaluated_at ON evaluations (evaluated_at)',
      ],
    })
    app.save(evaluations)

    // 3. evaluation_answers
    const answers = new Collection({
      name: 'evaluation_answers',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule:
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT')",
      updateRule:
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')",
      deleteRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      fields: [
        {
          name: 'evaluation',
          type: 'relation',
          required: true,
          collectionId: evaluations.id,
          cascadeDelete: true,
          maxSelect: 1,
        },
        {
          name: 'criterion',
          type: 'relation',
          required: true,
          collectionId: criteria.id,
          maxSelect: 1,
        },
        {
          name: 'answer',
          type: 'select',
          required: true,
          values: ['PARTIALLY_MEETS', 'MEETS', 'DOES_NOT_MEET', 'EXCEEDS'],
          maxSelect: 1,
        },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_answers_evaluation ON evaluation_answers (evaluation)'],
    })
    app.save(answers)

    // 4. audit_logs
    const auditLogs = new Collection({
      name: 'audit_logs',
      type: 'base',
      listRule:
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')",
      viewRule:
        "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')",
      createRule: "@request.auth.id != ''",
      updateRule: null,
      deleteRule: null,
      fields: [
        { name: 'user', type: 'relation', collectionId: '_pb_users_auth_', maxSelect: 1 },
        { name: 'entity_type', type: 'text' },
        { name: 'entity_id', type: 'text' },
        { name: 'action', type: 'text' },
        { name: 'summary', type: 'text' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: ['CREATE INDEX idx_audit_created ON audit_logs (created DESC)'],
    })
    app.save(auditLogs)

    // 5. notifications
    const notifications = new Collection({
      name: 'notifications',
      type: 'base',
      listRule: "@request.auth.id != ''",
      viewRule: "@request.auth.id != ''",
      createRule: "@request.auth.id != ''",
      updateRule: "@request.auth.id != ''",
      deleteRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
      fields: [
        {
          name: 'event',
          type: 'select',
          required: true,
          values: [
            'new_collaborator',
            'approaching_deadline',
            'overdue',
            'eval_45_done',
            'eval_90_done',
            'effective',
            'terminated',
            'processing_failure',
          ],
          maxSelect: 1,
        },
        { name: 'recipient', type: 'text' },
        { name: 'subject', type: 'text' },
        { name: 'body', type: 'text' },
        {
          name: 'status',
          type: 'select',
          required: true,
          values: ['Pendente', 'Enviada', 'Falha'],
          maxSelect: 1,
        },
        { name: 'attempts', type: 'number', onlyInt: true },
        { name: 'last_error', type: 'text' },
        { name: 'dedupe_key', type: 'text' },
        { name: 'sent_at', type: 'date' },
        { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
        { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
      ],
      indexes: [
        'CREATE INDEX idx_notif_status ON notifications (status)',
        'CREATE INDEX idx_notif_dedupe ON notifications (dedupe_key)',
      ],
    })
    app.save(notifications)
  },
  (app) => {
    const toDelete = [
      'notifications',
      'audit_logs',
      'evaluation_answers',
      'evaluations',
      'collaborators',
    ]
    for (const name of toDelete) {
      try {
        const col = app.findCollectionByNameOrId(name)
        app.delete(col)
      } catch (_) {}
    }
  },
)
