migrate(
  (app) => {
    // 1. Add 'category' select field to evaluation_criteria
    const criteriaCol = app.findCollectionByNameOrId('evaluation_criteria')
    if (!criteriaCol.fields.getByName('category')) {
      criteriaCol.fields.add(
        new SelectField({
          name: 'category',
          required: false,
          values: ['OBRAS', 'ESCRITORIO'],
          maxSelect: 1,
        }),
      )
      app.save(criteriaCol)
    }

    // 2. Set category = 'OBRAS' for any existing criteria with empty/null category
    try {
      app
        .db()
        .newQuery(
          "UPDATE evaluation_criteria SET category = 'OBRAS' WHERE category IS NULL OR category = ''",
        )
        .execute()
    } catch (err) {
      console.log('Update existing criteria category error:', err)
    }

    // 3. Seed the 8 Escritório criteria idempotently
    const escritorioCriteria = [
      {
        order: 1,
        name: 'ENTREGA DE RESULTADOS E QUALIDADE DO TRABALHO',
        description:
          'Capacidade de cumprir prazos, atingir metas com precisão e entregar resultados com excelência e qualidade técnica.',
      },
      {
        order: 2,
        name: 'CAPACIDADE TÉCNICA E CONHECIMENTO',
        description:
          'Domínio das rotinas, processos, ferramentas e conhecimentos técnicos exigidos para a função desempenhada.',
      },
      {
        order: 3,
        name: 'PROATIVIDADE',
        description:
          'Iniciativa para antecipar necessidades, propor soluções e atuar de forma autônoma e preventiva.',
      },
      {
        order: 4,
        name: 'DINAMISMO',
        description:
          'Agilidade na resolução de demandas, adaptabilidade a mudanças de prioridade e ritmo de trabalho produtivo.',
      },
      {
        order: 5,
        name: 'SOLUÇÃO DE PROBLEMAS',
        description:
          'Habilidade de identificar causas, analisar cenários críticos e propor alternativas eficazes e seguras.',
      },
      {
        order: 6,
        name: 'RELACIONAMENTO INTERPESSOAL E TRABALHO EM EQUIPE',
        description:
          'Comunicação clara e respeitosa, colaboração mútua, escuta ativa e facilidade de integração em equipe.',
      },
      {
        order: 7,
        name: 'POSTURA PROFISSIONAL E DISCIPLINA',
        description:
          'Ética profissional, responsabilidade com normas, pontualidade, discrição e respeito às diretrizes da empresa.',
      },
      {
        order: 8,
        name: 'ASSIDUIDADE',
        description:
          'Frequência regular, ausência de faltas injustificadas e estrito cumprimento da jornada contratual de trabalho.',
      },
    ]

    for (const item of escritorioCriteria) {
      let existingRecord = null
      try {
        const found = app.findRecordsByFilter(
          'evaluation_criteria',
          `category = 'ESCRITORIO' && name = '${item.name}'`,
          '',
          1,
          0,
        )
        if (found && found.length > 0) {
          existingRecord = found[0]
        }
      } catch (_) {}

      if (!existingRecord) {
        const record = new Record(criteriaCol)
        record.set('name', item.name)
        record.set('description', item.description)
        record.set('order', item.order)
        record.set('active', true)
        record.set('category', 'ESCRITORIO')
        app.save(record)
      }
    }
  },
  (app) => {
    // Revert: remove Escritório criteria and optionally the field
    try {
      app.db().newQuery("DELETE FROM evaluation_criteria WHERE category = 'ESCRITORIO'").execute()
    } catch (_) {}
  },
)
