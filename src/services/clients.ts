import pb from '@/lib/pocketbase/client'

export type ClientStatus = 'active' | 'suspended_overdue' | 'blocked_manually'

export interface ClientRecord {
  id: string
  name: string
  email: string
  plan: 'MENSAL' | 'ANUAL' | 'OUTRO'
  active: boolean
  status?: ClientStatus
  paid_until?: string
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
  paid_until?: string
  status?: ClientStatus
}

export interface UpdateClientPayload {
  name?: string
  plan?: 'MENSAL' | 'ANUAL' | 'OUTRO'
  notes?: string
  active?: boolean
  password?: string
  paid_until?: string
  status?: ClientStatus
}

export async function runSuspensionCheck(): Promise<{
  success: boolean
  totalChecked: number
  totalSuspended: number
  suspendedList: Array<{
    id: string
    name: string
    email: string
    paid_until: string
    days_overdue: number
  }>
}> {
  const res = await pb.send('/backend/v1/admin/run-suspension-check', {
    method: 'POST',
  })
  return res
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
