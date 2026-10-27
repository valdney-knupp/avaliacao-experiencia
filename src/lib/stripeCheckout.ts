import pb from '@/lib/pocketbase/client'

export interface StripeCheckoutConfig {
  payment_link: string
  price_id: string
  price_label: string
}

export const FALLBACK_CHECKOUT_CONFIG: StripeCheckoutConfig = {
  payment_link: 'https://buy.stripe.com/test_avaliacao_experiencia_297',
  price_id: 'price_avaliacao_experiencia_297',
  price_label: 'R$ 297,00',
}

/**
 * Busca o Payment Link dinâmico do backend ou do cache de settings.
 * Se o backend tiver conexão ativa com Stripe Connect do proprietário,
 * retorna a URL oficial gerada na conta Stripe. Caso contrário, retorna o link configurado.
 */
export async function getStripeCheckoutConfig(): Promise<StripeCheckoutConfig> {
  try {
    // 1. Tenta chamar o endpoint de checkout do backend
    const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const endpoint = `${backendUrl.replace(/\/+$/, '')}/backend/v1/billing/checkout-link`
    const res = await fetch(endpoint)
    if (res.ok) {
      const data = await res.json()
      if (data && data.payment_link) {
        return {
          payment_link: data.payment_link,
          price_id: data.price_id || FALLBACK_CHECKOUT_CONFIG.price_id,
          price_label: 'R$ 297,00',
        }
      }
    }
  } catch (err) {
    console.warn('Não foi possível obter link dinâmico via backend hook:', err)
  }

  // 2. Tenta ler direto das settings da base
  try {
    const records = await pb.collection('settings').getFullList({
      filter: 'key ~ "stripe"',
    })
    const linkRec = records.find((r) => r.key === 'stripe_payment_link')
    const priceRec = records.find((r) => r.key === 'stripe_price_id')
    if (linkRec && linkRec.value) {
      return {
        payment_link: linkRec.value,
        price_id: priceRec?.value || FALLBACK_CHECKOUT_CONFIG.price_id,
        price_label: 'R$ 297,00',
      }
    }
  } catch (err) {
    console.warn('Não foi possível obter link de settings:', err)
  }

  return FALLBACK_CHECKOUT_CONFIG
}
