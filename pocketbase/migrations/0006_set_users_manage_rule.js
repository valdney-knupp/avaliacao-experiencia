migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.manageRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.manageRule = null
    app.save(users)
  },
)
