import React, { useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  Minus,
  CheckCircle2,
  Clock,
  Calendar,
  Award,
  BarChart3,
  Users,
  Building2,
  ArrowRight,
  Upload,
  AlertCircle,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Progress } from '@/components/ui/progress'
import { calculateDeadlineStatus, formatDateBR } from '@/lib/dateAndCpfUtils'
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  CartesianGrid,
  Cell,
} from 'recharts'

export interface EngagementMetricsProps {
  collaborators: any[]
  evaluations: any[]
  evaluationAnswers?: any[]
  costCenters: any[]
  sectors?: any[]
  loading?: boolean
  canAccessImport?: boolean
}

// Escala de pontuação das respostas para média geral de notas
// DOES_NOT_MEET = 2.5 (1 estrela / Não atende)
// PARTIALLY_MEETS = 5.0 (2 estrelas / Atende parcialmente)
// MEETS = 7.5 (3 estrelas / Atende)
// EXCEEDS = 10.0 (4 estrelas / Supera)
export const ANSWER_SCORE_MAP: Record<string, number> = {
  DOES_NOT_MEET: 2.5,
  PARTIALLY_MEETS: 5.0,
  MEETS: 7.5,
  EXCEEDS: 10.0,
}

export const DashboardEngagementMetrics: React.FC<EngagementMetricsProps> = ({
  collaborators = [],
  evaluations = [],
  evaluationAnswers = [],
  costCenters = [],
  sectors = [],
  loading = false,
  canAccessImport = false,
}) => {
  const navigate = useNavigate()

  // 1. Processamento e cálculos analíticos de engajamento
  const metrics = useMemo(() => {
    const validCollabs = Array.isArray(collaborators)
      ? collaborators.filter((c) => c && typeof c === 'object' && c.id)
      : []
    const validEvals = Array.isArray(evaluations)
      ? evaluations.filter((e) => e && typeof e === 'object' && e.id)
      : []
    const validAnswers = Array.isArray(evaluationAnswers)
      ? evaluationAnswers.filter((a) => a && typeof a === 'object' && a.answer)
      : []

    // Mapas rápidos para cruzamento
    const collabMap = new Map<string, any>()
    for (const c of validCollabs) {
      collabMap.set(c.id, c)
    }

    const costCenterMap = new Map<string, any>()
    for (const cc of costCenters) {
      if (cc && cc.id) costCenterMap.set(cc.id, cc)
    }

    const sectorMap = new Map<string, any>()
    for (const s of sectors) {
      if (s && s.id) sectorMap.set(s.id, s)
    }

    // A. Pontualidade de avaliações concluídas (no prazo vs atrasadas)
    let totalCompleted = 0
    let completedOnTime = 0
    let completedOverdue = 0

    let completed45Total = 0
    let completed45OnTime = 0
    let completed45Overdue = 0

    let completed90Total = 0
    let completed90OnTime = 0
    let completed90Overdue = 0

    for (const ev of validEvals) {
      const cId = ev.collaborator || ev.collaborator?.id
      const collab = collabMap.get(cId)
      if (!collab) continue

      const is45 = (ev.stage || '').toLowerCase().includes('45')
      const is90 = (ev.stage || '').toLowerCase().includes('90')
      const targetDeadline = is45 ? collab.deadline_45 : is90 ? collab.deadline_90 : null

      const evalDate = ev.evaluated_at || ev.created || ''

      // Se tiver prazo definido para a etapa
      let wasOnTime = true
      if (targetDeadline && evalDate) {
        const evalIso = String(evalDate).slice(0, 10)
        const deadIso = String(targetDeadline).slice(0, 10)
        if (evalIso && deadIso && evalIso > deadIso) {
          wasOnTime = false
        }
      }

      totalCompleted++
      if (wasOnTime) {
        completedOnTime++
      } else {
        completedOverdue++
      }

      if (is45) {
        completed45Total++
        if (wasOnTime) completed45OnTime++
        else completed45Overdue++
      } else if (is90) {
        completed90Total++
        if (wasOnTime) completed90OnTime++
        else completed90Overdue++
      }
    }

    const pctOnTimeTotal =
      totalCompleted > 0 ? Math.round((completedOnTime / totalCompleted) * 100) : 0
    const pct45OnTime =
      completed45Total > 0 ? Math.round((completed45OnTime / completed45Total) * 100) : 0
    const pct90OnTime =
      completed90Total > 0 ? Math.round((completed90OnTime / completed90Total) * 100) : 0

    // B. Avaliações pendentes e prazos próximos (próximos 7 dias e 15 dias)
    let pendingTotal = 0
    let pendingDueNext7Days = 0
    let pendingDueNext15Days = 0
    let pendingOverdue = 0

    for (const c of validCollabs) {
      const situation = (c.situation || '').trim()
      if (situation !== 'Em experiência') continue

      const collabEvals = validEvals.filter(
        (e) => e.collaborator === c.id || e.collaborator?.id === c.id,
      )
      const has45 = collabEvals.some((e) => (e.stage || '').toLowerCase().includes('45'))
      const has90 = collabEvals.some((e) => (e.stage || '').toLowerCase().includes('90'))
      const eval45 = collabEvals.find((e) => (e.stage || '').toLowerCase().includes('45'))

      let targetDeadline: string | null = null
      let isPending = false

      if (!has45) {
        isPending = true
        targetDeadline = c.deadline_45
      } else if (!has90 && eval45?.decision === 'EXTEND') {
        isPending = true
        targetDeadline = c.deadline_90
      }

      if (isPending) {
        pendingTotal++
        if (targetDeadline) {
          const st = calculateDeadlineStatus(targetDeadline)
          if (st.isOverdue) {
            pendingOverdue++
          } else {
            if (st.daysRemaining <= 7) {
              pendingDueNext7Days++
            }
            if (st.daysRemaining <= 15) {
              pendingDueNext15Days++
            }
          }
        }
      }
    }

    // C. Taxa de conclusão das avaliações iniciadas
    // No fluxo do sistema: uma avaliação criada pode ou não ter todas as respostas aos critérios.
    // Avaliações concluídas = possuem registro em evaluations + respostas associadas.
    let startedEvalsCount = validEvals.length
    let fullyCompletedEvalsCount = 0

    // Agrupa respostas por avaliação
    const answersByEval = new Map<string, any[]>()
    for (const ans of validAnswers) {
      const evId = ans.evaluation || ans.evaluation?.id
      if (!evId) continue
      const list = answersByEval.get(evId) || []
      list.push(ans)
      answersByEval.set(evId, list)
    }

    for (const ev of validEvals) {
      const ansList = answersByEval.get(ev.id)
      // Se tiver pelo menos 1 resposta registrada ou origin importada com decision válida
      if ((ansList && ansList.length > 0) || ev.decision) {
        fullyCompletedEvalsCount++
      }
    }

    const completionRate =
      startedEvalsCount > 0
        ? Math.round((fullyCompletedEvalsCount / startedEvalsCount) * 100)
        : validCollabs.length > 0
          ? 0
          : 0

    // D. Participação no período (últimos 30 dias vs 30 dias anteriores)
    const now = new Date()
    const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000)
    const sixtyDaysAgo = new Date(now.getTime() - 60 * 24 * 60 * 60 * 1000)

    let evalsLast30Days = 0
    let evalsPrev30Days = 0

    for (const ev of validEvals) {
      const dateStr = ev.evaluated_at || ev.created
      if (!dateStr) continue
      const evDate = new Date(dateStr)
      if (isNaN(evDate.getTime())) continue

      if (evDate >= thirtyDaysAgo && evDate <= now) {
        evalsLast30Days++
      } else if (evDate >= sixtyDaysAgo && evDate < thirtyDaysAgo) {
        evalsPrev30Days++
      }
    }

    let trendPct = 0
    let trendDirection: 'up' | 'down' | 'neutral' = 'neutral'
    if (evalsPrev30Days > 0) {
      trendPct = Math.round(((evalsLast30Days - evalsPrev30Days) / evalsPrev30Days) * 100)
      if (trendPct > 0) trendDirection = 'up'
      else if (trendPct < 0) trendDirection = 'down'
      else trendDirection = 'neutral'
    } else if (evalsLast30Days > 0) {
      trendPct = 100
      trendDirection = 'up'
    }

    // E. Média geral de notas por setor / centro de custo
    // Calcula a pontuação média com base nas respostas registradas
    // Pontuação: DOES_NOT_MEET (2.5), PARTIALLY_MEETS (5.0), MEETS (7.5), EXCEEDS (10.0)
    // Agrupamento principal por Centro de Custo / Setor
    const groupScoreMap = new Map<
      string,
      { id: string; name: string; type: string; totalScore: number; count: number }
    >()

    for (const ev of validEvals) {
      const cId = ev.collaborator || ev.collaborator?.id
      const collab = collabMap.get(cId)
      if (!collab) continue

      const ccId = collab.cost_center || collab.expand?.cost_center?.id
      const secId = collab.sector || collab.expand?.sector?.id

      const ccObj = costCenterMap.get(ccId)
      const secObj = sectorMap.get(secId)

      // Se for Escritório e tiver setor, rotula pelo Setor; caso contrário, pelo Centro de Custo
      const isOffice = ccObj?.type === 'Escritório'
      const groupKey = isOffice && secObj ? `sec_${secObj.id}` : ccId || 'outros'
      const groupName =
        isOffice && secObj ? `${secObj.name} (Escritório)` : ccObj?.name || 'Não informado'
      const groupType = isOffice ? 'Setor' : ccObj?.type || 'Obra'

      const ansList = answersByEval.get(ev.id) || []
      for (const ans of ansList) {
        const score = ANSWER_SCORE_MAP[ans.answer]
        if (score !== undefined) {
          const current = groupScoreMap.get(groupKey) || {
            id: groupKey,
            name: groupName,
            type: groupType,
            totalScore: 0,
            count: 0,
          }
          current.totalScore += score
          current.count += 1
          groupScoreMap.set(groupKey, current)
        }
      }
    }

    const sectorScores = Array.from(groupScoreMap.values())
      .map((g) => ({
        ...g,
        avg: g.count > 0 ? Number((g.totalScore / g.count).toFixed(1)) : 0,
      }))
      .filter((g) => g.count > 0)
      .sort((a, b) => b.avg - a.avg)

    // Média geral do sistema
    let totalAllScore = 0
    let totalAllAnswers = 0
    for (const g of sectorScores) {
      totalAllScore += g.totalScore
      totalAllAnswers += g.count
    }
    const overallScoreAvg =
      totalAllAnswers > 0 ? Number((totalAllScore / totalAllAnswers).toFixed(1)) : 0

    // F. Colaboradores próximos da efetivação (90 dias concluída ou vencendo com boa média/decisão)
    // Regra:
    // 1) Avaliação de 90 dias concluída com decisão EFFECTIVATE OU
    // 2) Avaliação de 45 dias com EXTEND e prazo de 90 dias vencendo nos próximos 15 dias sem atraso crítico
    const readyForEffective: any[] = []

    for (const c of validCollabs) {
      const collabEvals = validEvals.filter(
        (e) => e.collaborator === c.id || e.collaborator?.id === c.id,
      )
      const eval45 = collabEvals.find((e) => (e.stage || '').toLowerCase().includes('45'))
      const eval90 = collabEvals.find((e) => (e.stage || '').toLowerCase().includes('90'))

      // Se já fez a de 90 dias e foi EFFECTIVATE (ou situação Efetivado recente)
      if (eval90 && (eval90.decision === 'EFFECTIVATE' || c.situation === 'Efetivado')) {
        // Calcula a média das notas se houver respostas
        const ansList = answersByEval.get(eval90.id) || []
        const total = ansList.reduce((acc, curr) => acc + (ANSWER_SCORE_MAP[curr.answer] || 7.5), 0)
        const avg = ansList.length > 0 ? Number((total / ansList.length).toFixed(1)) : 8.5

        readyForEffective.push({
          id: c.id,
          name: c.name,
          role: c.role,
          cost_center_name: c.expand?.cost_center?.name || 'Obra/Setor',
          sector_name: c.expand?.sector?.name,
          statusLabel: 'Avaliação 90d Concluída (Aprovado)',
          stage: '90 dias',
          scoreAvg: avg,
          date: eval90.evaluated_at || eval90.created,
          isCompleted: true,
        })
      } else if (
        c.situation === 'Em experiência' &&
        eval45 &&
        eval45.decision === 'EXTEND' &&
        !eval90
      ) {
        // Está em 90 dias pendente, com 45 aprovada
        if (c.deadline_90) {
          const st = calculateDeadlineStatus(c.deadline_90)
          if (!st.isOverdue && st.daysRemaining <= 20) {
            const ansList = answersByEval.get(eval45.id) || []
            const total = ansList.reduce(
              (acc, curr) => acc + (ANSWER_SCORE_MAP[curr.answer] || 7.5),
              0,
            )
            const avg = ansList.length > 0 ? Number((total / ansList.length).toFixed(1)) : 8.0

            readyForEffective.push({
              id: c.id,
              name: c.name,
              role: c.role,
              cost_center_name: c.expand?.cost_center?.name || 'Obra/Setor',
              sector_name: c.expand?.sector?.name,
              statusLabel: `Término dos 90d em ${st.daysRemaining} dia(s)`,
              stage: 'Reta final 90d',
              scoreAvg: avg,
              date: c.deadline_90,
              isCompleted: false,
            })
          }
        }
      }
    }

    return {
      totalCompleted,
      completedOnTime,
      completedOverdue,
      pctOnTimeTotal,
      completed45Total,
      pct45OnTime,
      completed90Total,
      pct90OnTime,
      pendingTotal,
      pendingDueNext7Days,
      pendingDueNext15Days,
      pendingOverdue,
      startedEvalsCount,
      fullyCompletedEvalsCount,
      completionRate,
      evalsLast30Days,
      evalsPrev30Days,
      trendPct,
      trendDirection,
      sectorScores,
      overallScoreAvg,
      readyForEffective: readyForEffective.slice(0, 5), // top 5
      isEmptyDatabase: validCollabs.length === 0,
    }
  }, [collaborators, evaluations, evaluationAnswers, costCenters, sectors])

  // Estado vazio amigável quando banco estiver zerado ou sem colaboradores no escopo
  if (metrics.isEmptyDatabase && !loading) {
    return (
      <div className="rounded-2xl border border-dashed border-slate-300 dark:border-white/15 bg-white/70 dark:bg-[#111512]/60 p-8 sm:p-10 shadow-xs text-center transition-all">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-[#54D769]/15 text-[#2CA840] dark:text-[#54D769] mb-4">
          <Sparkles className="h-7 w-7" />
        </div>
        <h3 className="text-lg font-bold text-slate-900 dark:text-white">
          Métricas de Engajamento Prontas para Uso
        </h3>
        <p className="mt-2 text-sm text-slate-600 dark:text-slate-400 max-w-xl mx-auto leading-relaxed">
          Nenhum colaborador ou avaliação cadastrada no momento. Assim que os dados forem inseridos,
          este painel exibirá automaticamente a pontualidade dos ciclos de 45 e 90 dias, a taxa de
          conclusão das respostas, médias por setor e colaboradores prontos para efetivação.
        </p>

        <div className="mt-6 flex flex-wrap items-center justify-center gap-3">
          {canAccessImport ? (
            <Button
              onClick={() => navigate('/import')}
              className="bg-[#54D769] text-slate-950 font-bold hover:bg-[#3DBE52] shadow-xs"
            >
              <Upload className="mr-2 h-4 w-4" />
              Importar Colaboradores via Planilha
            </Button>
          ) : (
            <Button
              onClick={() => navigate('/collaborators')}
              className="bg-[#54D769] text-slate-950 font-bold hover:bg-[#3DBE52] shadow-xs"
            >
              <Users className="mr-2 h-4 w-4" />
              Ver Lista de Colaboradores
            </Button>
          )}
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-6">
      {/* Título da seção */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-slate-200 dark:border-white/10 pb-3">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex h-2 w-2 rounded-full bg-[#54D769]" />
            <h2 className="text-lg sm:text-xl font-bold tracking-tight text-slate-900 dark:text-white">
              Métricas de Engajamento e Adesão
            </h2>
          </div>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            Mede na prática a pontualidade, taxa de resposta, participação e qualidade do processo.
          </p>
        </div>

        <div className="flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400">
          <span className="inline-block px-2.5 py-1 rounded-full bg-slate-100 dark:bg-white/10 border border-slate-200 dark:border-white/10">
            {metrics.totalCompleted} avaliação(ões) computada(s)
          </span>
        </div>
      </div>

      {/* Grid de 4 Cards Principais de Engajamento */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Card 1: Pontualidade (No prazo vs Atrasadas) */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151916] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Pontualidade Geral</span>
              <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/40 text-emerald-600 dark:text-emerald-400">
                <CheckCircle2 className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {metrics.totalCompleted > 0 ? `${metrics.pctOnTimeTotal}%` : '—'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                no prazo
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {metrics.completedOnTime} de {metrics.totalCompleted} concluídas na data limite.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 space-y-1.5 text-[11px]">
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span>Etapa 45 dias:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {metrics.completed45Total > 0
                  ? `${metrics.pct45OnTime}% no prazo`
                  : 'Sem registros'}
              </span>
            </div>
            <div className="flex items-center justify-between text-slate-600 dark:text-slate-300">
              <span>Etapa 90 dias:</span>
              <span className="font-bold text-slate-900 dark:text-white">
                {metrics.completed90Total > 0
                  ? `${metrics.pct90OnTime}% no prazo`
                  : 'Sem registros'}
              </span>
            </div>
          </div>
        </div>

        {/* Card 2: Prazos Críticos (Próximos 7 e 15 dias) */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151916] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Prazos Próximos</span>
              <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/40 text-amber-600 dark:text-amber-400">
                <Clock className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-amber-600 dark:text-amber-400">
                {metrics.pendingDueNext7Days}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                vencem em até 7 dias
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              {metrics.pendingDueNext15Days} avaliações vencem na quinzena (15 dias).
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px]">
            <span className="text-slate-600 dark:text-slate-400">Total pendente:</span>
            <span className="font-bold text-slate-900 dark:text-white">
              {metrics.pendingTotal} colaborador(es)
            </span>
          </div>
        </div>

        {/* Card 3: Taxa de Conclusão / Respostas */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151916] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">Taxa de Conclusão</span>
              <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/40 text-blue-600 dark:text-blue-400">
                <BarChart3 className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-blue-600 dark:text-blue-400">
                {metrics.startedEvalsCount > 0 ? `${metrics.completionRate}%` : '—'}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                finalizadas
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-1">
              Avaliações iniciadas que foram respondidas integralmente até o fim.
            </p>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5">
            <Progress
              value={metrics.completionRate}
              className="h-2 bg-slate-100 dark:bg-white/10"
            />
          </div>
        </div>

        {/* Card 4: Participação nos últimos 30 dias com tendência */}
        <div className="rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151916] p-5 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between text-slate-500 dark:text-slate-400 mb-2">
              <span className="text-xs font-bold uppercase tracking-wider">
                Atividade (30 dias)
              </span>
              <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/40 text-purple-600 dark:text-purple-400">
                <Calendar className="h-4 w-4" />
              </div>
            </div>
            <div className="flex items-baseline gap-2">
              <span className="text-3xl font-extrabold text-slate-900 dark:text-white">
                {metrics.evalsLast30Days}
              </span>
              <span className="text-xs text-slate-500 dark:text-slate-400 font-medium">
                realizadas
              </span>
            </div>
            <div className="flex items-center gap-1.5 mt-1 text-xs">
              {metrics.trendDirection === 'up' && (
                <span className="inline-flex items-center text-emerald-600 dark:text-emerald-400 font-bold">
                  <TrendingUp className="mr-1 h-3.5 w-3.5" />+{metrics.trendPct}%
                </span>
              )}
              {metrics.trendDirection === 'down' && (
                <span className="inline-flex items-center text-red-600 dark:text-red-400 font-bold">
                  <TrendingDown className="mr-1 h-3.5 w-3.5" />
                  {metrics.trendPct}%
                </span>
              )}
              {metrics.trendDirection === 'neutral' && (
                <span className="inline-flex items-center text-slate-500 dark:text-slate-400 font-medium">
                  <Minus className="mr-1 h-3.5 w-3.5" />
                  Estável
                </span>
              )}
              <span className="text-slate-500 dark:text-slate-400">vs 30 dias anteriores</span>
            </div>
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between text-[11px] text-slate-600 dark:text-slate-400">
            <span>Período anterior:</span>
            <span className="font-semibold text-slate-900 dark:text-white">
              {metrics.evalsPrev30Days} avaliações
            </span>
          </div>
        </div>
      </div>

      {/* Seção Inferior com 2 Blocos: Média por Setor/Centro e Próximos da Efetivação */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        {/* Bloco 1: Médias por Setor / Centro de Custo */}
        <div className="lg:col-span-7 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151916] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white">
                  Média de Desempenho por Setor / Centro
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Pontuação média (escala 0 a 10) baseada nas respostas aos critérios da avaliação.
                </p>
              </div>
              {metrics.overallScoreAvg > 0 && (
                <div className="self-start sm:self-auto rounded-xl bg-[#54D769]/15 border border-[#54D769]/30 px-3 py-1.5 text-center">
                  <span className="text-[10px] uppercase font-bold text-slate-600 dark:text-slate-300 block">
                    Média Geral
                  </span>
                  <span className="text-lg font-black text-[#2CA840] dark:text-[#54D769]">
                    {metrics.overallScoreAvg}
                  </span>
                </div>
              )}
            </div>

            {metrics.sectorScores.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                <Building2 className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p>Nenhuma resposta a critérios registrada ainda para calcular médias por setor.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  As notas aparecerão aqui conforme as avaliações forem preenchidas.
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* Gráfico de Barras Horizontal */}
                <div className="h-48 w-full">
                  <ResponsiveContainer width="100%" height="100%">
                    <BarChart
                      layout="vertical"
                      data={metrics.sectorScores.slice(0, 5)}
                      margin={{ top: 5, right: 25, left: 10, bottom: 5 }}
                    >
                      <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
                      <XAxis type="number" domain={[0, 10]} tick={{ fontSize: 11 }} />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{ fontSize: 11 }}
                        width={130}
                        tickFormatter={(val) => (val.length > 18 ? `${val.slice(0, 18)}...` : val)}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: '#111827',
                          color: '#FFFFFF',
                          borderRadius: '8px',
                          fontSize: '12px',
                          border: 'none',
                        }}
                        formatter={(val: any) => [`${val} / 10`, 'Nota Média']}
                      />
                      <Bar dataKey="avg" fill="#54D769" radius={[0, 6, 6, 0]}>
                        {metrics.sectorScores.slice(0, 5).map((entry, index) => (
                          <Cell
                            key={`cell-${index}`}
                            fill={
                              entry.avg >= 7.5
                                ? '#54D769'
                                : entry.avg >= 5.0
                                  ? '#F5A623'
                                  : '#EF4444'
                            }
                          />
                        ))}
                      </Bar>
                    </BarChart>
                  </ResponsiveContainer>
                </div>

                {/* Lista compacta com detalhes */}
                <div className="divide-y divide-slate-100 dark:divide-white/5 pt-1 text-xs">
                  {metrics.sectorScores.slice(0, 4).map((item) => (
                    <div key={item.id} className="py-2 flex items-center justify-between">
                      <div className="truncate pr-2">
                        <span className="font-semibold text-slate-900 dark:text-white truncate block">
                          {item.name}
                        </span>
                        <span className="text-[11px] text-slate-500 dark:text-slate-400">
                          {item.count} critério(s) respondido(s) • Tipo: {item.type}
                        </span>
                      </div>
                      <span
                        className={`font-extrabold px-2 py-0.5 rounded-md text-xs ${
                          item.avg >= 7.5
                            ? 'bg-emerald-100 dark:bg-emerald-950 text-emerald-800 dark:text-emerald-300'
                            : item.avg >= 5.0
                              ? 'bg-amber-100 dark:bg-amber-950 text-amber-800 dark:text-amber-300'
                              : 'bg-red-100 dark:bg-red-950 text-red-800 dark:text-red-300'
                        }`}
                      >
                        {item.avg}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>

        {/* Bloco 2: Colaboradores Próximos da Efetivação */}
        <div className="lg:col-span-5 rounded-2xl border border-slate-200 dark:border-white/10 bg-white dark:bg-[#151916] p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center justify-between mb-4">
              <div>
                <h3 className="text-base font-bold text-slate-900 dark:text-white flex items-center gap-1.5">
                  <Award className="h-4 w-4 text-emerald-600 dark:text-[#54D769]" />
                  Rumo à Efetivação
                </h3>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  Colaboradores com 90 dias concluídos com sucesso ou na reta final.
                </p>
              </div>
            </div>

            {metrics.readyForEffective.length === 0 ? (
              <div className="py-10 text-center text-xs text-slate-500 dark:text-slate-400 border border-dashed border-slate-200 dark:border-white/10 rounded-xl">
                <Users className="mx-auto h-8 w-8 text-slate-300 dark:text-slate-600 mb-2" />
                <p>Nenhum colaborador na reta final de 90 dias no momento.</p>
                <p className="text-[11px] text-slate-400 mt-1">
                  Os colaboradores que avançarem da etapa de 45 dias aparecerão listados aqui.
                </p>
              </div>
            ) : (
              <div className="divide-y divide-slate-100 dark:divide-white/5 space-y-1">
                {metrics.readyForEffective.map((collab) => (
                  <div
                    key={collab.id}
                    onClick={() => navigate(`/collaborators/${collab.id}`)}
                    className="py-2.5 flex items-center justify-between group cursor-pointer hover:bg-slate-50 dark:hover:bg-white/5 px-2 rounded-xl transition-all"
                  >
                    <div className="min-w-0 flex-1 pr-2">
                      <p className="font-bold text-xs text-slate-900 dark:text-white group-hover:text-[#2CA840] dark:group-hover:text-[#54D769] transition-colors truncate">
                        {collab.name}
                      </p>
                      <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                        {collab.role} • {collab.cost_center_name}
                      </p>
                      <span className="inline-block mt-1 text-[10px] font-semibold text-emerald-700 dark:text-emerald-300 bg-emerald-50 dark:bg-emerald-950/60 px-2 py-0.5 rounded-full">
                        {collab.statusLabel}
                      </span>
                    </div>

                    <div className="text-right shrink-0">
                      <span className="text-xs font-black text-slate-900 dark:text-white block">
                        Nota ~{collab.scoreAvg}
                      </span>
                      <ArrowRight className="h-4 w-4 text-slate-400 group-hover:text-slate-900 dark:group-hover:text-white group-hover:translate-x-0.5 transition-all inline mt-1" />
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="mt-4 pt-3 border-t border-slate-100 dark:border-white/5 flex items-center justify-between">
            <span className="text-[11px] text-slate-500 dark:text-slate-400">
              Acompanhamento de efetivações
            </span>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => navigate('/collaborators')}
              className="text-xs text-[#2CA840] dark:text-[#54D769] hover:text-[#1e782d] p-0 h-auto font-semibold"
            >
              Ver todos colaboradores <ArrowRight className="ml-1 h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardEngagementMetrics
