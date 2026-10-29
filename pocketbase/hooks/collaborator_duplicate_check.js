// Checks CPF duplicate rules without revealing full CPF to unauthorized users
routerAdd(
  'POST',
  '/backend/v1/collaborators/check-duplicate',
  (e) => {
    const reqData = e.requestInfo().body || {}
    const cpfHash = reqData.cpf_hash
    const costCenterId = reqData.cost_center
    const authUser = e.auth
    const userClient = authUser ? authUser.getString('client') : ''
    const isMaster =
      authUser && authUser.getString('email').trim().toLowerCase() === 'valdknupp@gmail.com'

    if (!cpfHash) {
      return e.json(400, { error: 'cpf_hash é obrigatório' })
    }

    try {
      let filterExpr = `cpf_hash = '${cpfHash.replace(/'/g, '')}'`
      if (!isMaster && userClient) {
        filterExpr += ` && client = '${userClient}'`
      }

      const records = $app.findRecordsByFilter(
        'collaborators',
        filterExpr,
        '-admission_date',
        10,
        0,
      )

      if (!records || records.length === 0) {
        return e.json(200, { exists: false })
      }

      const matches = records.map((r) => {
        let costCenterName = ''
        try {
          const cc = $app.findRecordById('cost_centers', r.getString('cost_center'))
          costCenterName = cc.getString('name')
        } catch (_) {}

        return {
          id: r.id,
          name: r.getString('name'),
          cost_center_id: r.getString('cost_center'),
          cost_center_name: costCenterName,
          admission_date: r.getString('admission_date'),
          situation: r.getString('situation'),
          same_center: costCenterId ? r.getString('cost_center') === costCenterId : false,
        }
      })

      const sameCenterMatch = matches.find((m) => m.same_center)

      return e.json(200, {
        exists: true,
        has_same_center: !!sameCenterMatch,
        same_center_match: sameCenterMatch || null,
        matches: matches,
      })
    } catch (err) {
      return e.json(500, { error: 'Erro ao verificar duplicidade: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
