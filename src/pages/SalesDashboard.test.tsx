import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { SalesDashboard } from '@/pages/SalesDashboard'
import * as salesDashboardService from '@/services/salesDashboard'

let mockCanAccessAdmin = false
let mockCanAccessSalesDashboard = false

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      name: 'Admin Test',
      email: 'admin@rpontes.com.br',
      profile: mockCanAccessAdmin ? 'ADMIN' : 'HR',
    },
    canAccessAdmin: mockCanAccessAdmin,
    canAccessSalesDashboard: mockCanAccessSalesDashboard,
  }),
}))

describe('SalesDashboard component', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockCanAccessAdmin = true
    mockCanAccessSalesDashboard = true
  })

  it('exibe tela de acesso restrito se o usuário não for ADMIN', () => {
    mockCanAccessAdmin = false
    render(<SalesDashboard />)
    expect(screen.getByText(/Acesso Restrito/i)).toBeDefined()
    expect(
      screen.getByText(/Apenas usuários com perfil de Administração possuem permissão/i),
    ).toBeDefined()
  })

  it('renderiza o dashboard com cards, filtros e tabela para ADMIN', async () => {
    vi.spyOn(salesDashboardService, 'fetchUnifiedSalesData').mockResolvedValue([
      {
        id: 'sale-1',
        source: 'sales',
        customer_name: 'Construtora Exemplo',
        customer_email: 'contato@exemplo.com.br',
        plan: 'MENSAL',
        amount: 297,
        amount_label: 'R$ 297,00',
        module: 'experiencia',
        module_label: 'Avaliação de Experiência',
        status: 'active',
        status_label: 'Ativo',
        created: '2026-11-01T10:00:00Z',
      },
      {
        id: 'sale-2',
        source: 'sales',
        customer_name: 'Engenharia Alfa',
        customer_email: 'financeiro@alfa.com.br',
        plan: 'ANUAL',
        amount: 3897,
        amount_label: 'R$ 3.897,00',
        module: 'combo',
        module_label: 'Combo (Experiência + Desempenho)',
        status: 'active',
        status_label: 'Ativo',
        created: '2026-11-05T14:30:00Z',
      },
    ])

    render(<SalesDashboard />)

    // Aguarda carregar dados
    await waitFor(() => {
      expect(screen.getByText('Dashboard de Vendas & Assinaturas')).toBeDefined()
    })

    // Cards de métricas
    expect(screen.getByText('Total de Vendas / Assinaturas')).toBeDefined()
    expect(screen.getByText('Receita Acumulada')).toBeDefined()
    expect(screen.getByText('Assinaturas Ativas')).toBeDefined()
    expect(screen.getByText('Suspensas / Expiradas')).toBeDefined()

    // Clientes na tabela
    expect(screen.getByText('Construtora Exemplo')).toBeDefined()
    expect(screen.getByText('Engenharia Alfa')).toBeDefined()

    // Valores acumulados
    expect(screen.getByText('R$ 4.194,00')).toBeDefined()
  })

  it('permite buscar na tabela por cliente ou e-mail', async () => {
    vi.spyOn(salesDashboardService, 'fetchUnifiedSalesData').mockResolvedValue([
      {
        id: 'sale-1',
        source: 'sales',
        customer_name: 'Construtora Exemplo',
        customer_email: 'contato@exemplo.com.br',
        plan: 'MENSAL',
        amount: 297,
        amount_label: 'R$ 297,00',
        module: 'experiencia',
        module_label: 'Avaliação de Experiência',
        status: 'active',
        status_label: 'Ativo',
        created: '2026-11-01T10:00:00Z',
      },
      {
        id: 'sale-2',
        source: 'sales',
        customer_name: 'Engenharia Alfa',
        customer_email: 'financeiro@alfa.com.br',
        plan: 'ANUAL',
        amount: 3897,
        amount_label: 'R$ 3.897,00',
        module: 'combo',
        module_label: 'Combo (Experiência + Desempenho)',
        status: 'active',
        status_label: 'Ativo',
        created: '2026-11-05T14:30:00Z',
      },
    ])

    render(<SalesDashboard />)

    await waitFor(() => {
      expect(screen.getByText('Construtora Exemplo')).toBeDefined()
    })

    const searchInput = screen.getByPlaceholderText(/Buscar por cliente/i)
    fireEvent.change(searchInput, { target: { value: 'Alfa' } })

    // Construtora Exemplo deve ser filtrada
    expect(screen.queryByText('Construtora Exemplo')).toBeNull()
    expect(screen.getByText('Engenharia Alfa')).toBeDefined()
  })
})
