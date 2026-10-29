// Batch definitive import execution endpoint
// Executes unified import records directly on the backend using $app, avoiding HTTP rate limits (429)

routerAdd(
  'POST',
  '/backend/v1/imports/batch-execute',
  (e) => {
    // 1. Authorization: ADMIN only (matriz de permissões estrita)
    const user = e.auth
    if (!user) {
      return e.json(401, { error: 'Usuário não autenticado.' })
    }
    const profile = user.getString('profile')
    if (profile !== 'ADMIN') {
      return e.json(403, {
        error:
          'Acesso negado: apenas Administradores possuem permissão para executar importação de dados.',
      })
    }

    const body = e.requestInfo().body || {}
    const filenames = String(body.filenames || '').trim()
    const reportData = body.report || {}
    const userClient = user.getString('client') || (body.client ? String(body.client).trim() : null)
    const collaborators = Array.isArray(body.collaborators) ? body.collaborators : []
    const evaluations = Array.isArray(body.evaluations) ? body.evaluations : []
    const adminAuthorized = body.adminAuthorized === true

    // Check if there are invalid CPFs without admin authorization
    if (reportData.invalidCpfs > 0 && !adminAuthorized && profile !== 'ADMIN') {
      return e.json(403, {
        error: 'A carga contém CPFs inválidos e exige autorização expressa de um Administrador.',
      })
    }

    // Helper functions inline inside callback to avoid Goja VM scoping ReferenceError
    const addDays = (isoDate, days) => {
      try {
        const parts = String(isoDate).slice(0, 10).split('-')
        if (parts.length !== 3) return ''
        const y = parseInt(parts[0], 10)
        const m = parseInt(parts[1], 10) - 1
        const d = parseInt(parts[2], 10)
        const dt = new Date(Date.UTC(y, m, d))
        dt.setUTCDate(dt.getUTCDate() + days)
        return dt.toISOString().slice(0, 10) + ' 00:00:00.000Z'
      } catch (_) {
        return ''
      }
    }

    const nowIso = () => {
      const d = new Date()
      return d.toISOString().slice(0, 10) + ' 00:00:00.000Z'
    }

    try {
      let importRec = null
      const importId = String(body.import_id || '').trim()

      if (importId) {
        try {
          importRec = $app.findRecordById('imports', importId)
        } catch (_) {
          // not found, will create
        }
      }

      if (!importRec) {
        const importsCol = $app.findCollectionByNameOrId('imports')
        importRec = new Record(importsCol)
        importRec.set('filename', filenames || 'Importação Unificada')
        importRec.set('type', 'colaboradores')
        importRec.set('user', user.id)
        importRec.set('status', 'executed')
        importRec.set('report', JSON.stringify(reportData))
        importRec.set('executed_at', nowIso())
        if (userClient) importRec.set('client', userClient)
        $app.save(importRec)
      } else {
        importRec.set('status', 'executed')
        importRec.set('report', JSON.stringify(reportData))
        if (userClient) importRec.set('client', userClient)
        $app.save(importRec)
      }

      const collabsCol = $app.findCollectionByNameOrId('collaborators')
      const evalsCol = $app.findCollectionByNameOrId('evaluations')
      const answersCol = $app.findCollectionByNameOrId('evaluation_answers')

      // Track inserted or resolved collaborators map: clientKey (e.g. "NEW_COLLAB_0") -> recordId
      const collabIdMap = {}
      let insertedCollabsCount = 0
      let skippedCollabsCount = 0

      // Preload existing collaborators for deduplication & idempotency
      // Map: cpf_hash -> id, and (nameNorm + "_" + costCenter) -> id
      const existingCollabMap = {}
      try {
        const existingList = $app.findRecordsByFilter('collaborators', 'id != ""', '', 50000, 0)
        for (const ec of existingList) {
          const h = ec.getString('cpf_hash')
          if (h) existingCollabMap['hash:' + h] = ec.id
          const n = ec.getString('name').trim().toUpperCase()
          const cc = ec.getString('cost_center')
          if (n && cc) existingCollabMap['name_cc:' + n + '_' + cc] = ec.id
        }
      } catch (err) {
        console.warn('Erro ao carregar colaboradores existentes no hook: ' + err)
      }

      // 2. Insert or link Collaborators
      for (let i = 0; i < collaborators.length; i++) {
        const c = collaborators[i]
        const clientKey = c.client_key || 'NEW_COLLAB_' + i
        const nameClean = String(c.name || '')
          .trim()
          .toUpperCase()
        const cpfHash = String(c.cpf_hash || '').trim()
        const costCenterId = String(c.cost_center || '').trim()

        // Check if already in database (idempotency check)
        let existingId = null
        if (cpfHash && existingCollabMap['hash:' + cpfHash]) {
          existingId = existingCollabMap['hash:' + cpfHash]
        } else if (
          nameClean &&
          costCenterId &&
          existingCollabMap['name_cc:' + nameClean + '_' + costCenterId]
        ) {
          existingId = existingCollabMap['name_cc:' + nameClean + '_' + costCenterId]
        }

        if (existingId) {
          collabIdMap[clientKey] = existingId
          skippedCollabsCount++
          continue
        }

        const rec = new Record(collabsCol)
        rec.set('name', nameClean)
        rec.set('cpf_hash', cpfHash)
        rec.set('cpf_encrypted', String(c.cpf_encrypted || ''))
        rec.set('cost_center', costCenterId)
        if (c.sector) rec.set('sector', String(c.sector).trim())
        rec.set(
          'role',
          String(c.role || 'COLABORADOR')
            .trim()
            .toUpperCase(),
        )

        const admissionIso = c.admission_date ? String(c.admission_date) : nowIso()
        rec.set('admission_date', admissionIso)
        rec.set('deadline_45', c.deadline_45 || addDays(admissionIso, 45))
        rec.set('deadline_90', c.deadline_90 || addDays(admissionIso, 90))
        rec.set('situation', 'Em experiência')
        rec.set('created_by', user.id)
        rec.set('import_reference', importRec.id)
        if (userClient) rec.set('client', userClient)
        if (c.import_line != null) rec.set('import_line', c.import_line)

        $app.save(rec)

        collabIdMap[clientKey] = rec.id
        existingCollabMap['hash:' + cpfHash] = rec.id
        if (nameClean && costCenterId)
          existingCollabMap['name_cc:' + nameClean + '_' + costCenterId] = rec.id
        insertedCollabsCount++
      }

      // Preload existing evaluations for idempotency check (collabId + "_" + stage -> evalId)
      const existingEvalMap = {}
      try {
        const evalsList = $app.findRecordsByFilter('evaluations', 'id != ""', '', 50000, 0)
        for (const ev of evalsList) {
          const cid = ev.getString('collaborator')
          const st = ev.getString('stage')
          if (cid && st) existingEvalMap[cid + '_' + st] = ev.id
        }
      } catch (err) {
        console.warn('Erro ao carregar avaliações existentes no hook: ' + err)
      }

      // 3. Insert Evaluations & Answers
      let insertedEvalsCount = 0
      let skippedEvalsCount = 0
      let insertedAnswersCount = 0

      for (let j = 0; j < evaluations.length; j++) {
        const ev = evaluations[j]
        let finalCollabId = ev.collaborator_id

        if (finalCollabId && String(finalCollabId).startsWith('NEW_COLLAB_')) {
          finalCollabId = collabIdMap[finalCollabId] || null
        }

        if (!finalCollabId) {
          continue
        }

        const stage = String(ev.stage || '45 dias').trim()
        const dedupeKey = finalCollabId + '_' + stage

        // Idempotency: skip evaluation if already exists for this collaborator + stage
        if (existingEvalMap[dedupeKey]) {
          skippedEvalsCount++
          continue
        }

        const evalRec = new Record(evalsCol)
        evalRec.set('collaborator', finalCollabId)
        evalRec.set('stage', stage)
        evalRec.set('evaluator', user.id)
        evalRec.set(
          'decision',
          String(ev.decision || (stage === '45 dias' ? 'EXTEND' : 'EFFECTIVATE')),
        )
        if (ev.justification) evalRec.set('justification', String(ev.justification))
        const notes = ev.notes ? String(ev.notes) : ''
        const importIdTag = ev.unique_import_id ? ' • ID Carga: ' + ev.unique_import_id : ''
        evalRec.set('notes', (notes + importIdTag).trim())
        evalRec.set('evaluated_at', ev.evaluated_at || nowIso())
        evalRec.set('origin', 'import')
        evalRec.set('import_reference', importRec.id)
        if (userClient) evalRec.set('client', userClient)

        $app.save(evalRec)
        existingEvalMap[dedupeKey] = evalRec.id
        insertedEvalsCount++

        // Save criteria answers
        if (Array.isArray(ev.answers) && ev.answers.length > 0) {
          for (const ans of ev.answers) {
            if (!ans.criterion_id || !ans.answer) continue
            try {
              const ansRec = new Record(answersCol)
              ansRec.set('evaluation', evalRec.id)
              ansRec.set('criterion', String(ans.criterion_id))
              ansRec.set('answer', String(ans.answer))
              if (userClient) ansRec.set('client', userClient)
              $app.save(ansRec)
              insertedAnswersCount++
            } catch (ansErr) {
              console.warn('Erro ao salvar resposta de critério no hook: ' + ansErr)
            }
          }
        }
      }

      // 4. Audit Log
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const audit = new Record(auditCol)
        audit.set('user', user.id)
        audit.set('entity_type', 'imports')
        audit.set('entity_id', importRec.id)
        audit.set('action', 'EXECUTE_UNIFIED_IMPORT')
        if (userClient) audit.set('client', userClient)
        audit.set(
          'summary',
          `Carga definitiva server-side concluída: ${insertedCollabsCount} colaboradores inseridos (${skippedCollabsCount} já existentes), ${insertedEvalsCount} avaliações (${skippedEvalsCount} duplicadas/existentes ignoradas), ${insertedAnswersCount} respostas a partir de: ${filenames}`,
        )
        $app.save(audit)
      } catch (auditErr) {
        console.warn('Erro ao gravar log de auditoria no hook: ' + auditErr)
      }

      return e.json(200, {
        success: true,
        import_id: importRec.id,
        inserted_collaborators: insertedCollabsCount,
        skipped_collaborators: skippedCollabsCount,
        inserted_evaluations: insertedEvalsCount,
        skipped_evaluations: skippedEvalsCount,
        inserted_answers: insertedAnswersCount,
      })
    } catch (err) {
      console.error('Falha geral na carga unificada server-side: ' + err)
      return e.json(500, {
        error: 'Falha interna ao gravar carga consolidada: ' + String(err),
      })
    }
  },
  $apis.requireAuth(),
)
