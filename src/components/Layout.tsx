import React, { useState, useEffect } from 'react'
import { NavLink, Outlet, useNavigate, useLocation } from 'react-router-dom'
import { useAuth } from '@/hooks/use-auth'
import { useTheme } from '@/hooks/use-theme'
import pb from '@/lib/pocketbase/client'
import {
  LayoutDashboard,
  CalendarCheck,
  Users,
  Settings,
  Upload,
  FileSpreadsheet,
  ShieldCheck,
  LogOut,
  Menu,
  X,
  Bell,
  Sun,
  Moon,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu'
import { formatDateTimeBR } from '@/lib/dateAndCpfUtils'
import { AppLogo } from '@/components/AppLogo'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export const Layout: React.FC = () => {
  const { user, signOut, canAccessAdmin, canAccessImport, canExportReports, canViewAudit } =
    useAuth()
  const { theme, toggleTheme } = useTheme()
  const isDark = theme === 'dark'
  const navigate = useNavigate()
  const location = useLocation()

  const [mobileMenuOpen, setMobileMenuOpen] = useState(false)
  const [notifications, setNotifications] = useState<any[]>([])
  const [unreadCount, setUnreadCount] = useState(0)

  // Profile friendly names
  const profileLabelMap: Record<string, string> = {
    ADMIN: 'Administrador',
    HR: 'Gestão de Pessoas',
    MANAGER_WORKSITE: 'Gestor de Obra',
    MANAGER_DEPARTMENT: 'Gestor de Setor',
    ADMIN_ASSISTANT: 'Assistente Administrativo',
    VIEWER: 'Consulta',
  }

  const friendlyProfile = user?.profile ? profileLabelMap[user.profile] || user.profile : 'Usuário'

  const getUserInitials = (name?: string, email?: string) => {
    if (!name && !email) return 'RP'
    const source = (name?.trim() || email?.trim() || '').replace(/[^a-zA-ZÀ-ÿ0-9\s]/g, '')
    const parts = source.split(/\s+/).filter(Boolean)
    if (parts.length >= 2) {
      return (parts[0][0] + parts[parts.length - 1][0]).toUpperCase()
    }
    return (parts[0]?.slice(0, 2) || 'RP').toUpperCase()
  }

  const userInitials = getUserInitials(user?.name, user?.email)

  // Fetch recent notifications
  const loadNotifications = async () => {
    try {
      const records = await pb.collection('notifications').getList(1, 10, {
        sort: '-created',
      })
      setNotifications(records.items)
      const count = records.items.filter((n) => n.status === 'Pendente').length
      setUnreadCount(count)
    } catch {
      // Ignore background notification fetch errors
    }
  }

  useEffect(() => {
    loadNotifications()

    let unsubscribe: () => void
    pb.collection('notifications')
      .subscribe('*', () => {
        loadNotifications()
      })
      .then((unsub) => {
        unsubscribe = unsub
      })
      .catch(() => {})

    return () => {
      if (unsubscribe) unsubscribe()
    }
  }, [])

  // Close mobile drawer on route change
  useEffect(() => {
    setMobileMenuOpen(false)
  }, [location.pathname])

  const navItems = [
    {
      to: '/dashboard',
      label: 'Visão geral',
      icon: LayoutDashboard,
      show: true,
    },
    {
      to: '/evaluations',
      label: 'Próximas avaliações',
      icon: CalendarCheck,
      show: true,
    },
    {
      to: '/collaborators',
      label: 'Colaboradores',
      icon: Users,
      show: true,
    },
    {
      to: '/admin',
      label: 'Administração',
      icon: Settings,
      show: canAccessAdmin,
    },
    {
      to: '/import',
      label: 'Importação de dados',
      icon: Upload,
      show: canAccessImport,
    },
    {
      to: '/reports',
      label: 'Relatórios e exportação',
      icon: FileSpreadsheet,
      show: canExportReports,
    },
    {
      to: '/audit',
      label: 'Auditoria',
      icon: ShieldCheck,
      show: canViewAudit,
    },
  ]

  const handleLogout = async () => {
    await signOut()
    navigate('/vendas')
  }

  const getPageTitle = () => {
    const path = location.pathname
    if (path.startsWith('/dashboard/detail')) return 'Detalhamento do Indicador'
    if (path === '/dashboard') return 'Visão Geral'
    if (path === '/evaluations') return 'Próximas Avaliações'
    if (path.startsWith('/collaborators/new')) return 'Novo Colaborador'
    if (path.includes('/evaluate')) return 'Avaliação de Desempenho'
    if (path.includes('/edit')) return 'Editar Colaborador'
    if (path.startsWith('/collaborators/')) return 'Detalhes do Colaborador'
    if (path === '/collaborators') return 'Colaboradores'
    if (path === '/admin') return 'Administração do Sistema'
    if (path === '/import') return 'Importação de Planilhas'
    if (path === '/reports') return 'Relatórios e Exportação'
    if (path === '/audit') return 'Trilha de Auditoria'
    return 'Avaliação de Experiência'
  }

  const renderNavLinks = () => (
    <nav className="flex-1 space-y-1.5 px-3 py-4">
      {navItems
        .filter((item) => item.show)
        .map((item) => {
          const Icon = item.icon
          return (
            <NavLink
              key={item.to}
              to={item.to}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3.5 py-2.5 text-sm font-medium transition-all ${
                  isActive
                    ? 'bg-[#54D769] text-slate-950 shadow-sm font-bold'
                    : isDark
                      ? 'text-slate-300 hover:bg-white/10 hover:text-white'
                      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900'
                }`
              }
            >
              <Icon className="h-4 w-4 shrink-0" />
              <span>{item.label}</span>
            </NavLink>
          )
        })}
    </nav>
  )

  return (
    <div className="flex min-h-screen bg-slate-100/70 dark:bg-slate-950 text-slate-900 dark:text-slate-100 transition-colors duration-200 selection:bg-[#54D769]/30 selection:text-current">
      {/* DESKTOP SIDEBAR */}
      <aside className="hidden lg:flex w-64 flex-col fixed inset-y-0 left-0 bg-white dark:bg-[#111512] z-30 border-r border-slate-200 dark:border-white/10 shadow-xs">
        {/* Brand */}
        <div className="flex flex-col border-b border-slate-200 dark:border-white/10 px-5 py-5">
          <div className="flex flex-col items-center text-center">
            <AppLogo
              variant={isDark ? 'dark-bg' : 'light-bg'}
              size="md"
              layout="full"
              align="center"
            />
          </div>
        </div>

        {/* Links */}
        <div className="flex-1 overflow-y-auto">{renderNavLinks()}</div>

        {/* Footer User Info */}
        <div className="shrink-0 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 px-3.5 py-3">
          <div className="flex items-center gap-3">
            <div
              className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full bg-[#54D769] font-bold text-slate-950 text-xs shadow-sm ring-1 ring-black/5 dark:ring-white/10"
              aria-label={user?.name || user?.email || 'Avatar do usuário'}
            >
              {userInitials}
            </div>
            <div className="min-w-0 flex-1">
              <p
                className="truncate text-xs font-semibold text-slate-900 dark:text-white leading-tight"
                title={user?.name || user?.email || ''}
              >
                {user?.name || user?.email || 'Usuário'}
              </p>
              <p
                className="truncate text-[11px] font-medium text-[#2CA840] dark:text-[#54D769] leading-tight mt-0.5"
                title={friendlyProfile}
              >
                {friendlyProfile}
              </p>
            </div>
            <Button
              variant="ghost"
              size="icon"
              onClick={handleLogout}
              className="h-8 w-8 shrink-0 rounded-md text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
              title="Sair do sistema"
              aria-label="Sair do sistema"
            >
              <LogOut className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </aside>

      {/* MOBILE DRAWER */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs lg:hidden transition-opacity"
          onClick={() => setMobileMenuOpen(false)}
        >
          <div
            className="fixed inset-y-0 left-0 w-72 bg-white dark:bg-[#111512] shadow-2xl flex flex-col"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="relative flex items-center justify-center border-b border-slate-200 dark:border-white/10 px-5 py-4">
              <div className="flex flex-col items-center text-center">
                <AppLogo
                  variant={isDark ? 'dark-bg' : 'light-bg'}
                  size="md"
                  layout="full"
                  align="center"
                />
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setMobileMenuOpen(false)}
                className="absolute right-3 top-3 text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white"
              >
                <X className="h-5 w-5" />
              </Button>
            </div>

            <div className="flex-1 overflow-y-auto">{renderNavLinks()}</div>

            <div className="shrink-0 border-t border-slate-200 dark:border-white/10 bg-slate-50 dark:bg-black/40 px-3.5 py-3">
              <div className="flex items-center gap-3">
                <div
                  className="flex h-10 w-10 shrink-0 select-none items-center justify-center rounded-full bg-[#54D769] font-bold text-slate-950 text-xs shadow-sm ring-1 ring-black/5 dark:ring-white/10"
                  aria-label={user?.name || user?.email || 'Avatar do usuário'}
                >
                  {userInitials}
                </div>
                <div className="min-w-0 flex-1">
                  <p
                    className="truncate text-xs font-semibold text-slate-900 dark:text-white leading-tight"
                    title={user?.name || user?.email || ''}
                  >
                    {user?.name || user?.email || 'Usuário'}
                  </p>
                  <p
                    className="truncate text-[11px] font-medium text-[#2CA840] dark:text-[#54D769] leading-tight mt-0.5"
                    title={friendlyProfile}
                  >
                    {friendlyProfile}
                  </p>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={handleLogout}
                  className="h-8 w-8 shrink-0 rounded-md text-slate-500 hover:text-slate-900 dark:text-gray-400 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/10 transition-colors"
                  title="Sair do sistema"
                  aria-label="Sair do sistema"
                >
                  <LogOut className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* MAIN CONTAINER */}
      <div className="flex-1 lg:pl-64 flex flex-col min-h-screen">
        {/* Top Header */}
        <header className="sticky top-0 z-20 flex h-16 items-center justify-between border-b border-slate-200 dark:border-white/10 bg-white/95 dark:bg-[#141815]/95 backdrop-blur-md px-4 sm:px-6 shadow-xs">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileMenuOpen(true)}
              className="lg:hidden p-1.5 rounded-lg text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10"
              aria-label="Abrir menu"
            >
              <Menu className="h-6 w-6" />
            </button>
            <h1 className="text-base sm:text-lg font-bold text-slate-900 dark:text-white">
              {getPageTitle()}
            </h1>
          </div>

          <div className="flex items-center gap-2 sm:gap-3">
            {/* Theme Toggle Button */}
            <button
              onClick={toggleTheme}
              className="flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-slate-200 dark:border-white/15 bg-slate-50 dark:bg-white/5 text-slate-700 dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-white/10 text-xs font-semibold transition-all"
              title={isDark ? 'Mudar para tema claro' : 'Mudar para tema escuro'}
              aria-label="Alternar tema claro/escuro"
            >
              {isDark ? (
                <>
                  <Sun className="h-4 w-4 text-amber-400" />
                  <span className="hidden sm:inline">Tema Claro</span>
                </>
              ) : (
                <>
                  <Moon className="h-4 w-4 text-slate-600" />
                  <span className="hidden sm:inline">Tema Escuro</span>
                </>
              )}
            </button>

            {/* Notification Bell */}
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="relative p-2 rounded-full text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-white/10 hover:text-slate-900 dark:hover:text-white transition-colors"
                  aria-label="Notificações"
                >
                  <Bell className="h-5 w-5" />
                  {unreadCount > 0 && (
                    <span className="absolute top-1.5 right-1.5 flex h-2.5 w-2.5">
                      <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-[#54D769] opacity-75" />
                      <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-[#54D769]" />
                    </span>
                  )}
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-80 max-h-96 overflow-y-auto">
                <DropdownMenuLabel className="flex items-center justify-between">
                  <span>Notificações</span>
                  <span className="text-xs font-normal text-muted-foreground">
                    {notifications.length} registros
                  </span>
                </DropdownMenuLabel>
                <DropdownMenuSeparator />
                {notifications.length === 0 ? (
                  <div className="p-4 text-center text-xs text-muted-foreground">
                    Nenhuma notificação recente.
                  </div>
                ) : (
                  notifications.map((notif) => (
                    <DropdownMenuItem
                      key={notif.id}
                      className="flex flex-col items-start gap-1 p-3 cursor-pointer"
                    >
                      <div className="flex w-full items-center justify-between">
                        <span className="text-xs font-semibold text-foreground line-clamp-1">
                          {notif.subject || 'Notificação'}
                        </span>
                        <span className="text-[10px] text-muted-foreground">
                          {formatDateTimeBR(notif.created)}
                        </span>
                      </div>
                      <p className="text-xs text-muted-foreground line-clamp-2">{notif.body}</p>
                    </DropdownMenuItem>
                  ))
                )}
              </DropdownMenuContent>
            </DropdownMenu>

            {/* User Initials Avatar */}
            <div className="flex items-center gap-2">
              <div className="flex h-9 w-9 shrink-0 select-none items-center justify-center rounded-full bg-[#54D769] font-bold text-slate-950 text-xs shadow-xs">
                {userInitials}
              </div>
              <div className="hidden sm:block text-left max-w-[160px]">
                <p className="truncate text-xs font-semibold text-slate-900 dark:text-white leading-tight">
                  {user?.name || user?.email}
                </p>
                <p className="truncate text-[11px] text-slate-500 dark:text-slate-400">
                  {friendlyProfile}
                </p>
              </div>
            </div>
          </div>
        </header>

        {/* Dynamic Page Content */}
        <main className="flex-1 p-3 sm:p-5 lg:p-6 w-full max-w-full mx-auto">
          <ErrorBoundary
            fallbackTitle="Falha ao carregar esta página"
            fallbackMessage="Não foi possível exibir o conteúdo desta rota. Clique em Tentar novamente ou volte para a Visão geral."
          >
            <Outlet />
          </ErrorBoundary>
        </main>

        {/* Global Footer */}
        <footer className="mt-auto border-t border-slate-200 dark:border-white/10 bg-white dark:bg-[#141815] px-6 py-4 text-xs text-slate-500 dark:text-slate-400 flex flex-col sm:flex-row items-center justify-between gap-2">
          <span>Sistema de Avaliação de Experiência</span>
          <span className="text-slate-400 dark:text-slate-500">v1.2.0 • Gestão de Pessoas</span>
        </footer>
      </div>
    </div>
  )
}

export default Layout
