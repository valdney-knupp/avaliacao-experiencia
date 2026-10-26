import React, { useState, useEffect } from 'react'
import { useParams, useNavigate, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  ArrowLeft,
  Building2,
  Calendar,
  Briefcase,
  ShieldCheck,
  Edit,
  Clock,
  CheckCircle2,
  AlertTriangle,
  History,
  FileText,
  UserCheck,
  ChevronDown,
  ChevronUp,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import {
  formatDateBR,
  formatDateTimeBR,
  maskCPF,
  calculateDeadlineStatus,
} from '@/lib/dateAndCpfUtils'

export const CollaboratorDetail: React.FC = () => {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const { user, canCreateCollaborator, canEvaluate } = useAuth()

  const [collaborator, setCollaborator] = useState<any | null>(null)
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // Expanded criteria cards
  const [expandedEvalIds, setExpandedEvalIds] = useState<Record<string, boolean>>({})

  const toggleEvalExpanded = (evalId: string) => {
    setExpandedEvalIds((prev) => ({ ...prev, [evalId]: !prev[evalId] }))
  }

  const loadData = async () => {
    if (!id) return
    setLoading(true)
    setError(null)

    try {
      const collabRes = await pb.collection('collaborators').getOne(id, {
        expand: 'cost_center,sector,created_by',
      })
      setCollaborator(collabRes)

      // Fetch evaluations for this collaborator
      const evalsRes = await pb.collection('evaluations').getFullList({
        filter: `collaborator = '${id}'`,
        sort: 'created',
        expand: 'evaluator',
      })

      // Fetch criteria answers for each evaluation
      const safeEvals = Array.isArray(evalsRes) ? evalsRes.filter(Boolean) : []
      const evalsWithAnswers = await Promise.all(
        safeEvals.map(async (ev) => {
          try {
            const answers = await pb.collection('evaluation_answers').getFullList({
              filter: `evaluation = '${ev.id}'`,
              expand: 'criterion',
            })
            return { ...ev, answers: Array.isArray(answers) ? answers : [] }
          } catch {
            return { ...ev, answers: [] }
          }
        }),
      )
      setEvaluations(evalsWithAnswers)

      // If authorized (ADMIN/HR), load audit logs for this collaborator
      if (user?.profile === 'ADMIN' || user?.profile === 'HR') {
        const audits = await pb.collection('audit_logs').getFullList({
          filter: `entity_id = '${id}'`,
          sort: '-created',
          expand: 'user',
        })
        const cleanAudits = Array.isArray(audits)
          ? audits.filter(
              (log) =>
                (log?.expand?.user?.email || '').trim().toLowerCase() !== 'valdknupp@gmail.com',
            )
          : []
        setAuditLogs(cleanAudits)
      }
    } catch (err: unknown) {
      setError(
        'Erro ao carregar dados do colaborador: ' + (err instanceof Error ? err.message : ''),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [id, user])

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-[#111111] border-t-[#54D769]" />
      </div>
    )
  }

  if (error || !collaborator) {
    return (
      <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-center text-red-700">
        <p className="font-semibold">{error || 'Colaborador não encontrado'}</p>
        <Button onClick={() => navigate('/collaborators')} className="mt-4" variant="outline">
          Voltar para a listagem
        </Button>
      </div>
    )
  }

  // Calculate status of 45 and 90 days
  const status45 = calculateDeadlineStatus(collaborator.deadline_45)
  const status90 = calculateDeadlineStatus(collaborator.deadline_90)

  const eval45 = evaluations.find((e) => e.stage === '45 dias')
  const eval90 = evaluations.find((e) => e.stage === '90 dias')

  // Next valid evaluation step:
  // If 45 not done and situation is "Em experiência" -> can do 45
  // If 45 done, decision was EXTEND, 90 not done and situation is "Em experiência" -> can do 90
  const canDo45 = !eval45 && collaborator.situation === 'Em experiência' && canEvaluate
  const canDo90 =
    eval45 &&
    eval45.decision === 'EXTEND' &&
    !eval90 &&
    collaborator.situation === 'Em experiência' &&
    canEvaluate

  const getDecisionBadge = (decision: string) => {
    switch (decision) {
      case 'EXTEND':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-100 text-blue-800">
            Prorrogado até 90 dias
          </span>
        )
      case 'EFFECTIVATE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-green-100 text-green-800">
            Efetivado
          </span>
        )
      case 'TERMINATE':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800">
            Contrato Encerrado / Desligado
          </span>
        )
      default:
        return <span className="text-xs text-gray-500">{decision}</span>
    }
  }

  const getAnswerLabel = (ans: string) => {
    switch (ans) {
      case 'PARTIALLY_MEETS':
        return <span className="text-amber-700 font-medium">Atende parcialmente</span>
      case 'MEETS':
        return <span className="text-green-700 font-medium">Atende</span>
      case 'DOES_NOT_MEET':
        return <span className="text-red-700 font-medium">Não atende</span>
      case 'EXCEEDS':
        return <span className="text-emerald-800 font-bold">Supera</span>
      default:
        return <span>{ans || '-'}</span>
    }
  }

  return (
    <div className="space-y-6">
      {/* Header Bar */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/collaborators')}
            className="text-gray-500 hover:text-black"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Colaboradores
          </Button>
          <h1 className="text-xl font-bold text-[#111111]">{collaborator.name}</h1>
        </div>

        <div className="flex items-center gap-2">
          {canCreateCollaborator && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => navigate(`/collaborators/${collaborator.id}/edit`)}
              className="border-[#E8E8E8] text-xs"
            >
              <Edit className="mr-1.5 h-3.5 w-3.5" /> Editar dados cadastrais
            </Button>
          )}

          {canDo45 && (
            <Button
              size="sm"
              onClick={() => navigate(`/collaborators/${collaborator.id}/evaluate?etapa=45`)}
              className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] text-xs shadow-xs"
            >
              Realizar avaliação de 45 dias
            </Button>
          )}

          {canDo90 && (
            <Button
              size="sm"
              onClick={() => navigate(`/collaborators/${collaborator.id}/evaluate?etapa=90`)}
              className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] text-xs shadow-xs"
            >
              Realizar avaliação de 90 dias
            </Button>
          )}
        </div>
      </div>

      {/* Cadastral Info Cards Grid */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        {/* Basic Cadastre */}
        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Dados do Colaborador
          </h3>
          <div className="space-y-2 text-sm">
            <div>
              <span className="text-xs text-gray-400 block">CPF:</span>
              <span className="font-mono font-medium text-gray-800">{maskCPF()}</span>
            </div>
            <div>
              <span className="text-xs text-gray-400 block">Função:</span>
              <span className="font-semibold text-gray-900">{collaborator.role || '-'}</span>
            </div>
            <div>
              <span className="text-xs text-gray-400 block">Centro de Custo:</span>
              <span className="font-medium text-gray-800">
                {collaborator.expand?.cost_center?.name || 'Não definido'}
                {collaborator.expand?.cost_center?.type
                  ? ` (${collaborator.expand.cost_center.type})`
                  : ''}
              </span>
            </div>
            {collaborator.expand?.sector?.name && (
              <div>
                <span className="text-xs text-gray-400 block">Setor:</span>
                <span className="font-medium text-gray-800">{collaborator.expand.sector.name}</span>
              </div>
            )}
            <div>
              <span className="text-xs text-gray-400 block">Situação Atual:</span>
              <span className="inline-block mt-0.5 font-semibold text-xs px-2.5 py-0.5 rounded-full bg-blue-50 text-blue-700 border border-blue-200">
                {collaborator.situation || 'Não definida'}
              </span>
            </div>
          </div>
        </div>

        {/* Deadlines & Dates */}
        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Prazos do Período de Experiência
          </h3>
          <div className="space-y-3 text-sm">
            <div>
              <span className="text-xs text-gray-400 block">Data de Admissão:</span>
              <span className="font-bold text-gray-900">
                {formatDateBR(collaborator.admission_date)}
              </span>
            </div>

            <div className="rounded-lg border border-gray-100 p-2.5 bg-gray-50/70">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700">Etapa 45 dias:</span>
                <span
                  className={`font-semibold ${
                    eval45
                      ? 'text-green-600'
                      : status45.isOverdue
                        ? 'text-red-600'
                        : 'text-amber-600'
                  }`}
                >
                  {eval45 ? 'Concluída' : status45.badgeLabel}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Vencimento: {formatDateBR(collaborator.deadline_45)}
              </p>
            </div>

            <div className="rounded-lg border border-gray-100 p-2.5 bg-gray-50/70">
              <div className="flex items-center justify-between text-xs">
                <span className="font-semibold text-gray-700">Etapa 90 dias:</span>
                <span
                  className={`font-semibold ${
                    eval90
                      ? 'text-green-600'
                      : status90.isOverdue
                        ? 'text-red-600'
                        : 'text-amber-600'
                  }`}
                >
                  {eval90 ? 'Concluída' : status90.badgeLabel}
                </span>
              </div>
              <p className="text-xs text-gray-500 mt-0.5">
                Vencimento: {formatDateBR(collaborator.deadline_90)}
              </p>
            </div>
          </div>
        </div>

        {/* Cycle Progress Check */}
        <div className="rounded-2xl border border-[#E8E8E8] bg-white p-5 shadow-xs space-y-3">
          <h3 className="text-xs font-bold uppercase tracking-wider text-gray-500">
            Progresso do Ciclo
          </h3>
          <div className="space-y-4 pt-1">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  eval45 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {eval45 ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              </div>
              <div className="text-xs">
                <p className="font-semibold text-gray-900">1ª Avaliação (45 dias)</p>
                <p className="text-gray-500">
                  {eval45 ? `Realizada em ${formatDateBR(eval45.evaluated_at)}` : 'Pendente'}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <div
                className={`flex h-8 w-8 items-center justify-center rounded-full ${
                  eval90 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-400'
                }`}
              >
                {eval90 ? <CheckCircle2 className="h-5 w-5" /> : <Clock className="h-5 w-5" />}
              </div>
              <div className="text-xs">
                <p className="font-semibold text-gray-900">2ª Avaliação (90 dias)</p>
                <p className="text-gray-500">
                  {eval90
                    ? `Realizada em ${formatDateBR(eval90.evaluated_at)}`
                    : eval45?.decision === 'TERMINATE'
                      ? 'Cancelada (contrato encerrado)'
                      : 'Aguardando 1ª etapa ou prazo'}
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Tabs: Evaluations & Authorized Audit */}
      <Tabs defaultValue="evaluations" className="space-y-4">
        <TabsList className="bg-white border border-[#E8E8E8]">
          <TabsTrigger
            value="evaluations"
            className="data-[state=active]:bg-[#54D769] data-[state=active]:text-[#111111]"
          >
            Avaliações Realizadas ({evaluations.length})
          </TabsTrigger>
          {(user?.profile === 'ADMIN' || user?.profile === 'HR') && (
            <TabsTrigger
              value="audit"
              className="data-[state=active]:bg-[#54D769] data-[state=active]:text-[#111111]"
            >
              Trilha de Alterações ({auditLogs.length})
            </TabsTrigger>
          )}
        </TabsList>

        <TabsContent value="evaluations" className="space-y-4">
          {evaluations.length === 0 ? (
            <div className="rounded-2xl border border-[#E8E8E8] bg-white p-10 text-center">
              <FileText className="mx-auto h-10 w-10 text-gray-300" />
              <h4 className="mt-2 text-sm font-semibold text-gray-900">
                Nenhuma avaliação realizada ainda
              </h4>
              <p className="mt-1 text-xs text-gray-500">
                Assim que as etapas forem concluídas, as notas por critério e decisões ficarão
                arquivadas aqui.
              </p>
            </div>
          ) : (
            evaluations.map((ev) => {
              const isExpanded = !!expandedEvalIds[ev.id]
              return (
                <div
                  key={ev.id}
                  className="rounded-2xl border border-[#E8E8E8] bg-white p-6 shadow-xs space-y-4"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-gray-100 pb-3">
                    <div className="flex items-center gap-2">
                      <span className="font-bold text-base text-gray-900">
                        Avaliação de {ev.stage}
                      </span>
                      {getDecisionBadge(ev.decision)}
                    </div>
                    <div className="text-xs text-gray-500">
                      Realizada em:{' '}
                      <span className="font-semibold text-gray-800">
                        {formatDateBR(ev.evaluated_at)}
                      </span>{' '}
                      {ev.responsible_name ? (
                        <>
                          • Responsável:{' '}
                          <span className="font-semibold text-gray-800">
                            {ev.responsible_name}
                            {ev.responsible_role ? ` (${ev.responsible_role})` : ''}
                          </span>
                        </>
                      ) : (
                        <>
                          • Avaliador:{' '}
                          <span className="font-semibold text-gray-800">
                            {ev.expand?.evaluator?.name || 'Sistema / Importação'}
                          </span>
                        </>
                      )}
                    </div>
                  </div>

                  {ev.justification && (
                    <div className="bg-red-50/70 border border-red-100 p-3.5 rounded-lg text-xs space-y-1">
                      <span className="font-bold text-red-900 block">
                        Justificativa de Desligamento / Encerramento:
                      </span>
                      <p className="text-red-800">{ev.justification}</p>
                    </div>
                  )}

                  {ev.notes && (
                    <div className="bg-gray-50 border border-gray-100 p-3 rounded-lg text-xs space-y-1">
                      <span className="font-bold text-gray-700 block">Observações:</span>
                      <p className="text-gray-600">{ev.notes}</p>
                    </div>
                  )}

                  {/* Toggle criteria answers */}
                  <div>
                    <button
                      onClick={() => toggleEvalExpanded(ev.id)}
                      className="flex items-center gap-1.5 text-xs font-semibold text-gray-700 hover:text-[#54D769] transition-colors"
                    >
                      {isExpanded ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                      {isExpanded
                        ? 'Ocultar respostas por critério'
                        : `Exibir critérios e notas (${ev.answers?.length || 0})`}
                    </button>

                    {isExpanded && (
                      <div className="mt-3 grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2">
                        {!ev.answers || ev.answers.length === 0 ? (
                          <div className="col-span-full p-3 rounded-lg border border-dashed border-gray-200 bg-gray-50 text-xs text-gray-500 text-center">
                            Nenhum critério detalhado para esta avaliação.
                          </div>
                        ) : (
                          ev.answers.map((ans: any, ansIdx: number) => {
                            const crit = ans.expand?.criterion
                            const critName =
                              crit?.name || ans.criterion_name || `Critério ${ansIdx + 1}`
                            const critCategory = crit?.category ? ` • ${crit.category}` : ''
                            const isCritInactive = crit && crit.active === false

                            return (
                              <div
                                key={ans.id || `ans_${ansIdx}`}
                                className="p-3 rounded-lg border border-gray-100 bg-[#F9FAFB] text-xs space-y-1"
                              >
                                <div className="flex items-start justify-between gap-2">
                                  <span className="font-semibold text-gray-900 block">
                                    {critName}
                                  </span>
                                  {isCritInactive && (
                                    <span className="text-[10px] bg-gray-200 text-gray-600 px-1.5 py-0.2 rounded shrink-0">
                                      Inativo
                                    </span>
                                  )}
                                </div>
                                {crit?.description && (
                                  <p className="text-[11px] text-gray-500 line-clamp-2">
                                    {crit.description}
                                  </p>
                                )}
                                <div className="flex items-center justify-between pt-1">
                                  <span className="text-gray-500">
                                    Classificação{critCategory}:
                                  </span>
                                  {getAnswerLabel(ans.answer)}
                                </div>
                              </div>
                            )
                          })
                        )}
                      </div>
                    )}
                  </div>
                </div>
              )
            })
          )}
        </TabsContent>

        {(user?.profile === 'ADMIN' || user?.profile === 'HR') && (
          <TabsContent value="audit" className="space-y-3">
            <div className="rounded-2xl border border-[#E8E8E8] bg-white p-5 shadow-xs">
              <h3 className="text-sm font-semibold text-gray-900 mb-3">
                Histórico de Ações Autorizadas
              </h3>
              {auditLogs.length === 0 ? (
                <p className="text-xs text-gray-500">Nenhum evento registrado no histórico.</p>
              ) : (
                <div className="space-y-2">
                  {auditLogs.map((log) => (
                    <div
                      key={log.id}
                      className="flex items-start justify-between border-b border-gray-100 py-2.5 text-xs last:border-0"
                    >
                      <div>
                        <span className="font-semibold text-gray-800">{log.action}:</span>{' '}
                        <span className="text-gray-600">{log.summary}</span>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          Usuário: {log.expand?.user?.name || log.expand?.user?.email || 'Sistema'}
                        </p>
                      </div>
                      <span className="text-[11px] text-gray-400 shrink-0 font-mono">
                        {formatDateTimeBR(log.created)}
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </TabsContent>
        )}
      </Tabs>
    </div>
  )
}

export default CollaboratorDetail
