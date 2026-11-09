import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { MemoryRouter, Routes, Route } from 'react-router-dom'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import { ThemeProvider } from '@/hooks/use-theme'

let mockUser: any = null
let mockIsAuthenticated = false
let mockCanAccessAdmin = false
let mockCanAccessSalesDashboard = false
let mockIsMasterUser = false

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: mockUser,
    loading: false,
    isAuthenticated: mockIsAuthenticated,
    isMasterUser: mockIsMasterUser,
    canAccessAdmin: mockCanAccessAdmin,
    canAccessSalesDashboard: mockCanAccessSalesDashboard,
    canAccessImport: mockUser?.profile === 'ADMIN',
    canExportReports: mockUser?.profile === 'ADMIN',
    canViewAudit: mockIsMasterUser,
    hasExperienciaAccess: true,
    hasDesempenhoAccess: true,
    signOut: vi.fn(),
  }),
}))

describe('Auditoria de Acesso - Controle Estrito para Dono do Sistema (isMasterUser)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('1. Interface (Layout / Sidebar Navigation)', () => {
    it('NÃO exibe Dashboard de Vendas, Administração e Auditoria para perfil HR (Gestão de Pessoas)', () => {
      mockUser = {
        id: 'hr_user',
        email: 'rh@empresa.com.br',
        name: 'Usuário RH',
        profile: 'HR',
      }
      mockIsAuthenticated = true
      mockIsMasterUser = false
      mockCanAccessAdmin = false
      mockCanAccessSalesDashboard = false

      render(
        <ThemeProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Layout />
          </MemoryRouter>
        </ThemeProvider>,
      )

      // Itens permitidos para RH
      expect(screen.getByText('Visão geral')).toBeDefined()
      expect(screen.getByText('Colaboradores')).toBeDefined()

      // Itens restritos que NÃO devem aparecer no menu
      expect(screen.queryByText('Dashboard de Vendas')).toBeNull()
      expect(screen.queryByText('Administração')).toBeNull()
      expect(screen.queryByText('Auditoria')).toBeNull()
    })

    it('NÃO exibe Dashboard de Vendas, Administração e Auditoria para Gestor de Obra ou Departamento', () => {
      mockUser = {
        id: 'manager_user',
        email: 'gestor@empresa.com.br',
        name: 'Gestor da Obra',
        profile: 'MANAGER',
      }
      mockIsAuthenticated = true
      mockIsMasterUser = false
      mockCanAccessAdmin = false
      mockCanAccessSalesDashboard = false

      render(
        <ThemeProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Layout />
          </MemoryRouter>
        </ThemeProvider>,
      )

      expect(screen.queryByText('Dashboard de Vendas')).toBeNull()
      expect(screen.queryByText('Administração')).toBeNull()
      expect(screen.queryByText('Auditoria')).toBeNull()
    })

    it('NÃO exibe Dashboard de Vendas, Administração e Auditoria para conta de ADMIN que não seja o dono', () => {
      mockUser = {
        id: 'other_admin',
        email: 'outro_admin@empresa.com.br',
        name: 'Outro Admin',
        profile: 'ADMIN',
      }
      mockIsAuthenticated = true
      mockIsMasterUser = false
      mockCanAccessAdmin = false
      mockCanAccessSalesDashboard = false

      render(
        <ThemeProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Layout />
          </MemoryRouter>
        </ThemeProvider>,
      )

      expect(screen.queryByText('Dashboard de Vendas')).toBeNull()
      expect(screen.queryByText('Administração')).toBeNull()
      expect(screen.queryByText('Auditoria')).toBeNull()
    })

    it('EXIBE Dashboard de Vendas, Administração e Auditoria para o dono/administrador master (valdknupp@gmail.com)', () => {
      mockUser = {
        id: 'owner_admin',
        email: 'valdknupp@gmail.com',
        name: 'Valdecir Knupp',
        profile: 'ADMIN',
      }
      mockIsAuthenticated = true
      mockIsMasterUser = true
      mockCanAccessAdmin = true
      mockCanAccessSalesDashboard = true

      render(
        <ThemeProvider>
          <MemoryRouter initialEntries={['/dashboard']}>
            <Layout />
          </MemoryRouter>
        </ThemeProvider>,
      )

      expect(screen.getByText('Dashboard de Vendas')).toBeDefined()
      expect(screen.getByText('Administração')).toBeDefined()
      expect(screen.getByText('Auditoria')).toBeDefined()
    })
  })

  describe('2. Link Direto e Redirecionamento (ProtectedRoute)', () => {
    it('redireciona para /dashboard se usuário não-master tentar acessar rota com requireMasterUser (/sales-dashboard)', () => {
      mockUser = {
        id: 'hr_user',
        email: 'rh@empresa.com.br',
        profile: 'HR',
      }
      mockIsAuthenticated = true
      mockIsMasterUser = false

      render(
        <MemoryRouter initialEntries={['/sales-dashboard']}>
          <Routes>
            <Route path="/dashboard" element={<div>Dashboard Principal (Redirecionado)</div>} />
            <Route
              path="/sales-dashboard"
              element={
                <ProtectedRoute allowedProfiles={['ADMIN']} requireMasterUser>
                  <div>Conteúdo Secreto de Vendas</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.queryByText('Conteúdo Secreto de Vendas')).toBeNull()
      expect(screen.getByText('Dashboard Principal (Redirecionado)')).toBeDefined()
    })

    it('redireciona para /dashboard se ADMIN de terceiro tentar acessar /admin com requireMasterUser', () => {
      mockUser = {
        id: 'third_party_admin',
        email: 'admin@cliente.com.br',
        profile: 'ADMIN',
      }
      mockIsAuthenticated = true
      mockIsMasterUser = false

      render(
        <MemoryRouter initialEntries={['/admin']}>
          <Routes>
            <Route path="/dashboard" element={<div>Dashboard Principal (Redirecionado)</div>} />
            <Route
              path="/admin"
              element={
                <ProtectedRoute allowedProfiles={['ADMIN']} requireMasterUser>
                  <div>Painel Admin do Sistema</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.queryByText('Painel Admin do Sistema')).toBeNull()
      expect(screen.getByText('Dashboard Principal (Redirecionado)')).toBeDefined()
    })

    it('permite acesso a /sales-dashboard e /admin quando isMasterUser for true (valdknupp@gmail.com)', () => {
      mockUser = {
        id: 'owner_admin',
        email: 'valdknupp@gmail.com',
        profile: 'ADMIN',
      }
      mockIsAuthenticated = true
      mockIsMasterUser = true

      render(
        <MemoryRouter initialEntries={['/sales-dashboard']}>
          <Routes>
            <Route
              path="/sales-dashboard"
              element={
                <ProtectedRoute allowedProfiles={['ADMIN']} requireMasterUser>
                  <div>Conteúdo Secreto de Vendas</div>
                </ProtectedRoute>
              }
            />
          </Routes>
        </MemoryRouter>,
      )

      expect(screen.getByText('Conteúdo Secreto de Vendas')).toBeDefined()
    })
  })
})
