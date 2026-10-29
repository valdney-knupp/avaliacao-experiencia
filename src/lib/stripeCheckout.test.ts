import { describe, it, expect } from 'vitest'
import { FALLBACK_CHECKOUT_CONFIG, isOfficialStripeLink } from './stripeCheckout'

describe('Stripe Checkout Configuration', () => {
  it('has valid fallback payment link and price id', () => {
    expect(FALLBACK_CHECKOUT_CONFIG.payment_link).toBe(
      'https://buy.stripe.com/14AdRa2IK9FJ42gfqb3Nm00',
    )
    expect(FALLBACK_CHECKOUT_CONFIG.price_id).toBe('price_1UW08YLpoAima4qdNrVsYYC5')
    expect(FALLBACK_CHECKOUT_CONFIG.price_label).toBe('R$ 297,00')
    expect(FALLBACK_CHECKOUT_CONFIG.is_official_link).toBe(true)
  })

  it('has valid monthly and annual fallback configurations', () => {
    expect(FALLBACK_CHECKOUT_CONFIG.monthly.name).toBe('Plano Mensal')
    expect(FALLBACK_CHECKOUT_CONFIG.monthly.price_label).toBe('297,00')
    expect(FALLBACK_CHECKOUT_CONFIG.annual.name).toBe('Plano Anual')
    expect(FALLBACK_CHECKOUT_CONFIG.annual.price_label).toBe('2.970,00')
    expect(FALLBACK_CHECKOUT_CONFIG.annual.badge).toContain('2 meses grátis')
  })

  it('correctly discriminates official Stripe URLs from fallback test links', () => {
    expect(isOfficialStripeLink('https://buy.stripe.com/test_avaliacao_experiencia_297')).toBe(
      false,
    )
    expect(isOfficialStripeLink('https://buy.stripe.com/abc123realPaymentLink')).toBe(true)
    expect(isOfficialStripeLink('https://pay.stripe.com/abc123realPaymentLink')).toBe(true)
    expect(isOfficialStripeLink('https://stripe.com')).toBe(false)
    expect(isOfficialStripeLink('')).toBe(false)
  })
})
