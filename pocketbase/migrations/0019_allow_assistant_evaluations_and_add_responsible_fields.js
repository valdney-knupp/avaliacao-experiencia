migrate(
  (app) => {
    // 1. evaluations collection:
    // - Add responsible_name (text) and responsible_role (text)
    // - Allow ADMIN_ASSISTANT to create and view evaluations for their cost center
    const evaluations = app.findCollectionByNameOrId('evaluations')

    if (!evaluations.fields.getByName('responsible_name')) {
      evaluations.fields.add(
        new TextField({
          name: 'responsible_name',
          type: 'text',
          required: false,
        }),
      )
    }

    if (!evaluations.fields.getByName('responsible_role')) {
      evaluations.fields.add(
        new TextField({
          name: 'responsible_role',
          type: 'text',
          required: false,
        }),
      )
    }

    // Permitir criação de avaliações por ADMIN_ASSISTANT
    evaluations.createRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT' || @request.auth.profile = 'ADMIN_ASSISTANT')"

    app.save(evaluations)

    // 2. evaluation_answers collection:
    // Também permitir criação de respostas de avaliação por ADMIN_ASSISTANT
    const answers = app.findCollectionByNameOrId('evaluation_answers')
    answers.createRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT' || @request.auth.profile = 'ADMIN_ASSISTANT')"
    app.save(answers)
  },
  (app) => {
    const evaluations = app.findCollectionByNameOrId('evaluations')
    evaluations.createRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT')"
    const respNameField = evaluations.fields.getByName('responsible_name')
    if (respNameField) {
      evaluations.fields.removeByName('responsible_name')
    }
    const respRoleField = evaluations.fields.getByName('responsible_role')
    if (respRoleField) {
      evaluations.fields.removeByName('responsible_role')
    }
    app.save(evaluations)

    const answers = app.findCollectionByNameOrId('evaluation_answers')
    answers.createRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT')"
    app.save(answers)
  },
)
