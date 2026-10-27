import pb from '@/lib/pocketbase/client'

export interface PlanConfig {
  name: string
  price_id: string
  payment_link: string
  price_label: string
  amount_cents: number
  active: boolean
  interval: 'month' | 'year'
  badge?: string
}

export interface StripeCheckoutConfig {
  payment_link: string
  price_id: string
  price_label: string
  stripe_connected?: boolean
  monthly: PlanConfig
  annual: PlanConfig
}

export const FALLBACK_CHECKOUT_CONFIG: StripeCheckoutConfig = {
  payment_link: 'https://buy.stripe.com/test_avaliacao_experiencia_297',
  price_id: 'price_avaliacao_experiencia_297',
  price_label: 'R$ 297,00',
  stripe_connected: false,
  monthly: {
    name: 'Plano Mensal',
    price_id: 'price_avaliacao_experiencia_297',
    payment_link: 'https://buy.stripe.com/test_avaliacao_experiencia_297',
    price_label: '297,00',
    amount_cents: 29700,
    active: true,
    interval: 'month',
  },
  annual: {
    name: 'Plano Anual',
    price_id: 'price_avaliacao_experiencia_2970_anual',
    payment_link: 'https://buy.stripe.com/test_avaliacao_experiencia_2970_anual',
    price_label: '2.970,00',
    amount_cents: 297000,
    active: true,
    interval: 'year',
    badge: '2 meses grátis',
  },
}

export interface SaleRecord {
  id: string
  source: 'stripe' | 'local'
  plan: 'MENSAL' | 'ANUAL' | 'OUTRO' | string
  amount: number
  amount_label: string
  status: 'succeeded' | 'pending' | 'canceled' | 'active' | 'checkout_started' | string
  customer_name: string
  customer_email: string
  payment_method: string
  stripe_subscription_id?: string
  stripe_customer_id?: string
  created: string
}

/**
 * Busca configurações dos planos (Mensal e Anual) do backend ou do cache de settings.
 * Se o backend tiver conexão ativa com Stripe Connect do proprietário,
 * retorna as URLs oficiais geradas na conta Stripe.
 */
export async function getStripeCheckoutConfig(): Promise<StripeCheckoutConfig> {
  try {
    // 1. Tenta chamar o endpoint de checkout do backend
    const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const endpoint = `${backendUrl.replace(/\/+$/, '')}/backend/v1/billing/checkout-link`
    const res = await fetch(endpoint)
    if (res.ok) {
      const data = await res.json()
      if (data && (data.monthly || data.payment_link)) {
        return {
          payment_link:
            data.monthly?.payment_link ||
            data.payment_link ||
            FALLBACK_CHECKOUT_CONFIG.payment_link,
          price_id: data.monthly?.price_id || data.price_id || FALLBACK_CHECKOUT_CONFIG.price_id,
          price_label: data.monthly?.price_label
            ? `R$ ${data.monthly.price_label}`
            : FALLBACK_CHECKOUT_CONFIG.price_label,
          stripe_connected: Boolean(data.stripe_connected),
          monthly: {
            name: data.monthly?.name || 'Plano Mensal',
            price_id: data.monthly?.price_id || FALLBACK_CHECKOUT_CONFIG.monthly.price_id,
            payment_link:
              data.monthly?.payment_link ||
              data.payment_link ||
              FALLBACK_CHECKOUT_CONFIG.monthly.payment_link,
            price_label: data.monthly?.price_label || '297,00',
            amount_cents: data.monthly?.amount_cents || 29700,
            active: data.monthly?.active !== false,
            interval: 'month',
          },
          annual: {
            name: data.annual?.name || 'Plano Anual',
            price_id: data.annual?.price_id || FALLBACK_CHECKOUT_CONFIG.annual.price_id,
            payment_link: data.annual?.payment_link || FALLBACK_CHECKOUT_CONFIG.annual.payment_link,
            price_label: data.annual?.price_label || '2.970,00',
            amount_cents: data.annual?.amount_cents || 297000,
            active: data.annual?.active !== false,
            interval: 'year',
            badge: data.annual?.badge || '2 meses grátis',
          },
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
    const getVal = (key: string) => records.find((r) => r.key === key)?.value

    const monthlyLink = getVal('stripe_monthly_payment_link') || getVal('stripe_payment_link')
    const monthlyPriceId = getVal('stripe_monthly_price_id') || getVal('stripe_price_id')
    const monthlyLabel =
      getVal('stripe_monthly_price_label') || getVal('stripe_plan_price_label') || '297,00'
    const monthlyActive = getVal('stripe_monthly_active') !== 'false'

    const annualLink = getVal('stripe_annual_payment_link')
    const annualPriceId = getVal('stripe_annual_price_id')
    const annualLabel = getVal('stripe_annual_price_label') || '2.970,00'
    const annualActive = getVal('stripe_annual_active') !== 'false'

    return {
      payment_link: monthlyLink || FALLBACK_CHECKOUT_CONFIG.payment_link,
      price_id: monthlyPriceId || FALLBACK_CHECKOUT_CONFIG.price_id,
      price_label: `R$ ${monthlyLabel}`,
      stripe_connected: false,
      monthly: {
        name: 'Plano Mensal',
        price_id: monthlyPriceId || FALLBACK_CHECKOUT_CONFIG.monthly.price_id,
        payment_link: monthlyLink || FALLBACK_CHECKOUT_CONFIG.monthly.payment_link,
        price_label: monthlyLabel,
        amount_cents: 29700,
        active: monthlyActive,
        interval: 'month',
      },
      annual: {
        name: 'Plano Anual',
        price_id: annualPriceId || FALLBACK_CHECKOUT_CONFIG.annual.price_id,
        payment_link: annualLink || FALLBACK_CHECKOUT_CONFIG.annual.payment_link,
        price_label: annualLabel,
        amount_cents: 297000,
        active: annualActive,
        interval: 'year',
        badge: '2 meses grátis',
      },
    }
  } catch (err) {
    console.warn('Não foi possível obter link de settings:', err)
  }

  return FALLBACK_CHECKOUT_CONFIG
}

/**
 * Consulta vendas (Stripe ou registros locais) via endpoint de billing
 */
export async function getSalesList(): Promise<{ stripe_connected: boolean; sales: SaleRecord[] }> {
  try {
    const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const endpoint = `${backendUrl.replace(/\/+$/, '')}/backend/v1/billing/sales`
    const res = await pb.send(endpoint, { method: 'GET' })
    if (res && Array.isArray(res.sales)) {
      return {
        stripe_connected: Boolean(res.stripe_connected),
        sales: res.sales,
      }
    }
  } catch (err) {
    console.warn('Erro ao consultar /backend/v1/billing/sales, tentando fallback direto:', err)
  }

  // Fallback: busca direto na coleção sales do PocketBase
  try {
    const list = await pb.collection('sales').getFullList({ sort: '-created' })
    const sales: SaleRecord[] = list.map((r: any) => ({
      id: r.id,
      source: 'local',
      plan: r.plan || 'MENSAL',
      amount: Number(r.amount) || 0,
      amount_label: r.amount_label || '',
      status: r.status || 'pending',
      customer_name: r.customer_name || 'Cliente',
      customer_email: r.customer_email || '-',
      payment_method: r.payment_method || 'Stripe',
      stripe_subscription_id: r.stripe_subscription_id,
      stripe_customer_id: r.stripe_customer_id,
      created: r.created,
    }))
    return { stripe_connected: false, sales }
  } catch (_) {
    return { stripe_connected: false, sales: [] }
  }
}

/**
 * Sincroniza / regenera produtos, preços e payment links no Stripe
 */
export async function syncStripeBilling(): Promise<{ success: boolean; message: string }> {
  try {
    const backendUrl = import.meta.env.VITE_POCKETBASE_URL || ''
    const endpoint = `${backendUrl.replace(/\/+$/, '')}/backend/v1/billing/sync-stripe`
    const res = await pb.send(endpoint, { method: 'POST' })
    return {
      success: true,
      message: res?.message || 'Preços e links sincronizados com sucesso no Stripe.',
    }
  } catch (err: any) {
    const msg =
      err?.data?.error || err?.response?.error || err?.message || 'Falha ao sincronizar com Stripe.'
    return {
      success: false,
      message: msg,
    }
  }
}
