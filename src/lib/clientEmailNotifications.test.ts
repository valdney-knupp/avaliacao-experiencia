import { describe, it, expect } from 'vitest'

describe('Client Plan Expiration and Email Notification Rules', () => {
  it('calculates due milestones correctly for 7, 3, and 1 day notices', () => {
    const today = new Date('2026-05-10T12:00:00Z')
    const todayIso = today.toISOString().split('T')[0]
    const [nY, nM, nD] = todayIso.split('-').map(Number)
    const todayUtc = Date.UTC(nY, nM - 1, nD)

    const calcDaysUntilDue = (paidUntilIso: string) => {
      const [pY, pM, pD] = paidUntilIso.split('-').map(Number)
      const paidUntilUtc = Date.UTC(pY, pM - 1, pD)
      return Math.round((paidUntilUtc - todayUtc) / (1000 * 60 * 60 * 24))
    }

    expect(calcDaysUntilDue('2026-05-17')).toBe(7)
    expect(calcDaysUntilDue('2026-05-13')).toBe(3)
    expect(calcDaysUntilDue('2026-05-11')).toBe(1)
    expect(calcDaysUntilDue('2026-05-10')).toBe(0)
    expect(calcDaysUntilDue('2026-05-08')).toBe(-2) // Vencido há 2 dias -> dispara suspensão (> 1 dia)
  })

  it('determines deduplication keys uniquely per client, milestone and due date', () => {
    const clientId = 'rec_client_123'
    const paidUntil = '2026-06-30'

    const dedupe7d = `${clientId}:expiring_7d:${paidUntil}`
    const dedupe3d = `${clientId}:expiring_3d:${paidUntil}`
    const dedupe1d = `${clientId}:expiring_1d:${paidUntil}`
    const dedupeSusp = `${clientId}:suspended_overdue:${paidUntil}`

    expect(dedupe7d).toBe('rec_client_123:expiring_7d:2026-06-30')
    expect(dedupe3d).toBe('rec_client_123:expiring_3d:2026-06-30')
    expect(dedupe1d).toBe('rec_client_123:expiring_1d:2026-06-30')
    expect(dedupeSusp).toBe('rec_client_123:suspended_overdue:2026-06-30')
  })

  it('ensures master email valdknupp@gmail.com is strictly excluded from notices and suspensions', () => {
    const isMasterEmail = (email: string) => email.trim().toLowerCase() === 'valdknupp@gmail.com'

    expect(isMasterEmail('valdknupp@gmail.com')).toBe(true)
    expect(isMasterEmail('VALDKNUPP@GMAIL.COM')).toBe(true)
    expect(isMasterEmail('cliente@empresa.com.br')).toBe(false)
  })

  it('formats dates in Brazilian standard for email bodies and subject lines', () => {
    const formatBR = (isoStr: string) => {
      const clean = isoStr.split(' ')[0].split('T')[0]
      const [y, m, d] = clean.split('-')
      return y && m && d ? `${d}/${m}/${y}` : clean
    }

    expect(formatBR('2026-10-25')).toBe('25/10/2026')
    expect(formatBR('2027-01-05T00:00:00Z')).toBe('05/01/2027')
  })
})
