/// <reference path="../pb_data/types.d.ts" />

/**
 * Webhook de checkout do Stripe.
 * - Registra a venda (sales) vinculada ao cliente
 * - Estende a validade POR MÓDULO comprado (experiencia_until / desempenho_until)
 * - Envia e-mail de boas-vindas com usuário, senha inicial e manual em PDF
 *
 * Prices (Stripe, livemode):
 *   Experiência Mensal  : price_1UZsZmLpoAima4qd0bB0mZ0X (lookup experiencia_mensal,   R$ 297)
 *   Experiência Anual   : price_1UZsZsLpoAima4qdH4xI0GtR (lookup experiencia_anual,     R$ 2.899)
 *   Desempenho Mensal   : price_1UZs1vLpoAima4qdpy6h3fIE (lookup desempenho_mensal,     R$ 150)
 *   Desempenho Anual    : price_1UZs22LpoAima4qd2xUCt4c3 (lookup desempenho_anual,      R$ 1.399)
 *   Combo Mensal        : price_1UZs2BLpoAima4qdHILjzxQG (lookup combo_mensal,          R$ 397)
 *   Combo Anual         : price_1UZs2HLpoAima4qdkMumJCvL (lookup combo_anual,           R$ 3.897)
 */

const PRICE_MODULES = {
  // Experiência (mantém os prices que o checkout já usava)
  price_1UZsZmLpoAima4qd0bB0mZ0X: { modules: ['experiencia'], periodDays: 31 },
  price_1UZsZsLpoAima4qdH4xI0GtR: { modules: ['experiencia'], periodDays: 366 },
  // Desempenho
  price_1UZs1vLpoAima4qdpy6h3fIE: { modules: ['desempenho'], periodDays: 31 },
  price_1UZs22LpoAima4qd2xUCt4c3: { modules: ['desempenho'], periodDays: 366 },
  // Combo (desconto para os dois módulos)
  price_1UZs2BLpoAima4qdHILjzxQG: { modules: ['experiencia', 'desempenho'], periodDays: 31 },
  price_1UZs2HLpoAima4qdkMumJCvL: { modules: ['experiencia', 'desempenho'], periodDays: 366 },
}

const MODULE_FIELDS = {
  experiencia: 'experiencia_until',
  desempenho: 'desempenho_until',
}

const PERIOD_MONTHS = { 31: 1, 366: 12 }

function addMonthsOrDays(isoDate, periodDays) {
  const base = isoDate ? new Date(isoDate) : new Date()
  if (isNaN(base.getTime())) {
    base.setTime(Date.now())
  }
  const months = PERIOD_MONTHS[periodDays] || 1
  const d = new Date(base.getTime())
  d.setMonth(d.getMonth() + months)
  // Se a data regrediu (ex.: 31/01 + 1 mês virou 03/03 em alguns TZs), normaliza somando dias
  if (d.getTime() <= base.getTime()) {
    d.setTime(base.getTime() + periodDays * 86400000)
  }
  return d.toISOString().slice(0, 10)
}

routerAdd(
  'POST',
  '/backend/v1/stripe/webhook',
  (e) => {
    const info = e.requestInfo()
    const body = info.body || {}

    const eventId = body.id || ''
    const type = body.type || ''
    const dataObj = (body.data && body.data.object) || {}

    if (type !== 'checkout.session.completed') {
      return e.json(200, { received: true, ignored: type })
    }

    const sessionId = dataObj.id || eventId
    const metadata = dataObj.metadata || {}

    // 1) Resolver cliente
    let client = null
    const clientIdMeta = metadata.client_id || ''
    if (clientIdMeta) {
      try {
        client = $app.findRecordById('clients', clientIdMeta)
      } catch (_) {
        client = null
      }
    }

    if (!client) {
      // fallback: localizar por email do checkout
      const email = (dataObj.customer_details && dataObj.customer_details.email) || ''
      if (email) {
        try {
          const found = $app.findRecordsByFilter('clients', "email = '" + email + "'", '', 1, 0)
          if (found.length > 0) client = found[0]
        } catch (_) {}
      }
    }

    if (!client) {
      console.log('[stripe] checkout sem cliente resolvível: ' + sessionId)
      return e.json(200, { received: true, client: null })
    }

    // 2) Identificar preço e módulos liberados
    const lineItems = (dataObj.display_items || []).concat(
      dataObj.total_details && dataObj.total_details.line_items ? [] : [],
    )
    let priceId = metadata.price_id || ''
    if (!priceId && lineItems.length > 0 && lineItems[0].price && lineItems[0].price.id) {
      priceId = lineItems[0].price.id
    }

    const priceInfo = PRICE_MODULES[priceId] || null
    if (!priceInfo) {
      console.log('[stripe] price desconhecido no checkout ' + sessionId + ': ' + priceId)
      return e.json(200, { received: true, price: priceId, mapped: false })
    }

    const isAnnual = priceInfo.periodDays > 100
    const today = new Date().toISOString().slice(0, 10)

    // 3) Estender validade apenas dos módulos comprados (acumula sobre o que já existe)
    const granted = []
    for (const mod of priceInfo.modules) {
      const field = MODULE_FIELDS[mod]
      const current = client.getString(field)
      const base = current && current > today ? current : today
      client.set(field, addMonthsOrDays(base, priceInfo.periodDays))
      granted.push(mod)
    }
    client.set('status', 'active')
    $app.save(client)

    // 4) Registrar venda
    try {
      const sale = new Record($app.findCollectionByNameOrId('sales'))
      sale.set('client', client.get('id'))
      sale.set('stripe_price_id', priceId)
      sale.set('modules', granted.join(','))
      sale.set('billing_cycle', isAnnual ? 'anual' : 'mensal')
      sale.set('amount', dataObj.amount_total ? dataObj.amount_total / 100 : 0)
      sale.set('stripe_session_id', sessionId)
      sale.set('status', 'paid')
      $app.save(sale)
    } catch (err) {
      console.log('[stripe] falha ao registrar venda: ' + err)
    }

    // 5) E-mail de boas-vindas com credenciais + manual PDF (preservado)
    try {
      const email = client.getString('email')
      if (email) {
        const tempPassword = client.getString('initial_password') || ''
        const firstName = (client.getString('name') || '').split(' ')[0] || 'Cliente'
        const mods =
          granted.indexOf('desempenho') >= 0 && granted.indexOf('experiencia') >= 0
            ? 'Avaliação de Experiência + Avaliação de Desempenho'
            : granted[0] === 'desempenho'
              ? 'Avaliação de Desempenho'
              : 'Avaliação de Experiência'

        let manualB64 = ''
        try {
          const f = $os.getenv('USER_MANUAL_PDF_PATH') || 'pb_public/manual.pdf'
          const file = new $filepath(f)
          if ($os.fileExists(f)) {
            manualB64 = $os.readFile(f)
          }
        } catch (_) {}

        const html =
          '<p>Olá ' +
          firstName +
          ',</p>' +
          '<p>Seu acesso ao módulo <strong>' +
          mods +
          '</strong> está ativo!</p>' +
          (tempPassword
            ? '<p>Usuário: <strong>' +
              email +
              '</strong><br>Senha inicial: <strong>' +
              tempPassword +
              '</strong></p>'
            : '<p>Use seu e-mail e a senha já cadastrada para acessar.</p>') +
          '<p>O manual do usuário em PDF está anexado.</p>'

        const message = new MailerMessage({
          from: {
            address: $app.settings().meta.senderAddress,
            name: $app.settings().meta.senderName,
          },
          to: [{ address: email }],
          subject: 'Seu acesso está liberado - ' + mods,
          html: html,
        })

        if (manualB64) {
          message.addAttachment('manual-do-usuario.pdf', manualB64)
        }

        $app.newMailClient().send(message)
      }
    } catch (err) {
      console.log('[stripe] falha no e-mail de boas-vindas: ' + err)
    }

    return e.json(200, { received: true, modules: granted, cycle: isAnnual ? 'anual' : 'mensal' })
  },
  $os.getenv('STRIPE_WEBHOOK_SECRET') ? null : null,
)
