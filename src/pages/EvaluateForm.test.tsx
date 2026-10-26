import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { MemoryRouter, Route, Routes } from 'react-router-dom'
import { EvaluateForm } from '@/pages/EvaluateForm'
import pb from '@/lib/pocketbase/client'

// Mock useAuth
vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: {
      id: 'user_123',
      email: 'joao.silva@rpontes.com.br',
      profile: 'HR',
      name: 'joão silva',
    },
    canEvaluate: true,
  }),
}))

describe('EvaluateForm — Transformação para Maiúsculas e Responsável', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('converte automaticamente os campos de nome e função do responsável para CAIXA ALTA ao digitar', async () => {
    const mockCollab = {
      id: 'collab_abc_123',
      name: 'Maria Conceição',
      role: 'Assistente Técnica',
      admission_date: '2026-01-10',
      deadline_45: '2026-02-24',
      deadline_90: '2026-04-10',
      situation: 'Em experiência',
      expand: {
        cost_center: { id: 'cc_1', name: 'SEDE ADMINISTRATIVA', type: 'Escritório' },
      },
    }

    const mockCriteria = [
      {
        id: 'crit_1',
        name: 'Proatividade',
        category: 'ESCRITORIO',
        active: true,
        order: 1,
      },
    ]

    vi.spyOn(pb, 'collection').mockImplementation((collectionName: string) => {
      if (collectionName === 'collaborators') {
        return {
          getOne: vi.fn().mockResolvedValue(mockCollab),
        } as any
      }
      if (collectionName === 'evaluations') {
        return {
          getFullList: vi.fn().mockResolvedValue([]),
          create: vi.fn().mockResolvedValue({ id: 'eval_created_1' }),
        } as any
      }
      if (collectionName === 'evaluation_criteria') {
        return {
          getFullList: vi.fn().mockResolvedValue(mockCriteria),
        } as any
      }
      return {
        getFullList: vi.fn().mockResolvedValue([]),
        getOne: vi.fn().mockResolvedValue({}),
      } as any
    })

    render(
      <MemoryRouter initialEntries={['/evaluations/new/collab_abc_123?etapa=45']}>
        <Routes>
          <Route path="/evaluations/new/:id" element={<EvaluateForm />} />
        </Routes>
      </MemoryRouter>,
    )

    // Aguarda carregar dados do formulário
    await waitFor(() => {
      expect(screen.getByText('Maria Conceição')).toBeDefined()
    })

    const nameInput = screen.getByLabelText(
      /Nome do Responsável pela avaliação/i,
    ) as HTMLInputElement
    const roleInput = screen.getByLabelText(/Função do Responsável/i) as HTMLInputElement

    // Os valores iniciais já devem vir em maiúsculas ("JOÃO SILVA" e "GESTÃO DE PESSOAS")
    expect(nameInput.value).toBe('JOÃO SILVA')
    expect(roleInput.value).toBe('GESTÃO DE PESSOAS')

    // Digita em minúsculas com acentos no campo Nome do Responsável
    fireEvent.change(nameInput, { target: { value: 'carlos eduardo de albuquerque açucena' } })
    expect(nameInput.value).toBe('CARLOS EDUARDO DE ALBUQUERQUE AÇUCENA')

    // Digita em minúsculas com acentos no campo Função do Responsável
    fireEvent.change(roleInput, { target: { value: 'engenheiro líder de produção & medição' } })
    expect(roleInput.value).toBe('ENGENHEIRO LÍDER DE PRODUÇÃO & MEDIÇÃO')
  })
})
