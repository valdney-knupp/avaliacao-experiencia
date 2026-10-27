import { describe, it, expect } from 'vitest'
import { FALLBACK_CHECKOUT_CONFIG } from './stripeCheckout'

describe('Stripe Checkout Configuration', () => {
  it('has valid fallback payment link and price id', () => {
    expect(FALLBACK_CHECKOUT_CONFIG.payment_link).toBe(
      'https://buy.stripe.com/test_avaliacao_experiencia_297',
    )
    expect(FALLBACK_CHECKOUT_CONFIG.price_id).toBe('price_avaliacao_experiencia_297')
    expect(FALLBACK_CHECKOUT_CONFIG.price_label).toBe('R$ 297,00')
  })
})
