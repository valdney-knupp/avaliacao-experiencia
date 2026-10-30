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
  is_official?: boolean
}

export interface StripeCheckoutConfig {
  payment_link: string
  price_id: string
  price_label: string
  stripe_connected?: boolean
  connectors_configured?: boolean
  sync_error?: string | null
  is_official_link?: boolean
  monthly: PlanConfig
  annual: PlanConfig
}

export const isOfficialStripeLink = (url: string): boolean => {
  if (!url || typeof url !== 'string') return false
  const isStripeDomain =
    url.startsWith('https://buy.stripe.com/') || url.startsWith('https://pay.stripe.com/')
  return isStripeDomain && !url.includes('test_avaliacao_experiencia')
}

export const FALLBACK_CHECKOUT_CONFIG: StripeCheckoutConfig = {
  payment_link: 'https://buy.stripe.com/14AdRa2IK9FJ42gfqb3Nm00',
  price_id: 'price_1UW08YLpoAima4qdNrVsYYC5',
  price_label: 'R$ 297,00',
  stripe_connected: true,
  is_official_link: true,
  monthly: {
    name: 'Plano Mensal',
    price_id: 'price_1UW08YLpoAima4qdNrVsYYC5',
    payment_link: 'https://buy.stripe.com/14AdRa2IK9FJ42gfqb3Nm00',
    price_label: '297,00',
    amount_cents: 29700,
    active: true,
    interval: 'month',
    is_official: true,
  },
  annual: {
    name: 'Plano Anual',
    price_id: 'price_1UW0OhLpoAima4qdRW4Xmqs0',
    payment_link: 'https://buy.stripe.com/aFa7sMgzAf0342ga5R3Nm02',
    price_label: '2.899,00',
    amount_cents: 289900,
    active: true,
    interval: 'year',
    badge: '2 meses grátis • Economia de R$ 665',
    is_official: true,
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
        const monthlyLink = data.monthly?.payment_link || data.payment_link || ''
        const annualLink = data.annual?.payment_link || ''
        const monthlyIsOfficial = Boolean(
          data.monthly?.is_official ?? isOfficialStripeLink(monthlyLink),
        )
        const annualIsOfficial = Boolean(
          data.annual?.is_official ?? isOfficialStripeLink(annualLink),
        )

        return {
          payment_link: monthlyLink || FALLBACK_CHECKOUT_CONFIG.payment_link,
          price_id: data.monthly?.price_id || data.price_id || FALLBACK_CHECKOUT_CONFIG.price_id,
          price_label: data.monthly?.price_label
            ? `R$ ${data.monthly.price_label}`
            : FALLBACK_CHECKOUT_CONFIG.price_label,
          stripe_connected: Boolean(data.stripe_connected),
          connectors_configured: Boolean(data.connectors_configured),
          sync_error: data.sync_error || null,
          is_official_link:
            Boolean(data.stripe_connected) || (monthlyIsOfficial && annualIsOfficial),
          monthly: {
            name: data.monthly?.name || 'Plano Mensal',
            price_id: data.monthly?.price_id || FALLBACK_CHECKOUT_CONFIG.monthly.price_id,
            payment_link: monthlyLink || FALLBACK_CHECKOUT_CONFIG.monthly.payment_link,
            price_label: data.monthly?.price_label || '297,00',
            amount_cents: data.monthly?.amount_cents || 29700,
            active: data.monthly?.active !== false,
            interval: 'month',
            is_official: monthlyIsOfficial,
          },
          annual: {
            name: data.annual?.name || 'Plano Anual',
            price_id: data.annual?.price_id || FALLBACK_CHECKOUT_CONFIG.annual.price_id,
            payment_link: annualLink || FALLBACK_CHECKOUT_CONFIG.annual.payment_link,
            price_label: data.annual?.price_label || '2.899,00',
            amount_cents: data.annual?.amount_cents || 289900,
            active: data.annual?.active !== false,
            interval: 'year',
            badge: data.annual?.badge || '2 meses grátis • Economia de R$ 665',
            is_official: annualIsOfficial,
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
    const annualLabel = getVal('stripe_annual_price_label') || '2.899,00'
    const annualActive = getVal('stripe_annual_active') !== 'false'

    const monthlyIsOfficial = isOfficialStripeLink(monthlyLink || '')
    const annualIsOfficial = isOfficialStripeLink(annualLink || '')
    const isStripeConnected = monthlyIsOfficial || annualIsOfficial

    return {
      payment_link: monthlyLink || FALLBACK_CHECKOUT_CONFIG.payment_link,
      price_id: monthlyPriceId || FALLBACK_CHECKOUT_CONFIG.price_id,
      price_label: `R$ ${monthlyLabel}`,
      stripe_connected: isStripeConnected,
      is_official_link: monthlyIsOfficial && annualIsOfficial,
      monthly: {
        name: 'Plano Mensal',
        price_id: monthlyPriceId || FALLBACK_CHECKOUT_CONFIG.monthly.price_id,
        payment_link: monthlyLink || FALLBACK_CHECKOUT_CONFIG.monthly.payment_link,
        price_label: monthlyLabel,
        amount_cents: 29700,
        active: monthlyActive,
        interval: 'month',
        is_official: monthlyIsOfficial,
      },
      annual: {
        name: 'Plano Anual',
        price_id: annualPriceId || FALLBACK_CHECKOUT_CONFIG.annual.price_id,
        payment_link: annualLink || FALLBACK_CHECKOUT_CONFIG.annual.payment_link,
        price_label: annualLabel,
        amount_cents: 289900,
        active: annualActive,
        interval: 'year',
        badge: '2 meses grátis • Economia de R$ 665',
        is_official: annualIsOfficial,
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
 * Adiciona prefilled_email aos Payment Links do Stripe quando disponível
 */
export function buildCheckoutUrl(
  baseUrl: string,
  params?: { email?: string; name?: string },
): string {
  if (!baseUrl) return ''
  try {
    const url = new URL(baseUrl)
    if (params?.email && params.email.trim()) {
      url.searchParams.set('prefilled_email', params.email.trim().toLowerCase())
    }
    return url.toString()
  } catch {
    return baseUrl
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
