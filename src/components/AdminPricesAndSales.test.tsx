import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { AdminPricesAndSales, AdminSalesTracking } from '@/components/AdminPricesAndSales'

// Variável para simular o estado do usuário
let mockIsMasterUser = false

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    isMasterUser: mockIsMasterUser,
  }),
}))

vi.mock('@/lib/stripeCheckout', () => ({
  getStripeCheckoutConfig: vi.fn().mockResolvedValue({}),
  getSalesList: vi.fn().mockResolvedValue({ stripe_connected: false, sales: [] }),
  syncStripeBilling: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  FALLBACK_CHECKOUT_CONFIG: {},
}))

describe('AdminPricesAndSales e AdminSalesTracking - Proteção para valdknupp@gmail.com', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockIsMasterUser = false
  })

  it('não renderiza o componente AdminPricesAndSales se o usuário não for master', () => {
    mockIsMasterUser = false
    const { container } = render(
      <AdminPricesAndSales settings={{}} onSaveSetting={vi.fn()} isSuperAdmin={true} />,
    )
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(/Plano Mensal/i)).toBeNull()
    expect(screen.queryByText(/Plano Anual/i)).toBeNull()
  })

  it('não renderiza o componente AdminSalesTracking se o usuário não for master', () => {
    mockIsMasterUser = false
    const { container } = render(<AdminSalesTracking isSuperAdmin={true} />)
    expect(container.firstChild).toBeNull()
    expect(screen.queryByText(/Histórico de Vendas/i)).toBeNull()
  })

  it('renderiza AdminPricesAndSales quando isMasterUser for true (valdknupp@gmail.com)', () => {
    mockIsMasterUser = true
    render(<AdminPricesAndSales settings={{}} onSaveSetting={vi.fn()} isSuperAdmin={true} />)
    expect(screen.getByText('Plano Mensal')).toBeDefined()
    expect(screen.getByText('Plano Anual')).toBeDefined()
    expect(screen.getByText('Integração Stripe Connect')).toBeDefined()
  })

  it('renderiza AdminSalesTracking quando isMasterUser for true (valdknupp@gmail.com)', () => {
    mockIsMasterUser = true
    render(<AdminSalesTracking isSuperAdmin={true} />)
    expect(screen.getByText('Histórico de Vendas e Assinaturas')).toBeDefined()
    expect(screen.getByText('Total de Assinaturas')).toBeDefined()
  })
})
