import { describe, it, expect } from 'vitest'
import {
  computeExitInviteMetrics,
  buildClosedAnswerDistribution,
  buildScaleAverages,
  buildMonthlyEvolution,
} from './exitInterviewLogic'

const future = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString()
const past = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString()

describe('exitInterviewLogic', () => {
  it('convite com dois canais/reenvios conta UMA vez na taxa de resposta', () => {
    const invites = [
      {
        invite: { id: 'i1', status: 'Respondido', responded_at: '2026-02-10 10:00:00' },
        attempts: [
          {
            id: 'a1',
            channel: 'email',
            status: 'Sucesso',
            recipient: 'x@y.com',
            created: '2026-02-01 09:00:00',
          },
          {
            id: 'a2',
            channel: 'whatsapp',
            status: 'Sucesso',
            recipient: '999',
            created: '2026-02-01 09:01:00',
          },
          {
            id: 'a3',
            channel: 'email',
            status: 'Sucesso',
            recipient: 'x@y.com',
            created: '2026-02-05 09:00:00',
          },
        ],
      },
    ]
    const m = computeExitInviteMetrics(invites)
    expect(m.sent).toBe(1)
    expect(m.responded).toBe(1)
    expect(m.responseRate).toBe(1)
  })

  it('classifica pendente, expirado e falha', () => {
    const invites = [
      {
        invite: { id: 'i1', status: 'Enviado', expires_at: future },
        attempts: [{ id: 'a', channel: 'email', status: 'Sucesso', recipient: '' }],
      },
      {
        invite: { id: 'i2', status: 'Enviado', expires_at: past },
        attempts: [{ id: 'a', channel: 'email', status: 'Sucesso', recipient: '' }],
      },
      { invite: { id: 'i3', status: 'Aguardando envio' }, attempts: [] },
      {
        invite: { id: 'i4', status: 'Enviado' },
        attempts: [{ id: 'a', channel: 'email', status: 'Falha', recipient: '' }],
      },
    ]
    const m = computeExitInviteMetrics(invites)
    expect(m.pending).toBe(1)
    expect(m.expired).toBe(1)
    expect(m.failed).toBe(2)
    expect(m.sent).toBe(2)
    expect(m.responseRate).toBe(0)
  })

  it('buildClosedAnswerDistribution conta opções', () => {
    const dist = buildClosedAnswerDistribution(
      [{ id: 'q1', label: 'Motivo', options: ['A', 'B'], type: 'radio' }],
      [
        { question_id: 'q1', value: JSON.stringify('A') },
        { question_id: 'q1', value: JSON.stringify('A') },
        { question_id: 'q1', value: JSON.stringify('C') },
      ],
    )
    const counts = dist.get('q1')!
    expect(counts.get('A')).toBe(2)
    expect(counts.get('B')).toBe(0)
    expect(counts.get('C')).toBe(1)
  })

  it('buildScaleAverages calcula médias', () => {
    const avg = buildScaleAverages(
      [{ id: 'q1', label: 'Nota', type: 'scale' }],
      [
        { question_id: 'q1', value: '2' },
        { question_id: 'q1', value: '5' },
      ],
    )
    expect(avg.get('q1')).toEqual({ avg: 3.5, count: 2 })
  })

  it('buildMonthlyEvolution usa primeiro envio bem-sucedido e data de conclusão', () => {
    const evo = buildMonthlyEvolution([
      {
        invite: { id: 'i1', status: 'Respondido', responded_at: '2026-03-05 10:00:00.000Z' },
        attempts: [
          {
            id: 'a1',
            channel: 'email',
            status: 'Falha',
            recipient: '',
            created: '2026-01-10 10:00:00.000Z',
          },
          {
            id: 'a2',
            channel: 'email',
            status: 'Sucesso',
            recipient: '',
            created: '2026-02-01 10:00:00.000Z',
          },
        ],
      },
    ])
    expect(evo).toEqual([
      { month: '2026-02', sent: 1, responded: 0 },
      { month: '2026-03', sent: 0, responded: 1 },
    ])
  })
})
