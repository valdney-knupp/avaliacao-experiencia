import pb from '@/lib/pocketbase/client'

export interface ClientRecord {
  id: string
  name: string
  email: string
  plan: 'MENSAL' | 'ANUAL' | 'OUTRO'
  active: boolean
  notes?: string
  created: string
  updated?: string
}

export interface CreateClientPayload {
  name: string
  email: string
  password: string
  plan: 'MENSAL' | 'ANUAL' | 'OUTRO'
  notes?: string
  active?: boolean
}

export interface UpdateClientPayload {
  name?: string
  plan?: 'MENSAL' | 'ANUAL' | 'OUTRO'
  notes?: string
  active?: boolean
  password?: string
}

export async function listClients(): Promise<ClientRecord[]> {
  try {
    const list = await pb.collection('clients').getFullList<ClientRecord>({
      sort: '-created',
    })
    return list
  } catch (err) {
    console.warn('Falha ao listar clientes:', err)
    return []
  }
}

export async function createClient(payload: CreateClientPayload): Promise<ClientRecord> {
  const res = await pb.send<ClientRecord>('/backend/v1/admin/clients', {
    method: 'POST',
    body: payload,
  })
  return res
}

export async function updateClient(
  id: string,
  payload: UpdateClientPayload,
): Promise<ClientRecord> {
  const res = await pb.send<ClientRecord>(`/backend/v1/admin/clients/${id}/update`, {
    method: 'POST',
    body: payload,
  })
  return res
}

export async function deleteClient(id: string): Promise<{ success: boolean; message: string }> {
  const res = await pb.send<{ success: boolean; message: string }>(
    `/backend/v1/admin/clients/${id}/delete`,
    {
      method: 'POST',
    },
  )
  return res
}
