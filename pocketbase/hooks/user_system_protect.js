// Hook de proteção contra edição ou exclusão acidental da conta de sistema mestre via API de records
onRecordUpdateRequest((e) => {
  const targetEmail = e.record.getString('email').toLowerCase()
  if (targetEmail === 'valdknupp@gmail.com') {
    // Permitir apenas se não for uma tentativa de inativação ou alteração destrutiva pelo painel
    // Se a requisição veio de um usuário pelo painel tentando gerenciar esta conta:
    if (e.auth && e.auth.getString('email').toLowerCase() !== 'valdknupp@gmail.com') {
      throw new ForbiddenError('Esta conta de sistema não pode ser gerenciada pelo painel.')
    }
  }
  e.next()
}, 'users')

onRecordDeleteRequest((e) => {
  const targetEmail = e.record.getString('email').toLowerCase()
  if (targetEmail === 'valdknupp@gmail.com') {
    throw new ForbiddenError('Esta conta de sistema não pode ser excluída.')
  }
  e.next()
}, 'users')
