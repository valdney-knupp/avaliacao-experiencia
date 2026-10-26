migrate(
  (app) => {
    // 1. Seed Cost Centers
    const costCentersCol = app.findCollectionByNameOrId('cost_centers')
    const costCentersData = [
      {
        name: 'ESCRITÓRIO',
        type: 'Escritório',
        active: true,
        email_recipients: 'gp@rpontes.com.br',
      },
      { name: 'BLEND', type: 'Obra', active: true, email_recipients: 'obra.blend@rpontes.com.br' },
      {
        name: 'SUMMIT',
        type: 'Obra',
        active: true,
        email_recipients: 'obra.summit@rpontes.com.br',
      },
      { name: 'OPEN', type: 'Obra', active: true, email_recipients: 'obra.open@rpontes.com.br' },
      {
        name: 'SUNRISE',
        type: 'Obra',
        active: true,
        email_recipients: 'obra.sunrise@rpontes.com.br',
      },
      {
        name: 'BLEND GRAND RESERVA',
        type: 'Obra',
        active: true,
        email_recipients: 'obra.blendgr@rpontes.com.br',
      },
    ]

    for (const item of costCentersData) {
      try {
        app.findFirstRecordByData('cost_centers', 'name', item.name)
      } catch (_) {
        const r = new Record(costCentersCol)
        r.set('name', item.name)
        r.set('type', item.type)
        r.set('active', item.active)
        r.set('email_recipients', item.email_recipients)
        app.save(r)
      }
    }

    // 2. Seed Sectors
    const sectorsCol = app.findCollectionByNameOrId('sectors')
    const sectorsData = [
      'ASSISTÊNCIA TÉCNICA',
      'GESTÃO DE PESSOAS',
      'FINANCEIRO',
      'SUPRIMENTOS',
      'ENGENHARIA',
      'MARKETING',
      'TI',
      'ANÁLISE DE DADOS',
      'COMERCIAL',
    ]

    for (const name of sectorsData) {
      try {
        app.findFirstRecordByData('sectors', 'name', name)
      } catch (_) {
        const r = new Record(sectorsCol)
        r.set('name', name)
        r.set('active', true)
        app.save(r)
      }
    }

    // 3. Seed Criteria (Strict Order 1 to 4)
    const criteriaCol = app.findCollectionByNameOrId('evaluation_criteria')
    const criteriaData = [
      {
        order: 1,
        name: 'Disciplina e cumprimento de regras',
        description:
          'Pontualidade, respeito às normas de segurança, postura e conduta ética no ambiente de trabalho.',
      },
      {
        order: 2,
        name: 'Qualidade e produtividade',
        description:
          'Rendimento, precisão na execução das tarefas, atenção aos detalhes e entrega nos prazos estipulados.',
      },
      {
        order: 3,
        name: 'Relacionamento interpessoal e trabalho em equipe',
        description:
          'Comunicação respeitosa, colaboração com colegas e liderança, disposição para cooperar.',
      },
      {
        order: 4,
        name: 'Assiduidade',
        description:
          'Frequência regular, ausência de faltas injustificadas e cumprimento da jornada contratual.',
      },
    ]

    for (const item of criteriaData) {
      try {
        app.findFirstRecordByData('evaluation_criteria', 'name', item.name)
      } catch (_) {
        const r = new Record(criteriaCol)
        r.set('name', item.name)
        r.set('description', item.description)
        r.set('order', item.order)
        r.set('active', true)
        app.save(r)
      }
    }

    // 4. Seed Settings
    const settingsCol = app.findCollectionByNameOrId('settings')
    const settingsData = [
      { key: 'alert_cutoff_date', value: '2026-01-01' },
      { key: 'days_first_eval', value: '45' },
      { key: 'days_second_eval', value: '90' },
      { key: 'notification_advance_days', value: '15' },
      { key: 'general_recipients', value: 'valdknupp@gmail.com,gp@rpontes.com.br' },
      { key: 'allow_hr_import', value: 'true' },
    ]

    for (const s of settingsData) {
      try {
        app.findFirstRecordByData('settings', 'key', s.key)
      } catch (_) {
        const r = new Record(settingsCol)
        r.set('key', s.key)
        r.set('value', s.value)
        app.save(r)
      }
    }

    // 5. Seed Initial Admin User: valdknupp@gmail.com / Skip@Pass
    const usersCol = app.findCollectionByNameOrId('_pb_users_auth_')
    try {
      const existingAdmin = app.findAuthRecordByEmail('_pb_users_auth_', 'valdknupp@gmail.com')
      existingAdmin.set('profile', 'ADMIN')
      existingAdmin.set('active', true)
      existingAdmin.setVerified(true)
      existingAdmin.set('name', 'Administrador R. Pontes')
      existingAdmin.setPassword('Skip@Pass')
      app.save(existingAdmin)
    } catch (_) {
      const admin = new Record(usersCol)
      admin.setEmail('valdknupp@gmail.com')
      admin.setPassword('Skip@Pass')
      admin.setVerified(true)
      admin.set('name', 'Administrador R. Pontes')
      admin.set('profile', 'ADMIN')
      admin.set('active', true)
      app.save(admin)
    }
  },
  (app) => {
    // Revert not strictly needed for seeds
  },
)
