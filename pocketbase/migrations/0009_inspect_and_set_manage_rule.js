migrate(
  (app) => {
    const users = app.findCollectionByNameOrId('users')
    console.log('0009 inspection:')
    console.log('users.manageRule: ' + users.manageRule)
    console.log('typeof users.manageRule: ' + typeof users.manageRule)
    console.log('users keys: ' + Object.keys(users))
    if (users.options) {
      console.log('users.options: ' + JSON.stringify(users.options))
    }

    // Try setting manageRule directly and on options if present
    users.manageRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    if (users.options && typeof users.options === 'object') {
      users.options.manageRule = "@request.auth.id != '' && @request.auth.profile = 'ADMIN'"
    }

    app.save(users)
    console.log('0009 saved users collection')
  },
  (app) => {
    try {
      const users = app.findCollectionByNameOrId('users')
      users.manageRule = null
      app.save(users)
    } catch (_) {}
  },
)
