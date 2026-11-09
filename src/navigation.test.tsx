import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { MemoryRouter, Routes, Route, Link, Outlet } from 'react-router-dom'
import Layout from '@/components/Layout'
import { ThemeProvider } from '@/hooks/use-theme'
import pb from '@/lib/pocketbase/client'

// Mock useAuth com perfil de ADMIN para que todas as opções de navegação estejam liberadas
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: 'admin_test_id',
      email: 'admin@rpontes.com.br',
      name: 'Administrador do Sistema',
      profile: 'ADMIN',
    },
    signOut: vi.fn(),
    canAccessAdmin: true,
    canAccessImport: true,
    canExportReports: true,
    canViewAudit: true,
    canCreateCollaborator: true,
    canEvaluate: true,
    isMasterUser: true,
    hasExperienciaAccess: true,
    hasDesempenhoAccess: true,
    experienciaUntil: null,
    desempenhoUntil: null,
  }),
}))

describe('Navegação entre rotas e resiliência de montagem/desmontagem (DOM SafeGuard & ErrorBoundary)', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock pb.collection padrão
    vi.spyOn(pb, 'collection').mockImplementation((collectionName: string) => {
      return {
        getList: vi.fn().mockResolvedValue({ items: [], totalItems: 0 }),
        getFullList: vi.fn().mockResolvedValue([]),
        getOne: vi.fn().mockResolvedValue({
          id: 'collab_1',
          name: 'Colaborador Teste',
          admission_date: '2026-01-01',
          deadline_45: '2026-02-15',
          deadline_90: '2026-04-01',
          situation: 'Em experiência',
          expand: {},
        }),
        subscribe: vi.fn().mockResolvedValue(() => {}),
      } as any
    })
  })

  it('permite transição contínua entre rotas sem disparar erro de unmount / removeChild no ErrorBoundary', async () => {
    // Configura um router em memória simulando navegação pelas rotas principais
    let testNavigate: (path: string) => void = () => {}

    const NavigationHelper: React.FC = () => {
      return (
        <div>
          <nav>
            <Link to="/dashboard">Ir para Dashboard</Link>
            <Link to="/evaluations">Ir para Avaliações</Link>
            <Link to="/collaborators">Ir para Colaboradores</Link>
            <Link to="/collaborators/collab_1">Ir para Detalhes Colaborador</Link>
            <Link to="/admin">Ir para Administração</Link>
            <Link to="/reports">Ir para Relatórios</Link>
          </nav>
        </div>
      )
    }

    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<Layout />}>
              <Route
                path="/dashboard"
                element={
                  <div>
                    <h2>Tela Dashboard</h2>
                    <NavigationHelper />
                  </div>
                }
              />
              <Route
                path="/evaluations"
                element={
                  <div>
                    <h2>Tela Próximas Avaliações</h2>
                    <NavigationHelper />
                  </div>
                }
              />
              <Route
                path="/collaborators"
                element={
                  <div>
                    <h2>Tela Colaboradores</h2>
                    <NavigationHelper />
                  </div>
                }
              />
              <Route
                path="/collaborators/:id"
                element={
                  <div>
                    <h2>Tela Detalhes Colaborador</h2>
                    <NavigationHelper />
                  </div>
                }
              />
              <Route
                path="/admin"
                element={
                  <div>
                    <h2>Tela Administração</h2>
                    <NavigationHelper />
                  </div>
                }
              />
              <Route
                path="/reports"
                element={
                  <div>
                    <h2>Tela Relatórios e Exportação</h2>
                    <NavigationHelper />
                  </div>
                }
              />
            </Route>
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    // Inicialmente no dashboard
    expect(screen.getByText('Tela Dashboard')).toBeDefined()
    expect(screen.queryByText('Falha ao carregar esta página')).toBeNull()

    // 1. Navegar para Avaliações
    await act(async () => {
      screen.getByText('Ir para Avaliações').click()
    })
    expect(screen.getByText('Tela Próximas Avaliações')).toBeDefined()
    expect(screen.queryByText('Falha ao carregar esta página')).toBeNull()

    // 2. Navegar para Colaboradores
    await act(async () => {
      screen.getByText('Ir para Colaboradores').click()
    })
    expect(screen.getByText('Tela Colaboradores')).toBeDefined()
    expect(screen.queryByText('Falha ao carregar esta página')).toBeNull()

    // 3. Navegar para Detalhes do colaborador
    await act(async () => {
      screen.getByText('Ir para Detalhes Colaborador').click()
    })
    expect(screen.getByText('Tela Detalhes Colaborador')).toBeDefined()
    expect(screen.queryByText('Falha ao carregar esta página')).toBeNull()

    // 4. Navegar para Administração
    await act(async () => {
      screen.getByText('Ir para Administração').click()
    })
    expect(screen.getByText('Tela Administração')).toBeDefined()
    expect(screen.queryByText('Falha ao carregar esta página')).toBeNull()

    // 5. Navegar para Relatórios
    await act(async () => {
      screen.getByText('Ir para Relatórios').click()
    })
    expect(screen.getByText('Tela Relatórios e Exportação')).toBeDefined()
    expect(screen.queryByText('Falha ao carregar esta página')).toBeNull()

    // 6. Voltar para o Dashboard
    await act(async () => {
      screen.getByText('Ir para Dashboard').click()
    })
    expect(screen.getByText('Tela Dashboard')).toBeDefined()
    expect(screen.queryByText('Falha ao carregar esta página')).toBeNull()
  })

  it('handleLogout no Layout redireciona para a raiz / (página de vendas)', async () => {
    const mockSignOut = vi.fn().mockResolvedValue({})
    // Renderiza Layout dentro de um MemoryRouter
    render(
      <ThemeProvider>
        <MemoryRouter initialEntries={['/dashboard']}>
          <Routes>
            <Route element={<Layout />}>
              <Route path="/dashboard" element={<div>Conteúdo Interno</div>} />
            </Route>
            <Route path="/" element={<div>Página de Vendas Raiz</div>} />
          </Routes>
        </MemoryRouter>
      </ThemeProvider>,
    )

    // Localiza e clica no botão de logout pelo title/aria-label "Sair do sistema"
    const logoutBtn = screen.getAllByTitle('Sair do sistema')[0]
    expect(logoutBtn).toBeDefined()

    await act(async () => {
      logoutBtn.click()
    })

    // Deve ter navegado para a rota raiz /
    expect(screen.getByText('Página de Vendas Raiz')).toBeDefined()
  })

  it('o DOM SafeGuard trata graciosamente chamadas desalinhadas a removeChild sem lançar DOMException', () => {
    const parentA = document.createElement('div')
    const parentB = document.createElement('div')
    const childNode = document.createElement('span')
    childNode.textContent = 'Texto modificado por tradutor'

    // Anexa o nó ao parentB (simulando tradutor que reparentou dentro de <font>)
    parentB.appendChild(childNode)

    // Tentar remover de parentA (onde o React pensava que o nó ainda estava)
    // Sem o SafeGuard, parentA.removeChild(childNode) lançaria NotFoundError: The node to be removed is not a child of this node
    expect(() => {
      parentA.removeChild(childNode)
    }).not.toThrow()

    // O nó deve ter sido desanexado do parentB
    expect(childNode.parentNode).toBeNull()
  })

  it('o DOM SafeGuard trata graciosamente chamadas a insertBefore com referenceNode reparentado', () => {
    const container = document.createElement('div')
    const subContainer = document.createElement('div')
    container.appendChild(subContainer)

    const refNode = document.createElement('span')
    subContainer.appendChild(refNode)

    const newNode = document.createElement('p')

    // Tentar dar insertBefore no container passando refNode cujo parentNode é subContainer
    expect(() => {
      container.insertBefore(newNode, refNode)
    }).not.toThrow()
  })
})
