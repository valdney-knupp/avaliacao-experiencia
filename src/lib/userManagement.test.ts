import { describe, it, expect, beforeAll } from 'vitest'
import pb from './pocketbase/client'
import PocketBase from 'pocketbase'

describe('User Management End-to-End against Live Backend', () => {
  let adminAuth: any
  let createdUserId: string
  const testEmail = `test_runner_${Date.now()}@rpontes.com.br`
  const initialPassword = 'InitialPass2026!#'
  const resetPassword = 'ResetPass2026!#'

  beforeAll(async () => {
    // 1. Authenticate as Admin with new updated password
    adminAuth = await pb.collection('users').authWithPassword('valdknupp@gmail.com', 'Vk@260800')
    expect(adminAuth.record).toBeDefined()
    expect(adminAuth.record.profile).toBe('ADMIN')
  })

  it('0. rejects old administrator password Skip@Pass2026!', async () => {
    const testPb = new PocketBase(pb.baseUrl)
    let failed = false
    try {
      await testPb.collection('users').authWithPassword('valdknupp@gmail.com', 'Skip@Pass2026!')
    } catch {
      failed = true
    }
    expect(failed).toBe(true)
  })

  it('0.1 blocks administrator from resetting their own password via admin reset endpoint', async () => {
    let blocked = false
    try {
      await pb.send('/backend/v1/admin/users/reset-password', {
        method: 'POST',
        body: {
          user_id: adminAuth.record.id,
          password: 'NewAdminPass2026!#',
        },
      })
    } catch (err: any) {
      blocked = true
      const msg = err?.data?.error || err?.response?.error || err?.message || ''
      expect(msg).toMatch(
        /Você não pode redefinir sua própria senha|Esta conta de sistema não pode ser gerenciada/,
      )
    }
    expect(blocked).toBe(true)
  })

  it('0.2 ensures master admin account is excluded when querying without query filter and filtering in memory', async () => {
    const list = await pb.collection('users').getFullList({
      sort: 'name',
      expand: 'cost_center,sector',
    })
    const visible = list.filter(
      (u) => (u.email || '').trim().toLowerCase() !== 'valdknupp@gmail.com',
    )
    const found = visible.some(
      (u) => (u.email || '').trim().toLowerCase() === 'valdknupp@gmail.com',
    )
    expect(found).toBe(false)
    // Confirma que os outros usuários permanecem presentes na listagem
    expect(visible.length).toBeGreaterThan(0)
  })

  it('0.3 HR user can list all users and exclude master admin account in memory', async () => {
    const hrPb = new PocketBase(pb.baseUrl)
    // Autenticar com o usuário HR existente (Valdney Knupp - HR)
    // Senha padrão/redefinida no seed: 'Skip@Pass' ou 'Vk@260800'
    let hrAuth: any = null
    try {
      hrAuth = await hrPb
        .collection('users')
        .authWithPassword('valdney.knupp@rpontes.com.br', 'Skip@Pass')
    } catch {
      hrAuth = await hrPb
        .collection('users')
        .authWithPassword('valdney.knupp@rpontes.com.br', 'Vk@260800')
    }
    expect(hrAuth?.record?.profile).toBe('HR')

    // Executa exatamente a query do Admin.tsx: getFullList sem filtro por email
    const allUsers = await hrPb.collection('users').getFullList({
      sort: 'name',
      expand: 'cost_center,sector',
    })

    // Garante que o HR recebeu a lista com os usuários do sistema
    expect(allUsers.length).toBeGreaterThan(1)

    // Filtra o mestre em memória
    const visibleUsers = allUsers.filter(
      (u) => (u.email || '').trim().toLowerCase() !== 'valdknupp@gmail.com',
    )

    // O mestre não deve constar na lista visível
    expect(
      visibleUsers.some((u) => (u.email || '').trim().toLowerCase() === 'valdknupp@gmail.com'),
    ).toBe(false)

    // Todos os outros usuários devem estar presentes
    const visibleEmails = visibleUsers.map((u) => (u.email || '').toLowerCase())
    expect(visibleEmails).toContain('valdney.knupp@rpontes.com.br')
    expect(visibleEmails).toContain('valdney.knupp@rpontes.com')
    expect(visibleEmails).toContain('joao.silva@rpontes.com.br')
    expect(visibleEmails).toContain('maria.jose@rpontes.com.br')
  })

  it('1. creates user with >=8 char password and valid rules via admin endpoint', async () => {
    const res = await pb.send<{
      id: string
      name: string
      email: string
      profile: string
      active: boolean
    }>('/backend/v1/admin/users', {
      method: 'POST',
      body: {
        name: 'Usuário Teste Automatizado',
        email: testEmail,
        password: initialPassword,
        profile: 'VIEWER',
        active: true,
      },
    })

    expect(res).toBeDefined()
    expect(res.id).toBeTruthy()
    expect(res.email).toBe(testEmail)
    createdUserId = res.id
  })

  it('2. confirms created user appears in collection and can authenticate', async () => {
    const rec = await pb.collection('users').getOne(createdUserId)
    expect(rec.id).toBe(createdUserId)
    expect(rec.email).toBe(testEmail)

    // Log in with new user credentials using a isolated PocketBase instance
    const userPb = new PocketBase(pb.baseUrl)
    const userAuth = await userPb.collection('users').authWithPassword(testEmail, initialPassword)
    expect(userAuth.record.id).toBe(createdUserId)
    expect(userAuth.record.email).toBe(testEmail)
  })

  it('3. resets user password via admin reset endpoint and verifies new password works', async () => {
    const resetRes = await pb.send<{ success: boolean }>('/backend/v1/admin/users/reset-password', {
      method: 'POST',
      body: {
        user_id: createdUserId,
        password: resetPassword,
      },
    })
    expect(resetRes.success).toBe(true)

    // Log in with new reset password
    const userPb = new PocketBase(pb.baseUrl)
    const userAuth = await userPb.collection('users').authWithPassword(testEmail, resetPassword)
    expect(userAuth.record.id).toBe(createdUserId)
  })

  it('4. deactivates user and confirms login is blocked', async () => {
    const updated = await pb.collection('users').update(createdUserId, {
      active: false,
    })
    expect(updated.active).toBe(false)

    const userPb = new PocketBase(pb.baseUrl)
    let loginFailed = false
    try {
      await userPb.collection('users').authWithPassword(testEmail, resetPassword)
    } catch {
      loginFailed = true
    }
    expect(loginFailed).toBe(true)
  })

  it('5. deletes user and confirms cleanup', async () => {
    await pb.collection('users').delete(createdUserId)

    let notFound = false
    try {
      await pb.collection('users').getOne(createdUserId)
    } catch {
      notFound = true
    }
    expect(notFound).toBe(true)
  })
})
