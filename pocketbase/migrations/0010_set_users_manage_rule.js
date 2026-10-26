migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.manageRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    app.save(users)

    const reloaded = app.findCollectionByNameOrId('_pb_users_auth_')
    console.log('0010 applied manageRule: ' + reloaded.manageRule)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('_pb_users_auth_')
    users.manageRule = null
    app.save(users)
  },
)
