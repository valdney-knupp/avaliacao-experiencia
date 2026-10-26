import { describe, it, expect } from 'vitest'
import pb from './pocketbase/client'
import PocketBase from 'pocketbase'

describe('Email Notification Templates & Button Specs', () => {
  it('checks that app_url setting exists in database for email templates', async () => {
    const client = new PocketBase(pb.baseUrl)
    await client.collection('users').authWithPassword('valdknupp@gmail.com', 'Vk@260800')
    expect(client.authStore.isValid).toBe(true)

    const setting = await client.collection('settings').getFirstListItem('key="app_url"')
    expect(setting).toBeDefined()
    expect(setting.value).toBe('https://avaliacao-de-experiencia-67c4f.goskip.app')
  })
})
