// Hook auxiliar para fornecer o manual em PDF diretamente pelo backend em /manual-usuario.pdf
// e permitir download direto com Content-Type application/pdf.

routerAdd('GET', '/manual-usuario.pdf', (e) => {
  try {
    // 1. Tentar ler da coleção system_assets
    try {
      const rec = $app.findFirstRecordByData('system_assets', 'key', 'manual-usuario.pdf')
      if (rec && rec.getString('file')) {
        const fileKey = rec.getString('file')
        const fsSystem = $app.newFilesystem()
        const reader = fsSystem.fileReader(rec.baseFilesPath() + '/' + fileKey)
        if (reader) {
          e.response.header().set('Content-Type', 'application/pdf')
          e.response.header().set('Content-Disposition', 'inline; filename="manual-usuario.pdf"')
          return e.stream(200, 'application/pdf', reader)
        }
      }
    } catch (_) {}

    // 2. Tentar ler do caminho local pb_hooks/assets/manual-usuario.pdf ou public/manual-usuario.pdf
    const candidatePaths = [
      'pb_hooks/assets/manual-usuario.pdf',
      'public/manual-usuario.pdf',
      'pb_public/manual-usuario.pdf',
    ]

    for (const p of candidatePaths) {
      try {
        const f = $filesystem.fileFromPath(p)
        if (f) {
          const r = f.reader.open()
          e.response.header().set('Content-Type', 'application/pdf')
          e.response.header().set('Content-Disposition', 'inline; filename="manual-usuario.pdf"')
          return e.stream(200, 'application/pdf', r)
        }
      } catch (_) {}
    }

    // 3. Fallback: redirecionar para a URL do frontend
    return e.redirect(302, '/manual-usuario.pdf')
  } catch (err) {
    return e.json(500, { error: 'Erro ao servir o manual do usuário: ' + String(err) })
  }
})
