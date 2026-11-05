/**
 * Helper oficial para integração da Tag de Conversão do Google Ads (gtag.js)
 *
 * Configurações fornecidas:
 * - ID de conversão global: AW-17085357710
 * - Rótulo de conversão para Assinatura do Sistema: AW-17085357710/h_UtCK-rzLIdEI6999I_
 */

export const GOOGLE_ADS_CONVERSION_ID = 'AW-17085357710'
export const GOOGLE_ADS_PURCHASE_CONVERSION_SEND_TO = 'AW-17085357710/h_UtCK-rzLIdEI6999I_'

declare global {
  interface Window {
    dataLayer?: unknown[]
    gtag?: (...args: unknown[]) => void
  }
}

let isTagInitialized = false

/**
 * Inicializa a tag global do Google Ads (gtag.js) de forma idempotente e segura para SSR/testes.
 * Insere o script no <head> apenas uma vez e define a função global window.gtag.
 */
export function initGoogleAds(conversionId: string = GOOGLE_ADS_CONVERSION_ID): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return
  }

  // Prepara o dataLayer e a função gtag imediatamente
  window.dataLayer = window.dataLayer || []
  if (typeof window.gtag !== 'function') {
    window.gtag = function gtag(...args: unknown[]) {
      window.dataLayer?.push(args)
    }
  }

  // Se já foi inicializado nesta sessão, não reconfigura nem reinsere script
  if (isTagInitialized) {
    return
  }

  // Configuração inicial oficial exigida pelo Google
  window.gtag('js', new Date())
  window.gtag('config', conversionId)

  // Verifica se o script já existe no DOM para evitar duplicatas
  const existingScript = document.querySelector(
    `script[src*="googletagmanager.com/gtag/js?id=${conversionId}"]`,
  )

  if (!existingScript) {
    const script = document.createElement('script')
    script.async = true
    script.src = `https://www.googletagmanager.com/gtag/js?id=${conversionId}`
    document.head.appendChild(script)
  }

  isTagInitialized = true
}

export interface PurchaseConversionOptions {
  transactionId?: string
  value?: number
  currency?: string
}

/**
 * Dispara o evento de conversão do Google Ads ao carregar a página de agradecimento (/obrigado).
 * Garante que a tag global esteja inicializada antes de enviar o evento.
 */
export function trackPurchaseConversion(
  options: PurchaseConversionOptions = {},
  sendTo: string = GOOGLE_ADS_PURCHASE_CONVERSION_SEND_TO,
): void {
  if (typeof window === 'undefined') {
    return
  }

  // Garante que o gtag e a tag global estejam prontos
  initGoogleAds()

  const payload: Record<string, unknown> = {
    send_to: sendTo,
    transaction_id: options.transactionId || '',
  }

  if (typeof options.value === 'number') {
    payload.value = options.value
    payload.currency = options.currency || 'BRL'
  }

  if (typeof window.gtag === 'function') {
    window.gtag('event', 'conversion', payload)
  }
}

/**
 * Função utilitária para testes: reseta o estado interno de inicialização.
 */
export function _resetGoogleAdsForTesting(): void {
  isTagInitialized = false
}
