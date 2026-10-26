migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const costCenters = app.findCollectionByNameOrId('cost_centers')
    const sectors = app.findCollectionByNameOrId('sectors')

    if (!users.fields.getByName('profile')) {
      users.fields.add(
        new SelectField({
          name: 'profile',
          required: true,
          values: ['ADMIN', 'HR', 'MANAGER_WORKSITE', 'MANAGER_DEPARTMENT', 'VIEWER'],
          maxSelect: 1,
        }),
      )
    }

    if (!users.fields.getByName('cost_center')) {
      users.fields.add(
        new RelationField({
          name: 'cost_center',
          collectionId: costCenters.id,
          maxSelect: 1,
        }),
      )
    }

    if (!users.fields.getByName('sector')) {
      users.fields.add(
        new RelationField({
          name: 'sector',
          collectionId: sectors.id,
          maxSelect: 1,
        }),
      )
    }

    if (!users.fields.getByName('active')) {
      users.fields.add(
        new BoolField({
          name: 'active',
        }),
      )
    }

    if (!users.fields.getByName('last_accessed')) {
      users.fields.add(
        new DateField({
          name: 'last_accessed',
        }),
      )
    }

    // Users access rules:
    // Admins and HR can list all; Managers/viewers can view their own profile
    users.listRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || id = @request.auth.id)"
    users.viewRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR' || id = @request.auth.id)"
    users.createRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    users.updateRule =
      "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || id = @request.auth.id)"
    users.deleteRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"

    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    const fields = ['profile', 'cost_center', 'sector', 'active', 'last_accessed']
    for (const f of fields) {
      try {
        users.fields.removeByName(f)
      } catch (_) {}
    }
    app.save(users)
  },
)
