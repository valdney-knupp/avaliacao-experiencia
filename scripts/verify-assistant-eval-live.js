import PocketBase from 'pocketbase'

async function runLiveTest() {
  const pb = new PocketBase('https://backend-dry-moon-3694.fly.dev')
  const timestamp = Date.now()

  console.log('1. Autenticando admin...')
  await pb.collection('users').authWithPassword('valdknupp@gmail.com', 'Vk@260800')
  console.log('Admin autenticado com sucesso:', pb.authStore.record?.email)

  // Obter um centro de custo do tipo Obra
  const worksiteCC = await pb.collection('cost_centers').getFirstListItem("type = 'Obra'")
  console.log('Centro de custo selecionado:', worksiteCC.id, worksiteCC.name)

  const testAssistantEmail = `teste_assist_${timestamp}@rpontes.com.br`
  const testPassword = 'Password123!'

  console.log('2. Criando usuário Assistente Administrativo de teste...')
  const assistantUser = await pb.collection('users').create({
    email: testAssistantEmail,
    password: testPassword,
    passwordConfirm: testPassword,
    name: `Assistente Teste ${timestamp}`,
    profile: 'ADMIN_ASSISTANT',
    cost_center: worksiteCC.id,
    active: true,
    verified: true,
  })
  console.log('Assistente criado:', assistantUser.id, assistantUser.email)

  // Criar um colaborador de teste vinculado à mesma obra
  console.log('3. Criando colaborador de teste na mesma obra...')
  const collab = await pb.collection('collaborators').create({
    name: `COLABORADOR TESTE ${timestamp}`,
    cpf_encrypted: `TEST_CPF_${timestamp}`,
    role: 'PEDREIRO',
    admission_date: '2026-09-01',
    cost_center: worksiteCC.id,
    situation: 'Em experiência',
  })
  console.log('Colaborador criado:', collab.id, collab.name)

  // Autenticar como o assistente administrativo
  const assistantPb = new PocketBase('https://backend-dry-moon-3694.fly.dev')
  console.log('4. Autenticando como Assistente Administrativo...')
  await assistantPb.collection('users').authWithPassword(testAssistantEmail, testPassword)
  console.log('Assistente autenticado:', assistantPb.authStore.record?.profile)

  // Criar avaliação com responsible_name e responsible_role
  console.log('5. Criando avaliação de 45 dias com responsável...')
  const evalRecord = await assistantPb.collection('evaluations').create({
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
  console.log('Avaliação criada com sucesso! ID:', evalRecord.id)
  console.log('Dados da avaliação gravada:', {
    responsible_name: evalRecord.responsible_name,
    responsible_role: evalRecord.responsible_role,
    stage: evalRecord.stage,
    decision: evalRecord.decision,
  })

  if (
    evalRecord.responsible_name !== 'Engenheiro Marcos Aurélio' ||
    evalRecord.responsible_role !== 'Engenheiro Residente'
  ) {
    throw new Error('Campos de responsável não conferem!')
  }

  // 6. Testar também avaliação de 90 dias
  console.log('6. Criando avaliação de 90 dias com responsável...')
  const eval90Record = await assistantPb.collection('evaluations').create({
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
  console.log('Avaliação de 90 dias criada com sucesso! ID:', eval90Record.id)

  // 7. Limpeza dos dados de teste
  console.log('7. Limpando dados de teste do banco...')
  await pb.collection('evaluations').delete(eval90Record.id)
  await pb.collection('evaluations').delete(evalRecord.id)
  await pb.collection('collaborators').delete(collab.id)
  await pb.collection('users').delete(assistantUser.id)
  console.log('Limpeza concluída com sucesso!')
}

runLiveTest().catch((err) => {
  console.error('Erro no teste ao vivo:', err)
  process.exit(1)
})
