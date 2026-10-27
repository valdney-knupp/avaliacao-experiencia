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

  it('has valid monthly and annual fallback configurations', () => {
    expect(FALLBACK_CHECKOUT_CONFIG.monthly.name).toBe('Plano Mensal')
    expect(FALLBACK_CHECKOUT_CONFIG.monthly.price_label).toBe('297,00')
    expect(FALLBACK_CHECKOUT_CONFIG.annual.name).toBe('Plano Anual')
    expect(FALLBACK_CHECKOUT_CONFIG.annual.price_label).toBe('2.970,00')
    expect(FALLBACK_CHECKOUT_CONFIG.annual.badge).toContain('2 meses grátis')
  })
})
