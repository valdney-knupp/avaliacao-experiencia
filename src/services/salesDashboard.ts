import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export type ModuleCategory = 'experiencia' | 'desempenho' | 'combo' | 'outro'
export type PeriodFilter = 'all' | '30d' | '90d' | 'year' | 'custom'

export interface UnifiedSaleRecord {
  id: string
  source: 'sales' | 'clients'
  customer_name: string
  customer_email: string
  plan: 'MENSAL' | 'ANUAL' | 'OUTRO'
  amount: number // em reais
  amount_label: string
  module: ModuleCategory
  module_label: string
  status: 'active' | 'succeeded' | 'suspended' | 'pending' | 'canceled'
  status_label: string
  created: string // ISO string
  experiencia_until?: string
  desempenho_until?: string
  paid_until?: string
  client_id?: string
  notes?: string
}

export interface SalesDashboardMetrics {
  totalSalesCount: number
  totalRevenue: number
  hasEstimatedRevenue: boolean
  activeSubscriptionsCount: number
  suspendedOrExpiredCount: number
  moduleDistribution: {
    experiencia: { total: number; mensal: number; anual: number; revenue: number }
    desempenho: { total: number; mensal: number; anual: number; revenue: number }
    combo: { total: number; mensal: number; anual: number; revenue: number }
    outro: { total: number; mensal: number; anual: number; revenue: number }
  }
  monthlyEvolution: Array<{
    monthKey: string // YYYY-MM
    label: string // ex: "Nov/2026"
    salesCount: number
    revenue: number
    experienciaCount: number
    desempenhoCount: number
    comboCount: number
  }>
  recentSales: UnifiedSaleRecord[]
}

// Preços de tabela oficiais por módulo e modalidade
export const MODULE_OFFICIAL_PRICES: Record<
  ModuleCategory,
  { MENSAL: number; ANUAL: number; label: string }
> = {
  experiencia: {
    MENSAL: 297,
    ANUAL: 2899,
    label: 'Avaliação de Experiência',
  },
  desempenho: {
    MENSAL: 150,
    ANUAL: 1399,
    label: 'Avaliação de Desempenho',
  },
  combo: {
    MENSAL: 397,
    ANUAL: 3897,
    label: 'Combo Experiência + Desempenho',
  },
  outro: {
    MENSAL: 297,
    ANUAL: 2899,
    label: 'Personalizado',
  },
}

/**
 * Deduce o módulo a partir dos metadados da venda ou das vigências do client
 */
export function deduceModule(
  amount?: number,
  metadata?: any,
  experienciaUntil?: string,
  desempenhoUntil?: string,
): ModuleCategory {
  // 1. Checagem direta de metadados
  if (metadata) {
    if (metadata.module === 'combo') return 'combo'
    if (metadata.module === 'desempenho') return 'desempenho'
    if (metadata.module === 'experiencia') return 'experiencia'
  }

  // 2. Se temos datas de vigência do client
  const hasExp = Boolean(experienciaUntil && experienciaUntil.trim())
  const hasDes = Boolean(desempenhoUntil && desempenhoUntil.trim())

  if (hasExp && hasDes) {
    return 'combo'
  }
  if (hasDes && !hasExp) {
    return 'desempenho'
  }
  if (hasExp && !hasDes) {
    return 'experiencia'
  }

  // 3. Fallback inteligente por valor pago
  if (amount) {
    if (Math.abs(amount - 397) < 5 || Math.abs(amount - 3897) < 20) return 'combo'
    if (Math.abs(amount - 150) < 5 || Math.abs(amount - 1399) < 20) return 'desempenho'
    if (Math.abs(amount - 297) < 5 || Math.abs(amount - 2899) < 20) return 'experiencia'
  }

  // Padrão do sistema: Experiência
  return 'experiencia'
}

/**
 * Obtém o label amigável do módulo
 */
export function getModuleLabel(mod: ModuleCategory): string {
  switch (mod) {
    case 'experiencia':
      return 'Avaliação de Experiência'
    case 'desempenho':
      return 'Avaliação de Desempenho'
    case 'combo':
      return 'Combo (Experiência + Desempenho)'
    default:
      return 'Outro / Personalizado'
  }
}

/**
 * Normaliza o status para exibição
 */
export function getStatusInfo(
  status: string,
  isActive: boolean,
  paidUntil?: string,
): { status: UnifiedSaleRecord['status']; label: string } {
  const nowIso = new Date().toISOString().split('T')[0]
  const isOverdue = Boolean(paidUntil && paidUntil.split(' ')[0].split('T')[0] < nowIso)

  if (!isActive || status === 'suspended_overdue' || status === 'blocked_manually' || isOverdue) {
    return { status: 'suspended', label: 'Suspenso / Expirado' }
  }

  if (status === 'succeeded' || status === 'active') {
    return { status: 'active', label: 'Ativo' }
  }

  if (status === 'pending' || status === 'checkout_started') {
    return { status: 'pending', label: 'Pendente' }
  }

  if (status === 'canceled') {
    return { status: 'canceled', label: 'Cancelado' }
  }

  return { status: 'active', label: 'Ativo' }
}

/**
 * Busca registros unificados de vendas (coleção sales + clientes de clients)
 */
export async function fetchUnifiedSalesData(): Promise<UnifiedSaleRecord[]> {
  const unified: UnifiedSaleRecord[] = []
  const clientMap = new Map<string, RecordModel>()

  // 1. Carregar clients
  try {
    const clients = await pb.collection('clients').getFullList<RecordModel>({
      sort: '-created',
    })
    for (const c of clients) {
      const email = (c.email || '').trim().toLowerCase()
      if (email) {
        clientMap.set(email, c)
      }
    }
  } catch (err) {
    console.warn('[salesDashboard] Erro ao carregar coleção clients:', err)
  }

  // 2. Carregar sales
  const processedEmails = new Set<string>()

  try {
    const sales = await pb.collection('sales').getFullList<RecordModel>({
      sort: '-created',
    })

    for (const s of sales) {
      const email = (s.customer_email || '').trim().toLowerCase()
      const client = email ? clientMap.get(email) : undefined
      if (email) processedEmails.add(email)

      const expUntil = client?.experiencia_until || ''
      const desUntil = client?.desempenho_until || ''
      const paidUntil = client?.paid_until || ''

      const mod = deduceModule(
        s.amount ? Number(s.amount) : undefined,
        s.metadata,
        expUntil,
        desUntil,
      )

      const planValue: 'MENSAL' | 'ANUAL' | 'OUTRO' =
        s.plan === 'ANUAL' ? 'ANUAL' : s.plan === 'MENSAL' ? 'MENSAL' : 'OUTRO'

      let amountVal = Number(s.amount) || 0
      // Se a venda não tem valor registrado, calcula a partir do preço oficial do plano e módulo
      if (!amountVal && planValue !== 'OUTRO') {
        amountVal = MODULE_OFFICIAL_PRICES[mod][planValue]
      }

      const clientActive = client ? client.active !== false : true
      const clientStatus = client?.status || s.status || 'active'
      const statusInfo = getStatusInfo(clientStatus, clientActive, paidUntil)

      unified.push({
        id: s.id,
        source: 'sales',
        customer_name: s.customer_name || client?.name || email || 'Cliente',
        customer_email: email,
        plan: planValue,
        amount: amountVal,
        amount_label:
          s.amount_label ||
          (amountVal
            ? `R$ ${amountVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
            : '-'),
        module: mod,
        module_label: getModuleLabel(mod),
        status: statusInfo.status,
        status_label: statusInfo.label,
        created: s.created,
        experiencia_until: expUntil,
        desempenho_until: desUntil,
        paid_until: paidUntil,
        client_id: client?.id,
      })
    }
  } catch (err) {
    console.warn('[salesDashboard] Erro ao carregar coleção sales:', err)
  }

  // 3. Adicionar clientes de 'clients' que ainda não possuem registro em 'sales'
  // (ex.: criados manualmente na administração ou legados)
  for (const [email, c] of clientMap.entries()) {
    if (processedEmails.has(email)) continue

    const expUntil = c.experiencia_until || ''
    const desUntil = c.desempenho_until || ''
    const paidUntil = c.paid_until || ''

    const mod = deduceModule(undefined, undefined, expUntil, desUntil)
    const planValue: 'MENSAL' | 'ANUAL' | 'OUTRO' =
      c.plan === 'ANUAL' ? 'ANUAL' : c.plan === 'MENSAL' ? 'MENSAL' : 'OUTRO'

    const amountVal = planValue !== 'OUTRO' ? MODULE_OFFICIAL_PRICES[mod][planValue] : 0

    const statusInfo = getStatusInfo(c.status || 'active', c.active !== false, paidUntil)

    unified.push({
      id: `client_${c.id}`,
      source: 'clients',
      customer_name: c.name || email,
      customer_email: email,
      plan: planValue,
      amount: amountVal,
      amount_label: amountVal
        ? `R$ ${amountVal.toLocaleString('pt-BR', { minimumFractionDigits: 2 })}`
        : '-',
      module: mod,
      module_label: getModuleLabel(mod),
      status: statusInfo.status,
      status_label: statusInfo.label,
      created: c.created,
      experiencia_until: expUntil,
      desempenho_until: desUntil,
      paid_until: paidUntil,
      client_id: c.id,
      notes: c.notes,
    })
  }

  // Ordenar por data de criação decrescente
  unified.sort((a, b) => new Date(b.created).getTime() - new Date(a.created).getTime())

  return unified
}

/**
 * Filtra vendas por período e módulo
 */
export function filterSales(
  sales: UnifiedSaleRecord[],
  period: PeriodFilter,
  selectedModule: ModuleCategory | 'all',
  customStartDate?: string,
  customEndDate?: string,
): UnifiedSaleRecord[] {
  const now = new Date()

  return sales.filter((item) => {
    // Filtro por módulo
    if (selectedModule !== 'all' && item.module !== selectedModule) {
      return false
    }

    // Filtro por período
    if (period === 'all') return true

    const itemDate = new Date(item.created)
    if (isNaN(itemDate.getTime())) return true

    if (period === '30d') {
      const past30 = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
      return itemDate >= past30
    }

    if (period === '90d') {
      const past90 = new Date(now.getTime() - 90 * 24 * 60 * 60 * 1000)
      return itemDate >= past90
    }

    if (period === 'year') {
      const currentYear = now.getFullYear()
      return itemDate.getFullYear() === currentYear
    }

    if (period === 'custom' && (customStartDate || customEndDate)) {
      if (customStartDate) {
        const start = new Date(customStartDate + 'T00:00:00')
        if (itemDate < start) return false
      }
      if (customEndDate) {
        const end = new Date(customEndDate + 'T23:59:59')
        if (itemDate > end) return false
      }
      return true
    }

    return true
  })
}

/**
 * Calcula todas as métricas para o Dashboard de Vendas
 */
export function computeSalesMetrics(sales: UnifiedSaleRecord[]): SalesDashboardMetrics {
  let totalRevenue = 0
  let activeSubscriptionsCount = 0
  let suspendedOrExpiredCount = 0

  const moduleDistribution = {
    experiencia: { total: 0, mensal: 0, anual: 0, revenue: 0 },
    desempenho: { total: 0, mensal: 0, anual: 0, revenue: 0 },
    combo: { total: 0, mensal: 0, anual: 0, revenue: 0 },
    outro: { total: 0, mensal: 0, anual: 0, revenue: 0 },
  }

  const monthlyMap = new Map<
    string,
    {
      salesCount: number
      revenue: number
      experienciaCount: number
      desempenhoCount: number
      comboCount: number
    }
  >()

  for (const s of sales) {
    const isRevenueValid = s.status === 'active' || s.status === 'succeeded'
    if (isRevenueValid) {
      totalRevenue += s.amount || 0
    }

    if (s.status === 'active' || s.status === 'succeeded') {
      activeSubscriptionsCount++
    } else if (s.status === 'suspended' || s.status === 'canceled') {
      suspendedOrExpiredCount++
    }

    // Distribuição por módulo
    const targetMod = moduleDistribution[s.module] || moduleDistribution.outro
    targetMod.total++
    if (s.plan === 'MENSAL') targetMod.mensal++
    if (s.plan === 'ANUAL') targetMod.anual++
    if (isRevenueValid) targetMod.revenue += s.amount || 0

    // Evolução mensal
    if (s.created) {
      const d = new Date(s.created)
      if (!isNaN(d.getTime())) {
        const y = d.getFullYear()
        const m = String(d.getMonth() + 1).padStart(2, '0')
        const monthKey = `${y}-${m}`

        const current = monthlyMap.get(monthKey) || {
          salesCount: 0,
          revenue: 0,
          experienciaCount: 0,
          desempenhoCount: 0,
          comboCount: 0,
        }

        current.salesCount++
        if (isRevenueValid) current.revenue += s.amount || 0
        if (s.module === 'experiencia') current.experienciaCount++
        if (s.module === 'desempenho') current.desempenhoCount++
        if (s.module === 'combo') current.comboCount++

        monthlyMap.set(monthKey, current)
      }
    }
  }

  // Formatar array de evolução mensal ordenado por mês crescente
  const monthNames = [
    'Jan',
    'Fev',
    'Mar',
    'Abr',
    'Mai',
    'Jun',
    'Jul',
    'Ago',
    'Set',
    'Out',
    'Nov',
    'Dez',
  ]

  const sortedMonthKeys = Array.from(monthlyMap.keys()).sort()
  const monthlyEvolution = sortedMonthKeys.map((key) => {
    const item = monthlyMap.get(key)!
    const [y, m] = key.split('-')
    const monthIndex = parseInt(m, 10) - 1
    const label = `${monthNames[monthIndex] || m}/${y}`
    return {
      monthKey: key,
      label,
      salesCount: item.salesCount,
      revenue: item.revenue,
      experienciaCount: item.experienciaCount,
      desempenhoCount: item.desempenhoCount,
      comboCount: item.comboCount,
    }
  })

  return {
    totalSalesCount: sales.length,
    totalRevenue,
    hasEstimatedRevenue: sales.some((s) => s.source === 'clients' && s.amount > 0),
    activeSubscriptionsCount,
    suspendedOrExpiredCount,
    moduleDistribution,
    monthlyEvolution,
    recentSales: sales.slice(0, 50),
  }
}
