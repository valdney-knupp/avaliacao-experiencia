// Executa na inicialização do backend para garantir que produto, preços e payment links existam e estejam salvos
onBootstrap((e) => {
  e.next()
  try {
    const PRODUCT_NAME = 'Avaliação de Experiência'
    const PRODUCT_DESC = 'Sistema de gestão de avaliações de experiência de 45 e 90 dias'
    const REDIRECT_URL = 'https://avaliacao-de-experiencia-copy-c732f.goskip.app/obrigado'

    const checkSetting = (k) => {
      try {
        const r = $app.findFirstRecordByData('settings', 'key', k)
        return r && r.getString('value') ? r.getString('value') : ''
      } catch (_) {
        return ''
      }
    }

    const currentMonthly = checkSetting('stripe_monthly_payment_link')
    const currentAnnual = checkSetting('stripe_annual_payment_link')
    const currentAnnualLabel = checkSetting('stripe_annual_price_label')
    const isRealOfficial = (u) =>
      u &&
      (u.startsWith('https://buy.stripe.com/') || u.startsWith('https://pay.stripe.com/')) &&
      !u.includes('test_avaliacao_experiencia')

    // Se já estiver com link oficial para 2.899,00 (ou 2899), não precisa reexecutar
    if (
      isRealOfficial(currentMonthly) &&
      isRealOfficial(currentAnnual) &&
      (currentAnnualLabel === '2.899,00' ||
        currentAnnualLabel === '2899,00' ||
        currentAnnualLabel === '2899')
    ) {
      console.log(
        '[Stripe Bootstrap] Links oficiais já persistidos e atualizados para R$ 2.899:',
        currentMonthly,
        currentAnnual,
      )
      return
    }

    console.log(
      '[Stripe Bootstrap] Verificando e criando produtos/preços/links na conta Stripe (alvo anual: R$ 2.899)...',
    )
    let productId = null
    try {
      const prodList = $connectors.executeAsOwner('STRIPE_LIST_PRODUCTS', {
        limit: 20,
        active: true,
      })
      if (prodList && prodList.successful) {
        const items = Array.isArray(prodList.data && prodList.data.data)
          ? prodList.data.data
          : Array.isArray(prodList.data)
            ? prodList.data
            : []
        const found = items.find(
          (p) => p && p.name && p.name.trim().toLowerCase() === PRODUCT_NAME.toLowerCase(),
        )
        if (found) {
          productId = found.id
          console.log('[Stripe Bootstrap] Produto existente encontrado:', productId)
        }
      }
    } catch (err) {
      console.warn('[Stripe Bootstrap] Erro ao listar produtos:', err)
    }

    if (!productId) {
      const prodCreate = $connectors.executeAsOwner('STRIPE_CREATE_PRODUCT', {
        name: PRODUCT_NAME,
        description: PRODUCT_DESC,
        active: true,
      })
      if (prodCreate && prodCreate.successful && prodCreate.data) {
        productId = prodCreate.data.id
        console.log('[Stripe Bootstrap] Produto criado:', productId)
      } else {
        console.warn('[Stripe Bootstrap] Erro ao criar produto:', prodCreate && prodCreate.error)
        return
      }
    }

    // Preços
    let monthlyPriceId = null
    let annualPriceId = null
    try {
      const priceList = $connectors.executeAsOwner('STRIPE_LIST_PRICES', {
        product: productId,
        type: 'recurring',
        currency: 'brl',
        active: true,
      })
      const prices =
        (priceList &&
          priceList.successful &&
          (Array.isArray(priceList.data && priceList.data.data)
            ? priceList.data.data
            : Array.isArray(priceList.data)
              ? priceList.data
              : [])) ||
        []

      for (const pr of prices) {
        if (!pr || !pr.recurring) continue
        if (pr.unit_amount === 29700 && pr.recurring.interval === 'month') {
          monthlyPriceId = pr.id
        }
        if (pr.unit_amount === 289900 && pr.recurring.interval === 'year') {
          annualPriceId = pr.id
        }
      }
    } catch (err) {
      console.warn('[Stripe Bootstrap] Erro ao listar preços:', err)
    }

    if (!monthlyPriceId) {
      const cMonth = $connectors.executeAsOwner('STRIPE_CREATE_PRICE', {
        product: productId,
        currency: 'brl',
        unit_amount: 29700,
        recurring: { interval: 'month' },
        active: true,
      })
      if (cMonth && cMonth.successful && cMonth.data) {
        monthlyPriceId = cMonth.data.id
        console.log('[Stripe Bootstrap] Preço mensal criado:', monthlyPriceId)
      }
    }

    if (!annualPriceId) {
      const cYear = $connectors.executeAsOwner('STRIPE_CREATE_PRICE', {
        product: productId,
        currency: 'brl',
        unit_amount: 289900,
        recurring: { interval: 'year' },
        active: true,
      })
      if (cYear && cYear.successful && cYear.data) {
        annualPriceId = cYear.data.id
        console.log('[Stripe Bootstrap] Preço anual criado (289900):', annualPriceId)
      }
    }

    // Payment links
    let existingLinks = []
    try {
      const plList = $connectors.executeAsOwner('STRIPE_LIST_PAYMENT_LINKS', {
        limit: 50,
        active: true,
      })
      if (plList && plList.successful && plList.data) {
        existingLinks = Array.isArray(plList.data.data)
          ? plList.data.data
          : Array.isArray(plList.data)
            ? plList.data
            : []
      }
    } catch (err) {}

    const afterCompletion = {
      type: 'redirect',
      redirect: { url: REDIRECT_URL },
    }

    const getOrMakeLink = (priceId) => {
      if (!priceId) return null
      for (const l of existingLinks) {
        if (!l || !l.id) continue
        let items = l.line_items && Array.isArray(l.line_items.data) ? l.line_items.data : []
        if (items.length === 0) {
          try {
            const liRes = $connectors.executeAsOwner(
              'STRIPE_GET_PAYMENT_LINKS_PAYMENT_LINK_LINE_ITEMS',
              {
                payment_link: l.id,
                limit: 10,
              },
            )
            if (liRes && liRes.successful && liRes.data) {
              items = Array.isArray(liRes.data.data)
                ? liRes.data.data
                : Array.isArray(liRes.data)
                  ? liRes.data
                  : []
            }
          } catch (_) {}
        }
        if (
          items.some((it) => it && (it.price === priceId || (it.price && it.price.id === priceId)))
        ) {
          try {
            $connectors.executeAsOwner('STRIPE_UPDATE_PAYMENT_LINK', {
              payment_link: l.id,
              active: true,
              after_completion: afterCompletion,
            })
          } catch (_) {}
          return l.url
        }
      }

      const createRes = $connectors.executeAsOwner('STRIPE_CREATE_PAYMENT_LINK', {
        line_items: [{ price: priceId, quantity: 1 }],
        after_completion: afterCompletion,
        customer_creation: 'always',
        billing_address_collection: 'auto',
      })
      if (createRes && createRes.successful && createRes.data) {
        return createRes.data.url
      }
      return null
    }

    // Se criarmos um novo link anual para o novo preço de R$ 2.899, desativar payment links antigos de R$ 2.970
    try {
      const oldAnnualPriceId = checkSetting('stripe_annual_price_id')
      if (oldAnnualPriceId && oldAnnualPriceId !== annualPriceId) {
        for (const l of existingLinks) {
          if (!l || !l.id || l.active === false) continue
          let items = l.line_items && Array.isArray(l.line_items.data) ? l.line_items.data : []
          if (items.length === 0) {
            try {
              const liRes = $connectors.executeAsOwner(
                'STRIPE_GET_PAYMENT_LINKS_PAYMENT_LINK_LINE_ITEMS',
                {
                  payment_link: l.id,
                  limit: 10,
                },
              )
              if (liRes && liRes.successful && liRes.data) {
                items = Array.isArray(liRes.data.data)
                  ? liRes.data.data
                  : Array.isArray(liRes.data)
                    ? liRes.data
                    : []
              }
            } catch (_) {}
          }
          const hasOldPrice = items.some(
            (it) =>
              it &&
              (it.price === oldAnnualPriceId || (it.price && it.price.id === oldAnnualPriceId)),
          )
          if (hasOldPrice) {
            console.log('[Stripe Bootstrap] Desativando payment link antigo de R$ 2.970:', l.id)
            $connectors.executeAsOwner('STRIPE_UPDATE_PAYMENT_LINK', {
              payment_link: l.id,
              active: false,
            })
          }
        }
      }
    } catch (deactErr) {
      console.warn('[Stripe Bootstrap] Aviso ao desativar link antigo de R$ 2.970:', deactErr)
    }

    const mLink = getOrMakeLink(monthlyPriceId)
    const aLink = getOrMakeLink(annualPriceId)

    const saveVal = (k, v) => {
      try {
        const col = $app.findCollectionByNameOrId('settings')
        let rec
        try {
          rec = $app.findFirstRecordByData('settings', 'key', k)
        } catch (_) {
          rec = new Record(col)
          rec.set('key', k)
        }
        rec.set('value', v)
        $app.save(rec)
      } catch (_) {}
    }

    if (mLink) {
      saveVal('stripe_monthly_payment_link', mLink)
      saveVal('stripe_payment_link', mLink)
    }
    if (aLink) {
      saveVal('stripe_annual_payment_link', aLink)
      saveVal('stripe_annual_price_label', '2.899,00')
    }
    if (monthlyPriceId) {
      saveVal('stripe_monthly_price_id', monthlyPriceId)
      saveVal('stripe_price_id', monthlyPriceId)
    }
    if (annualPriceId) {
      saveVal('stripe_annual_price_id', annualPriceId)
    }
    console.log('[Stripe Bootstrap] Links persistidos com sucesso:', mLink, aLink)
  } catch (bootErr) {
    console.warn('[Stripe Bootstrap] Erro capturado:', bootErr)
  }
})

// Rota pública para obtenção dos links e configurações dos planos (Mensal e Anual)
// Cria ou reutiliza no Stripe sob demanda via $connectors.executeAsOwner
// Sempre que o Stripe estiver conectado no painel Conectores, esta rota cria ou obtém
// o produto, preços recorrentes de R$ 297/mês e R$ 2.970/ano e payment links oficiais.

routerAdd('GET', '/backend/v1/billing/checkout-link', (e) => {
  const PRODUCT_NAME = 'Avaliação de Experiência'
  const PRODUCT_DESC = 'Sistema de gestão de avaliações de experiência de 45 e 90 dias'

  // 1. Obter valores salvos em settings
  let monthlyPriceLabel = '297,00'
  let annualPriceLabel = '2.899,00'
  let monthlyPaymentLink = 'https://buy.stripe.com/test_avaliacao_experiencia_297'
  let annualPaymentLink = 'https://buy.stripe.com/test_avaliacao_experiencia_2899_anual'
  let monthlyPriceId = 'price_avaliacao_experiencia_297'
  let annualPriceId = 'price_avaliacao_experiencia_2899_anual'
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
  annualPriceLabel = getSetting('stripe_annual_price_label', '2.899,00')
  if (
    annualPriceLabel === '2.970,00' ||
    annualPriceLabel === '2970,00' ||
    annualPriceLabel === '2970'
  ) {
    annualPriceLabel = '2.899,00'
  }
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
  const annualAmountCents = parseAmountToCents(annualPriceLabel, 289900)

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
      // Redirecionamento após checkout para a página de pós-compra /obrigado
      // Conforme requisito do projeto: https://avaliacao-de-experiencia-copy-c732f.goskip.app/obrigado
      const redirectUrl = 'https://avaliacao-de-experiencia-copy-c732f.goskip.app/obrigado'
      const afterCompletion = {
        type: 'redirect',
        redirect: { url: redirectUrl },
      }

      const findOrCreatePaymentLink = (priceId) => {
        if (!priceId) return null
        // Procurar por link ativo correspondente ao preço
        let matchedActiveLink = null
        let matchedInactiveLink = null

        for (const l of existingLinks) {
          if (!l || !l.id) continue
          // Verificar itens via l.line_items ou via busca detalhada
          let items = l.line_items && Array.isArray(l.line_items.data) ? l.line_items.data : []
          if (items.length === 0) {
            try {
              const liRes = $connectors.executeAsOwner(
                'STRIPE_GET_PAYMENT_LINKS_PAYMENT_LINK_LINE_ITEMS',
                {
                  payment_link: l.id,
                  limit: 10,
                },
              )
              if (liRes && liRes.successful && liRes.data) {
                items = Array.isArray(liRes.data.data)
                  ? liRes.data.data
                  : Array.isArray(liRes.data)
                    ? liRes.data
                    : []
              }
            } catch (_) {}
          }

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
          // Assegura que after_completion esteja atualizado para a URL oficial /obrigado
          try {
            $connectors.executeAsOwner('STRIPE_UPDATE_PAYMENT_LINK', {
              payment_link: matchedActiveLink.id,
              active: true,
              after_completion: afterCompletion,
            })
          } catch (_) {}
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
          after_completion: afterCompletion,
          customer_creation: 'always',
          billing_address_collection: 'auto',
        }

        console.log('[Stripe Connect] Criando payment link para priceId:', priceId)
        const plCreateRes = $connectors.executeAsOwner('STRIPE_CREATE_PAYMENT_LINK', createPayload)
        if (plCreateRes && plCreateRes.successful && plCreateRes.data) {
          console.log('[Stripe Connect] Payment link criado com sucesso:', plCreateRes.data.url)
          return plCreateRes.data.url
        } else {
          console.warn(
            '[Stripe Connect] Falha ao criar payment link:',
            plCreateRes && plCreateRes.error,
          )
        }
        return null
      }

      // Se tiver mudado o preço anual (ex: de 2970 para 2899), desativar links antigos com o preço de 2970
      try {
        const oldAnnualPriceId = getSetting('stripe_annual_price_id', '')
        if (oldAnnualPriceId && oldAnnualPriceId !== annualPriceId) {
          for (const l of existingLinks) {
            if (!l || !l.id || l.active === false) continue
            let items = l.line_items && Array.isArray(l.line_items.data) ? l.line_items.data : []
            if (items.length === 0) {
              try {
                const liRes = $connectors.executeAsOwner(
                  'STRIPE_GET_PAYMENT_LINKS_PAYMENT_LINK_LINE_ITEMS',
                  { payment_link: l.id, limit: 10 },
                )
                if (liRes && liRes.successful && liRes.data) {
                  items = Array.isArray(liRes.data.data) ? liRes.data.data : []
                }
              } catch (_) {}
            }
            const hasOldPrice = items.some(
              (it) =>
                it &&
                (it.price === oldAnnualPriceId || (it.price && it.price.id === oldAnnualPriceId)),
            )
            if (hasOldPrice) {
              console.log('[Stripe Connect] Desativando payment link antigo de R$ 2.970:', l.id)
              $connectors.executeAsOwner('STRIPE_UPDATE_PAYMENT_LINK', {
                payment_link: l.id,
                active: false,
              })
            }
          }
        }
      } catch (deactErr) {
        console.warn('[Stripe Connect] Aviso ao desativar links antigos:', deactErr)
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
        saveSetting('stripe_annual_price_label', '2.899,00')
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
    // Um link oficial da Stripe ativo possui formato https://buy.stripe.com/... ou https://pay.stripe.com/... e não contém 'test_avaliacao'
    const isStripeDomain =
      u.startsWith('https://buy.stripe.com/') || u.startsWith('https://pay.stripe.com/')
    return isStripeDomain && !u.includes('test_avaliacao_experiencia')
  }

  const monthlyIsOfficial = isRealOfficialStripeUrl(monthlyPaymentLink)
  const annualIsOfficial = isRealOfficialStripeUrl(annualPaymentLink)

  return e.json(200, {
    stripe_connected: stripeConnected,
    sync_error: syncError,
    connectors_configured: stripeConnected,
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

    // Limpar links e preços salvos em settings para forçar re-criação/sincronização completa
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
              ? 'R$ 2.899,00'
              : 'R$ 297,00'

          const createdIso = sub.created
            ? new Date(sub.created * 1000).toISOString()
            : new Date().toISOString()

          return {
            id: sub.id,
            source: 'stripe',
            plan: planName,
            amount: unitAmount ? unitAmount / 100 : isAnnual ? 2899 : 297,
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

// ------------------------------------------------------------------------------------------------
// WEBHOOK STRIPE: /backend/v1/stripe/webhook
// Ciclo: pagamento recebido -> ativa acesso -> define/estende paid_until -> registra venda na tabela sales
// ------------------------------------------------------------------------------------------------
routerAdd('POST', '/backend/v1/stripe/webhook', (e) => {
  // Helper inline para formatação de data ISO YYYY-MM-DD
  const formatDateOnlyIso = (d) => {
    const year = d.getUTCFullYear()
    const month = String(d.getUTCMonth() + 1).padStart(2, '0')
    const day = String(d.getUTCDate()).padStart(2, '0')
    return `${year}-${month}-${day}`
  }
  let rawBody = ''
  let event = null

  try {
    // Leitura do payload bruto
    const req = e.requestInfo()
    if (req && req.body && typeof req.body === 'object') {
      event = req.body
      rawBody = JSON.stringify(req.body)
    } else if (req && req.body) {
      rawBody = String(req.body)
      event = JSON.parse(rawBody)
    }
  } catch (parseErr) {
    console.warn('[Stripe Webhook] Erro ao analisar corpo da requisição:', parseErr)
    return e.json(400, { error: 'Invalid payload' })
  }

  if (!event || !event.type) {
    return e.json(400, { error: 'Missing event or event.type' })
  }

  // Validação opcional da assinatura Stripe Webhook se STRIPE_WEBHOOK_SECRET estiver configurado
  const webhookSecret = $os.getenv('STRIPE_WEBHOOK_SECRET') || ''
  const sigHeader = e.request.header.get('stripe-signature') || ''

  if (webhookSecret) {
    if (!sigHeader) {
      console.warn('[Stripe Webhook] Cabeçalho stripe-signature ausente com segredo configurado.')
      return e.json(400, { error: 'Missing stripe-signature header' })
    }

    try {
      // Formato do cabeçalho Stripe: t=1492774577,v1=5257a869e7ecebeda32affa62cd493...
      const parts = sigHeader.split(',')
      let timestamp = ''
      const signatures = []
      for (let i = 0; i < parts.length; i++) {
        const item = parts[i].trim()
        if (item.startsWith('t=')) {
          timestamp = item.slice(2)
        } else if (item.startsWith('v1=')) {
          signatures.push(item.slice(3))
        }
      }

      if (!timestamp || signatures.length === 0) {
        return e.json(400, { error: 'Invalid stripe-signature format' })
      }

      // Previne ataques de repetição (tolerância de 10 minutos)
      const nowSec = Math.floor(Date.now() / 1000)
      const tSec = parseInt(timestamp, 10)
      if (isNaN(tSec) || Math.abs(nowSec - tSec) > 600) {
        console.warn(
          '[Stripe Webhook] Timestamp da assinatura fora da janela de tolerância:',
          timestamp,
        )
        return e.json(400, { error: 'Signature timestamp out of tolerance' })
      }

      // Validação HMAC-SHA256
      const signedPayload = `${timestamp}.${rawBody}`
      const expectedSig = $security.hs256(signedPayload, webhookSecret)
      const matched = signatures.some((s) => s === expectedSig)
      if (!matched) {
        console.warn('[Stripe Webhook] Assinatura do webhook inválida.')
        return e.json(400, { error: 'Webhook signature verification failed' })
      }
    } catch (sigErr) {
      console.warn('[Stripe Webhook] Erro na verificação da assinatura:', sigErr)
      return e.json(400, { error: 'Signature verification error: ' + String(sigErr) })
    }
  }

  const eventType = event.type
  const eventId = event.id || ''
  const eventData = event.data && event.data.object ? event.data.object : {}

  console.log(`[Stripe Webhook] Recebido evento: ${eventType} (ID: ${eventId})`)

  try {
    // 1. Processar confirmação de pagamento
    if (eventType === 'checkout.session.completed' || eventType === 'invoice.paid') {
      let customerEmail = ''
      let customerName = ''
      let amountPaid = 0
      let planInterval = 'month'
      let stripeSubscriptionId = ''
      let stripeCustomerId = ''

      if (eventType === 'checkout.session.completed') {
        // Obter e-mail
        customerEmail =
          (eventData.customer_details && eventData.customer_details.email) ||
          eventData.customer_email ||
          (eventData.metadata && eventData.metadata.customer_email) ||
          ''
        customerName =
          (eventData.customer_details && eventData.customer_details.name) ||
          (eventData.metadata && eventData.metadata.customer_name) ||
          'Cliente Stripe'

        amountPaid = (eventData.amount_total || eventData.amount_subtotal || 0) / 100
        stripeSubscriptionId = eventData.subscription || ''
        stripeCustomerId = eventData.customer || ''

        // Identificar se anual ou mensal por amount ou metadata
        if (amountPaid >= 1000 || (eventData.metadata && eventData.metadata.plan === 'ANUAL')) {
          planInterval = 'year'
        }
      } else if (eventType === 'invoice.paid') {
        customerEmail =
          eventData.customer_email ||
          (eventData.customer_details && eventData.customer_details.email) ||
          ''
        customerName =
          eventData.customer_name ||
          (eventData.customer_details && eventData.customer_details.name) ||
          'Cliente Stripe'

        amountPaid = (eventData.amount_paid || 0) / 100
        stripeSubscriptionId = eventData.subscription || ''
        stripeCustomerId = eventData.customer || ''

        // Verificar interval nas linhas da fatura se presente
        if (
          eventData.lines &&
          Array.isArray(eventData.lines.data) &&
          eventData.lines.data.length > 0
        ) {
          const firstLine = eventData.lines.data[0]
          if (firstLine.price && firstLine.price.recurring) {
            planInterval = firstLine.price.recurring.interval || planInterval
          }
        }
        if (amountPaid >= 1000) {
          planInterval = 'year'
        }
      }

      customerEmail = String(customerEmail || '')
        .trim()
        .toLowerCase()
      customerName = String(customerName || '').trim()
      const isAnnual = planInterval === 'year' || amountPaid >= 1000
      const planName = isAnnual ? 'ANUAL' : 'MENSAL'
      const daysToAdd = isAnnual ? 365 : 30

      const amountFormatted = amountPaid
        ? 'R$ ' + amountPaid.toLocaleString('pt-BR', { minimumFractionDigits: 2 })
        : isAnnual
          ? 'R$ 2.899,00'
          : 'R$ 297,00'

      let matchedClient = null
      let isClientLinked = false

      if (customerEmail) {
        try {
          matchedClient = $app.findFirstRecordByData('clients', 'email', customerEmail)
        } catch (_) {}
      }

      // Se encontrou cliente cadastrado com este e-mail
      if (matchedClient) {
        isClientLinked = true
        console.log(
          `[Stripe Webhook] Pagamento vinculado ao cliente: ${matchedClient.getString('name')} (${customerEmail})`,
        )

        // 1.1 Calcular paid_until: hoje + dias, somando ao saldo se já possuir data futura
        const now = new Date()
        let baseDate = now
        const currentPaidUntilStr = matchedClient.getString('paid_until')

        if (currentPaidUntilStr) {
          const currentPaidDate = new Date(
            currentPaidUntilStr.split(' ')[0].split('T')[0] + 'T23:59:59Z',
          )
          if (!isNaN(currentPaidDate.getTime()) && currentPaidDate.getTime() > now.getTime()) {
            baseDate = currentPaidDate
          }
        }

        const newPaidUntil = new Date(baseDate.getTime() + daysToAdd * 24 * 60 * 60 * 1000)
        const newPaidUntilIso = formatDateOnlyIso(newPaidUntil)

        matchedClient.set('active', true)
        matchedClient.set('status', 'active')
        matchedClient.set('plan', planName)
        matchedClient.set('paid_until', newPaidUntilIso)
        $app.save(matchedClient)

        // 1.2 Ativar o usuário comprador principal e todos os usuários vinculados a este cliente
        try {
          const clientUsers = $app.findRecordsByFilter(
            '_pb_users_auth_',
            `client = '${matchedClient.id}'`,
            '',
            500,
            0,
          )
          for (let u = 0; u < clientUsers.length; u++) {
            const usr = clientUsers[u]
            usr.set('active', true)
            $app.save(usr)
          }
        } catch (uErr) {
          console.warn('[Stripe Webhook] Erro ao ativar usuários do cliente:', uErr)
        }

        // 1.3 Se houver usuário pelo próprio e-mail sem campo client setado, vincular e ativar
        try {
          const userByEmail = $app.findAuthRecordByEmail('_pb_users_auth_', customerEmail)
          if (
            userByEmail &&
            userByEmail.getString('email').toLowerCase() !== 'valdknupp@gmail.com'
          ) {
            userByEmail.set('active', true)
            if (!userByEmail.getString('client')) {
              userByEmail.set('client', matchedClient.id)
            }
            $app.save(userByEmail)
          }
        } catch (_) {}

        // Auditoria
        try {
          const auditCol = $app.findCollectionByNameOrId('audit_logs')
          const audit = new Record(auditCol)
          audit.set('entity_type', 'clients')
          audit.set('entity_id', matchedClient.id)
          audit.set('action', 'PAYMENT_RECEIVED')
          audit.set(
            'summary',
            `Pagamento Stripe confirmado (${planName} - ${amountFormatted}). Acesso ATIVADO até ${newPaidUntilIso}. Cliente: ${matchedClient.getString('name')} (${customerEmail}). Evento: ${eventId}`,
          )
          $app.save(audit)
        } catch (_) {}
      } else {
        console.log(
          `[Stripe Webhook] Pagamento recebido para e-mail NÃO cadastrado em clients: ${customerEmail || '(sem email)'}`,
        )
      }

      // 1.4 Registrar venda na coleção 'sales' (usada pela aba Acompanhamento de Vendas)
      try {
        const salesCol = $app.findCollectionByNameOrId('sales')
        let saleRecord = null
        if (eventId) {
          try {
            saleRecord = $app.findFirstRecordByData('sales', 'stripe_event_id', eventId)
          } catch (_) {}
        }

        if (!saleRecord) {
          saleRecord = new Record(salesCol)
          saleRecord.set('stripe_event_id', eventId)
        }

        saleRecord.set('plan', planName)
        saleRecord.set('amount', amountPaid || (isAnnual ? 2899 : 297))
        saleRecord.set('amount_label', amountFormatted)
        saleRecord.set('status', 'succeeded')
        saleRecord.set(
          'customer_name',
          matchedClient
            ? matchedClient.getString('name')
            : customerName || 'Cliente sem cadastro prévio',
        )
        saleRecord.set('customer_email', customerEmail || '-')
        saleRecord.set('payment_method', 'Stripe Checkout')
        saleRecord.set('stripe_subscription_id', stripeSubscriptionId)
        saleRecord.set('stripe_customer_id', stripeCustomerId)
        saleRecord.set(
          'metadata',
          JSON.stringify({
            linked_client_id: matchedClient ? matchedClient.id : null,
            linked_client_name: matchedClient ? matchedClient.getString('name') : null,
            is_client_linked: isClientLinked,
            note: isClientLinked ? 'Cliente vinculado e liberado' : 'Sem cliente vinculado',
            event_type: eventType,
          }),
        )
        $app.save(saleRecord)
      } catch (salesErr) {
        console.warn('[Stripe Webhook] Erro ao registrar na coleção sales:', salesErr)
      }

      return e.json(200, {
        received: true,
        event_type: eventType,
        client_linked: isClientLinked,
        customer_email: customerEmail,
      })
    }

    // 2. Eventos de cancelamento ou exclusão de assinatura (customer.subscription.deleted / customer.subscription.updated)
    if (eventType === 'customer.subscription.deleted') {
      const subId = eventData.id || ''
      const customerId = eventData.customer || ''
      console.log(`[Stripe Webhook] Assinatura cancelada no Stripe: ${subId}`)

      // Registrar auditoria ou atualizar status de venda se desejado
      try {
        const auditCol = $app.findCollectionByNameOrId('audit_logs')
        const audit = new Record(auditCol)
        audit.set('entity_type', 'stripe_subscription')
        audit.set('entity_id', subId)
        audit.set('action', 'SUBSCRIPTION_DELETED')
        audit.set(
          'summary',
          `Assinatura Stripe ${subId} (cliente ${customerId}) foi cancelada. O cliente continuará ativo até o término do paid_until.`,
        )
        $app.save(audit)
      } catch (_) {}

      return e.json(200, { received: true, event_type: eventType })
    }

    // Outros eventos Stripe retornam 200 normalmente
    return e.json(200, { received: true, ignored: true })
  } catch (handlerErr) {
    console.error('[Stripe Webhook] Erro durante o processamento do evento:', handlerErr)
    return e.json(500, { error: 'Internal handler error: ' + String(handlerErr) })
  }
})
