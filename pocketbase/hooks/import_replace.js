// Replaces imported records from a chosen import history
routerAdd(
  'POST',
  '/backend/v1/imports/{id}/replace',
  (e) => {
    const importId = e.requestInfo().pathParams.id
    const user = e.auth

    if (!user || user.getString('profile') !== 'ADMIN') {
      return e.json(403, {
        error: 'Apenas administradores podem executar substituição de histórico importado.',
      })
    }

    let importRec = null
    try {
      importRec = $app.findRecordById('imports', importId)
    } catch (_) {
      return e.json(404, { error: 'Importação não encontrada.' })
    }

    try {
      let deletedCollabs = 0
      let deletedEvals = 0

      // Delete evaluations linked to this import (and cascade delete their answers)
      const evals = $app.findRecordsByFilter(
        'evaluations',
        `import_reference = '${importId}'`,
        '',
        5000,
        0,
      )
      for (const ev of evals) {
        try {
          const answers = $app.findRecordsByFilter(
            'evaluation_answers',
            `evaluation = '${ev.id}'`,
            '',
            100,
            0,
          )
          for (const ans of answers) {
            $app.delete(ans)
          }
        } catch (_) {}
        $app.delete(ev)
        deletedEvals++
      }

      // Delete collaborators linked to this import
      const collabs = $app.findRecordsByFilter(
        'collaborators',
        `import_reference = '${importId}'`,
        '',
        5000,
        0,
      )
      for (const c of collabs) {
        $app.delete(c)
        deletedCollabs++
      }

      importRec.set('status', 'replaced')
      $app.save(importRec)

      // Audit log
      const auditCol = $app.findCollectionByNameOrId('audit_logs')
      const audit = new Record(auditCol)
      audit.set('user', user.id)
      audit.set('entity_type', 'imports')
      audit.set('entity_id', importId)
      audit.set('action', 'REPLACE_IMPORT')
      audit.set(
        'summary',
        `Histórico importado ${importRec.getString('filename')} revertido: ${deletedCollabs} colaboradores e ${deletedEvals} avaliações removidos.`,
      )
      $app.save(audit)

      return e.json(200, {
        success: true,
        deleted_collaborators: deletedCollabs,
        deleted_evaluations: deletedEvals,
      })
    } catch (err) {
      return e.json(500, { error: 'Falha ao substituir histórico importado: ' + String(err) })
    }
  },
  $apis.requireAuth(),
)
