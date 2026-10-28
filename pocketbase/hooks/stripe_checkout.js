// Rota pública para obtenção dos links e configurações dos planos (Mensal e Anual)
// Cria ou reutiliza no Stripe sob demanda via $connectors.executeAsOwner
// Sempre que o Stripe estiver conectado no painel Conectores, esta rota cria ou obtém
// o produto, preços recorrentes de R$ 297/mês e R$ 2.970/ano e payment links oficiais.

routerAdd('GET', '/backend/v1/billing/checkout-link', (e) => {
  const PRODUCT_NAME = 'Avaliação de Experiência'
  const PRODUCT_DESC = 'Sistema de gestão de avaliações de experiência de 45 e 90 dias'

  // 1. Obter valores salvos em settings
  let monthlyPriceLabel = '297,00'
  let annualPriceLabel = '2.970,00'
  let monthlyPaymentLink = 'https://buy.stripe.com/test_avaliacao_experiencia_297'
  let annualPaymentLink = 'https://buy.stripe.com/test_avaliacao_experiencia_2970_anual'
  let monthlyPriceId = 'price_avaliacao_experiencia_297'
  let annualPriceId = 'price_avaliacao_experiencia_2970_anual'
  let monthlyActive = true
  let annualActive = true

  const getSetting = (k, fallback) => {
    try {
      const rec = $app.findFirstRecordByData('settings', 'key', k)
      if (rec && rec.getString('value') !== '') return rec.getString('value')
    } catch (_) {}
    return fallback
  }

  monthlyPriceLabel = getSetting(
    'stripe_monthly_price_label',
    getSetting('stripe_plan_price_label', '297,00'),
  )
  annualPriceLabel = getSetting('stripe_annual_price_label', '2.970,00')
  monthlyPaymentLink = getSetting(
    'stripe_monthly_payment_link',
    getSetting('stripe_payment_link', monthlyPaymentLink),
  )
  annualPaymentLink = getSetting('stripe_annual_payment_link', annualPaymentLink)
  monthlyPriceId = getSetting(
    'stripe_monthly_price_id',
    getSetting('stripe_price_id', monthlyPriceId),
  )
  annualPriceId = getSetting('stripe_annual_price_id', annualPriceId)
  monthlyActive = getSetting('stripe_monthly_active', 'true') !== 'false'
  annualActive = getSetting('stripe_annual_active', 'true') !== 'false'

  // Calcular valor numérico em centavos a partir dos labels
  const parseAmountToCents = (label, defaultCents) => {
    try {
      const cleaned = String(label)
        .replace(/\./g, '')
        .replace(',', '.')
        .replace(/[^\d.]/g, '')
      const num = parseFloat(cleaned)
      if (!isNaN(num) && num > 0) return Math.round(num * 100)
    } catch (_) {}
    return defaultCents
  }

  const monthlyAmountCents = parseAmountToCents(monthlyPriceLabel, 29700)
  const annualAmountCents = parseAmountToCents(annualPriceLabel, 297000)

  // 2. Se o Stripe estiver conectado no Conectores, criar ou obter os dois preços e payment links
  let stripeConnected = false
  let syncError = null
  try {
    // 2.1 Verificar / criar o produto "Avaliação de Experiência"
    let productId = null
    let prodListRes = null
    try {
      prodListRes = $connectors.executeAsOwner('STRIPE_LIST_PRODUCTS', {
        limit: 20,
        active: true,
      })
    } catch (callErr) {
      syncError = callErr && callErr.message ? callErr.message : String(callErr)
      console.warn(
        '[Stripe Connect] Erro ao chamar executeAsOwner(STRIPE_LIST_PRODUCTS):',
        syncError,
      )
    }

    if (prodListRes && prodListRes.successful) {
      stripeConnected = true
      const prods = Array.isArray(prodListRes.data && prodListRes.data.data)
        ? prodListRes.data.data
        : Array.isArray(prodListRes.data)
          ? prodListRes.data
          : []
      const found = prods.find(
        (p) => p && p.name && p.name.trim().toLowerCase() === PRODUCT_NAME.toLowerCase(),
      )
      if (found) {
        productId = found.id
        console.log('[Stripe Connect] Produto existente reutilizado:', productId)
      }
    } else if (prodListRes && !prodListRes.successful) {
      syncError = prodListRes.error || 'Falha ao listar produtos no Stripe'
      console.warn('[Stripe Connect] Falha ao listar produtos no Stripe:', syncError)
    }

    if (stripeConnected && !productId) {
      console.log('[Stripe Connect] Criando produto:', PRODUCT_NAME)
      const prodCreateRes = $connectors.executeAsOwner('STRIPE_CREATE_PRODUCT', {
        name: PRODUCT_NAME,
        description: PRODUCT_DESC,
        active: true,
      })
      if (prodCreateRes && prodCreateRes.successful && prodCreateRes.data) {
        productId = prodCreateRes.data.id
        console.log('[Stripe Connect] Produto criado com sucesso:', productId)
      } else {
        syncError = (prodCreateRes && prodCreateRes.error) || 'Falha ao criar produto no Stripe'
        console.warn('[Stripe Connect] Falha ao criar produto:', syncError)
      }
    }

    if (stripeConnected && productId) {
      // 2.2 Listar preços existentes do produto
      const priceListRes = $connectors.executeAsOwner('STRIPE_LIST_PRICES', {
        product: productId,
        type: 'recurring',
        currency: 'brl',
        active: true,
      })

      const existingPrices =
        (priceListRes &&
          priceListRes.successful &&
          (Array.isArray(priceListRes.data && priceListRes.data.data)
            ? priceListRes.data.data
            : Array.isArray(priceListRes.data)
              ? priceListRes.data
              : [])) ||
        []

      // Helper para buscar ou criar preço recorrente
      const findOrCreatePrice = (amountCents, interval) => {
        const found = existingPrices.find(
          (pr) =>
            pr &&
            pr.unit_amount === amountCents &&
            pr.recurring &&
            pr.recurring.interval === interval &&
            pr.active !== false,
        )
        if (found) return found.id

        const createRes = $connectors.executeAsOwner('STRIPE_CREATE_PRICE', {
          product: productId,
          currency: 'brl',
          unit_amount: amountCents,
          recurring: { interval: interval },
          active: true,
        })
        if (createRes && createRes.successful && createRes.data) {
          return createRes.data.id
        }
        return null
      }

      const generatedMonthlyPriceId = findOrCreatePrice(monthlyAmountCents, 'month')
      const generatedAnnualPriceId = findOrCreatePrice(annualAmountCents, 'year')

      if (generatedMonthlyPriceId) monthlyPriceId = generatedMonthlyPriceId
      if (generatedAnnualPriceId) annualPriceId = generatedAnnualPriceId

      // 2.3 Listar payment links existentes
      const plListRes = $connectors.executeAsOwner('STRIPE_LIST_PAYMENT_LINKS', {
        limit: 50,
        active: true,
      })
      const existingLinks =
        (plListRes &&
          plListRes.successful &&
          (Array.isArray(plListRes.data && plListRes.data.data)
            ? plListRes.data.data
            : Array.isArray(plListRes.data)
              ? plListRes.data
              : [])) ||
        []

      // Redirecionamento após checkout para a página de pós-compra /obrigado
      let afterCompletion = undefined
      try {
        let baseUrl = ''
        try {
          const appUrlSetting = $app.findFirstRecordByData('settings', 'key', 'app_url')
          if (appUrlSetting && appUrlSetting.getString('value')) {
            baseUrl = appUrlSetting.getString('value').trim().replace(/\/+$/, '')
          }
        } catch (_) {}

        if (!baseUrl) {
          baseUrl = 'https://app.avaliacaodeexperiencia.com.br'
        }

        if (baseUrl) {
          afterCompletion = {
            type: 'redirect',
            redirect: { url: baseUrl + '/obrigado' },
          }
        }
      } catch (_) {}

      const findOrCreatePaymentLink = (priceId) => {
        if (!priceId) return null
        // Procurar por link ativo correspondente ao preço
        let matchedActiveLink = null
        let matchedInactiveLink = null

        for (const l of existingLinks) {
          if (!l || !l.id) continue
          const items = l.line_items && Array.isArray(l.line_items.data) ? l.line_items.data : []
          const matchesPrice = items.some(
            (it) => it && (it.price === priceId || (it.price && it.price.id === priceId)),
          )
          if (matchesPrice) {
            if (l.active !== false && l.url) {
              matchedActiveLink = l
              break
            } else if (!matchedInactiveLink) {
              matchedInactiveLink = l
            }
          }
        }

        if (matchedActiveLink && matchedActiveLink.url) {
          return matchedActiveLink.url
        }

        // Se encontrou link correspondente inativo, tentar reativar
        if (matchedInactiveLink && matchedInactiveLink.id) {
          try {
            const reactivateRes = $connectors.executeAsOwner('STRIPE_UPDATE_PAYMENT_LINK', {
              payment_link: matchedInactiveLink.id,
              active: true,
              after_completion: afterCompletion,
            })
            if (
              reactivateRes &&
              reactivateRes.successful &&
              reactivateRes.data &&
              reactivateRes.data.url
            ) {
              return reactivateRes.data.url
            }
          } catch (_) {}
        }

        const createPayload = {
          line_items: [{ price: priceId, quantity: 1 }],
        }
        if (afterCompletion) {
          createPayload.after_completion = afterCompletion
        }

        const plCreateRes = $connectors.executeAsOwner('STRIPE_CREATE_PAYMENT_LINK', createPayload)
        if (plCreateRes && plCreateRes.successful && plCreateRes.data) {
          return plCreateRes.data.url
        }
        return null
      }

      const generatedMonthlyLink = findOrCreatePaymentLink(monthlyPriceId)
      const generatedAnnualLink = findOrCreatePaymentLink(annualPriceId)

      if (generatedMonthlyLink) monthlyPaymentLink = generatedMonthlyLink
      if (generatedAnnualLink) annualPaymentLink = generatedAnnualLink

      // Salvar links gerados nas configurações para persistência rápida
      const saveSetting = (k, v) => {
        try {
          const settingsCol = $app.findCollectionByNameOrId('settings')
          let rec
          try {
            rec = $app.findFirstRecordByData('settings', 'key', k)
          } catch (_) {
            rec = new Record(settingsCol)
            rec.set('key', k)
          }
          rec.set('value', v)
          $app.save(rec)
        } catch (_) {}
      }

      if (generatedMonthlyLink) {
        saveSetting('stripe_monthly_payment_link', generatedMonthlyLink)
        saveSetting('stripe_payment_link', generatedMonthlyLink)
      }
      if (generatedAnnualLink) {
        saveSetting('stripe_annual_payment_link', generatedAnnualLink)
      }
      if (generatedMonthlyPriceId) {
        saveSetting('stripe_monthly_price_id', generatedMonthlyPriceId)
        saveSetting('stripe_price_id', generatedMonthlyPriceId)
      }
      if (generatedAnnualPriceId) {
        saveSetting('stripe_annual_price_id', generatedAnnualPriceId)
      }
    }
  } catch (stripeErr) {
    syncError = stripeErr && stripeErr.message ? stripeErr.message : String(stripeErr)
    console.warn('[Stripe Connect] Aviso na integração com Stripe Connect:', stripeErr)
  }

  // Identificar se os links atuais são oficiais da Stripe gerados na conta (não placeholder de teste)
  const isRealOfficialStripeUrl = (u) => {
    if (!u || typeof u !== 'string') return false
    // Um link oficial da Stripe ativo possui formato https://buy.stripe.com/... e não contém 'test_avaliacao'
    return u.startsWith('https://buy.stripe.com/') && !u.includes('test_avaliacao_experiencia')
  }

  const monthlyIsOfficial = isRealOfficialStripeUrl(monthlyPaymentLink)
  const annualIsOfficial = isRealOfficialStripeUrl(annualPaymentLink)

  return e.json(200, {
    stripe_connected: stripeConnected,
    sync_error: syncError,
    is_official_link: stripeConnected || (monthlyIsOfficial && annualIsOfficial),
    // Compatibilidade com código legado
    payment_link: monthlyPaymentLink,
    price_id: monthlyPriceId,
    price_label: monthlyPriceLabel,
    // Planos estruturados
    monthly: {
      name: 'Plano Mensal',
      price_id: monthlyPriceId,
      payment_link: monthlyPaymentLink,
      price_label: monthlyPriceLabel,
      amount_cents: monthlyAmountCents,
      active: monthlyActive,
      interval: 'month',
      is_official: monthlyIsOfficial,
    },
    annual: {
      name: 'Plano Anual',
      price_id: annualPriceId,
      payment_link: annualPaymentLink,
      price_label: annualPriceLabel,
      amount_cents: annualAmountCents,
      active: annualActive,
      interval: 'year',
      badge: '2 meses grátis',
      is_official: annualIsOfficial,
    },
    source: stripeConnected ? 'stripe_owner_api' : 'settings_fallback',
  })
})

// Rota administrativa para forçar sincronização / regeneração dos preços e payment links no Stripe
routerAdd(
  'POST',
  '/backend/v1/billing/sync-stripe',
  (e) => {
    // Exclusivamente o usuário master valdknupp@gmail.com com perfil ADMIN pode sincronizar preços
    const authRecord = e.auth
    const email = authRecord ? authRecord.getString('email').trim().toLowerCase() : ''
    const profile = authRecord ? authRecord.getString('profile') : ''
    if (!authRecord || profile !== 'ADMIN' || email !== 'valdknupp@gmail.com') {
      return e.json(403, {
        error:
          'Acesso negado: apenas o usuário master tem permissão para sincronizar preços com a Stripe.',
      })
    }

    // Tentar listar produtos no Stripe para testar conexão
    try {
      const testRes = $connectors.executeAsOwner('STRIPE_LIST_PRODUCTS', { limit: 1 })
      if (!testRes || !testRes.successful) {
        const errMsg = testRes && testRes.error ? testRes.error : 'Conta Stripe não vinculada.'
        console.warn('[Stripe Sync] Falha de conexão com Stripe Connect:', errMsg)
        return e.json(400, {
          error:
            'A conta Stripe ainda não está vinculada no painel Conectores do Skip Cloud: ' + errMsg,
          stripe_connected: false,
        })
      }
    } catch (err) {
      const errMsg = err && err.message ? err.message : String(err)
      console.warn('[Stripe Sync] Erro capturado ao chamar executeAsOwner:', errMsg)
      return e.json(400, {
        error: 'Stripe não conectado ou indisponível: ' + errMsg,
        stripe_connected: false,
      })
    }

    // Se conectado, disparar a lógica do checkout-link apagando os links de cache para forçar regeneração
    try {
      const clearSetting = (k) => {
        try {
          const r = $app.findFirstRecordByData('settings', 'key', k)
          r.set('value', '')
          $app.save(r)
        } catch (_) {}
      }
      clearSetting('stripe_monthly_payment_link')
      clearSetting('stripe_annual_payment_link')
      clearSetting('stripe_payment_link')
    } catch (_) {}

    return e.json(200, {
      message: 'Sincronização com Stripe concluída com sucesso.',
      stripe_connected: true,
    })
  },
  $apis.requireAuth(),
)

// Rota para acompanhamento de vendas (consulta Stripe assinaturas/cobranças ou fallback local na coleção sales)
routerAdd(
  'GET',
  '/backend/v1/billing/sales',
  (e) => {
    const authRecord = e.auth
    if (!authRecord) {
      return e.json(401, { error: 'Autenticação necessária.' })
    }
    const email = authRecord.getString('email').trim().toLowerCase()
    const profile = authRecord.getString('profile')
    // Exclusivamente o usuário master valdknupp@gmail.com pode visualizar o acompanhamento de vendas
    if (profile !== 'ADMIN' || email !== 'valdknupp@gmail.com') {
      return e.json(403, {
        error: 'Acesso negado: acompanhamento de vendas restrito ao usuário master.',
      })
    }

    let stripeConnected = false
    let stripeSales = []

    // 1. Tentar consultar no Stripe via executeAsOwner se conectado
    try {
      const subsRes = $connectors.executeAsOwner('STRIPE_LIST_SUBSCRIPTIONS', {
        limit: 50,
      })

      if (subsRes && subsRes.successful && subsRes.data) {
        stripeConnected = true
        const rawSubs = Array.isArray(subsRes.data.data)
          ? subsRes.data.data
          : Array.isArray(subsRes.data)
            ? subsRes.data
            : []

        stripeSales = rawSubs.map((sub) => {
          const item = sub.items && sub.items.data && sub.items.data[0]
          const planInterval =
            item && item.price && item.price.recurring && item.price.recurring.interval
          const unitAmount = item && item.price ? item.price.unit_amount : 0
          const isAnnual = planInterval === 'year' || unitAmount > 100000

          const planName = isAnnual ? 'ANUAL' : 'MENSAL'
          const amountFormatted = unitAmount
            ? 'R$ ' + (unitAmount / 100).toLocaleString('pt-BR', { minimumFractionDigits: 2 })
            : isAnnual
              ? 'R$ 2.970,00'
              : 'R$ 297,00'

          const createdIso = sub.created
            ? new Date(sub.created * 1000).toISOString()
            : new Date().toISOString()

          return {
            id: sub.id,
            source: 'stripe',
            plan: planName,
            amount: unitAmount ? unitAmount / 100 : isAnnual ? 2970 : 297,
            amount_label: amountFormatted,
            status: sub.status || 'active',
            customer_name:
              (sub.customer && sub.customer.name) ||
              (sub.metadata && sub.metadata.customer_name) ||
              'Cliente Stripe',
            customer_email:
              (sub.customer && sub.customer.email) ||
              (sub.metadata && sub.metadata.customer_email) ||
              '-',
            payment_method: 'Cartão de Crédito',
            stripe_subscription_id: sub.id,
            stripe_customer_id:
              typeof sub.customer === 'string'
                ? sub.customer
                : (sub.customer && sub.customer.id) || '',
            created: createdIso,
          }
        })
      }
    } catch (err) {
      // Stripe ainda não conectado, continua para registros locais
    }

    // 2. Consultar registros locais da coleção 'sales'
    let localSales = []
    try {
      const records = $app.findRecordsByFilter('sales', '', '-created', 100, 0)
      localSales = records.map((r) => ({
        id: r.id,
        source: 'local',
        plan: r.getString('plan') || 'MENSAL',
        amount: r.getFloat('amount') || 0,
        amount_label: r.getString('amount_label') || '',
        status: r.getString('status') || 'pending',
        customer_name: r.getString('customer_name') || 'Cliente',
        customer_email: r.getString('customer_email') || '-',
        payment_method: r.getString('payment_method') || 'Stripe Checkout',
        stripe_subscription_id: r.getString('stripe_subscription_id') || '',
        stripe_customer_id: r.getString('stripe_customer_id') || '',
        created: r.getString('created') || '',
      }))
    } catch (_) {}

    // Combinar (Stripe primeiro se houver, ou local)
    const combined = stripeSales.length > 0 ? stripeSales : localSales

    return e.json(200, {
      stripe_connected: stripeConnected,
      total: combined.length,
      sales: combined,
    })
  },
  $apis.requireAuth(),
)
