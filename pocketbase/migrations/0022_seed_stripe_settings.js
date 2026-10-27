migrate(
  (app) => {
    const settingsCol = app.findCollectionByNameOrId('settings')

    // 1. stripe_price_id
    try {
      app.findFirstRecordByData('settings', 'key', 'stripe_price_id')
    } catch (_) {
      const rec = new Record(settingsCol)
      rec.set('key', 'stripe_price_id')
      rec.set('value', 'price_avaliacao_experiencia_297')
      app.save(rec)
    }

    // 2. stripe_payment_link
    try {
      app.findFirstRecordByData('settings', 'key', 'stripe_payment_link')
    } catch (_) {
      const rec = new Record(settingsCol)
      rec.set('key', 'stripe_payment_link')
      rec.set('value', 'https://buy.stripe.com/test_avaliacao_experiencia_297')
      app.save(rec)
    }

    // 3. stripe_plan_price_label
    try {
      app.findFirstRecordByData('settings', 'key', 'stripe_plan_price_label')
    } catch (_) {
      const rec = new Record(settingsCol)
      rec.set('key', 'stripe_plan_price_label')
      rec.set('value', '297,00')
      app.save(rec)
    }
  },
  (app) => {
    try {
      const r1 = app.findFirstRecordByData('settings', 'key', 'stripe_price_id')
      app.delete(r1)
    } catch (_) {}
    try {
      const r2 = app.findFirstRecordByData('settings', 'key', 'stripe_payment_link')
      app.delete(r2)
    } catch (_) {}
    try {
      const r3 = app.findFirstRecordByData('settings', 'key', 'stripe_plan_price_label')
      app.delete(r3)
    } catch (_) {}
  },
)
