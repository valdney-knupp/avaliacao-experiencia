import React from 'react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import { MemoryRouter } from 'react-router-dom'
import { Dashboard } from '@/pages/Dashboard'
import pb from '@/lib/pocketbase/client'

vi.mock('@/hooks/use-auth', () => ({
  useAuth: () => ({
    user: { id: 'admin_id', email: 'admin@rpontes.com.br', profile: 'ADMIN', name: 'Admin Test' },
    scopedCostCenterId: undefined,
    scopedSectorId: undefined,
  }),
}))

describe('Dashboard component test', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders Dashboard with mock data without crashing', async () => {
    const mockCollaborators = [
      {
        id: 'c1',
        name: 'ANTONIO MANUEL MORGADO',
        admission_date: '2026-09-02 00:00:00.000Z',
        deadline_45: '2026-10-17 00:00:00.000Z',
        deadline_90: '2026-12-01 00:00:00.000Z',
        situation: 'Em experiência',
        cost_center: 'b36276uky6giklv',
        sector: 'tk2jkdlyv1ny3vf',
        role: 'ANALISTA DE DADOS',
      },
      {
        id: 'c2',
        name: 'RODRIGO SANTANA VIEIRA',
        admission_date: '2026-09-30 00:00:00.000Z',
        deadline_45: '2026-11-14 00:00:00.000Z',
        deadline_90: '2026-12-29 00:00:00.000Z',
        situation: 'Efetivado',
        cost_center: '9yovqb477ep8st4',
        sector: '',
        role: 'ALMOXARIFE DE OBRAS',
      },
    ]

    const mockCostCenters = [
      { id: 'b36276uky6giklv', name: 'ESCRITÓRIO', type: 'Escritório' },
      { id: '9yovqb477ep8st4', name: 'BLEND GRAND RESERVA', type: 'Obra' },
    ]

    const mockEvaluations = [
      {
        id: 'e1',
        collaborator: 'c1',
        stage: '45 dias',
        decision: 'EXTEND',
        evaluated_at: '2026-10-02 00:00:00.000Z',
      },
    ]

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'collaborators') {
        return {
          getFullList: vi.fn().mockResolvedValue(mockCollaborators),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      if (name === 'cost_centers') {
        return {
          getFullList: vi.fn().mockResolvedValue(mockCostCenters),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      if (name === 'evaluations') {
        return {
          getFullList: vi.fn().mockResolvedValue(mockEvaluations),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      return {
        getFullList: vi.fn().mockResolvedValue([]),
        subscribe: vi.fn().mockResolvedValue(() => {}),
      } as any
    })

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Visão geral')).toBeDefined()
      expect(screen.getByText('ESCRITÓRIO')).toBeDefined()
    })
  })

  it('handles null, undefined or corrupted records defensively without crashing', async () => {
    const corruptCollaborators = [
      null,
      undefined,
      {},
      {
        id: 'corrupt1',
        name: null,
        admission_date: 'invalid-date',
        deadline_45: null,
        deadline_90: undefined,
        situation: 'Em experiência',
        cost_center: null,
        sector: null,
      },
      {
        id: 'corrupt2',
        name: 'Sem situação',
        admission_date: null,
        situation: null,
        cost_center: 'cc_not_found',
      },
    ]

    const corruptCostCenters = [
      null,
      { id: 'cc1', name: null, type: null },
      { id: 'b36276uky6giklv', name: 'ESCRITÓRIO', type: 'Escritório' },
    ]

    const corruptEvaluations = [
      null,
      {},
      { id: 'e_null', collaborator: null, stage: null, decision: null },
    ]

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'collaborators') {
        return {
          getFullList: vi.fn().mockResolvedValue(corruptCollaborators),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      if (name === 'cost_centers') {
        return {
          getFullList: vi.fn().mockResolvedValue(corruptCostCenters),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      if (name === 'evaluations') {
        return {
          getFullList: vi.fn().mockResolvedValue(corruptEvaluations),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      return {
        getFullList: vi.fn().mockResolvedValue([]),
        subscribe: vi.fn().mockResolvedValue(() => {}),
      } as any
    })

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Visão geral')).toBeDefined()
    })
  })

  it('renders correctly with real database patterns: PocketBase UTC timestamps, null sectors, and orphaned cost centers', async () => {
    const realDbCollaborators = [
      {
        id: 'real_1',
        name: 'ANTONIO MANUEL MORGADO',
        admission_date: '2026-09-02 00:00:00.000Z',
        deadline_45: '2026-10-17 00:00:00.000Z',
        deadline_90: '2026-12-01 00:00:00.000Z',
        situation: 'Em experiência',
        cost_center: 'b36276uky6giklv',
        sector: 'tk2jkdlyv1ny3vf',
        role: 'ANALISTA DE DADOS',
        expand: {
          cost_center: { id: 'b36276uky6giklv', name: 'ESCRITÓRIO', type: 'Escritório' },
          sector: { id: 'tk2jkdlyv1ny3vf', name: 'ANÁLISE DE DADOS' },
        },
      },
      {
        id: 'real_2',
        name: 'RODRIGO SANTANA VIEIRA',
        admission_date: '2026-09-30 00:00:00.000Z',
        deadline_45: '2026-11-14 00:00:00.000Z',
        deadline_90: '2026-12-29 00:00:00.000Z',
        situation: 'Efetivado',
        cost_center: '9yovqb477ep8st4',
        sector: '',
        role: 'ALMOXARIFE DE OBRAS',
        expand: {
          cost_center: { id: '9yovqb477ep8st4', name: 'BLEND GRAND RESERVA', type: 'Obra' },
        },
      },
      {
        id: 'real_3',
        name: 'MARCELO VINÍCIUS DIAS',
        admission_date: '2026-08-15 00:00:00.000Z',
        deadline_45: '2026-09-29 00:00:00.000Z',
        deadline_90: '2026-11-13 00:00:00.000Z',
        situation: 'Desligado',
        cost_center: 'rsz2ikgqzctb8pa',
        sector: null,
        role: 'MONTADOR DE ANDAIMES',
      },
      {
        id: 'real_4',
        name: 'ORPHAN COLLABORATOR',
        admission_date: '2026-09-10 00:00:00.000Z',
        deadline_45: '2026-10-25 00:00:00.000Z',
        deadline_90: '2026-12-09 00:00:00.000Z',
        situation: 'Em experiência',
        cost_center: 'non_existent_cc',
        sector: '',
        role: 'PEDREIRO',
      },
    ]

    const realDbCostCenters = [
      { id: 'b36276uky6giklv', name: 'ESCRITÓRIO', type: 'Escritório' },
      { id: '9yovqb477ep8st4', name: 'BLEND GRAND RESERVA', type: 'Obra' },
      { id: 'rsz2ikgqzctb8pa', name: 'SUNRISE', type: 'Obra' },
    ]

    const realDbEvaluations = [
      {
        id: 'eval_1',
        collaborator: 'real_1',
        stage: '45 dias',
        decision: 'EXTEND',
        evaluated_at: '2026-10-02 00:00:00.000Z',
      },
      {
        id: 'eval_2',
        collaborator: 'real_3',
        stage: '45 dias',
        decision: 'TERMINATE',
        evaluated_at: '2026-10-01 00:00:00.000Z',
      },
    ]

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'collaborators') {
        return {
          getFullList: vi.fn().mockResolvedValue(realDbCollaborators),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      if (name === 'cost_centers') {
        return {
          getFullList: vi.fn().mockResolvedValue(realDbCostCenters),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      if (name === 'evaluations') {
        return {
          getFullList: vi.fn().mockResolvedValue(realDbEvaluations),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      return {
        getFullList: vi.fn().mockResolvedValue([]),
        subscribe: vi.fn().mockResolvedValue(() => {}),
      } as any
    })

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Visão geral')).toBeDefined()
      expect(screen.getByText('ESCRITÓRIO')).toBeDefined()
      expect(screen.getByText('SUNRISE')).toBeDefined()
      expect(screen.getByText('Não informado / Outros')).toBeDefined()
    })
  })

  it('calculates cost center breakdown correctly: Total matches sum of statuses and columns are distinct', async () => {
    const testCollaborators = [
      // ESCRITÓRIO: 1 pendente (em experiência, sem avaliações), 1 efetivado (com 45 e 90 feitas)
      {
        id: 'c_esc_1',
        name: 'ANTONIO MANUEL MORGADO',
        situation: 'Efetivado',
        cost_center: 'b36276uky6giklv',
      },
      {
        id: 'c_esc_2',
        name: 'DAYANE GUIMARÃES DE ALMEIDA',
        situation: 'Em experiência',
        cost_center: 'b36276uky6giklv',
      },
      // BLEND GRAND RESERVA: 8 colaboradores (2 pendentes, 3 efetivados, 3 desligados)
      {
        id: 'c_bgr_1',
        name: 'Colab 1',
        situation: 'Em experiência',
        cost_center: '9yovqb477ep8st4',
      },
      {
        id: 'c_bgr_2',
        name: 'Colab 2',
        situation: 'Em experiência',
        cost_center: '9yovqb477ep8st4',
      },
      { id: 'c_bgr_3', name: 'Colab 3', situation: 'Efetivado', cost_center: '9yovqb477ep8st4' },
      { id: 'c_bgr_4', name: 'Colab 4', situation: 'Efetivado', cost_center: '9yovqb477ep8st4' },
      { id: 'c_bgr_5', name: 'Colab 5', situation: 'Efetivado', cost_center: '9yovqb477ep8st4' },
      { id: 'c_bgr_6', name: 'Colab 6', situation: 'Desligado', cost_center: '9yovqb477ep8st4' },
      { id: 'c_bgr_7', name: 'Colab 7', situation: 'Desligado', cost_center: '9yovqb477ep8st4' },
      { id: 'c_bgr_8', name: 'Colab 8', situation: 'Desligado', cost_center: '9yovqb477ep8st4' },
    ]

    const testCostCenters = [
      { id: 'b36276uky6giklv', name: 'ESCRITÓRIO', type: 'Escritório' },
      { id: '9yovqb477ep8st4', name: 'BLEND GRAND RESERVA', type: 'Obra' },
    ]

    const testEvaluations = [
      { id: 'e1', collaborator: 'c_esc_1', stage: '45 dias', decision: 'EXTEND' },
      { id: 'e2', collaborator: 'c_esc_1', stage: '90 dias', decision: 'EFFECTIVATE' },
      // c_bgr_1 tem 45 dias feita
      { id: 'e3', collaborator: 'c_bgr_1', stage: '45 dias', decision: 'EXTEND' },
      // c_bgr_3 tem 45 e 90 feitas
      { id: 'e4', collaborator: 'c_bgr_3', stage: '45 dias', decision: 'EXTEND' },
      { id: 'e5', collaborator: 'c_bgr_3', stage: '90 dias', decision: 'EFFECTIVATE' },
      // c_bgr_6 desligado na 45
      { id: 'e6', collaborator: 'c_bgr_6', stage: '45 dias', decision: 'TERMINATE' },
    ]

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'collaborators') {
        return {
          getFullList: vi.fn().mockResolvedValue(testCollaborators),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      if (name === 'cost_centers') {
        return {
          getFullList: vi.fn().mockResolvedValue(testCostCenters),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      if (name === 'evaluations') {
        return {
          getFullList: vi.fn().mockResolvedValue(testEvaluations),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      return {
        getFullList: vi.fn().mockResolvedValue([]),
        subscribe: vi.fn().mockResolvedValue(() => {}),
      } as any
    })

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Detalhamento por Centro de Custo')).toBeDefined()
      expect(screen.getByText('Como entender os números:')).toBeDefined()
      expect(screen.getByText('45d Concluídas')).toBeDefined()
      expect(screen.getByText('90d Concluídas')).toBeDefined()
    })

    // Na tabela da versão 0.0.41 restaurada, os cabeçalhos "Pendentes", "Efetivados", "Desligados" e "Total" estão no thead
    const tableHeader = screen.getByRole('table').querySelector('thead')
    expect(tableHeader).not.toBeNull()
    expect(tableHeader?.textContent).toContain('Pendentes')
    expect(tableHeader?.textContent).toContain('Efetivados')
    expect(tableHeader?.textContent).toContain('Desligados')
    expect(tableHeader?.textContent).toContain('Total')
    expect(tableHeader?.textContent).toContain('45d Concluídas')
    expect(tableHeader?.textContent).toContain('90d Concluídas')
  })

  it('exibe coluna Outros dinamicamente apenas quando houver colaboradores inativos ou sem situação', async () => {
    const collabsWithoutOther = [
      { id: 'c1', name: 'Ativo', situation: 'Em experiência', cost_center: 'cc1' },
      { id: 'c2', name: 'Efetivo', situation: 'Efetivado', cost_center: 'cc1' },
    ]

    const collabsWithOther = [
      { id: 'c1', name: 'Ativo', situation: 'Em experiência', cost_center: 'cc1' },
      { id: 'c2', name: 'Inativo', situation: 'Inativo', cost_center: 'cc1' },
    ]

    const costCenters = [{ id: 'cc1', name: 'OBRA 1', type: 'Obra' }]

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'collaborators') {
        return {
          getFullList: vi.fn().mockResolvedValue(collabsWithoutOther),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      if (name === 'cost_centers') {
        return {
          getFullList: vi.fn().mockResolvedValue(costCenters),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      return {
        getFullList: vi.fn().mockResolvedValue([]),
        subscribe: vi.fn().mockResolvedValue(() => {}),
      } as any
    })

    const { rerender } = render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Detalhamento por Centro de Custo')).toBeDefined()
    })

    let thead = screen.getByRole('table').querySelector('thead')
    expect(thead?.textContent).not.toContain('Outros')

    // Agora testa com colaborador Inativo (deve exibir coluna Outros)
    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'collaborators') {
        return {
          getFullList: vi.fn().mockResolvedValue(collabsWithOther),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      if (name === 'cost_centers') {
        return {
          getFullList: vi.fn().mockResolvedValue(costCenters),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      return {
        getFullList: vi.fn().mockResolvedValue([]),
        subscribe: vi.fn().mockResolvedValue(() => {}),
      } as any
    })

    rerender(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      const updatedThead = screen.getByRole('table').querySelector('thead')
      expect(updatedThead?.textContent).toContain('Outros')
    })
  })

  it('handles completely corrupt real-world edge cases (null records, empty dates, orphan items) without breaking the page', async () => {
    const corruptCollaborators = [
      null,
      undefined,
      {
        id: 'collab_corrupt_1',
        name: 'Registro Corrompido Sem Datas',
        role: 'Ajudante',
        cost_center: '',
        sector: '',
        admission_date: '',
        deadline_45: '',
        deadline_90: '',
        situation: 'Em experiência',
      },
      {
        id: 'collab_corrupt_2',
        name: 'Registro com Data com Horário ISO',
        role: 'Pedreiro',
        cost_center: 'cc_deleted_orphan',
        sector: 'sec_deleted_orphan',
        admission_date: '2026-09-24 00:00:00.000Z',
        deadline_45: '2026-11-08 00:00:00.000Z',
        deadline_90: '2026-12-23 00:00:00.000Z',
        situation: 'Em experiência',
      },
      {
        id: 'collab_corrupt_3',
        name: 'Registro Situação Nula',
        role: null,
        cost_center: null,
        sector: null,
        admission_date: null,
        deadline_45: null,
        deadline_90: null,
        situation: null,
      },
    ]

    const corruptEvaluations = [
      null,
      {
        id: 'eval_unknown_stage',
        collaborator: 'collab_corrupt_2',
        stage: 'Etapa Desconhecida',
        decision: 'UNKNOWN',
        evaluated_at: '2026-10-10 00:00:00.000Z',
      },
      {
        id: 'eval_orphan_null',
        collaborator: null,
        stage: null,
        decision: null,
        evaluated_at: null,
      },
    ]

    vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
      if (name === 'collaborators') {
        return {
          getFullList: vi.fn().mockResolvedValue(corruptCollaborators),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      if (name === 'cost_centers') {
        return {
          getFullList: vi
            .fn()
            .mockResolvedValue([null, { id: 'cc1', name: 'OBRA 1', type: 'Obra' }]),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      if (name === 'evaluations') {
        return {
          getFullList: vi.fn().mockResolvedValue(corruptEvaluations),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      }
      return {
        getFullList: vi.fn().mockResolvedValue([]),
        subscribe: vi.fn().mockResolvedValue(() => {}),
      } as any
    })

    render(
      <MemoryRouter>
        <Dashboard />
      </MemoryRouter>,
    )

    await waitFor(() => {
      expect(screen.getByText('Visão geral')).toBeDefined()
    })

    expect(screen.queryByText('Corrigi um erro inesperado no aplicativo')).toBeNull()
  })

  describe('Card Desligados - Percentuais por etapa (45 dias e 90 dias)', () => {
    it('exibe "—" para percentuais quando o total de desligados for zero', async () => {
      const collabs = [
        {
          id: 'c1',
          name: 'Colaborador Ativo',
          situation: 'Em experiência',
          deadline_45: '2026-10-20',
          deadline_90: '2026-12-04',
        },
      ]

      vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
        if (name === 'collaborators') {
          return {
            getFullList: vi.fn().mockResolvedValue(collabs),
            subscribe: vi.fn().mockResolvedValue(() => {}),
          } as any
        }
        return {
          getFullList: vi.fn().mockResolvedValue([]),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      })

      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.getByText('Desligados')).toBeDefined()
      })

      // O card de desligados deve exibir '45 dias:' e '90 dias:' com '—'
      expect(screen.getByText('45 dias:')).toBeDefined()
      expect(screen.getByText('90 dias:')).toBeDefined()
      const dashes = screen.getAllByText('—')
      expect(dashes.length).toBeGreaterThanOrEqual(2)
    })

    it('calcula 100% na etapa 45 e 0% na etapa 90 quando todos foram desligados na 45', async () => {
      const collabs = [
        { id: 'c_desl_1', name: 'Desligado Um', situation: 'Desligado' },
        { id: 'c_desl_2', name: 'Desligado Dois', situation: 'Desligado' },
      ]

      const evals = [
        { id: 'e1', collaborator: 'c_desl_1', stage: '45 dias', decision: 'TERMINATE' },
        { id: 'e2', collaborator: 'c_desl_2', stage: '45 dias', decision: 'TERMINATE' },
      ]

      vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
        if (name === 'collaborators') {
          return {
            getFullList: vi.fn().mockResolvedValue(collabs),
            subscribe: vi.fn().mockResolvedValue(() => {}),
          } as any
        }
        if (name === 'evaluations') {
          return {
            getFullList: vi.fn().mockResolvedValue(evals),
            subscribe: vi.fn().mockResolvedValue(() => {}),
          } as any
        }
        return {
          getFullList: vi.fn().mockResolvedValue([]),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      })

      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.getByText('Desligados')).toBeDefined()
      })

      expect(screen.getByText('100%')).toBeDefined()
      expect(screen.getByText('0%')).toBeDefined()
    })

    it('calcula 0% na etapa 45 e 100% na etapa 90 quando todos foram desligados na 90', async () => {
      const collabs = [{ id: 'c_desl_1', name: 'Desligado Um', situation: 'Desligado' }]

      const evals = [
        { id: 'e1', collaborator: 'c_desl_1', stage: '90 dias', decision: 'TERMINATE' },
      ]

      vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
        if (name === 'collaborators') {
          return {
            getFullList: vi.fn().mockResolvedValue(collabs),
            subscribe: vi.fn().mockResolvedValue(() => {}),
          } as any
        }
        if (name === 'evaluations') {
          return {
            getFullList: vi.fn().mockResolvedValue(evals),
            subscribe: vi.fn().mockResolvedValue(() => {}),
          } as any
        }
        return {
          getFullList: vi.fn().mockResolvedValue([]),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      })

      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.getByText('Desligados')).toBeDefined()
      })

      expect(screen.getByText('0%')).toBeDefined()
      expect(screen.getByText('100%')).toBeDefined()
    })

    it('calcula percentuais distribuídos (ex.: 50% / 50%) e trata casos com desligamento nas duas etapas atribuindo à 45', async () => {
      const collabs = [
        { id: 'c_desl_45', name: 'Desligado 45', situation: 'Desligado' },
        { id: 'c_desl_90', name: 'Desligado 90', situation: 'Desligado' },
        { id: 'c_desl_both', name: 'Desligado Ambas', situation: 'Desligado' },
        { id: 'c_desl_only90', name: 'Outro Desligado 90', situation: 'Desligado' },
      ]

      const evals = [
        { id: 'e1', collaborator: 'c_desl_45', stage: '45 dias', decision: 'TERMINATE' },
        { id: 'e2', collaborator: 'c_desl_90', stage: '90 dias', decision: 'TERMINATE' },
        // c_desl_both tem desligamento em ambas as etapas -> deve ser computado na 45
        { id: 'e3_a', collaborator: 'c_desl_both', stage: '45 dias', decision: 'TERMINATE' },
        { id: 'e3_b', collaborator: 'c_desl_both', stage: '90 dias', decision: 'TERMINATE' },
        { id: 'e4', collaborator: 'c_desl_only90', stage: '90 dias', decision: 'TERMINATE' },
      ]

      // Total = 4. 45 dias: 2 (c_desl_45 e c_desl_both) => 50%. 90 dias: 2 (c_desl_90 e c_desl_only90) => 50%.

      vi.spyOn(pb, 'collection').mockImplementation((name: string) => {
        if (name === 'collaborators') {
          return {
            getFullList: vi.fn().mockResolvedValue(collabs),
            subscribe: vi.fn().mockResolvedValue(() => {}),
          } as any
        }
        if (name === 'evaluations') {
          return {
            getFullList: vi.fn().mockResolvedValue(evals),
            subscribe: vi.fn().mockResolvedValue(() => {}),
          } as any
        }
        return {
          getFullList: vi.fn().mockResolvedValue([]),
          subscribe: vi.fn().mockResolvedValue(() => {}),
        } as any
      })

      render(
        <MemoryRouter>
          <Dashboard />
        </MemoryRouter>,
      )

      await waitFor(() => {
        expect(screen.getByText('Desligados')).toBeDefined()
      })

      const fiftyPcts = screen.getAllByText('50%')
      expect(fiftyPcts.length).toBe(2)
    })
  })
})
