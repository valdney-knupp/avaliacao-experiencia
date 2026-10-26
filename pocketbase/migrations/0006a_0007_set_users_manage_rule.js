migrate(
  (app) => {
    // PocketBase Auth collection users manageRule
    const users = app.findCollectionByNameOrId('users')
    users.manageRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    app.save(users)
  },
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    users.manageRule = null
    app.save(users)
  },
)
