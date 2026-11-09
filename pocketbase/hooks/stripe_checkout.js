// Hook para integração com Stripe Checkout, Webhooks e Liberação de Acesso por Módulo
// Preserva criação de acesso de comprador + envio de e-mail de boas-vindas com usuário, senha inicial e manual em PDF.

// Mapeamento oficial dos Preços da Stripe por módulo e modalidade
const STRIPE_PRICES_MAP = {
  // Avaliação de Experiência
  price_1UW08YLpoAima4qdNrVsYYC5: {
    module: 'experiencia',
    interval: 'month',
    days: 30,
    planName: 'MENSAL',
    moduleLabel: 'Avaliação de Experiência (Mensal)',
    amountCents: 29700,
  },
  price_1UW0OhLpoAima4qdRW4Xmqs0: {
    module: 'experiencia',
    interval: 'year',
    days: 365,
    planName: 'ANUAL',
    moduleLabel: 'Avaliação de Experiência (Anual)',
    amountCents: 289900,
  },

  // Avaliação de Desempenho
  price_1UZs1vLpoAima4qdpy6h3fIE: {
    module: 'desempenho',
    interval: 'month',
    days: 30,
    planName: 'MENSAL',
    moduleLabel: 'Avaliação de Desempenho (Mensal)',
    amountCents: 15000,
  },
  price_1UZs22LpoAima4qd2xUCt4c3: {
    module: 'desempenho',
    interval: 'year',
    days: 365,
    planName: 'ANUAL',
    moduleLabel: 'Avaliação de Desempenho (Anual)',
    amountCents: 139900,
  },

  // Combo (Experiência + Desempenho)
  price_1UZs2BLpoAima4qdHILjzxQG: {
    module: 'combo',
    interval: 'month',
    days: 30,
    planName: 'MENSAL',
    moduleLabel: 'Combo Experiência + Desempenho (Mensal)',
    amountCents: 39700,
  },
  price_1UZs2HLpoAima4qdkMumJCvL: {
    module: 'combo',
    interval: 'year',
    days: 365,
    planName: 'ANUAL',
    moduleLabel: 'Combo Experiência + Desempenho (Anual)',
    amountCents: 389700,
  },
}

// 1. Rota para consultar as ofertas e payment links
routerAdd('GET', '/backend/v1/billing/offers', (e) => {
  const offers = {
    experiencia: {
      id: 'experiencia',
      name: 'Avaliação de Experiência',
      description:
        'Gestão completa de contratos de experiência (45 e 90 dias) e Entrevista de Desligamento.',
      monthly: {
        price_id: 'price_1UW08YLpoAima4qdNrVsYYC5',
        payment_link: 'https://buy.stripe.com/14AdRa2IK9FJ42gfqb3Nm00',
        price_label: '297,00',
        amount_cents: 29700,
        interval: 'month',
      },
      annual: {
        price_id: 'price_1UW0OhLpoAima4qdRW4Xmqs0',
        payment_link: 'https://buy.stripe.com/aFa7sMgzAf0342ga5R3Nm02',
        price_label: '2.899,00',
        amount_cents: 289900,
        interval: 'year',
        badge: '2 meses grátis • Economia de R$ 665',
      },
    },
    desempenho: {
      id: 'desempenho',
      name: 'Avaliação de Desempenho',
      description:
        'Ciclos de avaliação de desempenho por competências, Nível I e II, feedbacks e evolução.',
      monthly: {
        price_id: 'price_1UZs1vLpoAima4qdpy6h3fIE',
        payment_link: '',
        price_label: '150,00',
        amount_cents: 15000,
        interval: 'month',
      },
      annual: {
        price_id: 'price_1UZs22LpoAima4qd2xUCt4c3',
        payment_link: '',
        price_label: '1.399,00',
        amount_cents: 139900,
        interval: 'year',
        badge: 'Economia de R$ 401/ano',
      },
    },
    combo: {
      id: 'combo',
      name: 'Combo (Experiência + Desempenho)',
      description: 'Acesso completo a ambos os módulos com desconto especial unificado.',
      is_combo: true,
      monthly: {
        price_id: 'price_1UZs2BLpoAima4qdHILjzxQG',
        payment_link: '',
        price_label: '397,00',
        amount_cents: 39700,
        interval: 'month',
        badge: 'Economia de R$ 50/mês vs módulos separados',
      },
      annual: {
        price_id: 'price_1UZs2HLpoAima4qdkMumJCvL',
        payment_link: '',
        price_label: '3.897,00',
        amount_cents: 389700,
        interval: 'year',
        badge: 'Melhor Valor • Economia de R$ 401 no ano',
      },
    },
  }

  return e.json(200, { offers })
})

// Rota de compatibilidade para /backend/v1/billing/checkout-link
routerAdd('GET', '/backend/v1/billing/checkout-link', (e) => {
  return e.json(200, {
    stripe_connected: true,
    payment_link: 'https://buy.stripe.com/14AdRa2IK9FJ42gfqb3Nm00',
    price_id: 'price_1UW08YLpoAima4qdNrVsYYC5',
    price_label: '297,00',
    monthly: {
      name: 'Plano Mensal',
      price_id: 'price_1UW08YLpoAima4qdNrVsYYC5',
      payment_link: 'https://buy.stripe.com/14AdRa2IK9FJ42gfqb3Nm00',
      price_label: '297,00',
      amount_cents: 29700,
      active: true,
      interval: 'month',
      is_official: true,
    },
    annual: {
      name: 'Plano Anual',
      price_id: 'price_1UW0OhLpoAima4qdRW4Xmqs0',
      payment_link: 'https://buy.stripe.com/aFa7sMgzAf0342ga5R3Nm02',
      price_label: '2.899,00',
      amount_cents: 289900,
      active: true,
      interval: 'year',
      badge: '2 meses grátis • Economia de R$ 665',
      is_official: true,
    },
  })
})

// 2. Rota para criar Checkout Session na Stripe via API oficial
routerAdd('POST', '/backend/v1/billing/create-checkout-session', (e) => {
  try {
    const body = e.requestInfo().body || {}
    const priceId = body.price_id ? String(body.price_id).trim() : 'price_1UW08YLpoAima4qdNrVsYYC5'
    const customerEmail = body.customer_email
      ? String(body.customer_email).trim().toLowerCase()
      : ''
    const customerName = body.customer_name ? String(body.customer_name).trim() : ''

    let appUrl = 'https://avaliacao-de-experiencia-67c4f.goskip.app'
    try {
      const envUrl = $os.getenv('SITE_URL')
      if (envUrl && envUrl.trim()) appUrl = envUrl.trim()
    } catch (_) {}
    if (appUrl.endsWith('/')) appUrl = appUrl.slice(0, -1)

    const successUrl = body.success_url || `${appUrl}/obrigado?session_id={CHECKOUT_SESSION_ID}`
    const cancelUrl = body.cancel_url || `${appUrl}/#precos`

    // Se o preço tiver um Payment Link direto oficial conhecido:
    if (priceId === 'price_1UW08YLpoAima4qdNrVsYYC5') {
      let link = 'https://buy.stripe.com/14AdRa2IK9FJ42gfqb3Nm00'
      if (customerEmail) link += `?prefilled_email=${encodeURIComponent(customerEmail)}`
      return e.json(200, { url: link })
    }
    if (priceId === 'price_1UW0OhLpoAima4qdRW4Xmqs0') {
      let link = 'https://buy.stripe.com/aFa7sMgzAf0342ga5R3Nm02'
      if (customerEmail) link += `?prefilled_email=${encodeURIComponent(customerEmail)}`
      return e.json(200, { url: link })
    }

    // Para outros preços (Desempenho e Combo), criar Checkout Session via Stripe API
    let stripeKey = ''
    try {
      stripeKey = $os.getenv('STRIPE_SECRET_KEY') || ''
    } catch (_) {}

    if (!stripeKey) {
      try {
        const s = $app.findFirstRecordByData('settings', 'key', 'stripe_secret_key')
        if (s && s.getString('value')) stripeKey = s.getString('value').trim()
      } catch (_) {}
    }

    if (stripeKey) {
      const params = [
        'mode=subscription',
        `success_url=${encodeURIComponent(successUrl)}`,
        `cancel_url=${encodeURIComponent(cancelUrl)}`,
        `line_items[0][price]=${encodeURIComponent(priceId)}`,
        'line_items[0][quantity]=1',
        'allow_promotion_codes=true',
        'billing_address_collection=auto',
      ]
      if (customerEmail) {
        params.push(`customer_email=${encodeURIComponent(customerEmail)}`)
      }

      const postData = params.join('&')
      const res = $http.send({
        url: 'https://api.stripe.com/v1/checkout/sessions',
        method: 'POST',
        headers: {
          Authorization: `Bearer ${stripeKey}`,
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        body: postData,
      })

      if (res.statusCode >= 200 && res.statusCode < 300) {
        const data = JSON.parse(res.raw)
        if (data && data.url) {
          return e.json(200, { url: data.url, session_id: data.id })
        }
      } else {
        console.warn('[create-checkout-session] Erro resposta Stripe: ' + res.raw)
      }
    }

    // Fallback amigável se não tiver STRIPE_SECRET_KEY
    return e.json(200, {
      url: `https://buy.stripe.com/14AdRa2IK9FJ42gfqb3Nm00?prefilled_email=${encodeURIComponent(customerEmail)}`,
      fallback: true,
      message: 'Redirecionando para checkout seguro Stripe.',
    })
  } catch (err) {
    return e.json(500, { error: 'Erro ao gerar sessão de checkout: ' + String(err) })
  }
})

// 3. Webhook da Stripe para processamento de pagamentos e liberação de acesso por módulo
const handleStripeWebhookEvent = (e) => {
  try {
    const rawBody = e.requestInfo().body || {}
    const event = typeof rawBody === 'string' ? JSON.parse(rawBody) : rawBody

    const eventType = event.type || ''
    console.log(`[stripe_webhook] Recebido evento: ${eventType}`)

    if (eventType !== 'checkout.session.completed' && eventType !== 'invoice.payment_succeeded') {
      return e.json(200, { received: true, ignored: true, type: eventType })
    }

    const dataObject = event.data && event.data.object ? event.data.object : {}

    // Identificar e-mail do cliente
    let customerEmail = ''
    if (dataObject.customer_details && dataObject.customer_details.email) {
      customerEmail = dataObject.customer_details.email.trim().toLowerCase()
    } else if (dataObject.customer_email) {
      customerEmail = dataObject.customer_email.trim().toLowerCase()
    }

    let customerName = ''
    if (dataObject.customer_details && dataObject.customer_details.name) {
      customerName = dataObject.customer_details.name.trim()
    }

    const stripeCustomerId = dataObject.customer || ''
    const stripeSubscriptionId = dataObject.subscription || ''

    // Identificar price_id contratado
    let priceId = ''
    if (dataObject.line_items && dataObject.line_items.data && dataObject.line_items.data[0]) {
      const item = dataObject.line_items.data[0]
      if (item.price && item.price.id) priceId = item.price.id
    }
    if (!priceId && dataObject.lines && dataObject.lines.data && dataObject.lines.data[0]) {
      const item = dataObject.lines.data[0]
      if (item.price && item.price.id) priceId = item.price.id
    }
    if (!priceId && dataObject.metadata && dataObject.metadata.price_id) {
      priceId = dataObject.metadata.price_id
    }

    // Se ainda não identificou, assume Experiência Mensal como padrão legado
    const offerMeta = STRIPE_PRICES_MAP[priceId] || {
      module: 'experiencia',
      interval: 'month',
      days: 30,
      planName: 'MENSAL',
      moduleLabel: 'Avaliação de Experiência',
      amountCents: dataObject.amount_total || 29700,
    }

    if (!customerEmail) {
      console.warn('[stripe_webhook] E-mail não localizado no payload do evento.')
      return e.json(200, { received: true, warning: 'No email found' })
    }

    console.log(
      `[stripe_webhook] Processando liberação para ${customerEmail}: Módulo ${offerMeta.module}, Plano ${offerMeta.planName}, Preço ${priceId}`,
    )

    // Data de vencimento correspondente à periodicidade (30 ou 365 dias)
    const now = new Date()
    const validUntilDate = new Date(now.getTime() + offerMeta.days * 24 * 60 * 60 * 1000)
    const validUntilIso = validUntilDate.toISOString().split('T')[0]

    let clientRec = null
    let isNewClient = false
    let initialPassword = ''

    try {
      clientRec = $app.findFirstRecordByData('clients', 'email', customerEmail)
    } catch (_) {}

    if (clientRec) {
      // Cliente já existente: estende validade do módulo adquirido e reativa
      clientRec.set('active', true)
      clientRec.set('status', 'active')
      clientRec.set('plan', offerMeta.planName)

      // Atualiza validade geral paid_until se a nova for maior
      const currentPaid = clientRec.getString('paid_until')
      if (!currentPaid || currentPaid < validUntilIso) {
        clientRec.set('paid_until', validUntilIso)
      }

      // Liberação granular por módulo
      if (offerMeta.module === 'experiencia' || offerMeta.module === 'combo') {
        const curExp = clientRec.getString('experiencia_until')
        if (!curExp || curExp < validUntilIso) {
          clientRec.set('experiencia_until', validUntilIso)
        }
      }

      if (offerMeta.module === 'desempenho' || offerMeta.module === 'combo') {
        const curDes = clientRec.getString('desempenho_until')
        if (!curDes || curDes < validUntilIso) {
          clientRec.set('desempenho_until', validUntilIso)
        }
      }

      $app.save(clientRec)

      // Reativa usuários do cliente
      try {
        const users = $app.findRecordsByFilter(
          '_pb_users_auth_',
          `client = '${clientRec.id}'`,
          '',
          100,
          0,
        )
        for (let u of users) {
          u.set('active', true)
          $app.save(u)
        }
      } catch (_) {}
    } else {
      // Novo cliente comprador
      isNewClient = true
      const clientsCol = $app.findCollectionByNameOrId('clients')
      clientRec = new Record(clientsCol)
      clientRec.set('name', customerName || customerEmail.split('@')[0])
      clientRec.set('email', customerEmail)
      clientRec.set('plan', offerMeta.planName)
      clientRec.set('active', true)
      clientRec.set('status', 'active')
      clientRec.set('paid_until', validUntilIso)

      if (offerMeta.module === 'experiencia' || offerMeta.module === 'combo') {
        clientRec.set('experiencia_until', validUntilIso)
      }
      if (offerMeta.module === 'desempenho' || offerMeta.module === 'combo') {
        clientRec.set('desempenho_until', validUntilIso)
      }

      $app.save(clientRec)

      // Gerar senha inicial segura para o comprador
      const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnpqrstuvwxyz23456789'
      for (let i = 0; i < 10; i++) {
        initialPassword += chars.charAt(Math.floor(Math.random() * chars.length))
      }

      // Cria usuário de acesso ADMIN do tenant
      let userRec = null
      try {
        userRec = $app.findAuthRecordByEmail('_pb_users_auth_', customerEmail)
      } catch (_) {}

      if (!userRec) {
        const usersCol = $app.findCollectionByNameOrId('_pb_users_auth_')
        userRec = new Record(usersCol)
        userRec.setEmail(customerEmail)
        userRec.setPassword(initialPassword)
        userRec.setVerified(true)
        userRec.set('name', customerName || customerEmail.split('@')[0])
        userRec.set('profile', 'ADMIN')
        userRec.set('client', clientRec.id)
        userRec.set('active', true)
        $app.save(userRec)
      } else {
        userRec.set('client', clientRec.id)
        userRec.set('active', true)
        $app.save(userRec)
      }

      // Inicializa critérios de avaliação herdados para o cliente
      try {
        const criteriaCol = $app.findCollectionByNameOrId('evaluation_criteria')
        const allDefault = [
          {
            order: 1,
            name: 'Disciplina e cumprimento de regras',
            description:
              'Pontualidade, respeito às normas de segurança, postura e conduta ética no ambiente de trabalho.',
            category: 'Geral',
          },
          {
            order: 2,
            name: 'Qualidade técnica e produtividade',
            description:
              'Execução correta das tarefas, atenção aos detalhes, rendimento e entrega nos prazos combinados.',
            category: 'Técnico',
          },
          {
            order: 3,
            name: 'Trabalho em equipe e comunicação',
            description:
              'Relacionamento interpessoal com colegas e liderança, cooperação e clareza na comunicação.',
            category: 'Comportamental',
          },
          {
            order: 4,
            name: 'Iniciativa e interesse',
            description:
              'Vontade de aprender, proatividade para resolver problemas e dedicação ao desenvolvimento profissional.',
            category: 'Comportamental',
          },
          {
            order: 5,
            name: 'Uso de EPI e segurança no trabalho',
            description:
              'Uso correto e contínuo dos equipamentos de proteção individual e zelo pela integridade física da equipe.',
            category: 'Segurança',
          },
        ]

        for (let item of allDefault) {
          const rec = new Record(criteriaCol)
          rec.set('name', item.name)
          rec.set('description', item.description)
          rec.set('order', item.order)
          rec.set('category', item.category)
          rec.set('sector', null)
          rec.set('client', clientRec.id)
          rec.set('active', true)
          $app.save(rec)
        }
      } catch (critErr) {
        console.warn('[stripe_webhook] Aviso ao inicializar critérios: ' + critErr)
      }
    }

    // Registrar venda na coleção 'sales'
    try {
      const salesCol = $app.findCollectionByNameOrId('sales')
      const saleRec = new Record(salesCol)
      saleRec.set('plan', offerMeta.planName)
      saleRec.set('amount', offerMeta.amountCents / 100)
      saleRec.set(
        'amount_label',
        `R$ ${(offerMeta.amountCents / 100).toFixed(2).replace('.', ',')}`,
      )
      saleRec.set('status', 'succeeded')
      saleRec.set('customer_name', customerName || customerEmail)
      saleRec.set('customer_email', customerEmail)
      saleRec.set('payment_method', 'Stripe')
      if (stripeSubscriptionId) saleRec.set('stripe_subscription_id', stripeSubscriptionId)
      if (stripeCustomerId) saleRec.set('stripe_customer_id', stripeCustomerId)
      $app.save(saleRec)
    } catch (saleErr) {
      console.warn('[stripe_webhook] Aviso ao registrar venda: ' + saleErr)
    }

    // Disparar e-mail de confirmação / boas-vindas com dados de acesso e manual do usuário
    try {
      let appUrl = 'https://avaliacao-de-experiencia-67c4f.goskip.app'
      try {
        const envUrl = $os.getenv('SITE_URL')
        if (envUrl && envUrl.trim()) appUrl = envUrl.trim()
      } catch (_) {}
      if (appUrl.endsWith('/')) appUrl = appUrl.slice(0, -1)

      const subject = isNewClient
        ? '🎉 Bem-vindo ao Sistema! Seu acesso está ativo e liberado'
        : `Confirmação de Pagamento: Acesso renovado ao módulo ${offerMeta.moduleLabel}`

      const textBody = isNewClient
        ? [
            `Olá, ${customerName || 'Cliente'}!`,
            '',
            `Sua assinatura do módulo ${offerMeta.moduleLabel} foi confirmada com sucesso na Stripe e seu acesso ao sistema já está ATIVO E LIBERADO PARA USO!`,
            '',
            `DADOS DE ACESSO AO SISTEMA:`,
            `• Link de Acesso: ${appUrl}/login`,
            `• Usuário (E-mail): ${customerEmail}`,
            `• Senha Inicial: ${initialPassword}`,
            '',
            `Por motivos de segurança, recomendamos trocar sua senha no primeiro acesso através do menu de perfil ou pelo link "Esqueci minha senha".`,
            '',
            `O Manual Completo do Usuário está anexado a este e-mail em formato PDF e também pode ser acessado a qualquer momento em:`,
            `${appUrl}/manual-usuario.pdf`,
            '',
            `Se precisar de suporte, estamos à disposição:`,
            `WhatsApp: (82) 99106-9350`,
            `E-mail: valdknupp@gmail.com`,
          ].join('\n')
        : [
            `Olá, ${customerName || 'Cliente'}!`,
            '',
            `Confirmamos o recebimento do seu pagamento na Stripe referente ao módulo ${offerMeta.moduleLabel}.`,
            `Sua assinatura foi renovada com sucesso até ${validUntilIso}.`,
            '',
            `Acesse o sistema: ${appUrl}/login`,
          ].join('\n')

      const htmlBody = `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 24px; border: 1px solid #E8E8E8; border-radius: 8px; background-color: #FFFFFF;">
          <div style="background-color: #111111; padding: 20px; border-radius: 6px; text-align: center; margin-bottom: 24px;">
            <h2 style="color: #54D769; margin: 0; font-size: 22px; font-weight: bold;">Avaliação de Experiência & Desempenho</h2>
            <p style="color: #FFFFFF; margin: 6px 0 0 0; font-size: 13px; text-transform: uppercase; letter-spacing: 1px;">Acesso Ativo e Liberado</p>
          </div>
          <div style="color: #333333; line-height: 1.6; font-size: 15px;">
            <p>Olá, <strong>${customerName || 'Cliente'}</strong>!</p>
            <p>Sua assinatura do módulo <strong>${offerMeta.moduleLabel}</strong> foi confirmada com sucesso pela Stripe e o sistema já está <strong>ativo e pronto para uso</strong>.</p>
            
            ${
              isNewClient
                ? `
              <div style="background-color: #F8F9FA; border-left: 4px solid #54D769; padding: 16px; margin: 20px 0; border-radius: 4px;">
                <h3 style="margin: 0 0 10px 0; font-size: 15px; color: #111111;">Seus Dados de Acesso:</h3>
                <p style="margin: 0; font-size: 14px; line-height: 1.8;">
                  <strong>Link de Acesso:</strong> <a href="${appUrl}/login" style="color: #111111; font-weight: bold;">${appUrl}/login</a><br>
                  <strong>Usuário (E-mail):</strong> ${customerEmail}<br>
                  <strong>Senha Inicial:</strong> <code style="background-color: #EFEFEF; padding: 2px 6px; border-radius: 3px; font-weight: bold; font-size: 15px;">${initialPassword}</code>
                </p>
              </div>
              <p style="font-size: 13px; color: #666666;">Recomendamos alterar sua senha no primeiro login nas configurações de perfil.</p>
            `
                : `
              <div style="background-color: #F8F9FA; border-left: 4px solid #54D769; padding: 14px 16px; margin: 20px 0; border-radius: 4px;">
                <p style="margin: 0; font-size: 14px;"><strong>Validade estendida até:</strong> ${validUntilIso}</p>
              </div>
            `
            }

            <div style="text-align: center; margin: 28px 0;">
              <a href="${appUrl}/login" style="background-color: #54D769; color: #111111; padding: 14px 32px; text-decoration: none; border-radius: 6px; font-weight: bold; font-size: 15px; display: inline-block;">
                Acessar o Sistema Agora
              </a>
            </div>

            <div style="background-color: #F0FDF4; border: 1px solid #BBF7D0; padding: 14px 16px; border-radius: 6px; margin-top: 24px; font-size: 13px; color: #166534;">
              <strong>Manual do Usuário em Anexo:</strong><br>
              Anexamos a este e-mail o <em>Manual Completo do Usuário (PDF)</em> com passo a passo para início rápido. Você também pode visualizá-lo a qualquer momento em: <a href="${appUrl}/manual-usuario.pdf" style="color: #15803D; font-weight: bold;">${appUrl}/manual-usuario.pdf</a>.
            </div>

            <div style="margin-top: 24px; padding-top: 16px; border-top: 1px solid #E8E8E8; font-size: 13px; color: #555555;">
              <strong>Dúvidas ou suporte?</strong><br>
              WhatsApp: <strong>(82) 99106-9350</strong> | E-mail: <a href="mailto:valdknupp@gmail.com" style="color: #111111;">valdknupp@gmail.com</a>
            </div>
          </div>
        </div>
      `

      const message = new MailerMessage({
        from: {
          address: 'valdknupp@gmail.com',
          name: $app.settings().meta.senderName || 'Avaliação de Experiência',
        },
        to: [{ address: customerEmail }],
        subject: subject,
        text: textBody,
        html: htmlBody,
      })

      // Anexar manual em PDF se disponível
      try {
        let pdfReader = null
        try {
          const assetRec = $app.findFirstRecordByData('system_assets', 'key', 'manual-usuario.pdf')
          if (assetRec && assetRec.getString('file')) {
            const fsSystem = $app.newFilesystem()
            pdfReader = fsSystem.fileReader(
              assetRec.baseFilesPath() + '/' + assetRec.getString('file'),
            )
          }
        } catch (_) {}

        if (!pdfReader) {
          try {
            const f = $filesystem.fileFromPath('public/manual-usuario.pdf')
            if (f && f.reader) pdfReader = f.reader.open()
          } catch (_) {}
        }

        if (pdfReader) {
          message.attachments = { 'manual-usuario.pdf': pdfReader }
        }
      } catch (attErr) {
        console.warn('[stripe_webhook] Aviso ao carregar anexo do manual: ' + attErr)
      }

      $app.newMailClient().send(message)

      // Registrar log em client_email_logs
      try {
        const logsCol = $app.findCollectionByNameOrId('client_email_logs')
        const logRec = new Record(logsCol)
        logRec.set('client', clientRec.id)
        logRec.set('recipient', customerEmail)
        logRec.set('type', 'welcome_payment')
        logRec.set('subject', subject)
        logRec.set('paid_until', validUntilIso)
        logRec.set('plan', offerMeta.planName)
        logRec.set(
          'dedupe_key',
          `welcome_${clientRec.id}_${offerMeta.module}_${Date.now()}_${customerEmail}`,
        )
        logRec.set('status', 'Enviado')
        logRec.set('sent_at', new DateTime())
        $app.save(logRec)
      } catch (_) {}
    } catch (mailErr) {
      console.error('[stripe_webhook] Erro ao enviar e-mail de boas-vindas: ' + mailErr)
    }

    return e.json(200, {
      received: true,
      client_id: clientRec.id,
      module: offerMeta.module,
      valid_until: validUntilIso,
    })
  } catch (err) {
    console.error('[stripe_webhook] Erro fatal: ' + err)
    return e.json(500, { error: 'Erro no processamento do webhook: ' + String(err) })
  }
}

// Endpoints para receber o webhook da Stripe
routerAdd('POST', '/backend/v1/stripe/webhook', handleStripeWebhookEvent)
routerAdd('POST', '/backend/v1/stripe-webhook', handleStripeWebhookEvent)
routerAdd('POST', '/backend/v1/billing/webhook', handleStripeWebhookEvent)
