import React, { Component, ErrorInfo, ReactNode } from 'react'
import { AlertTriangle, RotateCcw, Home } from 'lucide-react'
import { Button } from '@/components/ui/button'

interface Props {
  children: ReactNode
  fallbackTitle?: string
  fallbackMessage?: string
  onReset?: () => void
  showHomeButton?: boolean
}

interface State {
  hasError: boolean
  error: Error | null
  errorInfo: ErrorInfo | null
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  }

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null }
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    this.setState({ errorInfo })
    console.error('ErrorBoundary capturou erro de renderização:', error, errorInfo)
  }

  public componentDidUpdate(prevProps: Props) {
    // Se mudou de filhos ou de contexto e estava em erro, mas o componente pai ainda está montado
    if (this.state.hasError && prevProps.children !== this.props.children) {
      this.setState({ hasError: false, error: null, errorInfo: null })
    }
  }

  private handleReset = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    if (this.props.onReset) {
      this.props.onReset()
    } else {
      // Tenta re-renderizar ou recarregar estado da tela
      try {
        window.history.pushState(null, '', window.location.href)
      } catch {
        // silencioso
      }
    }
  }

  private handleGoHome = () => {
    this.setState({ hasError: false, error: null, errorInfo: null })
    if (typeof window !== 'undefined') {
      window.location.href = '/dashboard'
    }
  }

  public render() {
    if (this.state.hasError) {
      const isChunkLoadFailed =
        this.state.error?.message?.includes('dynamically imported module') ||
        this.state.error?.message?.includes('Failed to fetch dynamically imported module') ||
        this.state.error?.message?.includes('Loading chunk')

      return (
        <div
          role="alert"
          className="min-h-[360px] w-full flex items-center justify-center p-6 bg-transparent"
        >
          <div className="w-full max-w-lg rounded-2xl border border-red-200 bg-white p-6 sm:p-8 shadow-sm text-center space-y-4">
            <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-red-100 text-red-600">
              <AlertTriangle className="h-7 w-7" />
            </div>

            <div className="space-y-2">
              <h2 className="text-lg font-bold text-gray-900">
                {this.props.fallbackTitle ||
                  (isChunkLoadFailed
                    ? 'Atualização disponível'
                    : 'Ocorreu uma instabilidade nesta tela')}
              </h2>
              <p className="text-sm text-gray-600 leading-relaxed">
                {this.props.fallbackMessage ||
                  (isChunkLoadFailed
                    ? 'Uma nova versão do sistema foi publicada ou a conexão oscilou. Recarregue a página para continuar navegando normalmente.'
                    : 'Não foi possível carregar todas as informações desta seção. Seus dados continuam salvos e você pode tentar novamente ou voltar para a Visão geral.')}
              </p>
            </div>

            {/* Detalhes técnicos colapsados apenas em desenvolvimento / inspeção */}
            {this.state.error?.message && (
              <details
                open
                className="text-left text-xs bg-gray-50 border border-gray-200 rounded-lg p-3 text-gray-700 overflow-auto max-h-48"
              >
                <summary className="cursor-pointer font-medium text-gray-500 hover:text-gray-900">
                  Detalhes técnicos do erro
                </summary>
                <pre className="mt-2 text-[11px] font-mono whitespace-pre-wrap break-all text-red-600">
                  {this.state.error.name}: {this.state.error.message}
                  {this.state.error.stack ? `\n\nStack:\n${this.state.error.stack}` : ''}
                  {this.state.errorInfo?.componentStack
                    ? `\n\nComponent Stack:${this.state.errorInfo.componentStack}`
                    : ''}
                </pre>
              </details>
            )}

            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 pt-2">
              <Button
                onClick={this.handleReset}
                variant="outline"
                className="w-full sm:w-auto border-gray-300 text-gray-800 hover:bg-gray-100 font-medium"
              >
                <RotateCcw className="mr-2 h-4 w-4" />
                Tentar novamente
              </Button>

              {(this.props.showHomeButton ?? true) && (
                <Button
                  onClick={this.handleGoHome}
                  className="w-full sm:w-auto bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] shadow-xs"
                >
                  <Home className="mr-2 h-4 w-4" />
                  Voltar para a Visão geral
                </Button>
              )}
            </div>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}

export default ErrorBoundary
