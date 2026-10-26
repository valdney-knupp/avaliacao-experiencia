import { describe, it, expect } from 'vitest'
import {
  parseDateToIso,
  formatDateBR,
  addDaysToIsoDate,
  calculateDeadlineStatus,
  isValidCPF,
  formatCPF,
  maskCPF,
  normalizeSearchText,
} from './dateAndCpfUtils'

describe('Regras Críticas: Validação e Manipulação de Datas DD/MM/AAAA', () => {
  it('preserva rigorosamente as 8 datas obrigatórias sem inversão de mês/dia', () => {
    const testDates = [
      { input: '01/02/2026', expectedIso: '2026-02-01', expectedBR: '01/02/2026' },
      { input: '02/01/2026', expectedIso: '2026-01-02', expectedBR: '02/01/2026' },
      { input: '05/11/2026', expectedIso: '2026-11-05', expectedBR: '05/11/2026' },
      { input: '11/05/2026', expectedIso: '2026-05-11', expectedBR: '11/05/2026' },
      { input: '12/08/2026', expectedIso: '2026-08-12', expectedBR: '12/08/2026' },
      { input: '13/08/2026', expectedIso: '2026-08-13', expectedBR: '13/08/2026' },
      { input: '31/12/2026', expectedIso: '2026-12-31', expectedBR: '31/12/2026' },
      { input: '29/02/2028', expectedIso: '2028-02-29', expectedBR: '29/02/2028' }, // Bissexto
    ]

    for (const item of testDates) {
      const iso = parseDateToIso(item.input)
      expect(iso).toBe(item.expectedIso)
      const br = formatDateBR(iso)
      expect(br).toBe(item.expectedBR)
    }
  })

  it('calcula prazos exatos de 45 e 90 dias corridos a partir da admissão', () => {
    const admission = '2026-01-01' // 01/01/2026
    const deadline45 = addDaysToIsoDate(admission, 45)
    // 01/01 + 45 days: 30 days remaining in Jan -> Feb 15
    expect(deadline45).toBe('2026-02-15')
    expect(formatDateBR(deadline45)).toBe('15/02/2026')

    const deadline90 = addDaysToIsoDate(admission, 90)
    // 01/01 + 90 days: Jan(31) + Feb(28) + 31 in March -> April 1
    expect(deadline90).toBe('2026-04-01')
    expect(formatDateBR(deadline90)).toBe('01/04/2026')
  })

  it('determina corretamente dias restantes e atrasos', () => {
    const deadline = '2026-03-01'
    const beforeDate = '2026-02-25' // 4 days remaining
    const stBefore = calculateDeadlineStatus(deadline, beforeDate)
    expect(stBefore.isOverdue).toBe(false)
    expect(stBefore.daysRemaining).toBe(4)
    expect(stBefore.badgeLabel).toBe('No prazo (4d)')

    const afterDate = '2026-03-05' // 4 days overdue
    const stAfter = calculateDeadlineStatus(deadline, afterDate)
    expect(stAfter.isOverdue).toBe(true)
    expect(stAfter.daysOverdue).toBe(4)
    expect(stAfter.badgeLabel).toBe('Atrasada (4d)')

    // Same day test
    const stToday = calculateDeadlineStatus(deadline, '2026-03-01')
    expect(stToday.isOverdue).toBe(false)
    expect(stToday.daysRemaining).toBe(0)
    expect(stToday.badgeLabel).toBe('Vence hoje')
  })

  it('lida com datas do PocketBase com timestamp ("YYYY-MM-DD HH:mm:ss.sssZ") sem retornar NaN', () => {
    // Caso real relatado pelo usuário:
    // Admissão 10/08/2026, prazo 45 = 24/09/2026, prazo 90 = 08/11/2026
    const pbAdmission = '2026-08-10 00:00:00.000Z'
    const deadline45FromPb = addDaysToIsoDate(pbAdmission, 45)
    expect(deadline45FromPb).toBe('2026-09-24')

    const deadline90FromPb = addDaysToIsoDate(pbAdmission, 90)
    expect(deadline90FromPb).toBe('2026-11-08')

    // Simulando PocketBase retornando campo deadline_45 com timestamp
    const pbDeadline45 = '2026-09-24 00:00:00.000Z'
    const pbDeadline90 = '2026-11-08 00:00:00.000Z'

    // Data de referência de teste: 10/10/2026 (após o prazo de 45 dias, antes do prazo de 90 dias)
    const testReferenceToday = '2026-10-10'

    const st45 = calculateDeadlineStatus(pbDeadline45, testReferenceToday)
    expect(st45.isOverdue).toBe(true)
    expect(st45.daysRemaining).toBe(0)
    expect(st45.daysOverdue).toBe(16) // 24/09 -> 10/10: 6 dias em set + 10 dias em out = 16
    expect(st45.badgeLabel).toBe('Atrasada (16d)')
    expect(st45.badgeLabel).not.toContain('NaN')

    const st90 = calculateDeadlineStatus(pbDeadline90, testReferenceToday)
    expect(st90.isOverdue).toBe(false)
    expect(st90.daysRemaining).toBe(29) // 10/10 -> 08/11: 21 dias em out + 8 dias em nov = 29
    expect(st90.daysOverdue).toBe(0)
    expect(st90.badgeLabel).toBe('No prazo (29d)')
    expect(st90.badgeLabel).not.toContain('NaN')
  })

  it('retorna "Sem prazo" e valores zerados para entradas nulas, vazias ou inválidas', () => {
    expect(calculateDeadlineStatus(null)).toEqual({
      isOverdue: false,
      daysRemaining: 0,
      daysOverdue: 0,
      badgeLabel: 'Sem prazo',
    })
    expect(calculateDeadlineStatus('')).toEqual({
      isOverdue: false,
      daysRemaining: 0,
      daysOverdue: 0,
      badgeLabel: 'Sem prazo',
    })
    expect(calculateDeadlineStatus('data-invalida')).toEqual({
      isOverdue: false,
      daysRemaining: 0,
      daysOverdue: 0,
      badgeLabel: 'Sem prazo',
    })
  })
})

describe('Regras Críticas: Validação de CPF e Segurança', () => {
  it('valida CPF correto e recusa CPFs inválidos ou com todos os dígitos iguais', () => {
    // Standard test CPF (valid)
    expect(isValidCPF('52998224725')).toBe(true)
    // Equal digits invalid
    expect(isValidCPF('11111111111')).toBe(false)
    expect(isValidCPF('00000000000')).toBe(false)
    // Random invalid
    expect(isValidCPF('12345678900')).toBe(false)
  })

  it('formata e mascara CPF corretamente', () => {
    expect(formatCPF('52998224725')).toBe('529.982.247-25')
    expect(maskCPF('52998224725')).toBe('***.***.***-25')
    expect(maskCPF('')).toBe('***.***.***-**')
  })
})

describe('Regras Críticas: Busca Insensível a Acentos e Caixa', () => {
  it('normaliza caracteres diacríticos e caixa alta/baixa', () => {
    const term1 = normalizeSearchText('Váldney')
    const term2 = normalizeSearchText('VALDNEY')
    const term3 = normalizeSearchText('valdney')

    expect(term1).toBe('valdney')
    expect(term2).toBe('valdney')
    expect(term3).toBe('valdney')
    expect(term1).toBe(term2)
  })
})
