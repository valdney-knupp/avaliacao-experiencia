// Rota pública para obtenção do link de checkout e criação sob demanda via Stripe Connect (owner)
// Sempre que o Stripe estiver conectado no painel Conectores, esta rota cria ou obtém
// o produto, preço recorrente de R$ 297/mês e o payment link oficial.

routerAdd('GET', '/backend/v1/billing/checkout-link', (e) => {
  const DEFAULT_PAYMENT_LINK = 'https://buy.stripe.com/test_avaliacao_experiencia_297'
  const PRICE_AMOUNT_BRL = 29700 // R$ 297,00 em centavos
  const PRODUCT_NAME = 'Avaliação de Experiência'
  const PRODUCT_DESC = 'Sistema de gestão de avaliações de experiência de 45 e 90 dias'

  // 1. Tentar ler se já salvamos um payment_link nas configurações
  try {
    const existingSetting = $app.findFirstRecordByData('settings', 'key', 'stripe_payment_link')
    if (existingSetting && existingSetting.getString('value')) {
      return e.json(200, {
        payment_link: existingSetting.getString('value'),
        price_id: (() => {
          try {
            return $app
              .findFirstRecordByData('settings', 'key', 'stripe_price_id')
              .getString('value')
          } catch (_) {
            return null
          }
        })(),
        source: 'cached_setting',
      })
    }
  } catch (_) {
    // ainda não armazenado
  }

  // 2. Se o owner toolkit do Stripe estiver ativo, chamar $connectors.executeAsOwner
  try {
    // 2.1 Verificar se existe o produto
    let productId = null
    const prodListRes = $connectors.executeAsOwner('STRIPE_LIST_PRODUCTS', {
      limit: 20,
      active: true,
    })

    if (prodListRes && prodListRes.successful && prodListRes.data) {
      const prods = Array.isArray(prodListRes.data.data)
        ? prodListRes.data.data
        : Array.isArray(prodListRes.data)
          ? prodListRes.data
          : []
      const found = prods.find(
        (p) => p && p.name && p.name.trim().toLowerCase() === PRODUCT_NAME.toLowerCase(),
      )
      if (found) {
        productId = found.id
      }
    }

    // Se não encontrou, cria o produto
    if (!productId) {
      const prodCreateRes = $connectors.executeAsOwner('STRIPE_CREATE_PRODUCT', {
        name: PRODUCT_NAME,
        description: PRODUCT_DESC,
        active: true,
      })
      if (prodCreateRes && prodCreateRes.successful && prodCreateRes.data) {
        productId = prodCreateRes.data.id
      }
    }

    // 2.2 Verificar se existe o preço recorrente de 297 BRL/mês
    let priceId = null
    if (productId) {
      const priceListRes = $connectors.executeAsOwner('STRIPE_LIST_PRICES', {
        product: productId,
        type: 'recurring',
        currency: 'brl',
        active: true,
      })

      if (priceListRes && priceListRes.successful && priceListRes.data) {
        const prices = Array.isArray(priceListRes.data.data)
          ? priceListRes.data.data
          : Array.isArray(priceListRes.data)
            ? priceListRes.data
            : []
        const foundPrice = prices.find(
          (pr) =>
            pr &&
            pr.unit_amount === PRICE_AMOUNT_BRL &&
            pr.recurring &&
            pr.recurring.interval === 'month',
        )
        if (foundPrice) {
          priceId = foundPrice.id
        }
      }

      // Se não encontrou o preço, cria
      if (!priceId) {
        const priceCreateRes = $connectors.executeAsOwner('STRIPE_CREATE_PRICE', {
          product: productId,
          currency: 'brl',
          unit_amount: PRICE_AMOUNT_BRL,
          recurring: { interval: 'month' },
          active: true,
        })
        if (priceCreateRes && priceCreateRes.successful && priceCreateRes.data) {
          priceId = priceCreateRes.data.id
        }
      }
    }

    // 2.3 Obter ou criar o payment link
    let paymentLinkUrl = null
    if (priceId) {
      const plListRes = $connectors.executeAsOwner('STRIPE_LIST_PAYMENT_LINKS', {
        limit: 20,
        active: true,
      })

      if (plListRes && plListRes.successful && plListRes.data) {
        const links = Array.isArray(plListRes.data.data)
          ? plListRes.data.data
          : Array.isArray(plListRes.data)
            ? plListRes.data
            : []
        const foundLink = links.find((l) => l && l.url && l.active !== false)
        if (foundLink) {
          paymentLinkUrl = foundLink.url
        }
      }

      if (!paymentLinkUrl) {
        // Redirecionamento após checkout para a página de pós-compra /obrigado
        let afterCompletion = undefined
        try {
          const appUrlSetting = $app.findFirstRecordByData('settings', 'key', 'app_url')
          if (appUrlSetting && appUrlSetting.getString('value')) {
            const baseUrl = appUrlSetting.getString('value').replace(/\/+$/, '')
            afterCompletion = {
              type: 'redirect',
              redirect: { url: baseUrl + '/obrigado' },
            }
          }
        } catch (_) {}

        const plCreateRes = $connectors.executeAsOwner('STRIPE_CREATE_PAYMENT_LINK', {
          line_items: [
            {
              price: priceId,
              quantity: 1,
            },
          ],
          after_completion: afterCompletion,
        })

        if (plCreateRes && plCreateRes.successful && plCreateRes.data) {
          paymentLinkUrl = plCreateRes.data.url
        }
      }
    }

    // Se gerou com sucesso, grava nas settings para próximas consultas rápidas
    if (paymentLinkUrl) {
      try {
        const settingsCol = $app.findCollectionByNameOrId('settings')
        let settingRec
        try {
          settingRec = $app.findFirstRecordByData('settings', 'key', 'stripe_payment_link')
        } catch (_) {
          settingRec = new Record(settingsCol)
          settingRec.set('key', 'stripe_payment_link')
        }
        settingRec.set('value', paymentLinkUrl)
        $app.save(settingRec)

        if (priceId) {
          let priceRec
          try {
            priceRec = $app.findFirstRecordByData('settings', 'key', 'stripe_price_id')
          } catch (_) {
            priceRec = new Record(settingsCol)
            priceRec.set('key', 'stripe_price_id')
          }
          priceRec.set('value', priceId)
          $app.save(priceRec)
        }
      } catch (saveErr) {
        console.warn('Aviso ao salvar link Stripe nas settings:', saveErr)
      }

      return e.json(200, {
        payment_link: paymentLinkUrl,
        price_id: priceId,
        source: 'stripe_owner_api',
      })
    }
  } catch (stripeErr) {
    console.warn('Aviso na integração com Stripe Connect:', stripeErr)
  }

  // Fallback seguro caso o conector ainda esteja aguardando login no painel do usuário
  return e.json(200, {
    payment_link: DEFAULT_PAYMENT_LINK,
    price_id: 'price_avaliacao_experiencia_297',
    source: 'default_fallback',
    note: 'Stripe aguardando conexão no painel Conectores para criação automática em tempo real.',
  })
})
