import React from 'react'
import { Routes, Route, Navigate } from 'react-router-dom'
// Providers de autenticação e tema
import { AuthProvider, useAuth } from '@/hooks/use-auth'
import { ThemeProvider } from '@/hooks/use-theme'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import Layout from '@/components/Layout'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Pages
import { Login } from '@/pages/Login'
import { ForgotPassword } from '@/pages/ForgotPassword'
import { ResetPassword } from '@/pages/ResetPassword'
import { VerifyEmail } from '@/pages/VerifyEmail'
import { ConfirmEmailChange } from '@/pages/ConfirmEmailChange'
import { Sales } from '@/pages/Sales'
import { ThankYou } from '@/pages/ThankYou'

import Dashboard from '@/pages/Dashboard'
import DashboardDetail from '@/pages/DashboardDetail'
import Evaluations from '@/pages/Evaluations'
import PerformanceEvaluation from '@/pages/PerformanceEvaluation'
import ExitInterviewPublic from '@/pages/ExitInterviewPublic'
import Collaborators from '@/pages/Collaborators'
import CollaboratorForm from '@/pages/CollaboratorForm'
import CollaboratorDetail from '@/pages/CollaboratorDetail'
import EvaluateForm from '@/pages/EvaluateForm'
import Admin from '@/pages/Admin'
import DataImport from '@/pages/DataImport'
import Reports from '@/pages/Reports'
import SalesDashboard from '@/pages/SalesDashboard'
import NotFound from '@/pages/NotFound'

/**
 * Rota raiz do sistema:
 * - Se o visitante não está autenticado, renderiza a página de Vendas (Sales).
 * - Se já estiver logado, redireciona de forma suave para o painel interno (/dashboard).
 * - Enquanto carrega a sessão, exibe a página de vendas sem flash ou espera suavemente.
 */
const RootRoute: React.FC = () => {
  const { isAuthenticated, loading, hasExperienciaAccess, hasDesempenhoAccess } = useAuth()

  if (loading) {
    // Durante a validação inicial do token, se ainda estiver pendente, renderiza a Sales
    // para garantir exibição imediata da página de vendas caso o usuário seja visitante.
    return <Sales />
  }

  if (isAuthenticated) {
    if (!hasExperienciaAccess && hasDesempenhoAccess) {
      return <Navigate to="/avaliacao-desempenho" replace />
    }
    return <Navigate to="/dashboard" replace />
  }

  return <Sales />
}

export const App: React.FC = () => {
  return (
    <ErrorBoundary
      fallbackTitle="Corrigi um erro inesperado no aplicativo"
      fallbackMessage="Houve uma falha inesperada na interface. Você pode tentar recarregar ou voltar para a Visão geral com segurança."
    >
      <ThemeProvider>
        <AuthProvider>
          <Routes>
            {/* Public Auth & Sales Routes */}
            {/* Rota raiz "/" como página principal pública de vendas; se o usuário já estiver autenticado, vai direto para o sistema interno (/dashboard) */}
            <Route path="/" element={<RootRoute />} />
            <Route path="/login" element={<Login />} />
            <Route path="/forgot-password" element={<ForgotPassword />} />
            <Route path="/reset-password" element={<ResetPassword />} />
            <Route path="/verify-email" element={<VerifyEmail />} />
            <Route path="/confirm-email-change" element={<ConfirmEmailChange />} />
            <Route path="/vendas" element={<Sales />} />
            <Route path="/obrigado" element={<ThankYou />} />
            <Route path="/entrevista/:token" element={<ExitInterviewPublic />} />

            {/* Authenticated Application Shell */}
            <Route
              element={
                <ProtectedRoute>
                  <Layout />
                </ProtectedRoute>
              }
            >
              <Route
                path="/dashboard"
                element={
                  <ProtectedRoute requiredModule="experiencia">
                    <Dashboard />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/dashboard/detail"
                element={
                  <ProtectedRoute requiredModule="experiencia">
                    <DashboardDetail />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/evaluations"
                element={
                  <ProtectedRoute requiredModule="experiencia">
                    <Evaluations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/evaluations/desligamento"
                element={
                  <ProtectedRoute requiredModule="experiencia">
                    <Evaluations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/avaliacao-experiencia/desligamento"
                element={
                  <ProtectedRoute requiredModule="experiencia">
                    <Evaluations />
                  </ProtectedRoute>
                }
              />
              <Route
                path="/avaliacao-desempenho"
                element={
                  <ProtectedRoute requiredModule="desempenho">
                    <PerformanceEvaluation />
                  </ProtectedRoute>
                }
              />
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
                path="/sales-dashboard"
                element={
                  <ProtectedRoute allowedProfiles={['ADMIN']}>
                    <SalesDashboard />
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
        </AuthProvider>
      </ThemeProvider>
    </ErrorBoundary>
  )
}

export default App
