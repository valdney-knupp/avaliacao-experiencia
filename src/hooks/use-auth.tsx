import React, { createContext, useContext, useEffect, useState, useMemo } from 'react'
import pb from '@/lib/pocketbase/client'
import type { RecordModel } from 'pocketbase'

export type UserProfile =
  | 'ADMIN'
  | 'HR'
  | 'MANAGER'
  | 'MANAGER_WORKSITE'
  | 'MANAGER_DEPARTMENT'
  | 'ADMIN_ASSISTANT'
  | 'VIEWER'

export interface AppUser {
  id: string
  email: string
  name: string
  profile: UserProfile
  cost_center?: string
  sector?: string
  active: boolean
  avatar?: string
  last_accessed?: string
  client?: string
  clientRecord?: {
    id: string
    name: string
    active: boolean
    status?: string
    paid_until?: string
    experiencia_until?: string
    desempenho_until?: string
  }
}

export interface AuthContextType {
  user: AppUser | null
  loading: boolean
  isAuthenticated: boolean
  signIn: (email: string, pass: string) => Promise<{ error: Error | null }>
  signOut: () => Promise<void>
  requestPasswordReset: (email: string) => Promise<{ error: Error | null }>
  confirmPasswordReset: (token: string, pass: string) => Promise<{ error: Error | null }>
  requestEmailChange: (newEmail: string) => Promise<{ error: Error | null }>
  confirmEmailChange: (token: string, pass: string) => Promise<{ error: Error | null }>
  canAccessAdmin: boolean
  canAccessSalesDashboard: boolean
  canAccessImport: boolean
  canExportReports: boolean
  canViewAudit: boolean
  canManageUsers: boolean
  canCreateCollaborator: boolean
  canEvaluate: boolean
  canManageExitInvites: boolean
  canViewExitIndividualAnswers: boolean
  isWorksiteManager: boolean
  isAdminAssistant: boolean
  isDepartmentManager: boolean
  scopedCostCenterId: string | undefined
  scopedSectorId: string | undefined
  isMasterUser: boolean
  clientId: string | undefined
  hasExperienciaAccess: boolean
  hasDesempenhoAccess: boolean
  refreshUser: () => Promise<void>
}

const AuthContext = createContext<AuthContextType | undefined>(undefined)

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null)
  const [loading, setLoading] = useState(true)

  const mapPbRecordToAppUser = (rec: RecordModel): AppUser => {
    const clientExpand = rec.expand?.client as RecordModel | undefined
    return {
      id: rec.id,
      email: rec.email || '',
      name: rec.name || rec.email || 'Usuário',
      profile: (rec.profile as UserProfile) || 'VIEWER',
      cost_center: rec.cost_center || undefined,
      sector: rec.sector || undefined,
      active: rec.active !== false,
      avatar: rec.avatar || undefined,
      last_accessed: rec.last_accessed || undefined,
      client: rec.client || undefined,
      clientRecord: clientExpand
        ? {
            id: clientExpand.id,
            name: clientExpand.name || '',
            active: clientExpand.active !== false,
            status: clientExpand.status,
            paid_until: clientExpand.paid_until,
            experiencia_until: clientExpand.experiencia_until,
            desempenho_until: clientExpand.desempenho_until,
          }
        : undefined,
    }
  }

  const handleExpiredSession = (message = 'Sua sessão expirou. Faça login novamente.') => {
    pb.authStore.clear()
    setUser(null)
    try {
      sessionStorage.setItem('auth_expired_message', message)
    } catch {
      // sessionStorage indisponível
    }
    if (typeof window !== 'undefined' && !window.location.pathname.startsWith('/login')) {
      window.location.href = '/login'
    }
  }

  const refreshUser = async () => {
    if (pb.authStore.isValid && pb.authStore.record) {
      try {
        // Validação ativa contra o servidor via authRefresh.
        // Se o tokenKey foi rotacionado (ex: troca/redefinição de senha) ou expirado,
        // o servidor rejeitará com 401/403 e a sessão zumbi é eliminada imediatamente.
        const authData = await pb.collection('users').authRefresh({ expand: 'client' })
        if (authData.record.active === false) {
          handleExpiredSession('Usuário inativo. Contate o administrador.')
          setLoading(false)
          return
        }
        setUser(mapPbRecordToAppUser(authData.record))
      } catch (err: any) {
        const status = err?.status || err?.response?.status
        // Se foi erro de autenticação (401/403) ou token revogado, limpa imediatamente e manda para login
        if (status === 401 || status === 403) {
          handleExpiredSession('Sua sessão expirou. Faça login novamente.')
          setLoading(false)
          return
        }
        // Para erros transitórios de rede (status === 0 ou falha de conexão offline),
        // não derrubar a sessão local imediatamente se o token local ainda for válido
        if (pb.authStore.record) {
          setUser(mapPbRecordToAppUser(pb.authStore.record))
        } else {
          setUser(null)
        }
      }
    } else {
      setUser(null)
    }
    setLoading(false)
  }

  useEffect(() => {
    refreshUser()
    const unsubscribe = pb.authStore.onChange(() => {
      if (!pb.authStore.isValid) {
        setUser(null)
      }
    })

    // Revalidar token ao focar na janela/aba para detectar sessões revogadas em segundo plano,
    // com throttle para evitar rajadas de requisições que interrompam navegações ou falhem temporariamente
    let lastFocusRefresh = 0
    const handleFocus = () => {
      const now = Date.now()
      // Limita revalidação a no máximo 1 vez a cada 60 segundos
      if (now - lastFocusRefresh < 60000) return
      lastFocusRefresh = now

      if (pb.authStore.isValid && pb.authStore.token) {
        pb.collection('users')
          .authRefresh()
          .then((authData) => {
            if (authData.record.active === false) {
              handleExpiredSession('Usuário inativo. Contate o administrador.')
            } else {
              setUser(mapPbRecordToAppUser(authData.record))
            }
          })
          .catch((err: any) => {
            const status = err?.status || err?.response?.status
            // Apenas expira sessão se o servidor ativamente rejeitou com 401 ou 403
            // Erros de rede, abort, timeout ou outros status não derrubam a sessão
            if (status === 401 || status === 403) {
              handleExpiredSession('Sua sessão expirou. Faça login novamente.')
            }
          })
      }
    }

    window.addEventListener('focus', handleFocus)
    return () => {
      unsubscribe()
      window.removeEventListener('focus', handleFocus)
    }
  }, [])

  const signIn = async (email: string, pass: string) => {
    try {
      const cleanEmail = email.trim().toLowerCase()
      const authData = await pb.collection('users').authWithPassword(cleanEmail, pass, {
        expand: 'client',
      })
      if (authData.record.active === false) {
        pb.authStore.clear()
        setUser(null)
        return { error: new Error('Usuário inativo. Contate o administrador.') }
      }
      setUser(mapPbRecordToAppUser(authData.record))
      return { error: null }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'E-mail ou senha inválidos.'
      return { error: new Error(msg) }
    }
  }

  const signOut = async () => {
    try {
      if (user?.id) {
        await pb
          .collection('audit_logs')
          .create({
            user: user.id,
            entity_type: 'users',
            entity_id: user.id,
            action: 'LOGOUT',
            summary: `Logout realizado pelo usuário ${user.email}`,
          })
          .catch(() => {})
      }
    } finally {
      pb.authStore.clear()
      setUser(null)
    }
  }

  const requestPasswordReset = async (email: string) => {
    try {
      await pb.collection('users').requestPasswordReset(email.trim().toLowerCase())
      return { error: null }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  const confirmPasswordReset = async (token: string, pass: string) => {
    try {
      await pb.collection('users').confirmPasswordReset(token, pass, pass)
      return { error: null }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  const requestEmailChange = async (newEmail: string) => {
    try {
      await pb.collection('users').requestEmailChange(newEmail.trim().toLowerCase())
      return { error: null }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  const confirmEmailChange = async (token: string, pass: string) => {
    try {
      await pb.collection('users').confirmEmailChange(token, pass)
      pb.authStore.clear()
      setUser(null)
      return { error: null }
    } catch (err: unknown) {
      return { error: err as Error }
    }
  }

  // Matriz de permissões estrita definida pelo usuário:
  // ADMIN: acesso irrestrito a tudo (Visão geral, Próximas avaliações, Colaboradores, Administração, Importação, Relatórios/Exportação, Auditoria)
  // HR (Gestão de Pessoas): Visão geral, Próximas avaliações, Colaboradores, Administração (sem Importação, sem Relatórios/Exportação, sem Auditoria)
  // MANAGER (e legados MANAGER_WORKSITE & MANAGER_DEPARTMENT): apenas Visão geral, Próximas avaliações, Colaboradores (sem Administração, sem Importação, sem Relatórios/Exportação, sem Auditoria)
  // ADMIN_ASSISTANT & VIEWER (Consulta): permissões mantidas intactas
  // Usuário master de sistema (dono do sistema): exclusivamente valdknupp@gmail.com com perfil ADMIN
  const isMasterUser =
    user?.profile === 'ADMIN' && (user?.email || '').trim().toLowerCase() === 'valdknupp@gmail.com'

  // Acesso à Administração, Auditoria e ao Dashboard de Vendas:
  // Restritos estritamente ao dono do sistema (isMasterUser)
  const canAccessAdmin = isMasterUser
  const canAccessSalesDashboard = isMasterUser
  const canViewAudit = isMasterUser
  const canAccessImport = user?.profile === 'ADMIN'
  const canExportReports =
    user?.profile === 'ADMIN' || user?.profile === 'ADMIN_ASSISTANT' || user?.profile === 'VIEWER'
  const canManageUsers = isMasterUser

  const canCreateCollaborator =
    user?.profile === 'ADMIN' || user?.profile === 'HR' || user?.profile === 'ADMIN_ASSISTANT'
  const canEvaluate =
    user?.profile === 'ADMIN' ||
    user?.profile === 'HR' ||
    user?.profile === 'MANAGER' ||
    user?.profile === 'MANAGER_WORKSITE' ||
    user?.profile === 'MANAGER_DEPARTMENT' ||
    user?.profile === 'ADMIN_ASSISTANT'

  const canManageExitInvites = user?.profile === 'ADMIN' || user?.profile === 'HR'
  const canViewExitIndividualAnswers = user?.profile === 'ADMIN' || user?.profile === 'HR'

  const isWorksiteManager =
    user?.profile === 'MANAGER_WORKSITE' || (user?.profile === 'MANAGER' && !!user?.cost_center)
  const isAdminAssistant = user?.profile === 'ADMIN_ASSISTANT'
  const isDepartmentManager =
    user?.profile === 'MANAGER_DEPARTMENT' || (user?.profile === 'MANAGER' && !!user?.sector)

  const scopedCostCenterId = isWorksiteManager || isAdminAssistant ? user?.cost_center : undefined
  const scopedSectorId = isDepartmentManager ? user?.sector : undefined

  const clientId = user?.client || undefined

  // Lógica de verificação de acesso por módulo para o cliente do usuário:
  // - Usuário master (valdknupp@gmail.com) e contas de sistema sem tenant vinculado têm acesso total a ambos os módulos.
  // - Para usuários vinculados a um client, checamos a data de vigência do módulo e a situação geral do cliente:
  //   * Módulo Experiência: ativo se experiencia_until >= hoje (ou fallback para paid_until) e client ativo.
  //   * Módulo Desempenho: ativo se desempenho_until >= hoje e client ativo.
  const { hasExperienciaAccess, hasDesempenhoAccess } = useMemo(() => {
    if (isMasterUser || !clientId) {
      return { hasExperienciaAccess: true, hasDesempenhoAccess: true }
    }

    const c = user?.clientRecord
    if (!c) {
      // Se não tem expand carregado ainda, concede temporariamente até o refresh
      return { hasExperienciaAccess: true, hasDesempenhoAccess: true }
    }

    // Se cliente está suspenso ou bloqueado
    if (c.active === false || (c.status && c.status !== 'active')) {
      return { hasExperienciaAccess: false, hasDesempenhoAccess: false }
    }

    const nowIso = new Date().toISOString().split('T')[0]

    // Módulo Experiência:
    const expUntil = c.experiencia_until || c.paid_until || ''
    const expIso = expUntil.split(' ')[0].split('T')[0]
    const expOk = !!expIso && expIso >= nowIso

    // Módulo Desempenho:
    const desUntil = c.desempenho_until || ''
    const desIso = desUntil.split(' ')[0].split('T')[0]
    const desOk = !!desIso && desIso >= nowIso

    return {
      hasExperienciaAccess: expOk,
      hasDesempenhoAccess: desOk,
    }
  }, [isMasterUser, clientId, user?.clientRecord])

  const value = useMemo(
    () => ({
      user,
      loading,
      isAuthenticated: !!user,
      signIn,
      signOut,
      requestPasswordReset,
      confirmPasswordReset,
      requestEmailChange,
      confirmEmailChange,
      canAccessAdmin,
      canAccessSalesDashboard,
      canAccessImport,
      canExportReports,
      canViewAudit,
      canManageUsers,
      canCreateCollaborator,
      canEvaluate,
      canManageExitInvites,
      canViewExitIndividualAnswers,
      isWorksiteManager,
      isAdminAssistant,
      isDepartmentManager,
      scopedCostCenterId,
      scopedSectorId,
      isMasterUser,
      clientId,
      hasExperienciaAccess,
      hasDesempenhoAccess,
      refreshUser,
    }),
    [user, loading, isMasterUser, clientId, hasExperienciaAccess, hasDesempenhoAccess],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export const useAuth = () => {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth must be used within an AuthProvider')
  }
  return context
}
