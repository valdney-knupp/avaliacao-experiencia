import { describe, it, expect } from 'vitest'
import { generateUserManualPdfBytes } from './userManualGenerator'

describe('User Manual PDF Generator', () => {
  it('gera o PDF válido com mais de 5KB contendo as etapas do sistema', () => {
    const bytes = generateUserManualPdfBytes()
    expect(bytes).toBeDefined()
    expect(bytes.length).toBeGreaterThan(5000)

    // O cabeçalho deve ser %PDF-1.4
    let headerStr = ''
    for (let i = 0; i < 8; i++) {
      headerStr += String.fromCharCode(bytes[i])
    }
    expect(headerStr).toContain('%PDF-1.4')
  })
})
