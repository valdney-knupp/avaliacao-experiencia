migrate(
  (app) => {
    const settingsCol = app.findCollectionByNameOrId('settings')

    const updateOrInsertSetting = (key, value) => {
      let rec
      try {
        rec = app.findFirstRecordByData('settings', 'key', key)
      } catch (_) {
        rec = new Record(settingsCol)
        rec.set('key', key)
      }
      rec.set('value', value)
      app.save(rec)
    }

    // Atualiza o plano anual para R$ 2.899/ano
    updateOrInsertSetting('stripe_annual_price_label', '2.899,00')
    updateOrInsertSetting('stripe_annual_price_id', 'price_1UW0OhLpoAima4qdRW4Xmqs0')
    updateOrInsertSetting(
      'stripe_annual_payment_link',
      'https://buy.stripe.com/aFa7sMgzAf0342ga5R3Nm02',
    )
    updateOrInsertSetting('stripe_annual_active', 'true')
  },
  (app) => {
    // Reversão para os valores anteriores caso necessário
    const updateOrInsertSetting = (key, value) => {
      try {
        const rec = app.findFirstRecordByData('settings', 'key', key)
        rec.set('value', value)
        app.save(rec)
      } catch (_) {}
    }
    updateOrInsertSetting('stripe_annual_price_label', '2.970,00')
    updateOrInsertSetting('stripe_annual_price_id', 'price_1UW08ZLpoAima4qdUvKUlT9X')
    updateOrInsertSetting(
      'stripe_annual_payment_link',
      'https://buy.stripe.com/4gM3cwbfg7xBgP291N3Nm01',
    )
  },
)
