import React from 'react'
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from '@/hooks/use-auth'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Pages
import { Login } from '@/pages/Login'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { ResetPassword } from '@/pages/ResetPassword'
import { VerifyEmail } from '@/pages/VerifyEmail'
import { ConfirmEmailChange } from '@/pages/ConfirmEmailChange'

import Dashboard from '@/pages/Dashboard'
import DashboardDetail from '@/pages/DashboardDetail'
import Evaluations from '@/pages/Evaluations'
import Collaborators from '@/pages/Collaborators'
import CollaboratorForm from '@/pages/CollaboratorForm'
import CollaboratorDetail from '@/pages/CollaboratorDetail'
import EvaluateForm from '@/pages/EvaluateForm'
import Admin from '@/pages/Admin'
import DataImport from '@/pages/DataImport'
import Reports from '@/pages/Reports'
import NotFound from '@/pages/NotFound'

export const App: React.FC = () => {
  return (
    <ErrorBoundary
      fallbackTitle="Corrigi um erro inesperado no aplicativo"
      fallbackMessage="Houve uma falha inesperada na interface. Você pode tentar recarregar ou voltar para a Visão geral com segurança."
    >
      <AuthProvider>
        <BrowserRouter>
          <Routes>
            {/* Public Auth Routes */}
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />

            {/* Authenticated Application Shell */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route path="/" element={<Navigate to="/dashboard" replace />} />
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/dashboard/detail" element={<DashboardDetail />} />
              <Route path="/evaluations" element={<Evaluations />} />
              <Route path="/collaborators" element={<Collaborators />} />
              <Route
                path="/collaborators/new"
                element={
                  <ProtectedRoute allowedProfiles={['ADMIN', 'HR', 'ADMIN_ASSISTANT']}>
                    <CollaboratorForm />
                  </ProtectedRoute>
                }
              />
              <Route path="/collaborators/:id" element={<CollaboratorDetail />} />
              <Route
                path="/collaborators/:id/edit"
                element={
                  <ProtectedRoute allowedProfiles={['ADMIN', 'HR', 'ADMIN_ASSISTANT']}>
                    <CollaboratorForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/collaborators/:id/evaluate"
                element={
                  <ProtectedRoute
                    allowedProfiles={[
                      'ADMIN',
                      'HR',
                      'MANAGER_WORKSITE',
                      'MANAGER_DEPARTMENT',
                      'ADMIN_ASSISTANT',
                    ]}
                  >
                    <EvaluateForm />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/admin"
                element={
                  <ProtectedRoute allowedProfiles={['ADMIN', 'HR']}>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/audit"
                element={
                  <ProtectedRoute allowedProfiles={['ADMIN']}>
                    <Admin />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/import"
                element={
                  <ProtectedRoute allowedProfiles={['ADMIN']}>
                    <DataImport />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/reports"
                element={
                  <ProtectedRoute allowedProfiles={['ADMIN', 'ADMIN_ASSISTANT', 'VIEWER']}>
                    <Reports />
                  </ProtectedRoute>
                }
              />
            </Route>

            {/* Catch-all 404 */}
            <Route path="*" element={<NotFound />} />
          </Routes>
        </BrowserRouter>
      </AuthProvider>
    </ErrorBoundary>
  )
}

export default App
