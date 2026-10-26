import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { CollaboratorDetail } from '@/pages/CollaboratorDetail'
import pb from '@/lib/pocketbase/client'

// Mock useAuth
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'user_123', email: 'admin@rpontes.com.br', profile: 'ADMIN', name: 'Admin Test' },
    canCreateCollaborator: true,
    canEvaluate: true,
    canAccessAdmin: true,
  }),
}))

describe('CollaboratorDetail — Robustez de Renderização de Critérios', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renderiza e abre critérios com sucesso, suportando critérios de OBRAS, ESCRITORIO e critério inativo/deletado sem quebrar a tela', async () => {
    const mockCollab = {
      id: 'collab_teste_123',
      name: 'FERNANDO SILVA SANTOS',
      role: 'ENGENHEIRO CIVIL',
      admission_date: '2026-08-01',
      deadline_45: '2026-09-15',
      deadline_90: '2026-10-30',
      situation: 'Em experiência',
      expand: {
        cost_center: { id: 'cc_1', name: 'OBRA RESERVA', type: 'Obra' },
        sector: null, // null sector não pode quebrar
      },
    }

    const mockEvaluations = [
      {
        id: 'eval_45_id',
        stage: '45 dias',
        decision: 'EXTEND',
        evaluated_at: '2026-09-14',
        responsible_name: 'Engenheiro Chefe de Obra',
        responsible_role: 'Engenheiro Residente',
        justification: '',
        notes: 'Colaborador demonstrou bom desempenho.',
        expand: {
          evaluator: { name: 'Avaliador Chefe' },
        },
      },
    ]

    // Respostas com critérios pertencentes a OBRAS, ESCRITÓRIO e um critério deletado/sem expand
    const mockAnswers = [
      {
        id: 'ans_1',
        evaluation: 'eval_45_id',
        answer: 'MEETS',
        expand: {
          criterion: {
            id: 'crit_obra',
            name: 'Qualidade e produtividade',
            category: 'OBRAS',
            active: true,
            description: 'Execução das tarefas e entrega nos prazos.',
          },
        },
      },
      {
        id: 'ans_2',
        evaluation: 'eval_45_id',
        answer: 'EXCEEDS',
        expand: {
          criterion: {
            id: 'crit_escritorio',
            name: 'ENTREGA DE RESULTADOS E QUALIDADE DO TRABALHO',
            category: 'ESCRITORIO',
            active: true,
            description: 'Capacidade técnica de escritório.',
          },
        },
      },
      {
        id: 'ans_3',
        evaluation: 'eval_45_id',
        answer: 'PARTIALLY_MEETS',
        expand: {
          criterion: {
            id: 'crit_inativo',
            name: 'Critério Desativado Antigo',
            category: 'OBRAS',
            active: false,
            description: 'Este critério foi desativado nas regras.',
          },
        },
      },
      {
        id: 'ans_4',
        evaluation: 'eval_45_id',
        answer: 'DOES_NOT_MEET',
        criterion_name: 'Critério Legado Sem Relação PB',
        expand: null, // expand ausente ou deletado do banco
      },
    ]

    const mockAuditLogs: any[] = []

    // Mock pb methods
    vi.spyOn(pb, 'collection').mockImplementation((collectionName: string) => {
      if (collectionName === 'collaborators') {
        return {
          getOne: vi.fn().mockResolvedValue(mockCollab),
        } as any
      }
      if (collectionName === 'evaluations') {
        return {
          getFullList: vi.fn().mockResolvedValue(mockEvaluations),
        } as any
      }
      if (collectionName === 'evaluation_answers') {
        return {
          getFullList: vi.fn().mockResolvedValue(mockAnswers),
        } as any
      }
      if (collectionName === 'audit_logs') {
        return {
          getFullList: vi.fn().mockResolvedValue(mockAuditLogs),
        } as any
      }
      return {
        getFullList: vi.fn().mockResolvedValue([]),
        getOne: vi.fn().mockResolvedValue({}),
      } as any
    })

    render(
      <MemoryRouter initialEntries={['/collaborators/collab_teste_123']}>
        <Routes>
          <Route path="/collaborators/:id" element={<CollaboratorDetail />} />
        </Routes>
      </MemoryRouter>,
    )

    // Aguarda carregar dados do colaborador
    await waitFor(() => {
      expect(screen.getByText('FERNANDO SILVA SANTOS')).toBeDefined()
    })

    // Garante que os dados cadastrais carregaram
    expect(screen.getByText('ENGENHEIRO CIVIL')).toBeDefined()
    expect(screen.getByText(/OBRA RESERVA/i)).toBeDefined()
    expect(screen.getByText('Avaliação de 45 dias')).toBeDefined()
    expect(screen.getByText(/Engenheiro Chefe de Obra/i)).toBeDefined()
    expect(screen.getByText(/Engenheiro Residente/i)).toBeDefined()

    // O botão de exibir critérios deve estar visível com a contagem total de 4 respostas
    const toggleButton = screen.getByRole('button', {
      name: /Exibir critérios e notas \(4\)/i,
    })
    expect(toggleButton).toBeDefined()

    // Clica em "Exibir critérios e notas"
    fireEvent.click(toggleButton)

    // Verifica que TODOS os 4 critérios foram renderizados sem crash
    // 1. Critério de Obra
    expect(screen.getByText('Qualidade e produtividade')).toBeDefined()
    // 2. Critério de Escritório
    expect(screen.getByText('ENTREGA DE RESULTADOS E QUALIDADE DO TRABALHO')).toBeDefined()
    // 3. Critério Inativo (com badge "Inativo")
    expect(screen.getByText('Critério Desativado Antigo')).toBeDefined()
    expect(screen.getByText('Inativo')).toBeDefined()
    // 4. Critério Legado sem expand
    expect(screen.getByText('Critério Legado Sem Relação PB')).toBeDefined()

    // Classificações exibidas
    expect(screen.getAllByText('Atende').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Supera').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Atende parcialmente').length).toBeGreaterThan(0)
    expect(screen.getAllByText('Não atende').length).toBeGreaterThan(0)

    // O botão deve alternar para "Ocultar respostas por critério"
    expect(screen.getByRole('button', { name: /Ocultar respostas por critério/i })).toBeDefined()

    // Clica novamente para recolher
    fireEvent.click(screen.getByRole('button', { name: /Ocultar respostas por critério/i }))

    // Critérios devem sumir da tela
    expect(screen.queryByText('Qualidade e produtividade')).toBeNull()
  })
})
