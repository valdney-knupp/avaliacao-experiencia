import React from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuth, UserProfile } from '@/hooks/use-auth'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowedProfiles?: UserProfile[]
}

export const ProtectedRoute: React.FC<ProtectedRouteProps> = ({ children, allowedProfiles }) => {
  const { user, loading, isAuthenticated } = useAuth()
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

  if (allowedProfiles && !allowedProfiles.includes(user.profile)) {
    return <Navigate to="/dashboard" replace />
  }

  return <>{children}</>
}
