import React, { useState, useEffect } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  ArrowLeft,
  Building2,
  Calendar,
  Briefcase,
  User,
  ShieldCheck,
  AlertCircle,
  HelpCircle,
  CheckCircle2,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
import {
  isValidCPF,
  formatCPF,
  formatDateBR,
  parseDateToIso,
  addDaysToIsoDate,
  sha256,
  encryptCPF,
} from '@/lib/dateAndCpfUtils'

export const CollaboratorForm: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const isEditing = Boolean(id)
  const { user, canCreateCollaborator, isAdminAssistant, scopedCostCenterId } = useAuth()
  const navigate = useNavigate()

  const [costCenters, setCostCenters] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)

  // Form states
  const [name, setName] = useState('')
  const [cpf, setCpf] = useState('')
  const [costCenterId, setCostCenterId] = useState(
    isAdminAssistant && scopedCostCenterId ? scopedCostCenterId : '',
  )
  const [sectorId, setSectorId] = useState('')
  const [role, setRole] = useState('')
  const [admissionDate, setAdmissionDate] = useState('') // DD/MM/AAAA or YYYY-MM-DD
  const [formError, setFormError] = useState<string | null>(null)

  // Modals
  const [showReviewModal, setShowReviewModal] = useState(false)
  const [duplicateWarning, setDuplicateWarning] = useState<any | null>(null)
  const [showCrossCenterConfirm, setShowCrossCenterConfirm] = useState(false)

  // Selected cost center object
  const selectedCostCenter = costCenters.find((c) => c.id === costCenterId)
  const isEscritorio = selectedCostCenter?.type === 'Escritório'

  useEffect(() => {
    if (!canCreateCollaborator) {
      navigate('/collaborators')
      return
    }

    const init = async () => {
      try {
        const [ccRes, secRes] = await Promise.all([
          pb.collection('cost_centers').getFullList({ filter: 'active = true', sort: 'name' }),
          pb.collection('sectors').getFullList({ filter: 'active = true', sort: 'name' }),
        ])
        setCostCenters(ccRes)
        setSectors(secRes)

        // Se for assistente administrativo, preenche/fixa automaticamente o centro de custo vinculado
        if (isAdminAssistant && scopedCostCenterId) {
          setCostCenterId(scopedCostCenterId)
        }

        if (isEditing && id) {
          const collab = await pb.collection('collaborators').getOne(id)
          setName(collab.name)
          setRole(collab.role)
          setCostCenterId(
            isAdminAssistant && scopedCostCenterId ? scopedCostCenterId : collab.cost_center,
          )
          setSectorId(collab.sector || '')
          setAdmissionDate(formatDateBR(collab.admission_date))
          // CPF cannot be directly edited in full easily, pre-fill blank or masked
          setCpf('')
        }
      } catch (err: unknown) {
        setFormError(
          'Erro ao carregar dados do formulário: ' + (err instanceof Error ? err.message : ''),
        )
      } finally {
        setLoading(false)
      }
    }

    init()
  }, [id, isEditing, canCreateCollaborator])

  const handleCpfChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const formatted = formatCPF(e.target.value)
    setCpf(formatted)
  }

  const validateForm = (): boolean => {
    setFormError(null)

    const cleanName = name.trim().replace(/\s+/g, ' ')
    if (!cleanName) {
      setFormError('O Nome Completo é obrigatório.')
      return false
    }

    if (!isEditing) {
      const cleanCpfDigits = cpf.replace(/\D/g, '')
      if (!isValidCPF(cleanCpfDigits)) {
        setFormError('O CPF informado é inválido. Verifique os dígitos digitados.')
        return false
      }
    }

    if (!costCenterId) {
      setFormError('Selecione um Centro de Custo.')
      return false
    }

    if (isEscritorio && !sectorId) {
      setFormError('Para o centro tipo Escritório, o Setor é obrigatório.')
      return false
    }

    const cleanRole = role.trim().replace(/\s+/g, ' ')
    if (!cleanRole) {
      setFormError('A Função é obrigatória.')
      return false
    }

    const isoDate = parseDateToIso(admissionDate)
    if (!isoDate || !isoDate.includes('-')) {
      setFormError('Data de admissão inválida. Utilize o formato DD/MM/AAAA.')
      return false
    }

    return true
  }

  const handlePreSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!validateForm()) return

    if (isEditing) {
      // Direct review modal for edits
      setShowReviewModal(true)
      return
    }

    // Check duplicate CPF rules on backend
    const cleanCpfDigits = cpf.replace(/\D/g, '')
    const cpfHash = await sha256(cleanCpfDigits)

    try {
      setSaving(true)
      const res = await pb.send('/backend/v1/collaborators/check-duplicate', {
        method: 'POST',
        body: {
          cpf_hash: cpfHash,
          cost_center: costCenterId,
        },
      })

      if (res.exists) {
        if (res.has_same_center) {
          // Rule 5: Same CPF in same cost center -> BLOCK
          const match = res.same_center_match
          setFormError(
            `Este colaborador já está cadastrado neste centro de custo. (Nome: ${match.name}, Centro: ${match.cost_center_name}, Admissão: ${formatDateBR(match.admission_date)})`,
          )
          setSaving(false)
          return
        } else {
          // Rule 5: Same CPF in different cost center -> CONFIRMATION
          setDuplicateWarning(res.matches[0])
          setShowCrossCenterConfirm(true)
          setSaving(false)
          return
        }
      }

      // No duplicate, show final review modal
      setShowReviewModal(true)
    } catch (err: unknown) {
      setFormError(
        'Erro ao verificar duplicidade de CPF: ' + (err instanceof Error ? err.message : ''),
      )
    } finally {
      setSaving(false)
    }
  }

  const executeSave = async () => {
    setSaving(true)
    setFormError(null)

    try {
      const cleanName = name.trim().replace(/\s+/g, ' ').toUpperCase()
      const cleanRole = role.trim().replace(/\s+/g, ' ').toUpperCase()
      const isoAdmission = parseDateToIso(admissionDate)
      const deadline45 = addDaysToIsoDate(isoAdmission, 45)
      const deadline90 = addDaysToIsoDate(isoAdmission, 90)

      if (isEditing && id) {
        const payload: Record<string, any> = {
          name: cleanName,
          role: cleanRole,
          cost_center: costCenterId,
          sector: isEscritorio ? sectorId : null,
          admission_date: isoAdmission,
          deadline_45: deadline45,
          deadline_90: deadline90,
        }

        if (cpf && cpf.replace(/\D/g, '').length === 11) {
          const cleanDigits = cpf.replace(/\D/g, '')
          payload.cpf_hash = await sha256(cleanDigits)
          payload.cpf_encrypted = await encryptCPF(cleanDigits)
        }

        await pb.collection('collaborators').update(id, payload)

        // Audit log
        await pb.collection('audit_logs').create({
          user: user?.id,
          entity_type: 'collaborators',
          entity_id: id,
          action: 'UPDATE_COLLABORATOR',
          summary: `Cadastro atualizado do colaborador ${cleanName} (${cleanRole})`,
          client: clientId || null,
        })

        setShowReviewModal(false)
        navigate(`/collaborators/${id}`)
      } else {
        // Create new
        const cleanCpfDigits = cpf.replace(/\D/g, '')
        const cpfHash = await sha256(cleanCpfDigits)
        const encryptedCpf = await encryptCPF(cleanCpfDigits)

        const newRecord = await pb.collection('collaborators').create({
          name: cleanName,
          cpf_hash: cpfHash,
          cpf_encrypted: encryptedCpf,
          cost_center: costCenterId,
          sector: isEscritorio ? sectorId : null,
          role: cleanRole,
          admission_date: isoAdmission,
          deadline_45: deadline45,
          deadline_90: deadline90,
          situation: 'Em experiência',
          created_by: user?.id,
          client: clientId || null,
        })

        // Audit log
        await pb.collection('audit_logs').create({
          user: user?.id,
          entity_type: 'collaborators',
          entity_id: newRecord.id,
          action: 'CREATE_COLLABORATOR',
          summary: `Novo colaborador incluído: ${cleanName} no centro ${selectedCostCenter?.name}`,
          client: clientId || null,
        })

        // Create initial notification event for new collaborator
        try {
          const centerEmails = selectedCostCenter?.email_recipients || ''
          if (centerEmails) {
            for (const em of centerEmails.split(',')) {
              const cleanEm = em.trim()
              if (cleanEm) {
                await pb.collection('notifications').create({
                  event: 'new_collaborator',
                  recipient: cleanEm,
                  subject: `[Novo Colaborador] ${cleanName} incluído no centro ${selectedCostCenter?.name}`,
                  body: `O colaborador ${cleanName} (${cleanRole}) foi admitido em ${formatDateBR(isoAdmission)} com prazo de 45 dias em ${formatDateBR(deadline45)} e 90 dias em ${formatDateBR(deadline90)}.`,
                  status: 'Pendente',
                  attempts: 0,
                  dedupe_key: `new_${newRecord.id}_${cleanEm}`,
                  client: clientId || null,
                })
              }
            }
          }
        } catch {
          /* intentionally ignored */
        }

        setShowReviewModal(false)
        navigate(`/collaborators/${newRecord.id}`)
      }
    } catch (err: unknown) {
      setFormError('Erro ao gravar colaborador: ' + (err instanceof Error ? err.message : ''))
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      {/* Top Breadcrumb / Return */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate('/collaborators')}
          className="text-gray-500 hover:text-black"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
        </Button>
        <h1 className="text-xl font-bold text-[#111111]">
          {isEditing ? 'Editar Colaborador' : 'Novo Colaborador'}
        </h1>
      </div>

      {formError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
          <AlertCircle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <p>{formError}</p>
        </div>
      )}

      {/* Main Form Card */}
      <form
        onSubmit={handlePreSubmit}
        className="rounded-2xl border border-[#E8E8E8] bg-white p-6 sm:p-8 shadow-xs space-y-5"
      >
        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-gray-700">
            Nome Completo <span className="text-red-500">*</span>
          </Label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Ex: SILVIO CARLOS DA SILVA"
            required
            className="h-11 border-[#E8E8E8] focus-visible:ring-[#54D769] font-medium uppercase"
          />
          <p className="text-[11px] text-gray-400">Será gravado em MAIÚSCULAS.</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-gray-700">
            CPF {isEditing ? '(Opcional na edição)' : <span className="text-red-500">*</span>}
          </Label>
          <Input
            value={cpf}
            onChange={handleCpfChange}
            placeholder="000.000.000-00"
            required={!isEditing}
            maxLength={14}
            className="h-11 border-[#E8E8E8] focus-visible:ring-[#54D769] font-mono"
          />
          <p className="text-[11px] text-gray-400">
            Validado por algoritmo oficial. Armazenado com criptografia segura.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <Label className="text-xs font-semibold uppercase tracking-wider text-gray-700">
              Centro de Custo <span className="text-red-500">*</span>
            </Label>
            {isAdminAssistant && scopedCostCenterId ? (
              <div className="space-y-1">
                <Input
                  disabled
                  value={
                    costCenters.find((c) => c.id === scopedCostCenterId)?.name
                      ? `${costCenters.find((c) => c.id === scopedCostCenterId)?.name} (Obra Vinculada)`
                      : 'Obra Vinculada'
                  }
                  className="h-11 bg-gray-50 border-[#E8E8E8] text-xs font-semibold text-gray-800"
                />
                <p className="text-[11px] text-gray-400">
                  Fixo na obra do seu perfil (Assistente Administrativo).
                </p>
              </div>
            ) : (
              <Select
                value={costCenterId}
                onValueChange={(val) => {
                  setCostCenterId(val)
                  const cc = costCenters.find((c) => c.id === val)
                  if (cc?.type !== 'Escritório') {
                    setSectorId('')
                  }
                }}
              >
                <SelectTrigger className="h-11 border-[#E8E8E8]">
                  <SelectValue placeholder="Selecione o centro..." />
                </SelectTrigger>
                <SelectContent>
                  {costCenters.map((cc) => (
                    <SelectItem key={cc.id} value={cc.id}>
                      {cc.name} ({cc.type})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
          </div>

          {isEscritorio ? (
            <div className="space-y-1.5">
              <Label className="text-xs font-semibold uppercase tracking-wider text-gray-700">
                Setor (Escritório) <span className="text-red-500">*</span>
              </Label>
              <Select value={sectorId} onValueChange={setSectorId}>
                <SelectTrigger className="h-11 border-[#E8E8E8]">
                  <SelectValue placeholder="Selecione o setor..." />
                </SelectTrigger>
                <SelectContent>
                  {sectors.map((sec) => (
                    <SelectItem key={sec.id} value={sec.id}>
                      {sec.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1.5 opacity-60">
              <Label className="text-xs font-semibold uppercase tracking-wider text-gray-400">
                Setor (Apenas Escritório)
              </Label>
              <Input
                disabled
                placeholder="Não aplicável para tipo Obra"
                className="h-11 border-dashed bg-gray-50 text-xs"
              />
            </div>
          )}
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-gray-700">
            Função / Cargo <span className="text-red-500">*</span>
          </Label>
          <Input
            value={role}
            onChange={(e) => setRole(e.target.value)}
            placeholder="Ex: PEDREIRO, ENGENHEIRO CIVIL, ANALISTA RH"
            required
            className="h-11 border-[#E8E8E8] focus-visible:ring-[#54D769] font-medium uppercase"
          />
          <p className="text-[11px] text-gray-400">Será gravada em MAIÚSCULAS.</p>
        </div>

        <div className="space-y-1.5">
          <Label className="text-xs font-semibold uppercase tracking-wider text-gray-700">
            Data de Admissão <span className="text-red-500">*</span>
          </Label>
          <Input
            type="text"
            placeholder="DD/MM/AAAA (ex: 01/02/2026)"
            value={admissionDate}
            onChange={(e) => setAdmissionDate(e.target.value)}
            required
            className="h-11 border-[#E8E8E8] focus-visible:ring-[#54D769]"
          />
          {admissionDate && (
            <p className="text-xs text-gray-500 mt-1">
              Prazos calculados automaticamente: 45 dias em{' '}
              <span className="font-semibold text-black">
                {formatDateBR(addDaysToIsoDate(parseDateToIso(admissionDate), 45))}
              </span>{' '}
              e 90 dias em{' '}
              <span className="font-semibold text-black">
                {formatDateBR(addDaysToIsoDate(parseDateToIso(admissionDate), 90))}
              </span>
              .
            </p>
          )}
        </div>

        <div className="pt-4 flex items-center justify-end gap-3 border-t border-[#E8E8E8]">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate('/collaborators')}
            className="border-[#E8E8E8]"
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            disabled={saving}
            className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52]"
          >
            {saving ? 'Verificando...' : 'Revisar e Incluir'}
          </Button>
        </div>
      </form>

      {/* Review Modal before final save */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Revisar Dados do Colaborador</DialogTitle>
            <DialogDescription>
              Confira com atenção os dados antes de confirmar a inclusão.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-3 text-sm">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-2">
              <div>
                <span className="text-xs text-gray-500 block">Nome Completo:</span>
                <span className="font-semibold text-gray-900">{name.toUpperCase()}</span>
              </div>
              {cpf && (
                <div>
                  <span className="text-xs text-gray-500 block">CPF:</span>
                  <span className="font-mono text-gray-900">{cpf}</span>
                </div>
              )}
              <div>
                <span className="text-xs text-gray-500 block">Centro de Custo:</span>
                <span className="font-semibold text-gray-900">
                  {selectedCostCenter?.name} ({selectedCostCenter?.type})
                </span>
              </div>
              {isEscritorio && (
                <div>
                  <span className="text-xs text-gray-500 block">Setor:</span>
                  <span className="font-semibold text-gray-900">
                    {sectors.find((s) => s.id === sectorId)?.name}
                  </span>
                </div>
              )}
              <div>
                <span className="text-xs text-gray-500 block">Função:</span>
                <span className="font-semibold text-gray-900">{role.toUpperCase()}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Data de Admissão:</span>
                <span className="font-semibold text-gray-900">
                  {formatDateBR(parseDateToIso(admissionDate))}
                </span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">Prazos Calculados:</span>
                <span className="text-xs text-gray-800">
                  45 dias: {formatDateBR(addDaysToIsoDate(parseDateToIso(admissionDate), 45))} • 90
                  dias: {formatDateBR(addDaysToIsoDate(parseDateToIso(admissionDate), 90))}
                </span>
              </div>
            </div>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowReviewModal(false)} disabled={saving}>
              Voltar e editar
            </Button>
            <Button
              onClick={executeSave}
              disabled={saving}
              className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52]"
            >
              {saving ? 'Gravando...' : 'Confirmar inclusão'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Confirmation modal for same CPF in another cost center */}
      <Dialog open={showCrossCenterConfirm} onOpenChange={setShowCrossCenterConfirm}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-amber-600">
              <AlertCircle className="h-5 w-5" /> Colaborador já existente
            </DialogTitle>
          </DialogHeader>

          <div className="py-2 text-sm text-gray-700 space-y-3">
            <p>
              O colaborador <span className="font-bold">{duplicateWarning?.name}</span> já existe na
              base no centro de custo{' '}
              <span className="font-bold">{duplicateWarning?.cost_center_name}</span>.
            </p>
            <p className="text-xs text-gray-500">
              Deseja incluí-lo novamente em um centro de custo diferente? Isso criará um novo
              período de experiência preservando todo o histórico anterior.
            </p>
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowCrossCenterConfirm(false)}>
              Não, voltar
            </Button>
            <Button
              onClick={() => {
                setShowCrossCenterConfirm(false)
                setShowReviewModal(true)
              }}
              className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52]"
            >
              Sim, incluir no novo centro
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default CollaboratorForm
