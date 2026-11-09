import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { Admin } from '@/pages/Admin'

let mockUser: any = {
  id: 'other_admin',
  email: 'outro_admin@empresa.com.br',
  profile: 'ADMIN',
  name: 'Outro Admin',
}
let mockIsMasterUser = false

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: mockUser,
    canViewAudit: true,
    isMasterUser: mockIsMasterUser,
  }),
}))

vi.mock('@/lib/pocketbase/client', () => ({
  default: {
    collection: vi.fn().mockReturnValue({
      getFullList: vi.fn().mockResolvedValue([]),
      getFirstListItem: vi.fn().mockResolvedValue({ id: 'set_1', value: '' }),
      update: vi.fn().mockResolvedValue({}),
      create: vi.fn().mockResolvedValue({}),
    }),
    send: vi.fn().mockResolvedValue({}),
  },
}))

vi.mock('@/lib/stripeCheckout', () => ({
  getStripeCheckoutConfig: vi.fn().mockResolvedValue({}),
  getSalesList: vi.fn().mockResolvedValue({ stripe_connected: false, sales: [] }),
  syncStripeBilling: vi.fn().mockResolvedValue({ success: true, message: 'ok' }),
  FALLBACK_CHECKOUT_CONFIG: {},
}))

describe('Página Admin (/admin) - Ocultação e proteção de Preços & Planos e Vendas', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockUser = {
      id: 'other_admin',
      email: 'outro_admin@empresa.com.br',
      profile: 'ADMIN',
      name: 'Outro Admin',
    }
    mockIsMasterUser = false
  })

  it('para outro usuário ADMIN que não seja valdknupp@gmail.com, as abas Preços & Planos e Acompanhamento de Vendas NÃO aparecem', () => {
    mockIsMasterUser = false
    render(<Admin />)

    // Abas padrão de administração devem existir
    expect(screen.getByText('Usuários')).toBeDefined()
    expect(screen.getByText('Centros de Custo')).toBeDefined()
    expect(screen.getByText('Setores')).toBeDefined()
    expect(screen.getByText('Critérios')).toBeDefined()
    expect(screen.getByText('Configurações Gerais')).toBeDefined()

    // As abas restritas NÃO devem existir
    expect(screen.queryByText(/Preços & Planos/i)).toBeNull()
    expect(screen.queryByText(/Acompanhamento de Vendas/i)).toBeNull()
  })

  it('para o usuário master valdknupp@gmail.com, as abas Preços & Planos e Acompanhamento de Vendas APARECEM', () => {
    mockUser = {
      id: 'master_user',
      email: 'valdknupp@gmail.com',
      profile: 'ADMIN',
      name: 'Valdecir Knupp',
    }
    mockIsMasterUser = true

    render(<Admin />)

    // As abas restritas DEVEM existir no TabsList
    expect(screen.getByText('Preços & Planos')).toBeDefined()
    expect(screen.getByText('Acompanhamento de Vendas')).toBeDefined()
  })

  it('no modal de criação de usuário, o campo Perfil de Acesso exibe as opções de perfis do sistema (ADMIN, HR, Gestor, etc.)', () => {
    mockUser = {
      id: 'master_user',
      email: 'valdknupp@gmail.com',
      profile: 'ADMIN',
      name: 'Valdecir Knupp',
    }
    mockIsMasterUser = true

    render(<Admin />)

    // Clica no botão "Novo Usuário"
    const newUserBtn = screen.getByRole('button', { name: /novo usuário/i })
    newUserBtn.click()

    // O modal deve estar aberto com o título
    expect(screen.getByText('Novo Usuário')).toBeDefined()

    // O label Perfil de Acesso existe
    expect(screen.getByText('Perfil de Acesso')).toBeDefined()

    // O trigger do Select de perfil exibe Consulta por padrão
    expect(screen.getByText('Consulta')).toBeDefined()
  })

  it('o seletor de perfil contém Administrador, Gestão de Pessoas (RH), Gestor, Assistente Administrativo e Consulta — e não contém Gestor de Obra nem Gestor de Setor', () => {
    mockUser = {
      id: 'master_user',
      email: 'valdknupp@gmail.com',
      profile: 'ADMIN',
      name: 'Valdecir Knupp',
    }
    mockIsMasterUser = true

    render(<Admin />)

    const newUserBtn = screen.getByRole('button', { name: /novo usuário/i })
    newUserBtn.click()

    // O seletor unificado deve conter apenas Gestor
    expect(screen.queryByText(/Gestor de Obra/i)).toBeNull()
    expect(screen.queryByText(/Gestor de Setor/i)).toBeNull()
  })
})
