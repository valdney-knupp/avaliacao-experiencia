import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, UserProfile } from '@/hooks/use-auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedProfiles?: UserProfile[]
  requiredModule?: 'experiencia' | 'desempenho'
  requireMasterUser?: boolean
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({
  children,
  allowedProfiles,
  requiredModule,
  requireMasterUser,
}) => {
  const {
    user,
    loading,
    isAuthenticated,
    hasExperienciaAccess,
    hasDesempenhoAccess,
    isMasterUser,
  } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-screen w-full items-center justify-center bg-[#F5F5F5]">
        <div className="flex flex-col items-center gap-3">
          <div className="h-10 w-10 animate-spin rounded-full border-4 border-[#111111] border-t-[#54D769]" />
          <p className="text-sm text-[#757575]">Carregando sistema...</p>
        </div>
      </div>
    )
  }

  if (!isAuthenticated || !user) {
    return <Navigate to="/login" state={{ from: location }} replace />
  }

  // Verificação de acesso exclusivo do administrador/dono (isMasterUser)
  if (requireMasterUser && !isMasterUser) {
    return <Navigate to="/dashboard" replace />
  }

  if (allowedProfiles && !allowedProfiles.includes(user.profile)) {
    return <Navigate to="/dashboard" replace />
  }

  // Verificação de acesso por módulo contratado
  if (requiredModule === 'experiencia' && !hasExperienciaAccess) {
    // Se tem acesso apenas a Desempenho, redireciona para lá
    if (hasDesempenhoAccess) {
      return <Navigate to="/avaliacao-desempenho" replace />
    }
    return <Navigate to="/login" replace />
  }

  if (requiredModule === 'desempenho' && !hasDesempenhoAccess) {
    // Se tem acesso a Experiência, redireciona para a home/dashboard
    if (hasExperienciaAccess) {
      return <Navigate to="/dashboard" replace />
    }
    return <Navigate to="/login" replace />
  }

  return <>{children}</>
}
