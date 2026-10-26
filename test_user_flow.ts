import pb from './src/lib/pocketbase/client'

async function test() {
  try {
    console.log('Authenticating as admin...')
    const authData = await pb
      .collection('users')
      .authWithPassword('valdknupp@gmail.com', 'Skip@Pass2026!')
    console.log('Logged in as:', authData.record.email, 'profile:', authData.record.profile)

    // Attempt to create a temporary test user
    const testEmail = `test_admin_${Date.now()}@example.com`
    console.log('Attempting to create user:', testEmail)
    const newUser = await pb.collection('users').create({
      name: 'Teste Admin User',
      email: testEmail,
      password: 'TemporaryPass123!',
      passwordConfirm: 'TemporaryPass123!',
      profile: 'VIEWER',
      active: true,
      emailVisibility: false,
    })
    console.log('Successfully created user with ID:', newUser.id)

    // Check reset password
    const tempPass = 'RPontes!' + Math.floor(100000 + Math.random() * 900000)
    console.log('Testing password update...')
    await pb.collection('users').update(newUser.id, {
      password: tempPass,
      passwordConfirm: tempPass,
    })
    console.log('Password updated successfully')

    // Clean up test user
    console.log('Deleting test user...')
    await pb.collection('users').delete(newUser.id)
    console.log('Test user deleted successfully!')

    // Clean up test audit logs created or logout
    pb.authStore.clear()
    console.log('ALL TESTS PASSED!')
  } catch (err: any) {
    console.error('Test failed with error:', err?.message || err)
    if (err?.response?.data) {
      console.error('Details:', JSON.stringify(err.response.data))
    }
  }
}

test()
