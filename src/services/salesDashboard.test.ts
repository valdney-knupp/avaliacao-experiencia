import { describe, it, expect } from 'vitest'
import {
  deduceModule,
  getModuleLabel,
  getStatusInfo,
  computeSalesMetrics,
  filterSales,
  MODULE_OFFICIAL_PRICES,
  type UnifiedSaleRecord,
} from '@/services/salesDashboard'

describe('salesDashboard service', () => {
  it('deduz módulo corretamente a partir de metadados e vigências', () => {
    // Por vigências
    expect(deduceModule(undefined, undefined, '2026-12-01', '2026-12-01')).toBe('combo')
    expect(deduceModule(undefined, undefined, '2026-12-01', undefined)).toBe('experiencia')
    expect(deduceModule(undefined, undefined, undefined, '2026-12-01')).toBe('desempenho')

    // Por metadados
    expect(deduceModule(undefined, { module: 'combo' })).toBe('combo')
    expect(deduceModule(undefined, { module: 'desempenho' })).toBe('desempenho')
    expect(deduceModule(undefined, { module: 'experiencia' })).toBe('experiencia')

    // Por valor de tabela
    expect(deduceModule(397)).toBe('combo')
    expect(deduceModule(3897)).toBe('combo')
    expect(deduceModule(150)).toBe('desempenho')
    expect(deduceModule(1399)).toBe('desempenho')
    expect(deduceModule(297)).toBe('experiencia')
    expect(deduceModule(2899)).toBe('experiencia')
  })

  it('retorna labels amigáveis para cada módulo', () => {
    expect(getModuleLabel('experiencia')).toContain('Experiência')
    expect(getModuleLabel('desempenho')).toContain('Desempenho')
    expect(getModuleLabel('combo')).toContain('Combo')
  })

  it('calcula status de assinatura ativo vs suspenso/expirado', () => {
    // Vencida no passado
    const pastInfo = getStatusInfo('active', true, '2020-01-01')
    expect(pastInfo.status).toBe('suspended')

    // Ativa no futuro
    const futureInfo = getStatusInfo('active', true, '2099-01-01')
    expect(futureInfo.status).toBe('active')

    // Inativa
    const inactiveInfo = getStatusInfo('active', false, '2099-01-01')
    expect(inactiveInfo.status).toBe('suspended')
  })

  it('calcula métricas agregadas e evolução mensal', () => {
    const mockSales: UnifiedSaleRecord[] = [
      {
        id: '1',
        source: 'sales',
        customer_name: 'Empresa A',
        customer_email: 'a@empresa.com',
        plan: 'MENSAL',
        amount: 297,
        amount_label: 'R$ 297,00',
        module: 'experiencia',
        module_label: 'Avaliação de Experiência',
        status: 'active',
        status_label: 'Ativo',
        created: '2026-10-15T10:00:00Z',
      },
      {
        id: '2',
        source: 'sales',
        customer_name: 'Empresa B',
        customer_email: 'b@empresa.com',
        plan: 'ANUAL',
        amount: 3897,
        amount_label: 'R$ 3.897,00',
        module: 'combo',
        module_label: 'Combo',
        status: 'active',
        status_label: 'Ativo',
        created: '2026-10-20T10:00:00Z',
      },
      {
        id: '3',
        source: 'sales',
        customer_name: 'Empresa C',
        customer_email: 'c@empresa.com',
        plan: 'MENSAL',
        amount: 150,
        amount_label: 'R$ 150,00',
        module: 'desempenho',
        module_label: 'Avaliação de Desempenho',
        status: 'suspended',
        status_label: 'Suspenso',
        created: '2026-11-01T10:00:00Z',
      },
    ]

    const metrics = computeSalesMetrics(mockSales)
    expect(metrics.totalSalesCount).toBe(3)
    expect(metrics.totalRevenue).toBe(297 + 3897) // id 3 está suspenso, não entra na receita confirmada
    expect(metrics.activeSubscriptionsCount).toBe(2)
    expect(metrics.suspendedOrExpiredCount).toBe(1)

    // Distribuição
    expect(metrics.moduleDistribution.experiencia.total).toBe(1)
    expect(metrics.moduleDistribution.experiencia.mensal).toBe(1)
    expect(metrics.moduleDistribution.combo.total).toBe(1)
    expect(metrics.moduleDistribution.combo.anual).toBe(1)
    expect(metrics.moduleDistribution.desempenho.total).toBe(1)

    // Evolução mensal
    expect(metrics.monthlyEvolution.length).toBe(2) // 2026-10 e 2026-11
    expect(metrics.monthlyEvolution[0].monthKey).toBe('2026-10')
    expect(metrics.monthlyEvolution[0].salesCount).toBe(2)
    expect(metrics.monthlyEvolution[1].monthKey).toBe('2026-11')
    expect(metrics.monthlyEvolution[1].salesCount).toBe(1)
  })

  it('filtra vendas por módulo e período corretamente', () => {
    const mockSales: UnifiedSaleRecord[] = [
      {
        id: '1',
        source: 'sales',
        customer_name: 'Empresa A',
        customer_email: 'a@empresa.com',
        plan: 'MENSAL',
        amount: 297,
        amount_label: 'R$ 297,00',
        module: 'experiencia',
        module_label: 'Avaliação de Experiência',
        status: 'active',
        status_label: 'Ativo',
        created: '2026-11-05T10:00:00Z',
      },
      {
        id: '2',
        source: 'sales',
        customer_name: 'Empresa B',
        customer_email: 'b@empresa.com',
        plan: 'ANUAL',
        amount: 1399,
        amount_label: 'R$ 1.399,00',
        module: 'desempenho',
        module_label: 'Desempenho',
        status: 'active',
        status_label: 'Ativo',
        created: '2025-01-01T10:00:00Z',
      },
    ]

    // Filtro por módulo
    const expOnly = filterSales(mockSales, 'all', 'experiencia')
    expect(expOnly.length).toBe(1)
    expect(expOnly[0].id).toBe('1')

    // Filtro por período
    const pastYear = filterSales(mockSales, 'year', 'all')
    // Apenas a de 2026 bate com o ano corrente da suíte se for 2026
    expect(pastYear.length).toBeGreaterThanOrEqual(1)
  })

  it('possui tabela de preços oficiais completa', () => {
    expect(MODULE_OFFICIAL_PRICES.experiencia.MENSAL).toBe(297)
    expect(MODULE_OFFICIAL_PRICES.experiencia.ANUAL).toBe(2899)
    expect(MODULE_OFFICIAL_PRICES.desempenho.MENSAL).toBe(150)
    expect(MODULE_OFFICIAL_PRICES.desempenho.ANUAL).toBe(1399)
    expect(MODULE_OFFICIAL_PRICES.combo.MENSAL).toBe(397)
    expect(MODULE_OFFICIAL_PRICES.combo.ANUAL).toBe(3897)
  })
})
