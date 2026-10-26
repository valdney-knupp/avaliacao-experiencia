// Handles notification email delivery asynchronously without failing the operation
onRecordAfterCreateSuccess((e) => {
  const notif = e.record
  const status = notif.getString('status')
  if (status !== 'Pendente') {
    return
  }

  const recipient = notif.getString('recipient')
  const subject = notif.getString('subject')
  const body = notif.getString('body')

  if (!recipient || !subject) {
    notif.set('status', 'Falha')
    notif.set('last_error', 'Destinatário ou assunto vazio')
    $app.save(notif)
    return
  }

  try {
    const attempts = notif.getInt('attempts') || 0
    notif.set('attempts', attempts + 1)

    // Resolve frontend application URL from environment, database settings, or production default
    let appUrl = 'https://avaliacao-de-experiencia-67c4f.goskip.app'
    try {
      const envUrl = $os.getenv('SITE_URL')
      if (envUrl && envUrl.trim()) {
        appUrl = envUrl.trim()
      } else {
        const appUrlSetting = $app.findFirstRecordByData('settings', 'key', 'app_url')
        const val = appUrlSetting.getString('value')
        if (val && val.trim()) {
          appUrl = val.trim()
        }
      }
    } catch (_) {}

    // Ensure no trailing slash
    if (appUrl.endsWith('/')) {
      appUrl = appUrl.slice(0, -1)
    }

    const message = new MailerMessage({
      from: {
        address: $app.settings().meta.senderAddress || 'naoresponda@rpontes.com.br',
        name: $app.settings().meta.senderName || 'Avaliação de Experiência - R. Pontes',
      },
      to: [{ address: recipient }],
      subject: subject,
      text: `${body}\n\nAcessar o sistema: ${appUrl}`,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E8E8E8; border-radius: 8px; background-color: #FFFFFF;">
          <div style="background-color: #111111; padding: 18px 20px; border-radius: 6px; text-align: center; margin-bottom: 24px;">
            <h2 style="color: #54D769; margin: 0; font-size: 20px; font-weight: bold; letter-spacing: 0.5px;">Construtora R. Pontes</h2>
            <p style="color: #FFFFFF; margin: 6px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Avaliação de Experiência</p>
          </div>
          <div style="color: #333333; line-height: 1.6; font-size: 15px; margin-bottom: 28px;">
            ${body.replace(/\n/g, '<br>')}
          </div>
          <div style="text-align: center; margin: 30px 0;">
            <a href="${appUrl}" style="background-color: #54D769; color: #111111; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block; box-shadow: 0 2px 4px rgba(0,0,0,0.1); text-align: center; min-width: 180px;">
              Acessar o sistema
            </a>
          </div>
          <div style="margin-top: 32px; padding-top: 16px; border-top: 1px solid #E8E8E8; font-size: 12px; color: #777777; text-align: center; line-height: 1.5;">
            Este é um e-mail automático gerado pelo sistema de Avaliação de Experiência da Construtora R. Pontes.<br>
            Se o botão não funcionar, copie e cole este link no seu navegador: <a href="${appUrl}" style="color: #111111; text-decoration: underline;">${appUrl}</a>
          </div>
        </div>
      `,
    })

    $app.newMailClient().send(message)

    notif.set('status', 'Enviada')
    notif.set('sent_at', new DateTime())
    $app.save(notif)
  } catch (err) {
    notif.set('status', 'Falha')
    notif.set('last_error', String(err))
    $app.save(notif)
  }
}, 'notifications')
