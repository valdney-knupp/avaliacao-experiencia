migrate(
  (app) => {
    const settingsCol = app.findCollectionByNameOrId('settings')

    const ensureSetting = (key, defaultValue) => {
      try {
        app.findFirstRecordByData('settings', 'key', key)
      } catch (_) {
        const rec = new Record(settingsCol)
        rec.set('key', key)
        rec.set('value', defaultValue)
        app.save(rec)
      }
    }

    // 1. Configurações do Plano Mensal
    ensureSetting('stripe_monthly_price_id', 'price_avaliacao_experiencia_297')
    ensureSetting(
      'stripe_monthly_payment_link',
      'https://buy.stripe.com/test_avaliacao_experiencia_297',
    )
    ensureSetting('stripe_monthly_price_label', '297,00')
    ensureSetting('stripe_monthly_active', 'true')

    // 2. Configurações do Plano Anual (R$ 2.970/ano, equivalente a 2 meses grátis)
    ensureSetting('stripe_annual_price_id', 'price_avaliacao_experiencia_2970_anual')
    ensureSetting(
      'stripe_annual_payment_link',
      'https://buy.stripe.com/test_avaliacao_experiencia_2970_anual',
    )
    ensureSetting('stripe_annual_price_label', '2.970,00')
    ensureSetting('stripe_annual_active', 'true')

    // 3. Coleção 'sales' para acompanhamento de vendas / assinaturas / checkouts
    try {
      app.findCollectionByNameOrId('sales')
    } catch (_) {
      const salesCol = new Collection({
        name: 'sales',
        type: 'base',
        // listRule e viewRule liberados para usuários autenticados ADMIN e HR
        listRule:
          "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')",
        viewRule:
          "@request.auth.id != '' && (@request.auth.profile = 'ADMIN' || @request.auth.profile = 'HR')",
        // createRule liberado publicamente para registro de eventos de checkout / webhooks / simulações
        createRule: '',
        updateRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
        deleteRule: "@request.auth.id != '' && @request.auth.profile = 'ADMIN'",
        fields: [
          {
            name: 'plan',
            type: 'select',
            values: ['MENSAL', 'ANUAL', 'OUTRO'],
            maxSelect: 1,
            required: true,
          },
          { name: 'amount', type: 'number' },
          { name: 'amount_label', type: 'text' },
          {
            name: 'status',
            type: 'select',
            values: ['succeeded', 'pending', 'canceled', 'active', 'checkout_started'],
            maxSelect: 1,
            required: true,
          },
          { name: 'customer_name', type: 'text' },
          { name: 'customer_email', type: 'text' },
          { name: 'payment_method', type: 'text' },
          { name: 'stripe_event_id', type: 'text' },
          { name: 'stripe_subscription_id', type: 'text' },
          { name: 'stripe_customer_id', type: 'text' },
          { name: 'metadata', type: 'json' },
          { name: 'created', type: 'autodate', onCreate: true, onUpdate: false },
          { name: 'updated', type: 'autodate', onCreate: true, onUpdate: true },
        ],
        indexes: [
          'CREATE INDEX idx_sales_created ON sales (created DESC)',
          'CREATE INDEX idx_sales_status ON sales (status)',
          'CREATE INDEX idx_sales_plan ON sales (plan)',
        ],
      })
      app.save(salesCol)
    }
  },
  (app) => {
    try {
      const salesCol = app.findCollectionByNameOrId('sales')
      app.delete(salesCol)
    } catch (_) {}
    const keysToDelete = [
      'stripe_monthly_price_id',
      'stripe_monthly_payment_link',
      'stripe_monthly_price_label',
      'stripe_monthly_active',
      'stripe_annual_price_id',
      'stripe_annual_payment_link',
      'stripe_annual_price_label',
      'stripe_annual_active',
    ]
    for (let k of keysToDelete) {
      try {
        const r = app.findFirstRecordByData('settings', 'key', k)
        app.delete(r)
      } catch (_) {}
    }
  },
)
