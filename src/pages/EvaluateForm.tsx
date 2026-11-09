import React, { useState, useEffect } from 'react'
import { useParams, useSearchParams, useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  ArrowLeft,
  Building2,
  Calendar,
  AlertTriangle,
  CheckCircle2,
  HelpCircle,
  Clock,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateBR, parseDateToIso, calculateDeadlineStatus } from '@/lib/dateAndCpfUtils'

export const EvaluateForm: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const [searchParams] = useSearchParams()
  const etapaParam = searchParams.get('etapa') // "45" or "90"
  const stage = etapaParam === '90' ? '90 dias' : '45 dias'

  const navigate = useNavigate()
  const { user, canEvaluate } = useAuth()

  const [collaborator, setCollaborator] = useState<any | null>(null)
  const [criteria, setCriteria] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [pageError, setPageError] = useState<string | null>(null)

  // Form inputs
  const [answers, setAnswers] = useState<Record<string, string>>({}) // criterionId -> answer
  const [decision, setDecision] = useState<string>('') // 45d: EXTEND or TERMINATE; 90d: EFFECTIVATE or TERMINATE
  const [justification, setJustification] = useState('')
  const [notes, setNotes] = useState('')
  const [responsibleName, setResponsibleName] = useState('')
  const [responsibleRole, setResponsibleRole] = useState('')
  const [formValidationMsg, setFormValidationMsg] = useState<string | null>(null)

  // Modal
  const [showReviewModal, setShowReviewModal] = useState(false)

  useEffect(() => {
    if (!canEvaluate) {
      navigate('/collaborators')
      return
    }

    const load = async () => {
      if (!id) return
      setLoading(true)
      setPageError(null)

      try {
        const collab = await pb.collection('collaborators').getOne(id, {
          expand: 'cost_center,sector',
        })
        setCollaborator(collab)

        // Check if previous stage completed
        const existingEvals = await pb.collection('evaluations').getFullList({
          filter: `collaborator = '${id}'`,
        })

        const has45 = existingEvals.some((e) => e.stage === '45 dias')
        const has90 = existingEvals.some((e) => e.stage === '90 dias')

        if (stage === '45 dias' && has45) {
          setPageError('A avaliação de 45 dias deste colaborador já foi concluída.')
          setLoading(false)
          return
        }

        if (stage === '90 dias') {
          if (!has45) {
            setPageError(
              'A avaliação de 90 dias só pode ser realizada após a conclusão da etapa de 45 dias.',
            )
            setLoading(false)
            return
          }
          if (has90) {
            setPageError('A avaliação de 90 dias deste colaborador já foi realizada.')
            setLoading(false)
            return
          }
        }

        // Determine category based on collaborator cost center:
        // cost_center.type === 'Escritório' => 'ESCRITORIO'
        // otherwise (type === 'Obra') => 'OBRAS'
        const isEscritorio = collab.expand?.cost_center?.type === 'Escritório'
        const targetCategory = isEscritorio ? 'ESCRITORIO' : 'OBRAS'

        let resolvedCriteria: any[] = []

        if (targetCategory === 'ESCRITORIO') {
          // Se o colaborador pertencer a um setor, verifica se existem critérios personalizados para esse setor
          const sectorId = collab.sector || collab.expand?.sector?.id
          if (sectorId) {
            const sectorCrits = await pb.collection('evaluation_criteria').getFullList({
              filter: `active = true && sector = '${sectorId}'`,
              sort: 'order',
            })
            if (Array.isArray(sectorCrits) && sectorCrits.length > 0) {
              resolvedCriteria = sectorCrits
            }
          }

          // Se não encontrou critérios específicos do setor, usa os critérios padrão de escritório (sem sector)
          if (resolvedCriteria.length === 0) {
            const defaultEscritorioCrits = await pb.collection('evaluation_criteria').getFullList({
              filter: `active = true && category = 'ESCRITORIO' && (sector = null || sector = '')`,
              sort: 'order',
            })
            resolvedCriteria = Array.isArray(defaultEscritorioCrits) ? defaultEscritorioCrits : []
          }
        } else {
          // Categoria OBRAS
          const obrasCrits = await pb.collection('evaluation_criteria').getFullList({
            filter: `active = true && category = 'OBRAS'`,
            sort: 'order',
          })
          resolvedCriteria = Array.isArray(obrasCrits) ? obrasCrits : []
        }

        setCriteria(resolvedCriteria.filter(Boolean))

        // Pre-fill default decisions
        if (stage === '45 dias') {
          setDecision('EXTEND')
        } else {
          setDecision('EFFECTIVATE')
        }

        // Sugestão de UX: pré-preencher nome e função com o usuário logado se ainda estiverem vazios
        if (user) {
          const profileRoleLabels: Record<string, string> = {
            ADMIN: 'Administrador',
            HR: 'Gestão de Pessoas',
            MANAGER: 'Gestor',
            MANAGER_WORKSITE: 'Gestor',
            MANAGER_DEPARTMENT: 'Gestor',
            ADMIN_ASSISTANT: 'Assistente Administrativo',
            VIEWER: 'Consulta',
          }
          const suggestedRole = user.profile ? profileRoleLabels[user.profile] || user.profile : ''
          setResponsibleName((prev) =>
            prev ? prev : (user.name || user.email || '').toLocaleUpperCase('pt-BR'),
          )
          setResponsibleRole((prev) => (prev ? prev : suggestedRole.toLocaleUpperCase('pt-BR')))
        }
      } catch (err: unknown) {
        setPageError(
          'Erro ao carregar dados da avaliação: ' + (err instanceof Error ? err.message : ''),
        )
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [id, stage, canEvaluate])

  const handleCriterionChange = (critId: string, value: string) => {
    setAnswers((prev) => ({ ...prev, [critId]: value }))
  }

  const validate = (): boolean => {
    setFormValidationMsg(null)

    if (!responsibleName.trim()) {
      setFormValidationMsg('O Nome do Responsável pela avaliação é obrigatório.')
      return false
    }

    if (!responsibleRole.trim()) {
      setFormValidationMsg('A Função do Responsável pela avaliação é obrigatória.')
      return false
    }

    // All active criteria must be answered
    for (const c of criteria) {
      if (!answers[c.id]) {
        setFormValidationMsg(`O critério "${c.name}" precisa ser respondido.`)
        return false
      }
    }

    if (!decision) {
      setFormValidationMsg('Selecione a decisão da avaliação.')
      return false
    }

    if (decision === 'TERMINATE' && !justification.trim()) {
      setFormValidationMsg(
        'A justificativa é obrigatória em caso de encerramento de contrato ou desligamento.',
      )
      return false
    }

    return true
  }

  const handlePreSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    if (validate()) {
      setShowReviewModal(true)
    }
  }

  const handleConfirmAndSave = async () => {
    if (saving || !collaborator) return
    setSaving(true)
    setFormValidationMsg(null)

    try {
      const todayIso = parseDateToIso(new Date())

      // 1. Create evaluation record
      const evalRecord = await pb.collection('evaluations').create({
        collaborator: collaborator.id,
        stage: stage,
        evaluator: user?.id,
        decision: decision,
        justification: decision === 'TERMINATE' ? justification.trim() : '',
        notes: notes.trim(),
        responsible_name: responsibleName.trim(),
        responsible_role: responsibleRole.trim(),
        evaluated_at: todayIso,
        origin: 'manual',
      })

      // 2. Create answer records for each criterion
      await Promise.all(
        criteria.map((c) =>
          pb.collection('evaluation_answers').create({
            evaluation: evalRecord.id,
            criterion: c.id,
            answer: answers[c.id],
          }),
        ),
      )

      // (The PocketBase hook `evaluation_complete.js` automatically updates situation,
      // generates audit log, and creates the notification event)

      setShowReviewModal(false)
      navigate(`/collaborators/${collaborator.id}`)
    } catch (err: unknown) {
      setFormValidationMsg(
        'Erro ao registrar avaliação: ' + (err instanceof Error ? err.message : ''),
      )
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#111111] border-t-[#54D769]" />
      </div>
    )
  }

  if (pageError || !collaborator) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-6 text-center text-red-700 max-w-xl mx-auto space-y-4">
        <AlertTriangle className="mx-auto h-10 w-10 text-red-500" />
        <h2 className="text-base font-bold">
          {pageError || 'Não foi possível carregar a avaliação'}
        </h2>
        <Button onClick={() => navigate(`/collaborators/${id || ''}`)} variant="outline">
          Voltar para os detalhes do colaborador
        </Button>
      </div>
    )
  }

  const deadlineDate = stage === '45 dias' ? collaborator.deadline_45 : collaborator.deadline_90
  const deadlineStatus = calculateDeadlineStatus(deadlineDate)

  const getFriendlyDecision = (dec: string) => {
    if (dec === 'EXTEND') return 'Prorrogar até 90 dias'
    if (dec === 'EFFECTIVATE') return 'Efetivar colaborador'
    if (dec === 'TERMINATE')
      return stage === '45 dias' ? 'Encerrar contrato' : 'Desligar colaborador'
    return dec
  }

  const getFriendlyAnswer = (ans: string) => {
    if (ans === 'PARTIALLY_MEETS') return 'Atende parcialmente'
    if (ans === 'MEETS') return 'Atende'
    if (ans === 'DOES_NOT_MEET') return 'Não atende'
    if (ans === 'EXCEEDS') return 'Supera'
    return ans
  }

  return (
    <div className="max-w-3xl mx-auto space-y-6">
      {/* Top Header */}
      <div className="flex items-center gap-3">
        <Button
          variant="ghost"
          size="sm"
          onClick={() => navigate(`/collaborators/${collaborator.id}`)}
          className="text-gray-500 hover:text-black"
        >
          <ArrowLeft className="mr-1.5 h-4 w-4" /> Voltar
        </Button>
        <h1 className="text-xl font-bold text-[#111111]">Avaliação de {stage}</h1>
      </div>

      {formValidationMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
          <AlertTriangle className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <p>{formValidationMsg}</p>
        </div>
      )}

      {/* Collaborator Summary Card */}
      <div className="rounded-2xl border border-[#E8E8E8] bg-white p-5 shadow-xs">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">{collaborator.name}</h2>
            <p className="text-xs text-gray-500">
              {collaborator.role} • {collaborator.expand?.cost_center?.name}
              {collaborator.expand?.sector ? ` (${collaborator.expand.sector.name})` : ''}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-500">
              Admissão: {formatDateBR(collaborator.admission_date)}
            </span>
            <span
              className={`text-xs px-2.5 py-0.5 rounded-full font-semibold ${
                deadlineStatus.isOverdue
                  ? 'bg-red-100 text-red-700 border border-red-200'
                  : 'bg-green-100 text-green-700 border border-green-200'
              }`}
            >
              Prazo: {formatDateBR(deadlineDate)} ({deadlineStatus.badgeLabel})
            </span>
          </div>
        </div>
      </div>

      {/* Evaluation Form */}
      <form onSubmit={handlePreSubmit} className="space-y-6">
        {/* Responsible Section */}
        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-6 shadow-xs space-y-4">
          <div className="border-b border-gray-100 pb-2">
            <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
              Responsável pela Avaliação (Obrigatório)
            </h2>
            <p className="text-xs text-gray-500 mt-0.5">
              Identifique quem realizou/respondeu esta avaliação de desempenho. Os campos vêm
              pré-preenchidos com seus dados, mas podem ser ajustados.
            </p>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div className="space-y-1.5">
              <Label htmlFor="resp_name" className="text-xs font-semibold text-gray-700">
                Nome do Responsável pela avaliação <span className="text-red-500">*</span>
              </Label>
              <Input
                id="resp_name"
                placeholder="Ex: Carlos Eduardo de Oliveira"
                value={responsibleName}
                onChange={(e) => setResponsibleName(e.target.value.toLocaleUpperCase('pt-BR'))}
                required
                className="h-10 text-xs border-[#E8E8E8] uppercase"
              />
            </div>

            <div className="space-y-1.5">
              <Label htmlFor="resp_role" className="text-xs font-semibold text-gray-700">
                Função do Responsável <span className="text-red-500">*</span>
              </Label>
              <Input
                id="resp_role"
                placeholder="Ex: Engenheiro Residente / Encarregado Geral"
                value={responsibleRole}
                onChange={(e) => setResponsibleRole(e.target.value.toLocaleUpperCase('pt-BR'))}
                required
                className="h-10 text-xs border-[#E8E8E8] uppercase"
              />
            </div>
          </div>
        </div>

        {/* Criteria List */}
        <div className="space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
            Critérios de Avaliação (Obrigatórios)
          </h2>

          {criteria.map((crit, idx) => (
            <div
              key={crit.id}
              className="rounded-2xl border border-[#E8E8E8] bg-white p-5 shadow-xs space-y-3"
            >
              <div className="flex items-start gap-2">
                <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-[#111111] text-white text-xs font-bold">
                  {idx + 1}
                </span>
                <div>
                  <h3 className="text-sm font-bold text-gray-900">{crit.name}</h3>
                  {crit.description && (
                    <p className="text-xs text-gray-500 mt-0.5">{crit.description}</p>
                  )}
                </div>
              </div>

              <RadioGroup
                value={answers[crit.id] || ''}
                onValueChange={(val) => handleCriterionChange(crit.id, val)}
                className="grid grid-cols-1 sm:grid-cols-4 gap-2 pt-2"
              >
                {[
                  {
                    value: 'PARTIALLY_MEETS',
                    label: 'Atende parcialmente',
                    color: 'hover:border-amber-400',
                  },
                  { value: 'MEETS', label: 'Atende', color: 'hover:border-green-400' },
                  { value: 'DOES_NOT_MEET', label: 'Não atende', color: 'hover:border-red-400' },
                  { value: 'EXCEEDS', label: 'Supera', color: 'hover:border-emerald-500' },
                ].map((opt) => (
                  <label
                    key={opt.value}
                    className={`flex items-center gap-2.5 rounded-xl border p-3 cursor-pointer text-xs transition-all ${
                      answers[crit.id] === opt.value
                        ? 'border-[#54D769] bg-[#54D769]/10 font-bold text-gray-900 shadow-xs'
                        : 'border-[#E8E8E8] bg-white text-gray-700 ' + opt.color
                    }`}
                  >
                    <RadioGroupItem value={opt.value} id={`${crit.id}_${opt.value}`} />
                    <span>{opt.label}</span>
                  </label>
                ))}
              </RadioGroup>
            </div>
          ))}
        </div>

        {/* Decision Card */}
        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-6 shadow-xs space-y-4">
          <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
            Decisão da Etapa ({stage})
          </h2>

          <RadioGroup
            value={decision}
            onValueChange={setDecision}
            className="grid grid-cols-1 sm:grid-cols-2 gap-3"
          >
            {stage === '45 dias' ? (
              <>
                <label
                  className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer text-sm transition-all ${
                    decision === 'EXTEND'
                      ? 'border-[#54D769] bg-[#54D769]/10 font-bold text-gray-900'
                      : 'border-[#E8E8E8] hover:border-gray-400'
                  }`}
                >
                  <RadioGroupItem value="EXTEND" id="dec_extend" />
                  <div>
                    <span className="block font-semibold">Prorrogar até 90 dias</span>
                    <span className="text-xs text-gray-500 font-normal">
                      O colaborador continua em período de experiência.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer text-sm transition-all ${
                    decision === 'TERMINATE'
                      ? 'border-red-500 bg-red-50 font-bold text-red-900'
                      : 'border-[#E8E8E8] hover:border-red-200'
                  }`}
                >
                  <RadioGroupItem value="TERMINATE" id="dec_terminate" />
                  <div>
                    <span className="block font-semibold">Encerrar contrato</span>
                    <span className="text-xs text-gray-500 font-normal">
                      Desligamento ao término dos primeiros 45 dias.
                    </span>
                  </div>
                </label>
              </>
            ) : (
              <>
                <label
                  className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer text-sm transition-all ${
                    decision === 'EFFECTIVATE'
                      ? 'border-[#54D769] bg-[#54D769]/10 font-bold text-gray-900'
                      : 'border-[#E8E8E8] hover:border-gray-400'
                  }`}
                >
                  <RadioGroupItem value="EFFECTIVATE" id="dec_effectivate" />
                  <div>
                    <span className="block font-semibold">Efetivar Colaborador</span>
                    <span className="text-xs text-gray-500 font-normal">
                      Aprovado no período de experiência com sucesso.
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-center gap-3 rounded-xl border p-4 cursor-pointer text-sm transition-all ${
                    decision === 'TERMINATE'
                      ? 'border-red-500 bg-red-50 font-bold text-red-900'
                      : 'border-[#E8E8E8] hover:border-red-200'
                  }`}
                >
                  <RadioGroupItem value="TERMINATE" id="dec_terminate_90" />
                  <div>
                    <span className="block font-semibold">Desligar Colaborador</span>
                    <span className="text-xs text-gray-500 font-normal">
                      Não aprovado ao término dos 90 dias de experiência.
                    </span>
                  </div>
                </label>
              </>
            )}
          </RadioGroup>

          {/* Justification required for TERMINATE */}
          {decision === 'TERMINATE' && (
            <div className="space-y-1.5 pt-2">
              <Label className="text-xs font-semibold uppercase tracking-wider text-red-700">
                Justificativa Obrigatória do Desligamento / Encerramento{' '}
                <span className="text-red-600">*</span>
              </Label>
              <Textarea
                placeholder="Descreva detalhadamente os motivos da decisão de não continuidade do contrato..."
                value={justification}
                onChange={(e) => setJustification(e.target.value)}
                required
                className="min-h-24 border-red-300 focus-visible:ring-red-400"
              />
            </div>
          )}

          {/* Optional notes */}
          <div className="space-y-1.5 pt-1">
            <Label className="text-xs font-semibold uppercase tracking-wider text-gray-700">
              Observações Adicionais (Opcional)
            </Label>
            <Textarea
              placeholder="Informações complementares, pontos fortes ou sugestões de desenvolvimento..."
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              className="min-h-20 border-[#E8E8E8]"
            />
          </div>
        </div>

        {/* Action Buttons */}
        <div className="flex items-center justify-end gap-3 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => navigate(`/collaborators/${collaborator.id}`)}
          >
            Cancelar
          </Button>
          <Button
            type="submit"
            className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] px-6"
          >
            Revisar Avaliação
          </Button>
        </div>
      </form>

      {/* Review Modal before final submit */}
      <Dialog open={showReviewModal} onOpenChange={setShowReviewModal}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Revisar e Confirmar Avaliação</DialogTitle>
            <DialogDescription>
              Confira todos os critérios e a decisão antes de registrar definitivamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 py-2 text-sm">
            <div className="bg-gray-50 p-3 rounded-lg border border-gray-100 space-y-1.5">
              <p className="text-xs text-gray-500">
                Colaborador: <span className="font-bold text-gray-900">{collaborator.name}</span>
              </p>
              <p className="text-xs text-gray-500">
                Etapa: <span className="font-bold text-gray-900">{stage}</span>
              </p>
              <p className="text-xs text-gray-500">
                Responsável:{' '}
                <span className="font-bold text-gray-900">
                  {responsibleName} ({responsibleRole})
                </span>
              </p>
              <p className="text-xs text-gray-500">
                Decisão Selecionada:{' '}
                <span className="font-bold text-black">{getFriendlyDecision(decision)}</span>
              </p>
            </div>

            <div className="space-y-1">
              <span className="text-xs font-bold text-gray-600 uppercase">
                Respostas aos Critérios:
              </span>
              <div className="divide-y divide-gray-100 rounded-lg border border-gray-100 bg-white">
                {criteria.map((c) => (
                  <div key={c.id} className="flex items-center justify-between p-2 text-xs">
                    <span className="text-gray-700">{c.name}</span>
                    <span className="font-semibold text-black">
                      {getFriendlyAnswer(answers[c.id])}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {decision === 'TERMINATE' && justification && (
              <div className="p-3 bg-red-50 border border-red-100 rounded-lg text-xs space-y-1">
                <span className="font-bold text-red-900 block">Justificativa:</span>
                <p className="text-red-800">{justification}</p>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button variant="outline" onClick={() => setShowReviewModal(false)} disabled={saving}>
              Voltar e editar
            </Button>
            <Button
              onClick={handleConfirmAndSave}
              disabled={saving}
              className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52]"
            >
              {saving ? 'Registrando...' : 'Confirmar e registrar'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default EvaluateForm
