migrate(
  (app) => {
    // 1. Update users profile select field values
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const profileField = users.fields.getByName('profile')
    if (profileField) {
      profileField.values = [
        'ADMIN',
        'HR',
        'MANAGER_WORKSITE',
        'MANAGER_DEPARTMENT',
        'ADMIN_ASSISTANT',
        'VIEWER',
      ]
    }
    app.save(users)

    // 2. Update collaborators collection access rules
    // ADMIN and HR can view/create/update all
    // MANAGER_WORKSITE and ADMIN_ASSISTANT can view their cost_center
    // ADMIN_ASSISTANT can also create collaborators (for their cost_center)
    // MANAGER_DEPARTMENT can view their sector
    // VIEWER can view all
    const collaborators = app.findCollectionByNameOrId('collaborators')
    collaborators.listRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || (@request.auth.profile = 'MANAGER_WORKSITE' && cost_center = @request.auth.cost_center) || (@request.auth.profile = 'ADMIN_ASSISTANT' && cost_center = @request.auth.cost_center) || (@request.auth.profile = 'MANAGER_DEPARTMENT' && sector = @request.auth.sector) || @request.auth.profile = 'VIEWER')"
    collaborators.viewRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || (@request.auth.profile = 'MANAGER_WORKSITE' && cost_center = @request.auth.cost_center) || (@request.auth.profile = 'ADMIN_ASSISTANT' && cost_center = @request.auth.cost_center) || (@request.auth.profile = 'MANAGER_DEPARTMENT' && sector = @request.auth.sector) || @request.auth.profile = 'VIEWER')"
    collaborators.createRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || (@request.auth.profile = 'ADMIN_ASSISTANT' && cost_center = @request.auth.cost_center))"
    collaborators.updateRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
    app.save(collaborators)

    // 3. Update evaluations collection list/view rules
    // Ensure MANAGER_WORKSITE and ADMIN_ASSISTANT only view evaluations for their cost center if needed, or maintain existing rule
    // Existing rule for evaluations: list/view "@request.auth.id != ''"
    // createRule: ADMIN, HR, MANAGER_WORKSITE, MANAGER_DEPARTMENT (ADMIN_ASSISTANT cannot create evaluations!)
    const evaluations = app.findCollectionByNameOrId('evaluations')
    evaluations.createRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || @request.auth.profile = 'MANAGER_WORKSITE' || @request.auth.profile = 'MANAGER_DEPARTMENT')"
    app.save(evaluations)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const profileField = users.fields.getByName('profile')
    if (profileField) {
      profileField.values = ['ADMIN', 'HR', 'MANAGER_WORKSITE', 'MANAGER_DEPARTMENT', 'VIEWER']
    }
    app.save(users)

    const collaborators = app.findCollectionByNameOrId('collaborators')
    collaborators.listRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || (@request.auth.profile = 'MANAGER_WORKSITE' && cost_center = @request.auth.cost_center) || (@request.auth.profile = 'MANAGER_DEPARTMENT' && sector = @request.auth.sector) || @request.auth.profile = 'VIEWER')"
    collaborators.viewRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || (@request.auth.profile = 'MANAGER_WORKSITE' && cost_center = @request.auth.cost_center) || (@request.auth.profile = 'MANAGER_DEPARTMENT' && sector = @request.auth.sector) || @request.auth.profile = 'VIEWER')"
    collaborators.createRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')"
    app.save(collaborators)
  },
)
