import React from 'react'
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ErrorBoundary } from '@/components/ErrorBoundary'

// Component that throws on demand
const ProblemChild: React.FC<{ shouldThrow?: boolean }> = ({ shouldThrow }) => {
  if (shouldThrow) {
    throw new Error('Falha de renderização intencional simulada para teste!')
  }
  return <div>Conteúdo normal renderizado</div>
}

describe('ErrorBoundary Component', () => {
  // Silence console.error in tests when testing ErrorBoundary throws
  const originalConsoleError = console.error
  beforeEach(() => {
    console.error = vi.fn()
  })
  afterEach(() => {
    console.error = originalConsoleError
  })

  it('renderiza os filhos normalmente quando não há erro', () => {
    render(
      <ErrorBoundary>
        <ProblemChild shouldThrow={false} />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Conteúdo normal renderizado')).toBeDefined()
  })

  it('captura um throw intencional e exibe mensagem amigável em PT-BR sem tela branca', () => {
    render(
      <ErrorBoundary
        fallbackTitle="Falha de teste customizada"
        fallbackMessage="Mensagem explicativa para o usuário em português."
      >
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>,
    )

    // O filho com erro NÃO deve ser exibido
    expect(screen.queryByText('Conteúdo normal renderizado')).toBeNull()

    // O Error Boundary deve exibir a interface amigável de recuperação
    expect(screen.getByText('Falha de teste customizada')).toBeDefined()
    expect(screen.getByText('Mensagem explicativa para o usuário em português.')).toBeDefined()

    // Deve possuir os botões "Tentar novamente" e "Voltar para a Visão geral"
    expect(screen.getByRole('button', { name: /Tentar novamente/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Voltar para a Visão geral/i })).toBeDefined()
  })

  it('chama onReset quando o usuário clica em Tentar novamente', () => {
    const handleReset = vi.fn()

    render(
      <ErrorBoundary onReset={handleReset}>
        <ProblemChild shouldThrow={true} />
      </ErrorBoundary>,
    )

    const retryBtn = screen.getByRole('button', { name: /Tentar novamente/i })
    fireEvent.click(retryBtn)

    expect(handleReset).toHaveBeenCalledTimes(1)
  })

  it('identifica erro de chunk load e apresenta mensagem orientando recarregamento', () => {
    const ChunkFailChild: React.FC = () => {
      throw new Error('Failed to fetch dynamically imported module: /src/pages/Reports.js')
    }

    render(
      <ErrorBoundary>
        <ChunkFailChild />
      </ErrorBoundary>,
    )

    expect(screen.getByText('Atualização disponível')).toBeDefined()
    expect(screen.getByText(/Uma nova versão do sistema foi publicada/i)).toBeDefined()
  })
})
