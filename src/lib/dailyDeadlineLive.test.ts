import { describe, it, expect } from 'vitest'
import pb from './pocketbase/client'
import PocketBase from 'pocketbase'

describe('Daily Deadline Check — Live Backend Endpoint Integration', () => {
  it('executes the /backend/v1/admin/run-deadline-check endpoint in dry_run mode without inserting notifications', async () => {
    const client = new PocketBase(pb.baseUrl)
    await client.collection('users').authWithPassword('valdknupp@gmail.com', 'Vk@260800')
    expect(client.authStore.isValid).toBe(true)

    const beforeNotifs = await client.collection('notifications').getList(1, 1)

    // Call manual check in dry-run mode
    const dryRunRes = await client.send('/backend/v1/admin/run-deadline-check', {
      method: 'POST',
      body: { dry_run: true },
    })

    expect(dryRunRes.success).toBe(true)
    expect(dryRunRes.dry_run).toBe(true)
    expect(dryRunRes.stats).toBeDefined()
    expect(dryRunRes.stats.totalChecked).toBeGreaterThanOrEqual(0)
    expect(dryRunRes.stats.totalErrors).toBe(0)

    // Verify that NO notifications were actually inserted into the database during dry_run
    const afterNotifs = await client.collection('notifications').getList(1, 1)
    expect(afterNotifs.totalItems).toBe(beforeNotifs.totalItems)
  })

  it('rejects unauthenticated requests to /backend/v1/admin/run-deadline-check', async () => {
    const unauthClient = new PocketBase(pb.baseUrl)
    let rejected = false
    try {
      await unauthClient.send('/backend/v1/admin/run-deadline-check', {
        method: 'POST',
        body: { dry_run: true },
      })
    } catch (err: any) {
      rejected = true
      expect(err?.status).toBe(401)
    }
    expect(rejected).toBe(true)
  })
})
