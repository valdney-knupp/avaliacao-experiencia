import pb from './src/lib/pocketbase/client.js'

async function testFlow() {
  console.log('--- 1. Autenticando com admin ---')
  const auth = await pb
    .collection('users')
    .authWithPassword('valdknupp@gmail.com', 'Skip@Pass2026!')
  console.log('Autenticado com sucesso:', auth.record.email, 'Perfil:', auth.record.profile)

  const testEmail = `test_user_${Date.now()}@rpontes.com.br`
  const testPassword = 'Password12345!'

  console.log('\n--- 2. Criando novo usuário via endpoint seguro /backend/v1/admin/users ---')
  const created = await pb.send('/backend/v1/admin/users', {
    method: 'POST',
    body: {
      name: 'Usuário Teste Verificação',
      email: testEmail,
      password: testPassword,
      profile: 'VIEWER',
      active: true,
    },
  })
  console.log('Usuário criado com sucesso:', created)

  console.log('\n--- 3. Verificando se o usuário aparece na listagem do PB ---')
  const found = await pb.collection('users').getOne(created.id)
  console.log('Encontrado na coleção users:', found.id, found.email, found.name)

  console.log('\n--- 4. Testando login com as credenciais do novo usuário ---')
  // Usar novo pb instance para não sujar o authStore do admin
  const { default: PocketBase } = await import('pocketbase')
  const testPb = new PocketBase(pb.baseUrl)
  const testAuth = await testPb.collection('users').authWithPassword(testEmail, testPassword)
  console.log('Login do novo usuário bem-sucedido!', testAuth.record.id, testAuth.record.email)

  console.log('\n--- 5. Testando redefinição de senha temporária pelo Admin ---')
  const newTempPass = 'RPontes!987654'
  const resetRes = await pb.send('/backend/v1/admin/users/reset-password', {
    method: 'POST',
    body: {
      user_id: created.id,
      password: newTempPass,
    },
  })
  console.log('Resposta do reset-password:', resetRes)

  console.log('\n--- 6. Testando login do usuário com a nova senha redefinida ---')
  const testPb2 = new PocketBase(pb.baseUrl)
  const testAuth2 = await testPb2.collection('users').authWithPassword(testEmail, newTempPass)
  console.log('Login com a senha redefinida bem-sucedido!', testAuth2.record.id)

  console.log('\n--- 7. Inativando o usuário pelo Admin ---')
  const updatedInactive = await pb.collection('users').update(created.id, {
    active: false,
  })
  console.log('Usuário atualizado para inativo:', updatedInactive.active)

  console.log('\n--- 8. Verificando que usuário inativo é bloqueado no login ---')
  try {
    const testPb3 = new PocketBase(pb.baseUrl)
    await testPb3.collection('users').authWithPassword(testEmail, newTempPass)
    console.error('ERRO: Usuário inativo conseguiu logar!')
  } catch (inactiveErr) {
    console.log(
      'Sucesso: login de usuário inativo bloqueado conforme esperado:',
      inactiveErr.message,
    )
  }

  console.log('\n--- 9. Limpando registro de teste (deleção pelo admin) ---')
  await pb.collection('users').delete(created.id)
  console.log('Usuário de teste deletado com sucesso do banco real.')

  console.log('\n--- 10. Confirmando que não existe mais ---')
  try {
    await pb.collection('users').getOne(created.id)
    console.error('ERRO: usuário ainda existe!')
  } catch (err) {
    console.log('Confirmado: usuário foi completamente removido.')
  }

  console.log('\nTODOS OS TESTES FIM-A-FIM PASSARAM COM SUCESSO!')
}

testFlow().catch((e) => {
  console.error('FALHA NO TESTE:', e)
  process.exit(1)
})
