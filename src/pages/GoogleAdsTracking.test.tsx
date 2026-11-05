import { describe, it, expect, beforeEach, vi } from 'vitest'
import React from 'react'
import { render } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { ThankYou } from './ThankYou'
import { Sales } from './Sales'
import * as googleAds from '@/lib/googleAds'

// Mock de syncManualAssetToBackend para evitar chamadas de rede no teste
vi.mock('@/lib/manualService', () => ({
  downloadManualPdf: vi.fn(),
  syncManualAssetToBackend: vi.fn().mockResolvedValue(true),
}))

// Mock de stripeCheckout para carregar rápido
vi.mock('@/lib/stripeCheckout', () => ({
  getStripeCheckoutConfig: vi.fn().mockResolvedValue({
    stripe_connected: true,
    monthly: { price: 'R$ 129,00', payment_link: 'https://buy.stripe.com/test_monthly' },
    annual: { price: 'R$ 1.290,00', payment_link: 'https://buy.stripe.com/test_annual' },
  }),
  FALLBACK_CHECKOUT_CONFIG: {
    stripe_connected: false,
    monthly: { price: 'R$ 129,00', payment_link: '' },
    annual: { price: 'R$ 1.290,00', payment_link: '' },
  },
  buildCheckoutUrl: vi.fn((url) => url),
}))

describe('Google Ads conversion tracking nas páginas', () => {
  beforeEach(() => {
    vi.restoreAllMocks()
  })

  it('deve disparar trackPurchaseConversion ao montar ThankYou', () => {
    const trackSpy = vi.spyOn(googleAds, 'trackPurchaseConversion')

    render(
      <MemoryRouter>
        <ThankYou />
      </MemoryRouter>,
    )

    expect(trackSpy).toHaveBeenCalledTimes(1)
  })

  it('NÃO deve disparar trackPurchaseConversion ao montar Sales, apenas inicializar initGoogleAds', () => {
    const trackSpy = vi.spyOn(googleAds, 'trackPurchaseConversion')
    const initSpy = vi.spyOn(googleAds, 'initGoogleAds')

    render(
      <MemoryRouter>
        <Sales />
      </MemoryRouter>,
    )

    expect(trackSpy).not.toHaveBeenCalled()
    expect(initSpy).toHaveBeenCalled()
  })
})
