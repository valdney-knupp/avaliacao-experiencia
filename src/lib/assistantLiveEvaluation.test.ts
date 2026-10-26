import { describe, it, expect, afterAll } from 'vitest'
import PocketBase from 'pocketbase'

describe('Validação ao vivo: Assistente Administrativo e Campos de Responsável', () => {
  const pb = new PocketBase('https://backend-dry-moon-3694.fly.dev')
  const timestamp = Date.now()
  let worksiteCC: any
  let assistantUser: any
  let collab: any
  let evalRecord: any
  let eval90Record: any
  let assistantPb: PocketBase

  it('autentica admin e provisiona dados de teste', async () => {
    await pb.collection('users').authWithPassword('valdknupp@gmail.com', 'Vk@260800')
    expect(pb.authStore.record?.email).toBe('valdknupp@gmail.com')

    worksiteCC = await pb.collection('cost_centers').getFirstListItem("type = 'Obra'")
    expect(worksiteCC).toBeDefined()

    const testAssistantEmail = `teste_assist_${timestamp}@rpontes.com.br`
    const testPassword = 'Password123!'

    assistantUser = await pb.collection('users').create({
      email: testAssistantEmail,
      password: testPassword,
      passwordConfirm: testPassword,
      name: `Assistente Teste ${timestamp}`,
      profile: 'ADMIN_ASSISTANT',
      cost_center: worksiteCC.id,
      active: true,
      verified: true,
    })
    expect(assistantUser.id).toBeTruthy()

    collab = await pb.collection('collaborators').create({
      name: `COLABORADOR TESTE ${timestamp}`,
      cpf_encrypted: `TEST_CPF_${timestamp}`,
      role: 'PEDREIRO',
      admission_date: '2026-09-01',
      cost_center: worksiteCC.id,
      situation: 'Em experiência',
    })
    expect(collab.id).toBeTruthy()

    assistantPb = new PocketBase('https://backend-dry-moon-3694.fly.dev')
    await assistantPb.collection('users').authWithPassword(testAssistantEmail, testPassword)
    expect(assistantPb.authStore.record?.profile).toBe('ADMIN_ASSISTANT')
  })

  it('permite que o Assistente Administrativo grave avaliação de 45 dias com responsável', async () => {
    evalRecord = await assistantPb.collection('evaluations').create({
      collaborator: collab.id,
      stage: '45 dias',
      evaluator: assistantUser.id,
      decision: 'EXTEND',
      responsible_name: 'Engenheiro Marcos Aurélio',
      responsible_role: 'Engenheiro Residente',
      evaluated_at: '2026-10-15',
      notes: 'Avaliação realizada pelo assistente com responsável indicado.',
      origin: 'manual',
    })

    expect(evalRecord.id).toBeTruthy()
    expect(evalRecord.responsible_name).toBe('Engenheiro Marcos Aurélio')
    expect(evalRecord.responsible_role).toBe('Engenheiro Residente')
    expect(evalRecord.stage).toBe('45 dias')
    expect(evalRecord.decision).toBe('EXTEND')

    // Verificar se a notificação foi gerada com os dados do responsável
    const notifs = await pb.collection('notifications').getFullList({
      filter: `event = 'eval_45_done' && dedupe_key ~ '${evalRecord.id}'`,
    })
    expect(notifs.length).toBeGreaterThan(0)
    for (const n of notifs) {
      expect(n.body).toContain('• Nome do Responsável pela avaliação: Engenheiro Marcos Aurélio')
      expect(n.body).toContain('• Função do Responsável: Engenheiro Residente')
    }
  })

  it('permite que o Assistente Administrativo grave avaliação de 90 dias com responsável', async () => {
    eval90Record = await assistantPb.collection('evaluations').create({
      collaborator: collab.id,
      stage: '90 dias',
      evaluator: assistantUser.id,
      decision: 'EFFECTIVATE',
      responsible_name: 'Engenheiro Marcos Aurélio',
      responsible_role: 'Engenheiro Residente',
      evaluated_at: '2026-11-20',
      notes: 'Avaliação de 90 dias efetuada com sucesso.',
      origin: 'manual',
    })

    expect(eval90Record.id).toBeTruthy()
    expect(eval90Record.responsible_name).toBe('Engenheiro Marcos Aurélio')
    expect(eval90Record.responsible_role).toBe('Engenheiro Residente')
    expect(eval90Record.stage).toBe('90 dias')
    expect(eval90Record.decision).toBe('EFFECTIVATE')
  })

  afterAll(async () => {
    if (eval90Record?.id) {
      try {
        await pb.collection('evaluations').delete(eval90Record.id)
      } catch {
        /* intentionally ignored */
      }
    }
    if (evalRecord?.id) {
      try {
        await pb.collection('evaluations').delete(evalRecord.id)
      } catch {
        /* intentionally ignored */
      }
    }
    if (collab?.id) {
      try {
        await pb.collection('collaborators').delete(collab.id)
      } catch {
        /* intentionally ignored */
      }
    }
    if (assistantUser?.id) {
      try {
        await pb.collection('users').delete(assistantUser.id)
      } catch {
        /* intentionally ignored */
      }
    }
  })
})
