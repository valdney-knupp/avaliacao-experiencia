import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import pb from './pocketbase/client'
import PocketBase from 'pocketbase'
import { sha256, encryptCPF } from './dateAndCpfUtils'

describe('ADMIN_ASSISTANT Profile & Notification End-to-End Test', () => {
  let adminClient: PocketBase
  let assistantClient: PocketBase
  const timestamp = Date.now()
  const assistantEmail = `asst_test_${timestamp}@rpontes.com.br`
  const assistantPassword = 'AssistantPass2026!#'
  const worksiteCostCenterId = '9qu0b4lbrv7431c' // BLEND (Obra)
  const otherCostCenterId = 'wnr737mthqa7r5w' // SUMMIT (Obra)

  let createdAssistantId: string
  let createdCollabId: string
  let otherCollabId: string
  let createdEvalId: string

  beforeAll(async () => {
    // 1. Authenticate as Admin
    adminClient = new PocketBase(pb.baseUrl)
    await adminClient.collection('users').authWithPassword('valdknupp@gmail.com', 'Vk@260800')
    expect(adminClient.authStore.isValid).toBe(true)
  })

  afterAll(async () => {
    // Clean up all test data so production has zero test records
    try {
      if (createdEvalId) {
        await adminClient
          .collection('evaluations')
          .delete(createdEvalId)
          .catch(() => {})
      }
      if (createdCollabId) {
        await adminClient
          .collection('collaborators')
          .delete(createdCollabId)
          .catch(() => {})
      }
      if (otherCollabId) {
        await adminClient
          .collection('collaborators')
          .delete(otherCollabId)
          .catch(() => {})
      }
      if (createdAssistantId) {
        await adminClient
          .collection('users')
          .delete(createdAssistantId)
          .catch(() => {})
      }
      // Delete test notifications created during this run
      const testNotifs = await adminClient.collection('notifications').getFullList({
        filter: `subject ~ 'TESTE_ASSISTANT_${timestamp}'`,
      })
      for (const notif of testNotifs) {
        await adminClient
          .collection('notifications')
          .delete(notif.id)
          .catch(() => {})
      }
    } catch (e) {
      console.error('Error during cleanup:', e)
    }
  })

  it('1. creates ADMIN_ASSISTANT user linked to worksite cost center via admin endpoint', async () => {
    const res = await adminClient.send<{
      id: string
      email: string
      profile: string
      cost_center: string
    }>('/backend/v1/admin/users', {
      method: 'POST',
      body: {
        name: `Assistente Teste ${timestamp}`,
        email: assistantEmail,
        password: assistantPassword,
        profile: 'ADMIN_ASSISTANT',
        cost_center: worksiteCostCenterId,
        active: true,
      },
    })

    expect(res).toBeDefined()
    expect(res.id).toBeTruthy()
    expect(res.email).toBe(assistantEmail)
    expect(res.profile).toBe('ADMIN_ASSISTANT')
    expect(res.cost_center).toBe(worksiteCostCenterId)
    createdAssistantId = res.id
  })

  it('2. confirms ADMIN_ASSISTANT can authenticate successfully', async () => {
    assistantClient = new PocketBase(pb.baseUrl)
    const authData = await assistantClient
      .collection('users')
      .authWithPassword(assistantEmail, assistantPassword)
    expect(authData.record.id).toBe(createdAssistantId)
    expect(authData.record.profile).toBe('ADMIN_ASSISTANT')
    expect(authData.record.cost_center).toBe(worksiteCostCenterId)
  })

  it('3. verifies scope isolation: collaborator from another worksite is not visible or accessible', async () => {
    // Admin creates a collaborator in SUMMIT (other cost center)
    const dummyCpf = '11144477735'
    const otherCollab = await adminClient.collection('collaborators').create({
      name: `OTHER_COLLAB_${timestamp}`,
      role: 'SERVENTE',
      cost_center: otherCostCenterId,
      admission_date: '2026-03-01',
      deadline_45: '2026-04-15',
      deadline_90: '2026-05-30',
      situation: 'Em experiência',
      cpf_hash: await sha256(dummyCpf),
      cpf_encrypted: await encryptCPF(dummyCpf),
    })
    otherCollabId = otherCollab.id

    // ADMIN_ASSISTANT attempts to list collaborators: only sees records from BLEND
    const visibleCollabs = await assistantClient.collection('collaborators').getFullList()
    const foundOther = visibleCollabs.find((c) => c.id === otherCollabId)
    expect(foundOther).toBeUndefined()

    // ADMIN_ASSISTANT direct getOne of collaborator in other cost center should fail (404/forbidden)
    let directGetFailed = false
    try {
      await assistantClient.collection('collaborators').getOne(otherCollabId)
    } catch {
      directGetFailed = true
    }
    expect(directGetFailed).toBe(true)
  })

  it('4. confirms ADMIN_ASSISTANT can create collaborator in their own cost center and notification is triggered', async () => {
    const collabCpf = '52998224725'
    const collabName = `TESTE_ASSISTANT_${timestamp}`
    const createdCollab = await assistantClient.collection('collaborators').create({
      name: collabName,
      role: 'PEDREIRO',
      cost_center: worksiteCostCenterId,
      admission_date: '2026-03-01',
      deadline_45: '2026-04-15',
      deadline_90: '2026-05-30',
      situation: 'Em experiência',
      cpf_hash: await sha256(collabCpf),
      cpf_encrypted: await encryptCPF(collabCpf),
      created_by: createdAssistantId,
    })

    expect(createdCollab).toBeDefined()
    expect(createdCollab.id).toBeTruthy()
    expect(createdCollab.name).toBe(collabName)
    createdCollabId = createdCollab.id

    // Check notifications generated by collaborator_notify.js hook
    // It sends to: active ADMIN, active HR, active evaluation managers, plus cost_center email
    const notifs = await adminClient.collection('notifications').getFullList({
      filter: `subject ~ '${collabName}'`,
    })

    expect(notifs.length).toBeGreaterThan(0)
    // Recipients should include admin email (valdknupp@gmail.com) and cost center recipient
    const recipientEmails = notifs.map((n) => n.recipient)
    expect(recipientEmails).toContain('valdknupp@gmail.com')
    // Notifications must have status 'Pendente'
    for (const notif of notifs) {
      expect(notif.status).toBe('Pendente')
      expect(notif.event).toBe('new_collaborator')
      // Ensure CPF is NOT in the subject or body
      expect(notif.body).not.toContain(collabCpf)
    }
  })

  it('5. confirms ADMIN_ASSISTANT CAN create evaluations with responsible name and role', async () => {
    // Assistente administrativo agora pode realizar avaliações para colaboradores da sua obra
    const evalRecord = await assistantClient.collection('evaluations').create({
      collaborator: createdCollabId,
      stage: '45 dias',
      decision: 'EXTEND',
      evaluator: createdAssistantId,
      responsible_name: 'Engenheiro Teste Silva',
      responsible_role: 'Engenheiro Residente',
      evaluated_at: '2026-03-15',
    })

    expect(evalRecord).toBeDefined()
    expect(evalRecord.id).toBeTruthy()
    expect(evalRecord.responsible_name).toBe('Engenheiro Teste Silva')
    expect(evalRecord.responsible_role).toBe('Engenheiro Residente')
    createdEvalId = evalRecord.id
  })

  it('6. verifies evaluation completion notifications triggered when evaluation is completed', async () => {
    // Verify collaborator situation updated to 'Em experiência'
    const updatedCollab = await adminClient.collection('collaborators').getOne(createdCollabId)
    expect(updatedCollab.situation).toBe('Em experiência')

    // Verify evaluation notifications generated by evaluation_complete.js hook
    const evalNotifs = await adminClient.collection('notifications').getFullList({
      filter: `subject ~ 'TESTE_ASSISTANT_${timestamp}' && event = 'eval_45_done'`,
    })

    expect(evalNotifs.length).toBeGreaterThan(0)
    const evalRecipients = evalNotifs.map((n) => n.recipient)
    expect(evalRecipients).toContain('valdknupp@gmail.com')
    for (const n of evalNotifs) {
      expect(n.status).toBe('Pendente')
      expect(n.subject).toContain('Avaliação de 45 dias concluída')
      expect(n.body).toContain('Prorrogar até 90 dias')
      // Validar se o nome e função do responsável estão presentes no corpo do e-mail
      expect(n.body).toContain('• Nome do Responsável pela avaliação: Engenheiro Teste Silva')
      expect(n.body).toContain('• Função do Responsável: Engenheiro Residente')
    }
  })
})
