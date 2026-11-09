import React, { useState, useEffect } from 'react'
import {
  KeyRound,
  Plus,
  Edit2,
  Trash2,
  Users,
  Building,
  CheckCircle,
  XCircle,
  AlertCircle,
  Shield,
  ShieldCheck,
  Eye,
  EyeOff,
  UserPlus,
  RefreshCw,
  Search,
  Lock,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Switch } from '@/components/ui/switch'
import { formatDateBR } from '@/lib/dateAndCpfUtils'
import {
  listClients,
  listClientEmailLogs,
  createClient,
  updateClient,
  deleteClient,
  runSuspensionCheck,
  type ClientRecord,
  type ClientStatus,
  type ClientEmailLogRecord,
} from '@/services/clients'
import pb from '@/lib/pocketbase/client'

interface AdminAccessReleaseProps {
  isMasterUser: boolean
}

export const AdminAccessRelease: React.FC<AdminAccessReleaseProps> = ({ isMasterUser }) => {
  const [clients, setClients] = useState<ClientRecord[]>([])
  const [emailLogs, setEmailLogs] = useState<ClientEmailLogRecord[]>([])
  const [loading, setLoading] = useState(true)
  const [searchTerm, setSearchTerm] = useState('')
  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)

  // Modal Novo / Editar Cliente Comprador
  const [clientModalOpen, setClientModalOpen] = useState(false)
  const [editingClient, setEditingClient] = useState<ClientRecord | null>(null)
  const [showPassword, setShowPassword] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  const [checkingSuspension, setCheckingSuspension] = useState(false)
  const [clientForm, setClientForm] = useState({
    name: '',
    email: '',
    password: '',
    plan: 'MENSAL' as 'MENSAL' | 'ANUAL' | 'OUTRO',
    status: 'active' as ClientStatus,
    paid_until: '',
    experiencia_until: '',
    desempenho_until: '',
    notes: '',
  })

  // Modal Gerenciamento de Usuários do Cliente
  const [teamModalOpen, setTeamModalOpen] = useState(false)
  const [selectedClientForTeam, setSelectedClientForTeam] = useState<ClientRecord | null>(null)
  const [teamUsers, setTeamUsers] = useState<any[]>([])
  const [clientCostCenters, setClientCostCenters] = useState<any[]>([])
  const [clientSectors, setClientSectors] = useState<any[]>([])
  const [loadingTeam, setLoadingTeam] = useState(false)

  // Sub-modal Novo Usuário para o Cliente
  const [addUserModalOpen, setAddUserModalOpen] = useState(false)
  const [submittingUser, setSubmittingUser] = useState(false)
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    password: '',
    profile: 'VIEWER',
    cost_center: '',
    sector: '',
    active: true,
  })

  // Modal Redefinir Senha do Comprador / Usuário
  const [tempPassModal, setTempPassModal] = useState<{
    open: boolean
    pass: string
    title: string
  }>({
    open: false,
    pass: '',
    title: '',
  })

  const loadAllClients = async () => {
    setLoading(true)
    setErrorMsg(null)
    try {
      const [clientData, logsData] = await Promise.all([listClients(), listClientEmailLogs()])
      setClients(clientData)
      setEmailLogs(logsData)
    } catch (err: any) {
      setErrorMsg('Falha ao carregar lista de clientes: ' + (err?.message || ''))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (isMasterUser) {
      loadAllClients()
    }
  }, [isMasterUser])

  if (!isMasterUser) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-sm text-red-700">
        <Shield className="mx-auto h-8 w-8 text-red-500 mb-2" />
        <p className="font-bold">Acesso Exclusivo ao Administrador Master</p>
        <p className="text-xs text-red-600 mt-1">
          Esta tela de Liberação de Acessos é restrita à conta master de sistema.
        </p>
      </div>
    )
  }

  const handleOpenCreateModal = () => {
    setEditingClient(null)
    const defDate = new Date()
    defDate.setDate(defDate.getDate() + 30)
    const defIso = defDate.toISOString().split('T')[0]
    setClientForm({
      name: '',
      email: '',
      password: 'Skip@' + Math.floor(100000 + Math.random() * 900000),
      plan: 'MENSAL',
      status: 'active',
      paid_until: defIso,
      experiencia_until: defIso,
      desempenho_until: defIso,
      notes: '',
    })
    setShowPassword(false)
    setClientModalOpen(true)
  }

  const handleOpenEditModal = (c: ClientRecord) => {
    setEditingClient(c)
    const effectiveStatus: ClientStatus =
      c.status || (c.active !== false ? 'active' : 'blocked_manually')
    setClientForm({
      name: c.name,
      email: c.email,
      password: '',
      plan: c.plan,
      status: effectiveStatus,
      paid_until: c.paid_until ? c.paid_until.split(' ')[0].split('T')[0] : '',
      experiencia_until: c.experiencia_until
        ? c.experiencia_until.split(' ')[0].split('T')[0]
        : c.paid_until
          ? c.paid_until.split(' ')[0].split('T')[0]
          : '',
      desempenho_until: c.desempenho_until
        ? c.desempenho_until.split(' ')[0].split('T')[0]
        : c.paid_until
          ? c.paid_until.split(' ')[0].split('T')[0]
          : '',
      notes: c.notes || '',
    })
    setShowPassword(false)
    setClientModalOpen(true)
  }

  const handleSaveClient = async () => {
    setErrorMsg(null)
    setFeedbackMsg(null)
    setSubmitting(true)

    try {
      if (editingClient) {
        await updateClient(editingClient.id, {
          name: clientForm.name.trim(),
          plan: clientForm.plan,
          notes: clientForm.notes.trim(),
          status: clientForm.status,
          paid_until: clientForm.paid_until || undefined,
          experiencia_until: clientForm.experiencia_until || undefined,
          desempenho_until: clientForm.desempenho_until || undefined,
          active: clientForm.status === 'active',
          password: clientForm.password.trim() ? clientForm.password : undefined,
        })
        setFeedbackMsg(`Acesso do cliente "${clientForm.name}" atualizado com sucesso!`)
      } else {
        if (!clientForm.name.trim() || !clientForm.email.trim() || !clientForm.password) {
          setErrorMsg('Preencha o nome, e-mail e uma senha inicial válida (mínimo 8 caracteres).')
          setSubmitting(false)
          return
        }
        await createClient({
          name: clientForm.name.trim(),
          email: clientForm.email.trim().toLowerCase(),
          password: clientForm.password,
          plan: clientForm.plan,
          notes: clientForm.notes.trim(),
          status: clientForm.status,
          paid_until: clientForm.paid_until || undefined,
          experiencia_until: clientForm.experiencia_until || undefined,
          desempenho_until: clientForm.desempenho_until || undefined,
          active: clientForm.status === 'active',
        })
        setFeedbackMsg(
          `Acesso liberado com sucesso para ${clientForm.name}! O comprador já pode logar.`,
        )
      }
      setClientModalOpen(false)
      loadAllClients()
    } catch (err: any) {
      const msg =
        err?.data?.error || err?.response?.error || err?.message || 'Falha ao salvar cliente.'
      setErrorMsg('Erro: ' + msg)
    } finally {
      setSubmitting(false)
    }
  }

  const handleRunSuspensionCheck = async () => {
    setCheckingSuspension(true)
    setErrorMsg(null)
    setFeedbackMsg(null)
    try {
      const res = await runSuspensionCheck()
      const noticesCount = res.totalNoticesSent || 0
      const suspendedCount = res.totalSuspended || 0

      let details = `Checados: ${res.totalChecked} cliente(s).`
      if (suspendedCount > 0) {
        details += ` Suspenso(s): ${suspendedCount}.`
      } else {
        details += ` Nenhuma suspensão pendente.`
      }
      if (noticesCount > 0) {
        details += ` Avisos de vencimento disparados por e-mail: ${noticesCount}.`
      } else {
        details += ` Nenhum novo aviso de e-mail necessário no momento.`
      }

      setFeedbackMsg(`Rotina de vencimentos e avisos executada com sucesso! ${details}`)
      loadAllClients()
    } catch (err: any) {
      setErrorMsg('Falha ao executar rotina de suspensão/avisos: ' + (err?.message || ''))
    } finally {
      setCheckingSuspension(false)
    }
  }

  const handleDeleteClient = async (c: ClientRecord) => {
    const conf = window.confirm(
      `ATENÇÃO: Deseja realmente EXCLUIR o acesso de "${c.name}" (${c.email})?\n\nEsta ação apagará o comprador, seus usuários e todos os dados associados a este cliente de forma irreversível.`,
    )
    if (!conf) return

    setErrorMsg(null)
    setFeedbackMsg(null)
    try {
      await deleteClient(c.id)
      setFeedbackMsg(`Acesso do cliente "${c.name}" foi excluído permanentemente.`)
      loadAllClients()
    } catch (err: any) {
      const msg = err?.data?.error || err?.response?.error || err?.message || 'Erro ao excluir.'
      setErrorMsg('Falha ao excluir cliente: ' + msg)
    }
  }

  const handleOpenTeamModal = async (c: ClientRecord) => {
    setSelectedClientForTeam(c)
    setTeamModalOpen(true)
    setLoadingTeam(true)

    try {
      const [usersRes, ccRes, secRes] = await Promise.all([
        pb.collection('users').getFullList({
          filter: `client = '${c.id}'`,
          sort: 'name',
          expand: 'cost_center,sector',
        }),
        pb.collection('cost_centers').getFullList({
          filter: `client = '${c.id}'`,
          sort: 'name',
        }),
        pb.collection('sectors').getFullList({
          filter: `client = '${c.id}'`,
          sort: 'name',
        }),
      ])
      setTeamUsers(usersRes)
      setClientCostCenters(ccRes)
      setClientSectors(secRes)
    } catch (err: any) {
      console.warn('Erro ao carregar equipe do cliente:', err)
    } finally {
      setLoadingTeam(false)
    }
  }

  const handleSaveTeamUser = async () => {
    if (!selectedClientForTeam) return
    setErrorMsg(null)
    setSubmittingUser(true)

    try {
      if (!userForm.name.trim() || !userForm.email.trim() || !userForm.password) {
        setErrorMsg('Nome, e-mail e senha de 8+ caracteres são obrigatórios.')
        setSubmittingUser(false)
        return
      }

      await pb.send('/backend/v1/admin/users', {
        method: 'POST',
        body: {
          name: userForm.name.trim(),
          email: userForm.email.trim().toLowerCase(),
          password: userForm.password,
          profile: userForm.profile,
          cost_center:
            userForm.profile === 'MANAGER' ||
            userForm.profile === 'MANAGER_WORKSITE' ||
            userForm.profile === 'ADMIN_ASSISTANT'
              ? userForm.cost_center || null
              : null,
          sector:
            userForm.profile === 'MANAGER' || userForm.profile === 'MANAGER_DEPARTMENT'
              ? userForm.sector || null
              : null,
          active: userForm.active,
          client: selectedClientForTeam.id,
        },
      })

      setAddUserModalOpen(false)
      setUserForm({
        name: '',
        email: '',
        password: '',
        profile: 'VIEWER',
        cost_center: '',
        sector: '',
        active: true,
      })
      // Recarregar equipe
      handleOpenTeamModal(selectedClientForTeam)
      setFeedbackMsg('Novo usuário adicionado à equipe do cliente com sucesso!')
    } catch (err: any) {
      const msg =
        err?.data?.error || err?.response?.error || err?.message || 'Falha ao criar usuário.'
      setErrorMsg('Erro ao cadastrar usuário na equipe: ' + msg)
    } finally {
      setSubmittingUser(false)
    }
  }

  const handleResetTeamUserPassword = async (u: any) => {
    const tempPass = 'Aval!' + Math.floor(100000 + Math.random() * 900000)
    try {
      await pb.send('/backend/v1/admin/users/reset-password', {
        method: 'POST',
        body: {
          user_id: u.id,
          password: tempPass,
        },
      })
      setTempPassModal({
        open: true,
        pass: tempPass,
        title: `Nova Senha Temporária para ${u.name || u.email}`,
      })
    } catch (err: any) {
      setErrorMsg('Erro ao gerar senha: ' + (err?.message || ''))
    }
  }

  const filteredClients = clients.filter((c) => {
    const q = searchTerm.toLowerCase()
    return c.name.toLowerCase().includes(q) || c.email.toLowerCase().includes(q)
  })

  return (
    <div className="space-y-6">
      {/* Mensagens de feedback */}
      {feedbackMsg && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-xs font-semibold text-green-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <CheckCircle className="h-4 w-4 shrink-0 text-green-600" />
            <span>{feedbackMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setFeedbackMsg(null)}
            className="text-green-600 hover:text-green-900 text-xs"
          >
            Fechar
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs font-semibold text-red-800 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2">
            <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
            <span>{errorMsg}</span>
          </div>
          <button
            type="button"
            onClick={() => setErrorMsg(null)}
            className="text-red-600 hover:text-red-900 text-xs"
          >
            Fechar
          </button>
        </div>
      )}

      {/* Header com ações e busca */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <KeyRound className="h-5 w-5 text-[#54D769]" />
            <h2 className="text-base md:text-lg font-bold text-gray-900">
              Liberação de Acessos aos Compradores (SaaS Multi-tenant)
            </h2>
          </div>
          <p className="text-xs text-gray-500 mt-0.5">
            Crie e gerencie contas de clientes compradores com login imediato. Cada cliente possui
            ambiente 100% isolado no backend.
          </p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <Button
            variant="outline"
            size="sm"
            onClick={handleRunSuspensionCheck}
            disabled={checkingSuspension}
            title="Executa a verificação de clientes com paid_until vencido há mais de 1 dia"
            className="text-xs border-[#E8E8E8] text-amber-700 hover:bg-amber-50"
          >
            <RefreshCw
              className={`mr-1.5 h-3.5 w-3.5 ${checkingSuspension ? 'animate-spin' : ''}`}
            />{' '}
            Checar Vencidos
          </Button>
          <Button
            variant="outline"
            size="sm"
            onClick={loadAllClients}
            className="text-xs border-[#E8E8E8] text-gray-700 hover:bg-gray-50"
          >
            <RefreshCw className="mr-1.5 h-3.5 w-3.5" /> Atualizar
          </Button>
          <Button
            onClick={handleOpenCreateModal}
            className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] text-xs"
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Liberar Novo Acesso
          </Button>
        </div>
      </div>

      {/* Barra de busca */}
      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
        <Input
          type="text"
          placeholder="Buscar por cliente, empresa ou e-mail..."
          value={searchTerm}
          onChange={(e) => setSearchTerm(e.target.value)}
          className="pl-9 text-xs bg-white border-[#E8E8E8] h-9"
        />
      </div>

      {/* Tabela de Clientes */}
      <div className="rounded-2xl border border-[#E8E8E8] bg-white shadow-xs overflow-hidden">
        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs md:text-sm table-fixed">
            <thead className="bg-[#F9FAFB] text-[11px] md:text-xs font-semibold text-gray-600 uppercase border-b border-[#E8E8E8]">
              <tr>
                <th className="w-[22%] px-3 py-2.5">Cliente / Empresa</th>
                <th className="w-[18%] px-2 py-2.5">E-mail (Login)</th>
                <th className="w-[9%] px-2 py-2.5 text-center">Plano</th>
                <th className="w-[11%] px-2 py-2.5 text-center">Vencimento</th>
                <th className="w-[14%] px-2 py-2.5 text-center">Módulos</th>
                <th className="w-[11%] px-1.5 py-2.5 text-center">Situação</th>
                <th className="w-[13%] px-2 py-2.5 text-center">Avisos E-mail</th>
                <th className="w-[12%] px-3 py-2.5 text-right">Ações</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8E8]">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-xs text-gray-500">
                    Carregando clientes liberados...
                  </td>
                </tr>
              ) : filteredClients.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-xs text-gray-500">
                    Nenhum comprador cadastrado no momento. Clique em "Liberar Novo Acesso" para
                    criar o primeiro cliente.
                  </td>
                </tr>
              ) : (
                filteredClients.map((c) => {
                  const clientLogs = emailLogs.filter((l) => l.client === c.id)
                  const has7d = clientLogs.some(
                    (l) => l.type === 'expiring_7d' && l.status === 'Enviado',
                  )
                  const has3d = clientLogs.some(
                    (l) => l.type === 'expiring_3d' && l.status === 'Enviado',
                  )
                  const has1d = clientLogs.some(
                    (l) => l.type === 'expiring_1d' && l.status === 'Enviado',
                  )
                  const hasSuspended = clientLogs.some(
                    (l) => l.type === 'suspended_overdue' && l.status === 'Enviado',
                  )
                  const hasReactivated = clientLogs.some(
                    (l) => l.type === 'reactivated_payment' && l.status === 'Enviado',
                  )

                  return (
                    <tr key={c.id} className="hover:bg-gray-50/80">
                      <td className="px-3 py-2.5">
                        <div className="flex items-center gap-2">
                          <div className="w-7 h-7 rounded-full bg-emerald-100 text-emerald-800 flex items-center justify-center font-bold text-xs shrink-0">
                            {c.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="truncate">
                            <p className="font-bold text-gray-900 truncate" title={c.name}>
                              {c.name}
                            </p>
                            {c.notes && (
                              <p className="text-[11px] text-gray-400 truncate" title={c.notes}>
                                {c.notes}
                              </p>
                            )}
                          </div>
                        </div>
                      </td>
                      <td className="px-2 py-2.5 text-xs text-gray-700 truncate" title={c.email}>
                        {c.email}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        <span
                          className={`text-[10px] md:text-xs px-2 py-0.5 rounded-full font-bold ${
                            c.plan === 'ANUAL'
                              ? 'bg-purple-100 text-purple-800'
                              : 'bg-blue-100 text-blue-800'
                          }`}
                        >
                          {c.plan}
                        </span>
                      </td>
                      <td className="px-2 py-2.5 text-center text-xs whitespace-nowrap">
                        {c.paid_until ? (
                          <div className="flex flex-col items-center">
                            <span className="font-semibold text-gray-800">
                              {formatDateBR(c.paid_until)}
                            </span>
                            {(() => {
                              const pIso = c.paid_until.split(' ')[0].split('T')[0]
                              const nowIso = new Date().toISOString().split('T')[0]
                              const isPast = pIso < nowIso
                              return (
                                <span
                                  className={`text-[10px] font-medium ${
                                    isPast ? 'text-red-600' : 'text-emerald-700'
                                  }`}
                                >
                                  {isPast ? 'Vencido' : 'Em dia'}
                                </span>
                              )
                            })()}
                          </div>
                        ) : (
                          <span className="text-gray-400 text-xs">-</span>
                        )}
                      </td>
                      <td className="px-2 py-2.5 text-center text-[11px]">
                        {(() => {
                          const nowIso = new Date().toISOString().split('T')[0]
                          const expIso = c.experiencia_until
                            ? c.experiencia_until.split(' ')[0].split('T')[0]
                            : c.paid_until
                              ? c.paid_until.split(' ')[0].split('T')[0]
                              : ''
                          const desIso = c.desempenho_until
                            ? c.desempenho_until.split(' ')[0].split('T')[0]
                            : ''
                          const isExpActive =
                            expIso &&
                            expIso >= nowIso &&
                            c.active !== false &&
                            c.status === 'active'
                          const isDesActive =
                            desIso &&
                            desIso >= nowIso &&
                            c.active !== false &&
                            c.status === 'active'

                          return (
                            <div className="flex flex-col gap-1 items-center">
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                                  isExpActive
                                    ? 'bg-emerald-100 text-emerald-800 border border-emerald-200'
                                    : 'bg-slate-100 text-slate-500 line-through'
                                }`}
                                title={
                                  expIso
                                    ? `Experiência até ${formatDateBR(expIso)}`
                                    : 'Não liberado'
                                }
                              >
                                Exp: {expIso ? formatDateBR(expIso) : 'Inativo'}
                              </span>
                              <span
                                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold whitespace-nowrap ${
                                  isDesActive
                                    ? 'bg-blue-100 text-blue-800 border border-blue-200'
                                    : 'bg-slate-100 text-slate-500 line-through'
                                }`}
                                title={
                                  desIso ? `Desempenho até ${formatDateBR(desIso)}` : 'Não liberado'
                                }
                              >
                                Desemp: {desIso ? formatDateBR(desIso) : 'Inativo'}
                              </span>
                            </div>
                          )
                        })()}
                      </td>
                      <td className="px-1.5 py-2.5 text-center">
                        {(() => {
                          const effectiveStatus =
                            c.status || (c.active !== false ? 'active' : 'blocked_manually')

                          if (effectiveStatus === 'active') {
                            return (
                              <span className="text-[10px] md:text-xs px-2.5 py-0.5 rounded-full font-bold bg-green-100 text-green-800 whitespace-nowrap">
                                Ativo
                              </span>
                            )
                          }
                          if (effectiveStatus === 'suspended_overdue') {
                            return (
                              <span className="text-[10px] md:text-xs px-2.5 py-0.5 rounded-full font-bold bg-amber-100 text-amber-800 border border-amber-300 whitespace-nowrap">
                                Suspenso (Vencido)
                              </span>
                            )
                          }
                          return (
                            <span className="text-[10px] md:text-xs px-2.5 py-0.5 rounded-full font-bold bg-red-100 text-red-800 whitespace-nowrap">
                              Bloqueado (Manual)
                            </span>
                          )
                        })()}
                      </td>
                      <td className="px-2 py-2.5 text-center">
                        {clientLogs.length === 0 ? (
                          <span className="text-[11px] text-gray-400">Nenhum</span>
                        ) : (
                          <div
                            className="flex items-center justify-center gap-1 flex-wrap"
                            title={`Total de envios: ${clientLogs.length}`}
                          >
                            {has7d && (
                              <span
                                className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-blue-50 text-blue-700 border border-blue-200"
                                title="Aviso de 7 dias enviado"
                              >
                                7d
                              </span>
                            )}
                            {has3d && (
                              <span
                                className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-amber-50 text-amber-700 border border-amber-200"
                                title="Aviso de 3 dias enviado"
                              >
                                3d
                              </span>
                            )}
                            {has1d && (
                              <span
                                className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-orange-50 text-orange-700 border border-orange-200"
                                title="Aviso de 1 dia enviado"
                              >
                                1d
                              </span>
                            )}
                            {hasSuspended && (
                              <span
                                className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-red-50 text-red-700 border border-red-200"
                                title="E-mail de suspensão enviado"
                              >
                                Susp
                              </span>
                            )}
                            {hasReactivated && (
                              <span
                                className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-emerald-50 text-emerald-700 border border-emerald-200"
                                title="E-mail de reativação enviado"
                              >
                                Reat
                              </span>
                            )}
                            {clientLogs.some(
                              (l) => l.type === 'welcome_payment' && l.status === 'Enviado',
                            ) && (
                              <span
                                className="text-[9px] px-1.5 py-0.2 rounded font-bold bg-teal-50 text-teal-700 border border-teal-200"
                                title="E-mail de boas-vindas pós-compra com manual enviado"
                              >
                                Boas-vindas
                              </span>
                            )}
                          </div>
                        )}
                      </td>
                      <td className="px-3 py-2.5 text-right whitespace-nowrap space-x-1">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenTeamModal(c)}
                          title="Gerenciar Equipe do Cliente"
                          className="h-7 px-2 text-xs text-blue-700 hover:text-blue-900 hover:bg-blue-50"
                        >
                          <Users className="h-3.5 w-3.5 mr-1" />
                          <span className="hidden sm:inline">Equipe</span>
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleOpenEditModal(c)}
                          title="Editar ou Trocar Senha"
                          className="h-7 px-1.5 text-xs text-gray-600 hover:text-black"
                        >
                          <Edit2 className="h-3.5 w-3.5" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => handleDeleteClient(c)}
                          title="Excluir Acesso"
                          className="h-7 px-1.5 text-xs text-red-600 hover:text-red-800 hover:bg-red-50"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </td>
                    </tr>
                  )
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Modal Criar / Editar Acesso de Comprador */}
      <Dialog open={clientModalOpen} onOpenChange={setClientModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <KeyRound className="h-4 w-4 text-[#54D769]" />
              {editingClient ? 'Editar Acesso do Cliente' : 'Liberar Acesso para Comprador'}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Nome do Cliente / Empresa *
              </Label>
              <Input
                type="text"
                placeholder="Ex: Construtora Silva & Filhos"
                value={clientForm.name}
                onChange={(e) => setClientForm({ ...clientForm, name: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                E-mail do Comprador (Login do Sistema) *
              </Label>
              <Input
                type="email"
                disabled={!!editingClient}
                placeholder="comprador@empresa.com.br"
                value={clientForm.email}
                onChange={(e) => setClientForm({ ...clientForm, email: e.target.value })}
                className="mt-1 text-xs"
              />
              {editingClient && (
                <p className="text-[10px] text-gray-400 mt-0.5">
                  O e-mail principal é o identificador de login e não pode ser renomeado.
                </p>
              )}
            </div>

            <div>
              <div className="flex items-center justify-between">
                <Label className="text-xs font-semibold text-gray-700">
                  {editingClient
                    ? 'Nova Senha (deixe em branco para não alterar)'
                    : 'Senha de Acesso *'}
                </Label>
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="text-[11px] text-gray-500 hover:text-black flex items-center gap-1"
                >
                  {showPassword ? <EyeOff className="h-3 w-3" /> : <Eye className="h-3 w-3" />}
                  {showPassword ? 'Ocultar' : 'Ver'}
                </button>
              </div>
              <Input
                type={showPassword ? 'text' : 'password'}
                placeholder={editingClient ? '••••••••' : 'Mínimo 8 caracteres'}
                value={clientForm.password}
                onChange={(e) => setClientForm({ ...clientForm, password: e.target.value })}
                className="mt-1 text-xs font-mono"
              />
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label className="text-xs font-semibold text-gray-700">Plano</Label>
                <Select
                  value={clientForm.plan}
                  onValueChange={(val: any) => {
                    const days = val === 'ANUAL' ? 365 : 30
                    const d = new Date()
                    d.setDate(d.getDate() + days)
                    setClientForm({
                      ...clientForm,
                      plan: val,
                      paid_until: clientForm.paid_until || d.toISOString().split('T')[0],
                    })
                  }}
                >
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="MENSAL">Mensal (R$ 297/mês)</SelectItem>
                    <SelectItem value="ANUAL">Anual (R$ 2.899/ano)</SelectItem>
                    <SelectItem value="OUTRO">Personalizado</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  Data de Vencimento Geral
                </Label>
                <Input
                  type="date"
                  value={clientForm.paid_until}
                  onChange={(e) => {
                    const nextVal = e.target.value
                    setClientForm({
                      ...clientForm,
                      paid_until: nextVal,
                      // se ainda vazios, atualiza módulos junto
                      experiencia_until: clientForm.experiencia_until || nextVal,
                      desempenho_until: clientForm.desempenho_until || nextVal,
                    })
                  }}
                  className="mt-1 text-xs"
                />
              </div>
            </div>

            {/* Vencimento Individual por Módulo */}
            <div className="p-3 rounded-xl border border-emerald-100 bg-emerald-50/40 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-950 flex items-center gap-1.5">
                  <ShieldCheck className="h-4 w-4 text-[#2CA840]" />
                  Validade Isolada por Módulo
                </span>
                <span className="text-[10px] text-emerald-700">Permissões independentes</span>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3 pt-1">
                <div>
                  <Label className="text-[11px] font-semibold text-gray-700">
                    Avaliação de Experiência & Desligamento
                  </Label>
                  <Input
                    type="date"
                    value={clientForm.experiencia_until}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, experiencia_until: e.target.value })
                    }
                    className="mt-1 text-xs bg-white"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Libera contratos 45/90 dias e Entrevista de Desligamento.
                  </p>
                </div>
                <div>
                  <Label className="text-[11px] font-semibold text-gray-700">
                    Avaliação de Desempenho
                  </Label>
                  <Input
                    type="date"
                    value={clientForm.desempenho_until}
                    onChange={(e) =>
                      setClientForm({ ...clientForm, desempenho_until: e.target.value })
                    }
                    className="mt-1 text-xs bg-white"
                  />
                  <p className="text-[10px] text-gray-500 mt-0.5">
                    Libera módulo autônomo de Avaliação de Desempenho Nível I e II.
                  </p>
                </div>
              </div>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Situação do Acesso</Label>
              <Select
                value={clientForm.status}
                onValueChange={(val: ClientStatus) => setClientForm({ ...clientForm, status: val })}
              >
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="active">Ativo (Liberado)</SelectItem>
                  <SelectItem value="suspended_overdue">Suspenso por Vencimento</SelectItem>
                  <SelectItem value="blocked_manually">Bloqueado Manualmente</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-[10px] text-gray-500 mt-1">
                O master pode bloquear ou desbloquear manualmente a qualquer momento independente do
                vencimento. Se suspenso por vencimento ou bloqueado, o comprador verá os contatos
                para regularização.
              </p>
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Observações Internas</Label>
              <Textarea
                placeholder="Anotações comerciais, número do contrato, etc."
                value={clientForm.notes}
                onChange={(e) => setClientForm({ ...clientForm, notes: e.target.value })}
                className="mt-1 text-xs resize-none"
                rows={2}
              />
            </div>
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={submitting}
              onClick={() => setClientModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={submitting}
              onClick={handleSaveClient}
              className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] text-xs"
            >
              {submitting
                ? 'Salvando...'
                : editingClient
                  ? 'Salvar Alterações'
                  : 'Liberar Acesso Agora'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Equipe do Cliente */}
      <Dialog open={teamModalOpen} onOpenChange={setTeamModalOpen}>
        <DialogContent className="sm:max-w-3xl bg-white max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Users className="h-4 w-4 text-[#54D769]" />
                <span>Equipe de: {selectedClientForTeam?.name}</span>
              </div>
              <Button
                size="sm"
                onClick={() => {
                  setUserForm({
                    name: '',
                    email: '',
                    password: 'Skip@' + Math.floor(100000 + Math.random() * 900000),
                    profile: 'VIEWER',
                    cost_center: '',
                    sector: '',
                    active: true,
                  })
                  setAddUserModalOpen(true)
                }}
                className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] text-xs h-7"
              >
                <UserPlus className="mr-1 h-3.5 w-3.5" /> Adicionar Usuário à Equipe
              </Button>
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <p className="text-xs text-gray-500">
              Usuários cadastrados aqui pertencem exclusivamente à conta deste cliente e visualizam
              somente os colaboradores e centros de custo cadastrados para ele.
            </p>

            <div className="rounded-xl border border-[#E8E8E8] overflow-hidden">
              <table className="w-full text-left text-xs table-fixed">
                <thead className="bg-[#F9FAFB] font-semibold text-gray-600 uppercase border-b border-[#E8E8E8]">
                  <tr>
                    <th className="w-[30%] px-3 py-2">Nome</th>
                    <th className="w-[30%] px-2 py-2">E-mail</th>
                    <th className="w-[20%] px-2 py-2">Perfil</th>
                    <th className="w-[20%] px-2 py-2 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E8]">
                  {loadingTeam ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                        Carregando equipe...
                      </td>
                    </tr>
                  ) : teamUsers.length === 0 ? (
                    <tr>
                      <td colSpan={4} className="px-3 py-6 text-center text-gray-500">
                        Nenhum usuário subordinado cadastrado para este cliente ainda.
                      </td>
                    </tr>
                  ) : (
                    teamUsers.map((u) => (
                      <tr key={u.id} className="hover:bg-gray-50">
                        <td className="px-3 py-2 font-bold text-gray-900 truncate" title={u.name}>
                          {u.name}
                        </td>
                        <td className="px-2 py-2 text-gray-600 truncate" title={u.email}>
                          {u.email}
                        </td>
                        <td className="px-2 py-2">
                          <span className="text-[10px] px-1.5 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-800">
                            {u.profile === 'MANAGER' ||
                            u.profile === 'MANAGER_WORKSITE' ||
                            u.profile === 'MANAGER_DEPARTMENT'
                              ? 'Gestor'
                              : u.profile === 'ADMIN'
                                ? 'Administrador'
                                : u.profile === 'HR'
                                  ? 'Gestão de Pessoas'
                                  : u.profile === 'ADMIN_ASSISTANT'
                                    ? 'Assistente Administrativo'
                                    : u.profile === 'VIEWER'
                                      ? 'Consulta'
                                      : u.profile}
                          </span>
                        </td>
                        <td className="px-2 py-2 text-right whitespace-nowrap">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleResetTeamUserPassword(u)}
                            className="h-6 px-1.5 text-xs text-gray-600 hover:text-black"
                            title="Redefinir senha temporária"
                          >
                            <KeyRound className="h-3 w-3 mr-1" /> Senha
                          </Button>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </DialogContent>
      </Dialog>

      {/* Sub-modal Adicionar Usuário para a Equipe */}
      <Dialog open={addUserModalOpen} onOpenChange={setAddUserModalOpen}>
        <DialogContent className="sm:max-w-md bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900">
              Novo Usuário para {selectedClientForTeam?.name}
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-3 py-2 text-xs">
            <div>
              <Label className="text-xs font-semibold text-gray-700">Nome Completo *</Label>
              <Input
                type="text"
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">E-mail *</Label>
              <Input
                type="email"
                value={userForm.email}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                className="mt-1 text-xs"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">
                Senha Inicial (8+ caracteres) *
              </Label>
              <Input
                type="text"
                value={userForm.password}
                onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                className="mt-1 text-xs font-mono"
              />
            </div>

            <div>
              <Label className="text-xs font-semibold text-gray-700">Perfil de Acesso</Label>
              <Select
                value={userForm.profile}
                onValueChange={(val) => setUserForm({ ...userForm, profile: val })}
              >
                <SelectTrigger className="mt-1 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">Administrador</SelectItem>
                  <SelectItem value="HR">Gestão de Pessoas (RH)</SelectItem>
                  <SelectItem value="MANAGER">Gestor</SelectItem>
                  <SelectItem value="ADMIN_ASSISTANT">Assistente Administrativo</SelectItem>
                  <SelectItem value="VIEWER">Consulta</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(userForm.profile === 'MANAGER' ||
              userForm.profile === 'MANAGER_WORKSITE' ||
              userForm.profile === 'ADMIN_ASSISTANT') && (
              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  {userForm.profile === 'MANAGER'
                    ? 'Centro de Custo / Obra (opcional)'
                    : 'Centro de Custo / Obra'}
                </Label>
                <Select
                  value={userForm.cost_center || 'none'}
                  onValueChange={(val) =>
                    setUserForm({ ...userForm, cost_center: val === 'none' ? '' : val })
                  }
                >
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue placeholder="Selecione o centro de custo..." />
                  </SelectTrigger>
                  <SelectContent>
                    {userForm.profile === 'MANAGER' && (
                      <SelectItem value="none">Nenhum centro de custo</SelectItem>
                    )}
                    {clientCostCenters.map((cc) => (
                      <SelectItem key={cc.id} value={cc.id}>
                        {cc.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                {clientCostCenters.length === 0 && (
                  <p className="text-[10px] text-amber-600 mt-1">
                    Este cliente ainda não cadastrou centros de custo. O gestor pode ser associado
                    depois.
                  </p>
                )}
              </div>
            )}

            {(userForm.profile === 'MANAGER' || userForm.profile === 'MANAGER_DEPARTMENT') && (
              <div>
                <Label className="text-xs font-semibold text-gray-700">
                  {userForm.profile === 'MANAGER' ? 'Setor (opcional)' : 'Setor'}
                </Label>
                <Select
                  value={userForm.sector || 'none'}
                  onValueChange={(val) =>
                    setUserForm({ ...userForm, sector: val === 'none' ? '' : val })
                  }
                >
                  <SelectTrigger className="mt-1 text-xs">
                    <SelectValue placeholder="Selecione o setor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {userForm.profile === 'MANAGER' && (
                      <SelectItem value="none">Nenhum setor vinculado</SelectItem>
                    )}
                    {clientSectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2">
            <Button
              variant="outline"
              size="sm"
              disabled={submittingUser}
              onClick={() => setAddUserModalOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              size="sm"
              disabled={submittingUser}
              onClick={handleSaveTeamUser}
              className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] text-xs"
            >
              {submittingUser ? 'Criando...' : 'Cadastrar Usuário'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Modal Senha Temporária */}
      <Dialog
        open={tempPassModal.open}
        onOpenChange={(op) => setTempPassModal({ ...tempPassModal, open: op })}
      >
        <DialogContent className="sm:max-w-sm bg-white">
          <DialogHeader>
            <DialogTitle className="text-base font-bold text-gray-900 flex items-center gap-2">
              <Lock className="h-4 w-4 text-[#54D769]" />
              {tempPassModal.title || 'Senha Gerada com Sucesso'}
            </DialogTitle>
          </DialogHeader>
          <div className="py-3 text-center space-y-2">
            <p className="text-xs text-gray-500">
              Copie e envie a nova senha temporária para o usuário:
            </p>
            <div className="p-3 bg-gray-100 rounded-xl font-mono text-base font-bold tracking-wider select-all text-gray-900 border border-gray-200">
              {tempPassModal.pass}
            </div>
          </div>
          <DialogFooter>
            <Button
              size="sm"
              onClick={() => setTempPassModal({ open: false, pass: '', title: '' })}
              className="w-full bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] text-xs"
            >
              Concluído
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
