import { describe, it, expect, beforeEach, vi } from 'vitest'
import {
  GOOGLE_ADS_CONVERSION_ID,
  GOOGLE_ADS_PURCHASE_CONVERSION_SEND_TO,
  initGoogleAds,
  trackPurchaseConversion,
  _resetGoogleAdsForTesting,
} from './googleAds'

describe('googleAds helper', () => {
  beforeEach(() => {
    _resetGoogleAdsForTesting()
    document.head.innerHTML = ''
    delete window.gtag
    delete window.dataLayer
  })

  it('deve ter as constantes oficiais corretas do Google Ads', () => {
    expect(GOOGLE_ADS_CONVERSION_ID).toBe('AW-17085357710')
    expect(GOOGLE_ADS_PURCHASE_CONVERSION_SEND_TO).toBe('AW-17085357710/h_UtCK-rzLIdEI6999I_')
  })

  it('deve inicializar window.dataLayer e window.gtag apenas uma vez no head', () => {
    initGoogleAds()

    expect(window.dataLayer).toBeDefined()
    expect(Array.isArray(window.dataLayer)).toBe(true)
    expect(typeof window.gtag).toBe('function')

    const scripts = document.querySelectorAll(
      `script[src*="googletagmanager.com/gtag/js?id=${GOOGLE_ADS_CONVERSION_ID}"]`,
    )
    expect(scripts.length).toBe(1)
    expect(scripts[0].getAttribute('async')).not.toBeNull()

    // Segunda chamada não deve duplicar o script
    initGoogleAds()
    const scriptsAfter = document.querySelectorAll(
      `script[src*="googletagmanager.com/gtag/js?id=${GOOGLE_ADS_CONVERSION_ID}"]`,
    )
    expect(scriptsAfter.length).toBe(1)
  })

  it('deve enviar eventos para dataLayer através da função gtag', () => {
    initGoogleAds()

    // O dataLayer deve conter a chamada inicial 'js' e 'config'
    expect(window.dataLayer?.length).toBeGreaterThanOrEqual(2)
    const firstCall = (window.dataLayer as unknown[][])[0]
    expect(firstCall[0]).toBe('js')
    const secondCall = (window.dataLayer as unknown[][])[1]
    expect(secondCall[0]).toBe('config')
    expect(secondCall[1]).toBe(GOOGLE_ADS_CONVERSION_ID)
  })

  it('deve disparar trackPurchaseConversion com send_to e transaction_id padrão', () => {
    const gtagSpy = vi.fn()

    // Inicializa gtag manual para espiar
    window.gtag = gtagSpy
    window.dataLayer = []

    trackPurchaseConversion()

    expect(gtagSpy).toHaveBeenCalledWith('event', 'conversion', {
      send_to: GOOGLE_ADS_PURCHASE_CONVERSION_SEND_TO,
      transaction_id: '',
    })
  })

  it('deve incluir transaction_id e valor quando informados', () => {
    const gtagSpy = vi.fn()
    window.gtag = gtagSpy
    window.dataLayer = []

    trackPurchaseConversion({
      transactionId: 'pi_123456',
      value: 129,
      currency: 'BRL',
    })

    expect(gtagSpy).toHaveBeenCalledWith('event', 'conversion', {
      send_to: GOOGLE_ADS_PURCHASE_CONVERSION_SEND_TO,
      transaction_id: 'pi_123456',
      value: 129,
      currency: 'BRL',
    })
  })
})
