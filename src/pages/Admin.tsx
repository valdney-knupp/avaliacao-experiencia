import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { extractFieldErrors, getErrorMessage } from '@/lib/pocketbase/errors'
import { useAuth, UserProfile } from '@/hooks/use-auth'
import {
  Users,
  Building2,
  FolderTree,
  ListOrdered,
  Sliders,
  ShieldCheck,
  Plus,
  Edit2,
  KeyRound,
  Check,
  X,
  AlertCircle,
  ArrowUp,
  ArrowDown,
  Trash2,
  Copy,
  RotateCcw,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { Switch } from '@/components/ui/switch'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTimeBR, formatDateBR } from '@/lib/dateAndCpfUtils'

export const Admin: React.FC = () => {
  const { user, canViewAudit } = useAuth()
  const isSuperAdmin = user?.profile === 'ADMIN'

  // Tab active
  const [activeTab, setActiveTab] = useState('users')

  // Datasets
  const [usersList, setUsersList] = useState<any[]>([])
  const [costCenters, setCostCenters] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [criteria, setCriteria] = useState<any[]>([])
  const [settings, setSettings] = useState<Record<string, string>>({})
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Modal states
  const [userModalOpen, setUserModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<any | null>(null)
  const [userForm, setUserForm] = useState({
    name: '',
    email: '',
    profile: 'VIEWER' as UserProfile,
    cost_center: '',
    sector: '',
    active: true,
    password: '',
  })

  const [tempPasswordModal, setTempPasswordModal] = useState<{ open: boolean; pass: string }>({
    open: false,
    pass: '',
  })

  // Cost Center modal
  const [ccModalOpen, setCcModalOpen] = useState(false)
  const [editingCc, setEditingCc] = useState<any | null>(null)
  const [ccForm, setCcForm] = useState({
    name: '',
    type: 'Obra',
    active: true,
    email_recipients: '',
  })

  // Sector modal
  const [sectorModalOpen, setSectorModalOpen] = useState(false)
  const [editingSector, setEditingSector] = useState<any | null>(null)
  const [sectorForm, setSectorForm] = useState({ name: '', active: true })

  // Criterion modal, Category filter & Sector Link
  const [critCategoryTab, setCritCategoryTab] = useState<'OBRAS' | 'ESCRITORIO'>('ESCRITORIO')
  const [critSelectedSectorId, setCritSelectedSectorId] = useState<string>('__DEFAULT_ESCRITORIO__')
  const [critModalOpen, setCritModalOpen] = useState(false)
  const [quickNewSectorOpen, setQuickNewSectorOpen] = useState(false)
  const [quickNewSectorName, setQuickNewSectorName] = useState('')
  const [editingCrit, setEditingCrit] = useState<any | null>(null)
  const [critForm, setCritForm] = useState({
    name: '',
    description: '',
    category: 'ESCRITORIO' as 'OBRAS' | 'ESCRITORIO',
    sector: '' as string,
    active: true,
  })

  // Audit filters
  const [auditUserFilter, setAuditUserFilter] = useState('all')
  const [auditActionFilter, setAuditActionFilter] = useState('all')

  const [feedbackMsg, setFeedbackMsg] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [usersLoadError, setUsersLoadError] = useState<string | null>(null)

  const loadAll = async () => {
    setLoading(true)
    setUsersLoadError(null)

    // Carregamento resiliente: usuários são carregados e qualquer falha 401/403/erro
    // gera um alerta visual explicativo com ação de recarga/login
    try {
      const uRes = await pb.collection('users').getFullList({
        sort: 'name',
        expand: 'cost_center,sector',
      })
      // Excluir a conta mestre apenas em memória (case-insensitive, trim)
      const visibleUsers = uRes.filter(
        (u) => (u.email || '').trim().toLowerCase() !== 'valdknupp@gmail.com',
      )
      setUsersList(visibleUsers)
      setUsersLoadError(null)
    } catch (err: any) {
      console.error('Erro ao carregar lista de usuários:', err)
      const isAuthErr =
        err?.status === 401 ||
        err?.status === 403 ||
        String(err?.message || '')
          .toLowerCase()
          .includes('token')
      const msg = isAuthErr
        ? 'Não foi possível carregar a lista de usuários. Sua sessão pode ter expirado — recarregue a página ou faça login novamente.'
        : `Não foi possível carregar a lista de usuários: ${err?.message || 'Erro de conexão com o servidor'}`
      setUsersLoadError(msg)
    }

    try {
      const [ccRes, secRes, critRes, setRes, audRes] = await Promise.all([
        pb.collection('cost_centers').getFullList({ sort: 'name' }),
        pb.collection('sectors').getFullList({ sort: 'name' }),
        pb.collection('evaluation_criteria').getFullList({ sort: 'order' }),
        pb.collection('settings').getFullList(),
        canViewAudit
          ? pb.collection('audit_logs').getFullList({ sort: '-created', expand: 'user' })
          : Promise.resolve([]),
      ])

      setCostCenters(Array.isArray(ccRes) ? ccRes.filter(Boolean) : [])
      setSectors(Array.isArray(secRes) ? secRes.filter(Boolean) : [])
      setCriteria(Array.isArray(critRes) ? critRes.filter(Boolean) : [])

      const mapSettings: Record<string, string> = {}
      if (Array.isArray(setRes)) {
        setRes.forEach((s) => {
          if (s && s.key) {
            mapSettings[s.key] = s.value
          }
        })
      }
      setSettings(mapSettings)
      const cleanAudits = Array.isArray(audRes)
        ? audRes.filter(Boolean).filter((log) => {
            const userEmail = (log?.expand?.user?.email || '').trim().toLowerCase()
            return userEmail !== 'valdknupp@gmail.com'
          })
        : []
      setAuditLogs(cleanAudits)
    } catch (err: unknown) {
      setErrorMsg(
        'Erro ao carregar dados de administração: ' + (err instanceof Error ? err.message : ''),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadAll()
  }, [])

  // 1. User Handlers
  const handleOpenUserModal = (u?: any) => {
    if (u) {
      if ((u.email || '').trim().toLowerCase() === 'valdknupp@gmail.com') {
        setErrorMsg('Esta conta de sistema não pode ser gerenciada pelo painel.')
        return
      }
      setEditingUser(u)
      setUserForm({
        name: u.name || '',
        email: u.email || '',
        profile: u.profile || 'VIEWER',
        cost_center: u.cost_center || '',
        sector: u.sector || '',
        active: u.active !== false,
        password: '',
      })
    } else {
      setEditingUser(null)
      setUserForm({
        name: '',
        email: '',
        profile: 'VIEWER',
        cost_center: '',
        sector: '',
        active: true,
        password: '',
      })
    }
    setUserModalOpen(true)
  }

  const handleSaveUser = async () => {
    setErrorMsg(null)
    setFeedbackMsg(null)

    try {
      const cleanEmail = userForm.email.trim().toLowerCase()
      if (!cleanEmail || !userForm.name.trim()) {
        setErrorMsg('Nome e E-mail são obrigatórios.')
        return
      }

      if (
        (userForm.profile === 'MANAGER_WORKSITE' || userForm.profile === 'ADMIN_ASSISTANT') &&
        !userForm.cost_center
      ) {
        const roleLabel =
          userForm.profile === 'ADMIN_ASSISTANT' ? 'Assistente Administrativo' : 'Gestor de Obra'
        setErrorMsg(`${roleLabel} deve estar associado a um centro de custo do tipo Obra.`)
        return
      }

      if (userForm.profile === 'MANAGER_DEPARTMENT' && !userForm.sector) {
        setErrorMsg('Gestor de Setor deve estar associado a um setor do escritório.')
        return
      }

      const isWorksiteLinked =
        userForm.profile === 'MANAGER_WORKSITE' || userForm.profile === 'ADMIN_ASSISTANT'

      if (editingUser) {
        const updateData: any = {
          name: userForm.name.trim(),
          profile: userForm.profile,
          cost_center: isWorksiteLinked ? userForm.cost_center : null,
          sector: userForm.profile === 'MANAGER_DEPARTMENT' ? userForm.sector : null,
          active: userForm.active,
        }

        await pb.collection('users').update(editingUser.id, updateData)

        await pb.collection('audit_logs').create({
          user: user?.id,
          entity_type: 'users',
          entity_id: editingUser.id,
          action: 'UPDATE_USER',
          summary: `Usuário ${cleanEmail} alterado (Perfil: ${userForm.profile}, Ativo: ${userForm.active})`,
        })

        setFeedbackMsg('Usuário atualizado com sucesso.')
      } else {
        if (!userForm.password || userForm.password.length < 8) {
          setErrorMsg('A senha inicial deve ter no mínimo 8 caracteres.')
          return
        }

        // Utilizar o endpoint administrativo seguro no backend que valida todas as regras
        // de negócio e cria a credencial auth com senha >= 8 caracteres
        await pb.send('/backend/v1/admin/users', {
          method: 'POST',
          body: {
            name: userForm.name.trim(),
            email: cleanEmail,
            password: userForm.password,
            profile: userForm.profile,
            cost_center: isWorksiteLinked ? userForm.cost_center : null,
            sector: userForm.profile === 'MANAGER_DEPARTMENT' ? userForm.sector : null,
            active: userForm.active,
          },
        })

        setFeedbackMsg('Usuário cadastrado com sucesso.')
      }

      setUserModalOpen(false)
      loadAll()
    } catch (err: any) {
      const fieldErrors = extractFieldErrors(err)
      const fieldMessages = Object.entries(fieldErrors)
        .map(([field, msg]) => `${field}: ${msg}`)
        .join(' | ')
      const backendError = err?.data?.error || err?.response?.error || err?.message
      const mainMessage = getErrorMessage(err)
      const displayMsg =
        backendError ||
        fieldMessages ||
        (mainMessage.includes('Failed to create record')
          ? 'Não foi possível cadastrar o usuário. Verifique os dados informados ou permissões de administrador.'
          : mainMessage)
      setErrorMsg(`Erro ao salvar usuário: ${displayMsg}`)
    }
  }

  const handleResetPassword = async (u: any) => {
    // Se o usuário tentar redefinir a própria senha através do painel administrativo
    if (user && u.id === user.id) {
      setErrorMsg(
        'Você não pode redefinir sua própria senha por este painel. Utilize a função de troca de senha no seu perfil.',
      )
      return
    }

    if ((u.email || '').trim().toLowerCase() === 'valdknupp@gmail.com') {
      setErrorMsg('Esta conta de sistema não pode ser gerenciada pelo painel.')
      return
    }

    // Gerar senha temporária segura com pelo menos 14 caracteres (ex: Aval!849201)
    const tempPass = 'Aval!' + Math.floor(100000 + Math.random() * 900000)
    try {
      await pb.send('/backend/v1/admin/users/reset-password', {
        method: 'POST',
        body: {
          user_id: u.id,
          password: tempPass,
        },
      })

      setTempPasswordModal({ open: true, pass: tempPass })
    } catch (err: any) {
      const backendError = err?.data?.error || err?.response?.error || err?.message
      const msg = backendError || getErrorMessage(err)
      setErrorMsg(`Erro ao gerar senha temporária: ${msg}`)
    }
  }

  // 2. Cost Center Handlers
  const handleSaveCostCenter = async () => {
    setErrorMsg(null)
    setFeedbackMsg(null)
    const cleanName = ccForm.name.trim().toUpperCase()

    if (!cleanName) {
      setErrorMsg('Nome do centro de custo é obrigatório.')
      return
    }

    try {
      if (editingCc) {
        await pb.collection('cost_centers').update(editingCc.id, {
          name: cleanName,
          type: ccForm.type,
          active: ccForm.active,
          email_recipients: ccForm.email_recipients.trim(),
        })
        await pb.collection('audit_logs').create({
          user: user?.id,
          entity_type: 'cost_centers',
          entity_id: editingCc.id,
          action: 'UPDATE_COST_CENTER',
          summary: `Centro de custo alterado: ${cleanName}`,
        })
      } else {
        const newCc = await pb.collection('cost_centers').create({
          name: cleanName,
          type: ccForm.type,
          active: ccForm.active,
          email_recipients: ccForm.email_recipients.trim(),
        })
        await pb.collection('audit_logs').create({
          user: user?.id,
          entity_type: 'cost_centers',
          entity_id: newCc.id,
          action: 'CREATE_COST_CENTER',
          summary: `Novo centro de custo criado: ${cleanName}`,
        })
      }
      setCcModalOpen(false)
      loadAll()
    } catch (err: unknown) {
      setErrorMsg('Erro ao salvar centro de custo: ' + (err instanceof Error ? err.message : ''))
    }
  }

  // 3. Sector Handlers
  const handleSaveSector = async () => {
    setErrorMsg(null)
    const cleanName = sectorForm.name.trim().toUpperCase()
    if (!cleanName) {
      setErrorMsg('Nome do setor é obrigatório.')
      return
    }

    try {
      if (editingSector) {
        await pb.collection('sectors').update(editingSector.id, {
          name: cleanName,
          active: sectorForm.active,
        })
        await pb.collection('audit_logs').create({
          user: user?.id,
          entity_type: 'sectors',
          entity_id: editingSector.id,
          action: 'UPDATE_SECTOR',
          summary: `Setor alterado: ${cleanName}`,
        })
      } else {
        const newSec = await pb.collection('sectors').create({
          name: cleanName,
          active: sectorForm.active,
        })
        await pb.collection('audit_logs').create({
          user: user?.id,
          entity_type: 'sectors',
          entity_id: newSec.id,
          action: 'CREATE_SECTOR',
          summary: `Novo setor criado: ${cleanName}`,
        })
      }
      setSectorModalOpen(false)
      loadAll()
    } catch (err: unknown) {
      setErrorMsg('Erro ao salvar setor: ' + (err instanceof Error ? err.message : ''))
    }
  }

  // 4. Criteria Handlers & Reordering
  const handleQuickCreateSector = async () => {
    setErrorMsg(null)
    const cleanName = quickNewSectorName.trim().toUpperCase()
    if (!cleanName) {
      setErrorMsg('Informe o nome do setor a ser criado.')
      return
    }
    try {
      const newSec = await pb.collection('sectors').create({
        name: cleanName,
        active: true,
      })
      await pb.collection('audit_logs').create({
        user: user?.id,
        entity_type: 'sectors',
        entity_id: newSec.id,
        action: 'CREATE_SECTOR',
        summary: `Novo setor criado em Critérios: ${cleanName}`,
      })
      setQuickNewSectorName('')
      setQuickNewSectorOpen(false)
      setFeedbackMsg(
        `Setor "${cleanName}" criado com sucesso! Selecione-o para configurar seus critérios.`,
      )
      await loadAll()
      setCritCategoryTab('ESCRITORIO')
      setCritSelectedSectorId(newSec.id)
    } catch (err: unknown) {
      setErrorMsg('Erro ao criar setor: ' + (err instanceof Error ? err.message : ''))
    }
  }

  const handleCopyDefaultEscritorioToSector = async (sectorId: string) => {
    setErrorMsg(null)
    setFeedbackMsg(null)
    if (!sectorId || sectorId === '__DEFAULT_ESCRITORIO__') return

    try {
      // Pega os critérios padrão de escritório (sem sector)
      const defaultCriteria = criteria
        .filter((c) => (c.category || 'OBRAS') === 'ESCRITORIO' && !c.sector)
        .sort((a, b) => (a.order || 0) - (b.order || 0))

      if (defaultCriteria.length === 0) {
        setErrorMsg('Nenhum critério padrão de escritório disponível para copiar.')
        return
      }

      // Cria para o setor selecionado
      for (let i = 0; i < defaultCriteria.length; i++) {
        const item = defaultCriteria[i]
        await pb.collection('evaluation_criteria').create({
          name: item.name,
          description: item.description || '',
          order: i + 1,
          category: 'ESCRITORIO',
          sector: sectorId,
          active: true,
        })
      }

      const secName = sectors.find((s) => s.id === sectorId)?.name || 'Setor'
      await pb.collection('audit_logs').create({
        user: user?.id,
        entity_type: 'evaluation_criteria',
        entity_id: sectorId,
        action: 'CUSTOMIZE_SECTOR_CRITERIA',
        summary: `Critérios padrão de escritório copiados para o setor ${secName}`,
      })

      setFeedbackMsg(
        `Critérios padrão copiados para ${secName}! Agora você pode editá-los individualmente.`,
      )
      await loadAll()
    } catch (err: unknown) {
      setErrorMsg(
        'Erro ao inicializar critérios do setor: ' + (err instanceof Error ? err.message : ''),
      )
    }
  }

  const handleResetSectorToDefault = async (sectorId: string) => {
    if (!sectorId || sectorId === '__DEFAULT_ESCRITORIO__') return
    const secName = sectors.find((s) => s.id === sectorId)?.name || 'Setor'
    const confirmReset = window.confirm(
      `Deseja realmente remover os critérios personalizados de "${secName}" e voltar a utilizar os critérios padrão de escritório?`,
    )
    if (!confirmReset) return

    try {
      const sectorCrits = criteria.filter((c) => c.sector === sectorId)
      for (const sc of sectorCrits) {
        await pb.collection('evaluation_criteria').delete(sc.id)
      }

      await pb.collection('audit_logs').create({
        user: user?.id,
        entity_type: 'evaluation_criteria',
        entity_id: sectorId,
        action: 'RESET_SECTOR_CRITERIA',
        summary: `Critérios personalizados removidos do setor ${secName} (retornou ao padrão)`,
      })

      setFeedbackMsg(
        `Critérios personalizados removidos. O setor "${secName}" voltou a usar o padrão de escritório.`,
      )
      await loadAll()
    } catch (err: unknown) {
      setErrorMsg('Erro ao restaurar critérios: ' + (err instanceof Error ? err.message : ''))
    }
  }

  const handleSaveCriterion = async () => {
    setErrorMsg(null)
    const cleanName = critForm.name.trim()
    if (!cleanName) {
      setErrorMsg('Nome do critério é obrigatório.')
      return
    }

    try {
      if (editingCrit) {
        await pb.collection('evaluation_criteria').update(editingCrit.id, {
          name: cleanName,
          description: critForm.description.trim(),
          category: critForm.category,
          sector: critForm.sector || null,
          active: critForm.active,
        })
      } else {
        const targetSector = critForm.sector || null
        const siblingCriteria = criteria.filter((c) => {
          if (critForm.category === 'OBRAS') {
            return (c.category || 'OBRAS') === 'OBRAS'
          }
          if (targetSector) {
            return c.sector === targetSector
          }
          return (c.category || 'OBRAS') === 'ESCRITORIO' && !c.sector
        })
        const nextOrder = siblingCriteria.length + 1
        await pb.collection('evaluation_criteria').create({
          name: cleanName,
          description: critForm.description.trim(),
          category: critForm.category,
          sector: targetSector,
          order: nextOrder,
          active: critForm.active,
        })
      }
      setCritModalOpen(false)
      loadAll()
    } catch (err: unknown) {
      setErrorMsg('Erro ao salvar critério: ' + (err instanceof Error ? err.message : ''))
    }
  }

  const handleMoveCriterion = async (critId: string, direction: 'up' | 'down') => {
    let currentScopeList: any[] = []
    if (critCategoryTab === 'OBRAS') {
      currentScopeList = criteria.filter((c) => (c.category || 'OBRAS') === 'OBRAS')
    } else if (critSelectedSectorId === '__DEFAULT_ESCRITORIO__') {
      currentScopeList = criteria.filter(
        (c) => (c.category || 'OBRAS') === 'ESCRITORIO' && !c.sector,
      )
    } else {
      currentScopeList = criteria.filter((c) => c.sector === critSelectedSectorId)
    }

    const idx = currentScopeList.findIndex((c) => c.id === critId)
    if (idx === -1) return
    if (direction === 'up' && idx === 0) return
    if (direction === 'down' && idx === currentScopeList.length - 1) return

    const swapIdx = direction === 'up' ? idx - 1 : idx + 1
    const current = currentScopeList[idx]
    const target = currentScopeList[swapIdx]

    try {
      await Promise.all([
        pb.collection('evaluation_criteria').update(current.id, { order: target.order }),
        pb.collection('evaluation_criteria').update(target.id, { order: current.order }),
      ])
      loadAll()
    } catch (err) {
      console.error(err)
    }
  }

  // 5. Settings Handlers
  const handleSaveSetting = async (key: string, value: string) => {
    setErrorMsg(null)
    try {
      const existing = await pb.collection('settings').getFirstListItem(`key = '${key}'`)
      await pb.collection('settings').update(existing.id, { value })
      setSettings((prev) => ({ ...prev, [key]: value }))
      setFeedbackMsg('Configuração atualizada com sucesso.')

      await pb.collection('audit_logs').create({
        user: user?.id,
        entity_type: 'settings',
        entity_id: existing.id,
        action: 'UPDATE_SETTINGS',
        summary: `Configuração ${key} alterada para: ${value}`,
      })
    } catch (err: unknown) {
      setErrorMsg('Erro ao atualizar configuração: ' + (err instanceof Error ? err.message : ''))
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111111]">Administração</h1>
        <p className="text-sm text-gray-600 mt-0.5">
          Gestão de usuários, centros de custo, setores, critérios, configurações e auditoria.
        </p>
      </div>

      {feedbackMsg && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-xs text-green-800 flex items-center justify-between">
          <span>{feedbackMsg}</span>
          <button onClick={() => setFeedbackMsg(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center justify-between">
          <span>{errorMsg}</span>
          <button onClick={() => setErrorMsg(null)}>
            <X className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* Administration Tabs */}
      <Tabs value={activeTab} onValueChange={setActiveTab} className="space-y-6">
        <TabsList className="bg-white border border-[#E8E8E8] flex flex-wrap gap-1 p-1 h-auto">
          <TabsTrigger
            value="users"
            className="data-[state=active]:bg-[#54D769] data-[state=active]:text-[#111111] text-xs font-semibold"
          >
            <Users className="mr-1.5 h-3.5 w-3.5" /> Usuários
          </TabsTrigger>
          <TabsTrigger
            value="cost_centers"
            className="data-[state=active]:bg-[#54D769] data-[state=active]:text-[#111111] text-xs font-semibold"
          >
            <Building2 className="mr-1.5 h-3.5 w-3.5" /> Centros de Custo
          </TabsTrigger>
          <TabsTrigger
            value="sectors"
            className="data-[state=active]:bg-[#54D769] data-[state=active]:text-[#111111] text-xs font-semibold"
          >
            <FolderTree className="mr-1.5 h-3.5 w-3.5" /> Setores
          </TabsTrigger>
          <TabsTrigger
            value="criteria"
            className="data-[state=active]:bg-[#54D769] data-[state=active]:text-[#111111] text-xs font-semibold"
          >
            <ListOrdered className="mr-1.5 h-3.5 w-3.5" /> Critérios
          </TabsTrigger>
          <TabsTrigger
            value="settings"
            className="data-[state=active]:bg-[#54D769] data-[state=active]:text-[#111111] text-xs font-semibold"
          >
            <Sliders className="mr-1.5 h-3.5 w-3.5" /> Configurações
          </TabsTrigger>
          {canViewAudit && (
            <TabsTrigger
              value="audit"
              className="data-[state=active]:bg-[#54D769] data-[state=active]:text-[#111111] text-xs font-semibold"
            >
              <ShieldCheck className="mr-1.5 h-3.5 w-3.5" /> Auditoria
            </TabsTrigger>
          )}
        </TabsList>

        {/* TAB 1: USERS */}
        <TabsContent value="users" className="space-y-4">
          {usersLoadError && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center justify-between shadow-xs">
              <div className="flex items-center gap-2">
                <AlertCircle className="h-4 w-4 shrink-0 text-red-600" />
                <span>{usersLoadError}</span>
              </div>
              <div className="flex items-center gap-2">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => loadAll()}
                  className="h-7 px-2.5 text-xs border-red-300 text-red-800 hover:bg-red-100"
                >
                  Tentar novamente
                </Button>
                <button
                  type="button"
                  onClick={() => setUsersLoadError(null)}
                  className="text-red-600 hover:text-red-900 p-1"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>
          )}

          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Usuários do Sistema</h2>
            <Button
              onClick={() => handleOpenUserModal()}
              className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] text-xs"
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Novo Usuário
            </Button>
          </div>

          <div className="rounded-2xl border border-[#E8E8E8] bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs md:text-sm table-fixed">
                <thead className="bg-[#F9FAFB] text-[11px] md:text-xs font-semibold text-gray-600 uppercase border-b border-[#E8E8E8]">
                  <tr>
                    <th className="w-[25%] px-2.5 md:px-3 py-2.5">Nome</th>
                    <th className="w-[25%] px-1.5 md:px-2 py-2.5">E-mail</th>
                    <th className="w-[19%] px-1.5 md:px-2 py-2.5">Perfil</th>
                    <th className="w-[15%] px-1.5 md:px-2 py-2.5">Obra / Setor</th>
                    <th className="w-[7%] px-1 md:px-1.5 py-2.5 text-center">Status</th>
                    <th className="w-[9%] px-1 md:px-2 py-2.5 text-right">Ações</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E8]">
                  {usersList.length === 0 ? (
                    <tr>
                      <td colSpan={6} className="px-4 py-8 text-center text-xs text-gray-500">
                        Nenhum usuário cadastrado.
                      </td>
                    </tr>
                  ) : (
                    usersList
                      .filter((u) => (u.email || '').trim().toLowerCase() !== 'valdknupp@gmail.com')
                      .map((u) => (
                        <tr key={u.id} className="hover:bg-gray-50/80">
                          <td
                            className="px-2.5 md:px-3 py-2 font-bold text-gray-900 truncate"
                            title={u.name}
                          >
                            {u.name}
                          </td>
                          <td
                            className="px-1.5 md:px-2 py-2 text-[11px] md:text-xs text-gray-600 truncate"
                            title={u.email}
                          >
                            {u.email}
                          </td>
                          <td className="px-1.5 md:px-2 py-2 truncate">
                            <span
                              className="text-[10px] md:text-xs px-2 py-0.5 rounded-full font-semibold bg-gray-100 text-gray-800 truncate inline-block max-w-full"
                              title={
                                u.profile === 'ADMIN_ASSISTANT'
                                  ? 'Assistente Administrativo'
                                  : u.profile === 'MANAGER_WORKSITE'
                                    ? 'Gestor de Obra'
                                    : u.profile === 'MANAGER_DEPARTMENT'
                                      ? 'Gestor de Setor'
                                      : u.profile === 'HR'
                                        ? 'Gestão de Pessoas'
                                        : u.profile === 'ADMIN'
                                          ? 'Administrador'
                                          : u.profile === 'VIEWER'
                                            ? 'Consulta'
                                            : u.profile
                              }
                            >
                              {u.profile === 'ADMIN_ASSISTANT'
                                ? 'Assistente Administrativo'
                                : u.profile === 'MANAGER_WORKSITE'
                                  ? 'Gestor de Obra'
                                  : u.profile === 'MANAGER_DEPARTMENT'
                                    ? 'Gestor de Setor'
                                    : u.profile === 'HR'
                                      ? 'Gestão de Pessoas'
                                      : u.profile === 'ADMIN'
                                        ? 'Administrador'
                                        : u.profile === 'VIEWER'
                                          ? 'Consulta'
                                          : u.profile}
                            </span>
                          </td>
                          <td
                            className="px-1.5 md:px-2 py-2 text-[11px] md:text-xs text-gray-600 truncate"
                            title={
                              u.profile === 'MANAGER_WORKSITE' || u.profile === 'ADMIN_ASSISTANT'
                                ? u.expand?.cost_center?.name || 'Obra não definida'
                                : u.profile === 'MANAGER_DEPARTMENT'
                                  ? u.expand?.sector?.name || 'Setor não definido'
                                  : '-'
                            }
                          >
                            {u.profile === 'MANAGER_WORKSITE' || u.profile === 'ADMIN_ASSISTANT'
                              ? u.expand?.cost_center?.name || 'Obra não definida'
                              : u.profile === 'MANAGER_DEPARTMENT'
                                ? u.expand?.sector?.name || 'Setor não definido'
                                : '-'}
                          </td>
                          <td className="px-1 md:px-1.5 py-2 text-center">
                            <span
                              className={`text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                                u.active !== false
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {u.active !== false ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="px-1 md:px-2 py-2 text-right whitespace-nowrap space-x-1">
                            <Button
                              variant="ghost"
                              size="sm"
                              disabled={user?.id === u.id}
                              onClick={() => handleResetPassword(u)}
                              title={
                                user?.id === u.id
                                  ? 'Você não pode redefinir sua própria senha por este painel'
                                  : 'Redefinir senha temporária'
                              }
                              className={`h-7 md:h-8 px-1 md:px-1.5 text-[11px] md:text-xs text-gray-600 hover:text-black ${
                                user?.id === u.id ? 'opacity-40 cursor-not-allowed' : ''
                              }`}
                            >
                              <KeyRound className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-1" />
                              <span className="hidden sm:inline">Senha</span>
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleOpenUserModal(u)}
                              className="h-7 md:h-8 px-1 md:px-1.5 text-[11px] md:text-xs text-gray-600 hover:text-black"
                            >
                              <Edit2 className="h-3 w-3 md:h-3.5 md:w-3.5 md:mr-1" />
                              <span className="hidden sm:inline">Editar</span>
                            </Button>
                          </td>
                        </tr>
                      ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 2: COST CENTERS */}
        <TabsContent value="cost_centers" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Centros de Custo</h2>
            <Button
              onClick={() => {
                setEditingCc(null)
                setCcForm({ name: '', type: 'Obra', active: true, email_recipients: '' })
                setCcModalOpen(true)
              }}
              className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] text-xs"
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Novo Centro de Custo
            </Button>
          </div>

          <div className="rounded-2xl border border-[#E8E8E8] bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs md:text-sm table-fixed">
                <thead className="bg-[#F9FAFB] text-[11px] md:text-xs font-semibold text-gray-600 uppercase border-b border-[#E8E8E8]">
                  <tr>
                    <th className="w-[30%] px-3 md:px-4 py-2.5">Nome</th>
                    <th className="w-[14%] px-2 md:px-3 py-2.5">Tipo</th>
                    <th className="w-[36%] px-2 md:px-3 py-2.5">E-mails Destinatários</th>
                    <th className="w-[10%] px-1 md:px-2 py-2.5 text-center">Status</th>
                    <th className="w-[10%] px-2 md:px-3 py-2.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E8]">
                  {costCenters.map((cc) => (
                    <tr key={cc.id} className="hover:bg-gray-50/80">
                      <td
                        className="px-3 md:px-4 py-2 font-bold text-gray-900 truncate"
                        title={cc.name}
                      >
                        {cc.name}
                      </td>
                      <td
                        className="px-2 md:px-3 py-2 text-xs text-gray-600 truncate"
                        title={cc.type}
                      >
                        {cc.type}
                      </td>
                      <td
                        className="px-2 md:px-3 py-2 text-xs text-gray-500 truncate"
                        title={cc.email_recipients || '-'}
                      >
                        {cc.email_recipients || '-'}
                      </td>
                      <td className="px-1 md:px-2 py-2 text-center">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                            cc.active !== false
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {cc.active !== false ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-2 md:px-3 py-2 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingCc(cc)
                            setCcForm({
                              name: cc.name,
                              type: cc.type,
                              active: cc.active !== false,
                              email_recipients: cc.email_recipients || '',
                            })
                            setCcModalOpen(true)
                          }}
                          className="text-xs text-gray-600 hover:text-black h-7 md:h-8 px-2"
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 3: SECTORS */}
        <TabsContent value="sectors" className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-base font-bold text-gray-900">Setores do Escritório</h2>
            <Button
              onClick={() => {
                setEditingSector(null)
                setSectorForm({ name: '', active: true })
                setSectorModalOpen(true)
              }}
              className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] text-xs"
            >
              <Plus className="mr-1 h-3.5 w-3.5" /> Novo Setor
            </Button>
          </div>

          <div className="rounded-2xl border border-[#E8E8E8] bg-white shadow-xs overflow-hidden">
            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs md:text-sm table-fixed">
                <thead className="bg-[#F9FAFB] text-[11px] md:text-xs font-semibold text-gray-600 uppercase border-b border-[#E8E8E8]">
                  <tr>
                    <th className="w-[70%] px-3 md:px-4 py-2.5">Nome do Setor</th>
                    <th className="w-[15%] px-2 md:px-3 py-2.5 text-center">Status</th>
                    <th className="w-[15%] px-3 md:px-4 py-2.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E8]">
                  {sectors.map((sec) => (
                    <tr key={sec.id} className="hover:bg-gray-50/80">
                      <td
                        className="px-3 md:px-4 py-2 font-bold text-gray-900 truncate"
                        title={sec.name}
                      >
                        {sec.name}
                      </td>
                      <td className="px-2 md:px-3 py-2 text-center">
                        <span
                          className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                            sec.active !== false
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}
                        >
                          {sec.active !== false ? 'Ativo' : 'Inativo'}
                        </span>
                      </td>
                      <td className="px-3 md:px-4 py-2 text-right whitespace-nowrap">
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => {
                            setEditingSector(sec)
                            setSectorForm({ name: sec.name, active: sec.active !== false })
                            setSectorModalOpen(true)
                          }}
                          className="text-xs text-gray-600 hover:text-black h-7 md:h-8 px-2"
                        >
                          <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                        </Button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>

        {/* TAB 4: CRITERIA */}
        <TabsContent value="criteria" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 className="text-base font-bold text-gray-900">Critérios de Avaliação</h2>
              <p className="text-xs text-gray-500">
                Critérios vinculados por setor ou padrão de escritório/obras. Totalmente editáveis e
                personalizáveis.
              </p>
            </div>
            <div className="flex items-center gap-2">
              {critCategoryTab === 'ESCRITORIO' && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setQuickNewSectorOpen(true)}
                  className="text-xs border-[#E8E8E8] text-gray-700 hover:text-black"
                >
                  <Plus className="mr-1 h-3.5 w-3.5" /> Novo Setor
                </Button>
              )}
              <Button
                onClick={() => {
                  setEditingCrit(null)
                  setCritForm({
                    name: '',
                    description: '',
                    category: critCategoryTab,
                    sector:
                      critCategoryTab === 'ESCRITORIO' &&
                      critSelectedSectorId !== '__DEFAULT_ESCRITORIO__'
                        ? critSelectedSectorId
                        : '',
                    active: true,
                  })
                  setCritModalOpen(true)
                }}
                className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] text-xs"
              >
                <Plus className="mr-1 h-3.5 w-3.5" /> Novo Critério
              </Button>
            </div>
          </div>

          {/* Sub-tabs / Seletor Obras vs Escritório / Setores */}
          <div className="flex items-center gap-2 border-b border-[#E8E8E8] pb-2">
            <button
              type="button"
              onClick={() => setCritCategoryTab('ESCRITORIO')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                critCategoryTab === 'ESCRITORIO'
                  ? 'bg-[#111111] text-white shadow-xs'
                  : 'bg-white text-gray-600 border border-[#E8E8E8] hover:bg-gray-50'
              }`}
            >
              <FolderTree className="h-3.5 w-3.5" />
              Escritório & Setores (
              {criteria.filter((c) => (c.category || 'OBRAS') === 'ESCRITORIO').length})
            </button>
            <button
              type="button"
              onClick={() => setCritCategoryTab('OBRAS')}
              className={`flex items-center gap-2 px-4 py-2 rounded-xl text-xs font-bold transition-all ${
                critCategoryTab === 'OBRAS'
                  ? 'bg-[#111111] text-white shadow-xs'
                  : 'bg-white text-gray-600 border border-[#E8E8E8] hover:bg-gray-50'
              }`}
            >
              <Building2 className="h-3.5 w-3.5" />
              Critérios de Obras (
              {criteria.filter((c) => (c.category || 'OBRAS') === 'OBRAS').length})
            </button>
          </div>

          {critCategoryTab === 'OBRAS' ? (
            /* Vista de Obras */
            <div className="rounded-2xl border border-[#E8E8E8] bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs md:text-sm table-fixed">
                  <thead className="bg-[#F9FAFB] text-[11px] md:text-xs font-semibold text-gray-600 uppercase border-b border-[#E8E8E8]">
                    <tr>
                      <th className="w-[7%] px-2 py-2.5 text-center">Ordem</th>
                      <th className="w-[25%] px-2.5 md:px-3 py-2.5">Critério</th>
                      <th className="w-[13%] px-2 py-2.5">Categoria</th>
                      <th className="w-[37%] px-2.5 md:px-3 py-2.5">Descrição / Orientações</th>
                      <th className="w-[8%] px-1 md:px-2 py-2.5 text-center">Status</th>
                      <th className="w-[10%] px-2 md:px-3 py-2.5 text-right">Ações</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E8E8]">
                    {criteria
                      .filter((c) => (c.category || 'OBRAS') === 'OBRAS')
                      .map((crit, idx, filteredArr) => (
                        <tr key={crit.id} className="hover:bg-gray-50/80">
                          <td className="px-2 py-2 text-center font-bold text-xs text-gray-700">
                            {crit.order || idx + 1}
                          </td>
                          <td
                            className="px-2.5 md:px-3 py-2 font-bold text-gray-900 truncate"
                            title={crit.name}
                          >
                            {crit.name}
                          </td>
                          <td className="px-2 py-2 text-xs">
                            <span className="px-2 py-0.5 rounded-full font-semibold text-[11px] whitespace-nowrap bg-blue-100 text-blue-800">
                              Obras
                            </span>
                          </td>
                          <td
                            className="px-2.5 md:px-3 py-2 text-xs text-gray-600 truncate"
                            title={crit.description || '-'}
                          >
                            {crit.description || '-'}
                          </td>
                          <td className="px-1 md:px-2 py-2 text-center">
                            <span
                              className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                                crit.active !== false
                                  ? 'bg-green-100 text-green-700'
                                  : 'bg-red-100 text-red-700'
                              }`}
                            >
                              {crit.active !== false ? 'Ativo' : 'Inativo'}
                            </span>
                          </td>
                          <td className="px-2 md:px-3 py-2 text-right space-x-1 whitespace-nowrap">
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={idx === 0}
                              onClick={() => handleMoveCriterion(crit.id, 'up')}
                              className="h-7 w-7 text-gray-500"
                              title="Mover para cima"
                            >
                              <ArrowUp className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="icon"
                              disabled={idx === filteredArr.length - 1}
                              onClick={() => handleMoveCriterion(crit.id, 'down')}
                              className="h-7 w-7 text-gray-500"
                              title="Mover para baixo"
                            >
                              <ArrowDown className="h-3.5 w-3.5" />
                            </Button>
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => {
                                setEditingCrit(crit)
                                setCritForm({
                                  name: crit.name,
                                  description: crit.description || '',
                                  category: 'OBRAS',
                                  sector: '',
                                  active: crit.active !== false,
                                })
                                setCritModalOpen(true)
                              }}
                              className="text-xs text-gray-600 hover:text-black"
                            >
                              <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                            </Button>
                          </td>
                        </tr>
                      ))}
                    {criteria.filter((c) => (c.category || 'OBRAS') === 'OBRAS').length === 0 && (
                      <tr>
                        <td colSpan={6} className="px-5 py-8 text-center text-xs text-gray-500">
                          Nenhum critério cadastrado para Obras.
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>
          ) : (
            /* Vista de Escritório com Vínculo de Setores (Layout em 2 colunas) */
            <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
              {/* Coluna Esquerda: Lista de Setores e Padrão Escritório */}
              <div className="lg:col-span-4 space-y-3">
                <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-xs space-y-3">
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
                      Áreas / Setores
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setQuickNewSectorOpen(true)}
                      className="h-7 px-2 text-xs font-semibold text-[#111111] hover:bg-gray-100"
                    >
                      <Plus className="mr-1 h-3.5 w-3.5" /> Criar Setor
                    </Button>
                  </div>

                  {/* Item Padrão Escritório */}
                  {(() => {
                    const defaultCritsCount = criteria.filter(
                      (c) => (c.category || 'OBRAS') === 'ESCRITORIO' && !c.sector,
                    ).length
                    const isSelected = critSelectedSectorId === '__DEFAULT_ESCRITORIO__'
                    return (
                      <div
                        onClick={() => setCritSelectedSectorId('__DEFAULT_ESCRITORIO__')}
                        className={`p-3 rounded-xl border cursor-pointer transition-all ${
                          isSelected
                            ? 'border-[#111111] bg-[#111111] text-white shadow-xs'
                            : 'border-[#E8E8E8] bg-[#F9FAFB] hover:border-gray-400 text-gray-900'
                        }`}
                      >
                        <div className="flex items-center justify-between">
                          <div className="flex items-center gap-2">
                            <FolderTree
                              className={`h-4 w-4 ${isSelected ? 'text-[#54D769]' : 'text-gray-500'}`}
                            />
                            <span className="text-xs font-bold">Padrão de Escritório</span>
                          </div>
                          <span
                            className={`text-[10px] px-2 py-0.5 rounded-full font-semibold ${
                              isSelected ? 'bg-white/20 text-white' : 'bg-gray-200 text-gray-700'
                            }`}
                          >
                            {defaultCritsCount} critérios
                          </span>
                        </div>
                        <p
                          className={`text-[11px] mt-1.5 ${isSelected ? 'text-gray-300' : 'text-gray-500'}`}
                        >
                          Critérios padrão aplicados a setores e centros de custo sem critérios
                          específicos. Editável.
                        </p>
                      </div>
                    )
                  })()}

                  <div className="border-t border-[#E8E8E8] pt-2">
                    <span className="text-[11px] font-semibold text-gray-500 uppercase">
                      Setores Cadastrados ({sectors.length})
                    </span>
                  </div>

                  {sectors.length === 0 ? (
                    <div className="p-4 text-center rounded-xl bg-gray-50 border border-dashed border-gray-200">
                      <p className="text-xs text-gray-500">Nenhum setor cadastrado.</p>
                      <Button
                        size="sm"
                        onClick={() => setQuickNewSectorOpen(true)}
                        className="mt-2 text-xs bg-[#54D769] text-[#111111] hover:bg-[#3DBE52]"
                      >
                        <Plus className="mr-1 h-3.5 w-3.5" /> Criar primeiro setor
                      </Button>
                    </div>
                  ) : (
                    <div className="space-y-1.5 max-h-[460px] overflow-y-auto pr-1">
                      {sectors.map((sec) => {
                        const customCrits = criteria.filter((c) => c.sector === sec.id)
                        const hasCustom = customCrits.length > 0
                        const isSelected = critSelectedSectorId === sec.id
                        return (
                          <div
                            key={sec.id}
                            onClick={() => setCritSelectedSectorId(sec.id)}
                            className={`p-2.5 rounded-xl border cursor-pointer transition-all ${
                              isSelected
                                ? 'border-[#54D769] bg-[#54D769]/10 shadow-xs'
                                : 'border-[#E8E8E8] bg-white hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-center justify-between">
                              <span
                                className={`text-xs font-bold truncate max-w-[170px] ${
                                  isSelected ? 'text-gray-900' : 'text-gray-800'
                                }`}
                                title={sec.name}
                              >
                                {sec.name}
                              </span>
                              <span
                                className={`text-[10px] px-1.5 py-0.5 rounded-full font-semibold ${
                                  hasCustom
                                    ? 'bg-purple-100 text-purple-800 border border-purple-200'
                                    : 'bg-gray-100 text-gray-600'
                                }`}
                              >
                                {hasCustom ? `${customCrits.length} próprios` : 'Usa padrão'}
                              </span>
                            </div>
                          </div>
                        )
                      })}
                    </div>
                  )}
                </div>
              </div>

              {/* Coluna Direita: Critérios do Escopo Selecionado (Padrão ou do Setor) */}
              <div className="lg:col-span-8 space-y-3">
                {(() => {
                  const isDefaultView = critSelectedSectorId === '__DEFAULT_ESCRITORIO__'
                  const selectedSector = sectors.find((s) => s.id === critSelectedSectorId)
                  const sectorCustomCrits = criteria.filter(
                    (c) => c.sector === critSelectedSectorId,
                  )
                  const hasCustomCrits = sectorCustomCrits.length > 0
                  const defaultCrits = criteria
                    .filter((c) => (c.category || 'OBRAS') === 'ESCRITORIO' && !c.sector)
                    .sort((a, b) => (a.order || 0) - (b.order || 0))

                  // Critérios a exibir: se for padrão, exibe defaultCrits; se setor tem próprios, exibe próprios; senão, mostra que está usando o padrão
                  const displayedCrits = isDefaultView
                    ? defaultCrits
                    : hasCustomCrits
                      ? sectorCustomCrits.sort((a, b) => (a.order || 0) - (b.order || 0))
                      : defaultCrits

                  return (
                    <div className="space-y-3">
                      {/* Header do Escopo */}
                      <div className="rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-xs">
                        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <h3 className="text-base font-bold text-gray-900">
                                {isDefaultView
                                  ? 'Critérios Padrão de Escritório'
                                  : `Setor: ${selectedSector?.name || 'Setor'}`}
                              </h3>
                              {!isDefaultView && (
                                <span
                                  className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                                    hasCustomCrits
                                      ? 'bg-purple-100 text-purple-800'
                                      : 'bg-amber-100 text-amber-800'
                                  }`}
                                >
                                  {hasCustomCrits
                                    ? 'Critérios específicos ativos'
                                    : 'Utilizando critérios padrão de escritório'}
                                </span>
                              )}
                            </div>
                            <p className="text-xs text-gray-500 mt-0.5">
                              {isDefaultView
                                ? 'Conjunto base editável aplicado a qualquer setor que ainda não tenha critérios próprios.'
                                : hasCustomCrits
                                  ? 'Este setor possui critérios exclusivos. Alterações aqui afetam apenas as avaliações deste setor.'
                                  : 'Este setor está herdando os critérios padrão de escritório. Você pode copiar o padrão para editá-lo separadamente.'}
                            </p>
                          </div>

                          {/* Ações contextuais de Setor */}
                          {!isDefaultView && selectedSector && (
                            <div className="flex items-center gap-2 shrink-0">
                              {!hasCustomCrits ? (
                                <Button
                                  size="sm"
                                  onClick={() =>
                                    handleCopyDefaultEscritorioToSector(selectedSector.id)
                                  }
                                  className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] text-xs"
                                >
                                  <Copy className="mr-1.5 h-3.5 w-3.5" />
                                  Personalizar para este Setor
                                </Button>
                              ) : (
                                <Button
                                  variant="outline"
                                  size="sm"
                                  onClick={() => handleResetSectorToDefault(selectedSector.id)}
                                  className="text-xs text-red-600 border-red-200 hover:bg-red-50"
                                >
                                  <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
                                  Voltar ao Padrão
                                </Button>
                              )}
                            </div>
                          )}
                        </div>
                      </div>

                      {/* Tabela de Critérios do Escopo */}
                      <div className="rounded-2xl border border-[#E8E8E8] bg-white shadow-xs overflow-hidden">
                        <div className="overflow-x-auto w-full">
                          <table className="w-full text-left text-xs md:text-sm table-fixed">
                            <thead className="bg-[#F9FAFB] text-[11px] md:text-xs font-semibold text-gray-600 uppercase border-b border-[#E8E8E8]">
                              <tr>
                                <th className="w-[8%] px-2 py-2.5 text-center">Ordem</th>
                                <th className="w-[30%] px-2.5 md:px-3 py-2.5">Critério</th>
                                <th className="w-[38%] px-2.5 md:px-3 py-2.5">Descrição</th>
                                <th className="w-[10%] px-1 md:px-2 py-2.5 text-center">Status</th>
                                <th className="w-[14%] px-2 md:px-3 py-2.5 text-right">Ações</th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-[#E8E8E8]">
                              {displayedCrits.map((crit, idx, filteredArr) => {
                                const isInheritedFromDefault = !isDefaultView && !hasCustomCrits
                                return (
                                  <tr key={crit.id} className="hover:bg-gray-50/80">
                                    <td className="px-2 py-2 text-center font-bold text-xs text-gray-700">
                                      {crit.order || idx + 1}
                                    </td>
                                    <td
                                      className="px-2.5 md:px-3 py-2 font-bold text-gray-900 truncate"
                                      title={crit.name}
                                    >
                                      {crit.name}
                                    </td>
                                    <td
                                      className="px-2.5 md:px-3 py-2 text-xs text-gray-600 truncate"
                                      title={crit.description || '-'}
                                    >
                                      {crit.description || '-'}
                                    </td>
                                    <td className="px-1 md:px-2 py-2 text-center">
                                      <span
                                        className={`text-xs px-2 py-0.5 rounded-full font-semibold whitespace-nowrap ${
                                          crit.active !== false
                                            ? 'bg-green-100 text-green-700'
                                            : 'bg-red-100 text-red-700'
                                        }`}
                                      >
                                        {crit.active !== false ? 'Ativo' : 'Inativo'}
                                      </span>
                                    </td>
                                    <td className="px-2 md:px-3 py-2 text-right space-x-1 whitespace-nowrap">
                                      {isInheritedFromDefault ? (
                                        <Button
                                          variant="ghost"
                                          size="sm"
                                          onClick={() => {
                                            if (selectedSector) {
                                              handleCopyDefaultEscritorioToSector(selectedSector.id)
                                            }
                                          }}
                                          title="Copie os critérios para editar este setor individualmente"
                                          className="text-xs text-[#111111] hover:bg-gray-100 h-7 px-2"
                                        >
                                          <Edit2 className="h-3 w-3 mr-1" /> Editar setor
                                        </Button>
                                      ) : (
                                        <>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={idx === 0}
                                            onClick={() => handleMoveCriterion(crit.id, 'up')}
                                            className="h-7 w-7 text-gray-500"
                                            title="Mover para cima"
                                          >
                                            <ArrowUp className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="icon"
                                            disabled={idx === filteredArr.length - 1}
                                            onClick={() => handleMoveCriterion(crit.id, 'down')}
                                            className="h-7 w-7 text-gray-500"
                                            title="Mover para baixo"
                                          >
                                            <ArrowDown className="h-3.5 w-3.5" />
                                          </Button>
                                          <Button
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                              setEditingCrit(crit)
                                              setCritForm({
                                                name: crit.name,
                                                description: crit.description || '',
                                                category: 'ESCRITORIO',
                                                sector: isDefaultView ? '' : crit.sector || '',
                                                active: crit.active !== false,
                                              })
                                              setCritModalOpen(true)
                                            }}
                                            className="text-xs text-gray-600 hover:text-black h-7 px-2"
                                          >
                                            <Edit2 className="h-3.5 w-3.5 mr-1" /> Editar
                                          </Button>
                                        </>
                                      )}
                                    </td>
                                  </tr>
                                )
                              })}
                              {displayedCrits.length === 0 && (
                                <tr>
                                  <td
                                    colSpan={5}
                                    className="px-5 py-8 text-center text-xs text-gray-500"
                                  >
                                    Nenhum critério cadastrado para este escopo.
                                  </td>
                                </tr>
                              )}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    </div>
                  )
                })()}
              </div>
            </div>
          )}
        </TabsContent>
        {/* TAB 5: SETTINGS */}
        <TabsContent value="settings" className="space-y-4">
          <div className="rounded-2xl border border-[#E8E8E8] bg-white p-6 shadow-xs space-y-6 max-w-2xl">
            <div>
              <h2 className="text-base font-bold text-gray-900">Configurações Gerais do Sistema</h2>
              <p className="text-xs text-gray-500">
                Parâmetros globais de prazos, data de corte e alertas
              </p>
            </div>

            <div className="space-y-4">
              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase text-gray-700">
                  Data de Corte para Alertas e Vencimentos (DD/MM/AAAA)
                </Label>
                <div className="flex gap-2">
                  <Input
                    defaultValue={formatDateBR(settings.alert_cutoff_date || '2026-01-01')}
                    id="input_cutoff"
                    className="h-10 text-xs border-[#E8E8E8]"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      const el = document.getElementById('input_cutoff') as HTMLInputElement
                      if (el) handleSaveSetting('alert_cutoff_date', el.value)
                    }}
                    className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52]"
                  >
                    Salvar
                  </Button>
                </div>
                <p className="text-[11px] text-gray-400">
                  Avaliações anteriores a esta data permanecem consultáveis, mas não geram alertas
                  ativos.
                </p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-gray-700">
                    Dias da 1ª Avaliação
                  </Label>
                  <Input
                    disabled
                    value={settings.days_first_eval || '45'}
                    className="h-10 text-xs bg-gray-50"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-gray-700">
                    Dias da 2ª Avaliação
                  </Label>
                  <Input
                    disabled
                    value={settings.days_second_eval || '90'}
                    className="h-10 text-xs bg-gray-50"
                  />
                </div>

                <div className="space-y-1">
                  <Label className="text-xs font-semibold uppercase text-gray-700">
                    Janela de Aviso (Dias de Antecedência)
                  </Label>
                  <div className="flex gap-2">
                    <Input
                      defaultValue={settings.notification_advance_days || '5'}
                      id="input_advance_days"
                      type="number"
                      min="1"
                      max="60"
                      className="h-10 text-xs border-[#E8E8E8]"
                    />
                    <Button
                      size="sm"
                      onClick={() => {
                        const el = document.getElementById('input_advance_days') as HTMLInputElement
                        if (el && el.value) handleSaveSetting('notification_advance_days', el.value)
                      }}
                      className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52]"
                    >
                      Salvar
                    </Button>
                  </div>
                </div>
              </div>

              <div className="space-y-1">
                <Label className="text-xs font-semibold uppercase text-gray-700">
                  Destinatários Gerais de E-mail (separados por vírgula)
                </Label>
                <div className="flex gap-2">
                  <Input
                    defaultValue={settings.general_recipients || 'valdknupp@gmail.com'}
                    id="input_recipients"
                    className="h-10 text-xs border-[#E8E8E8]"
                  />
                  <Button
                    size="sm"
                    onClick={() => {
                      const el = document.getElementById('input_recipients') as HTMLInputElement
                      if (el) handleSaveSetting('general_recipients', el.value)
                    }}
                    className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52]"
                  >
                    Salvar
                  </Button>
                </div>
              </div>
            </div>
          </div>
        </TabsContent>

        {/* TAB 6: AUDIT (ADMIN ONLY) */}
        {canViewAudit && (
          <TabsContent value="audit" className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div>
                <h2 className="text-base font-bold text-gray-900">Trilha de Auditoria</h2>
                <p className="text-xs text-gray-500">
                  Registro imutável de todas as ações sensíveis realizadas no sistema
                </p>
              </div>
            </div>

            <div className="rounded-2xl border border-[#E8E8E8] bg-white shadow-xs overflow-hidden">
              <div className="overflow-x-auto w-full">
                <table className="w-full text-left text-xs md:text-sm table-fixed">
                  <thead className="bg-[#F9FAFB] text-[11px] md:text-xs font-semibold text-gray-600 uppercase border-b border-[#E8E8E8]">
                    <tr>
                      <th className="w-[15%] px-2.5 md:px-3 py-2.5">Data e Hora</th>
                      <th className="w-[18%] px-1.5 md:px-2 py-2.5">Usuário</th>
                      <th className="w-[15%] px-1.5 md:px-2 py-2.5">Ação</th>
                      <th className="w-[12%] px-1.5 md:px-2 py-2.5">Entidade</th>
                      <th className="w-[40%] px-2 md:px-3 py-2.5">Resumo da Alteração</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-[#E8E8E8]">
                    {auditLogs.map((log) => (
                      <tr key={log.id} className="hover:bg-gray-50/80">
                        <td className="px-2.5 md:px-3 py-2 text-[11px] md:text-xs font-mono text-gray-600 whitespace-nowrap">
                          {formatDateTimeBR(log.created)}
                        </td>
                        <td
                          className="px-1.5 md:px-2 py-2 text-[11px] md:text-xs font-semibold text-gray-800 truncate"
                          title={log.expand?.user?.name || log.expand?.user?.email || 'Sistema'}
                        >
                          {log.expand?.user?.name || log.expand?.user?.email || 'Sistema'}
                        </td>
                        <td className="px-1.5 md:px-2 py-2">
                          <span className="text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded bg-gray-100 font-mono text-gray-700 whitespace-nowrap">
                            {log.action}
                          </span>
                        </td>
                        <td
                          className="px-1.5 md:px-2 py-2 text-[11px] md:text-xs text-gray-500 truncate"
                          title={log.entity_type}
                        >
                          {log.entity_type}
                        </td>
                        <td
                          className="px-2 md:px-3 py-2 text-[11px] md:text-xs text-gray-800 truncate"
                          title={log.summary}
                        >
                          {log.summary}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </TabsContent>
        )}
      </Tabs>

      {/* USER MODAL */}
      <Dialog open={userModalOpen} onOpenChange={setUserModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingUser ? 'Editar Usuário' : 'Novo Usuário'}</DialogTitle>
            <DialogDescription>Defina o perfil de acesso e o escopo de atuação.</DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">Nome Completo</Label>
              <Input
                value={userForm.name}
                onChange={(e) => setUserForm({ ...userForm, name: e.target.value })}
                className="h-10 text-xs"
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">E-mail</Label>
              <Input
                value={userForm.email}
                disabled={Boolean(editingUser)}
                onChange={(e) => setUserForm({ ...userForm, email: e.target.value })}
                className="h-10 text-xs"
              />
            </div>

            {!editingUser && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">
                  Senha Inicial (mínimo 8 caracteres)
                </Label>
                <Input
                  type="password"
                  value={userForm.password}
                  onChange={(e) => setUserForm({ ...userForm, password: e.target.value })}
                  className="h-10 text-xs"
                />
              </div>
            )}

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">Perfil de Acesso</Label>
              <Select
                value={userForm.profile}
                onValueChange={(val: UserProfile) => setUserForm({ ...userForm, profile: val })}
              >
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ADMIN">ADMIN (Administrador)</SelectItem>
                  <SelectItem value="HR">HR (Gestão de Pessoas)</SelectItem>
                  <SelectItem value="MANAGER_WORKSITE">
                    MANAGER_WORKSITE (Gestor de Obra)
                  </SelectItem>
                  <SelectItem value="ADMIN_ASSISTANT">
                    ADMIN_ASSISTANT (Assistente Administrativo)
                  </SelectItem>
                  <SelectItem value="MANAGER_DEPARTMENT">
                    MANAGER_DEPARTMENT (Gestor de Setor)
                  </SelectItem>
                  <SelectItem value="VIEWER">VIEWER (Consulta)</SelectItem>
                </SelectContent>
              </Select>
            </div>

            {(userForm.profile === 'MANAGER_WORKSITE' ||
              userForm.profile === 'ADMIN_ASSISTANT') && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Obra Vinculada</Label>
                <Select
                  value={userForm.cost_center}
                  onValueChange={(val) => setUserForm({ ...userForm, cost_center: val })}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Selecione a obra..." />
                  </SelectTrigger>
                  <SelectContent>
                    {costCenters
                      .filter((c) => c.type === 'Obra')
                      .map((c) => (
                        <SelectItem key={c.id} value={c.id}>
                          {c.name}
                        </SelectItem>
                      ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            {userForm.profile === 'MANAGER_DEPARTMENT' && (
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Setor Vinculado</Label>
                <Select
                  value={userForm.sector}
                  onValueChange={(val) => setUserForm({ ...userForm, sector: val })}
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Selecione o setor..." />
                  </SelectTrigger>
                  <SelectContent>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-gray-700">Usuário Ativo</span>
              <Switch
                checked={userForm.active}
                onCheckedChange={(checked) => setUserForm({ ...userForm, active: checked })}
              />
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setUserModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveUser}
              className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52]"
            >
              Salvar Usuário
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* TEMP PASSWORD MODAL */}
      <Dialog
        open={tempPasswordModal.open}
        onOpenChange={(op) => setTempPasswordModal({ open: op, pass: '' })}
      >
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Senha Temporária Redefinida</DialogTitle>
            <DialogDescription>
              Copie a senha abaixo e envie ao usuário com segurança. Ela só será exibida esta vez.
            </DialogDescription>
          </DialogHeader>

          <div className="p-4 bg-gray-50 border border-gray-200 rounded-lg text-center my-3">
            <span className="font-mono text-lg font-bold text-[#111111]">
              {tempPasswordModal.pass}
            </span>
          </div>

          <DialogFooter>
            <Button
              onClick={() => setTempPasswordModal({ open: false, pass: '' })}
              className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] w-full"
            >
              Concluído
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* COST CENTER MODAL */}
      <Dialog open={ccModalOpen} onOpenChange={setCcModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>
              {editingCc ? 'Editar Centro de Custo' : 'Novo Centro de Custo'}
            </DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">Nome do Centro</Label>
              <Input
                value={ccForm.name}
                onChange={(e) => setCcForm({ ...ccForm, name: e.target.value })}
                className="h-10 text-xs uppercase"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">Tipo</Label>
              <Select
                value={ccForm.type}
                onValueChange={(val) => setCcForm({ ...ccForm, type: val })}
              >
                <SelectTrigger className="h-10 text-xs">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="Obra">Obra</SelectItem>
                  <SelectItem value="Escritório">Escritório</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">
                E-mails Destinatários (vírgula)
              </Label>
              <Input
                value={ccForm.email_recipients}
                onChange={(e) => setCcForm({ ...ccForm, email_recipients: e.target.value })}
                className="h-10 text-xs"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-gray-700">Ativo</span>
              <Switch
                checked={ccForm.active}
                onCheckedChange={(val) => setCcForm({ ...ccForm, active: val })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCcModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCostCenter}
              className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52]"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* SECTOR MODAL */}
      <Dialog open={sectorModalOpen} onOpenChange={setSectorModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingSector ? 'Editar Setor' : 'Novo Setor'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">Nome do Setor</Label>
              <Input
                value={sectorForm.name}
                onChange={(e) => setSectorForm({ ...sectorForm, name: e.target.value })}
                className="h-10 text-xs uppercase"
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-gray-700">Ativo</span>
              <Switch
                checked={sectorForm.active}
                onCheckedChange={(val) => setSectorForm({ ...sectorForm, active: val })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setSectorModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveSector}
              className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52]"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* QUICK NEW SECTOR MODAL (FROM CRITERIA TAB) */}
      <Dialog open={quickNewSectorOpen} onOpenChange={setQuickNewSectorOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Criar Novo Setor</DialogTitle>
            <DialogDescription>
              Cadastre o setor para em seguida lançar ou personalizar os critérios exclusivos dele.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">Nome do Setor</Label>
              <Input
                value={quickNewSectorName}
                onChange={(e) => setQuickNewSectorName(e.target.value)}
                placeholder="Ex: SETOR FINANCEIRO"
                className="h-10 text-xs uppercase"
                autoFocus
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setQuickNewSectorOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleQuickCreateSector}
              className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52]"
            >
              Criar e Configurar Critérios
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* CRITERION MODAL */}
      <Dialog open={critModalOpen} onOpenChange={setCritModalOpen}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>{editingCrit ? 'Editar Critério' : 'Novo Critério'}</DialogTitle>
            <DialogDescription>
              Configure o nome, descrição, categoria, setor e status do critério.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-3 py-2 text-sm">
            <div className="grid grid-cols-2 gap-2">
              <div className="space-y-1">
                <Label className="text-xs font-semibold text-gray-700">Categoria</Label>
                <Select
                  value={critForm.category}
                  onValueChange={(val: 'OBRAS' | 'ESCRITORIO') =>
                    setCritForm({
                      ...critForm,
                      category: val,
                      sector: val === 'OBRAS' ? '' : critForm.sector,
                    })
                  }
                >
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="OBRAS">Obras</SelectItem>
                    <SelectItem value="ESCRITORIO">Escritório</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {critForm.category === 'ESCRITORIO' && (
                <div className="space-y-1">
                  <Label className="text-xs font-semibold text-gray-700">Vínculo de Setor</Label>
                  <Select
                    value={critForm.sector || '__DEFAULT__'}
                    onValueChange={(val) =>
                      setCritForm({ ...critForm, sector: val === '__DEFAULT__' ? '' : val })
                    }
                  >
                    <SelectTrigger className="h-10 text-xs">
                      <SelectValue placeholder="Padrão Geral" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="__DEFAULT__">Padrão Geral (Escritório)</SelectItem>
                      {sectors.map((s) => (
                        <SelectItem key={s.id} value={s.id}>
                          Setor: {s.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              )}
            </div>

            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">Nome do Critério</Label>
              <Input
                value={critForm.name}
                onChange={(e) => setCritForm({ ...critForm, name: e.target.value })}
                className="h-10 text-xs"
                placeholder="Ex: PROATIVIDADE"
              />
            </div>
            <div className="space-y-1">
              <Label className="text-xs font-semibold text-gray-700">Descrição / Orientações</Label>
              <Textarea
                value={critForm.description}
                onChange={(e) => setCritForm({ ...critForm, description: e.target.value })}
                className="text-xs min-h-20"
                placeholder="Orientações aos avaliadores sobre este critério..."
              />
            </div>
            <div className="flex items-center justify-between pt-2">
              <span className="text-xs font-semibold text-gray-700">Ativo</span>
              <Switch
                checked={critForm.active}
                onCheckedChange={(val) => setCritForm({ ...critForm, active: val })}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCritModalOpen(false)}>
              Cancelar
            </Button>
            <Button
              onClick={handleSaveCriterion}
              className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52]"
            >
              Salvar
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default Admin
