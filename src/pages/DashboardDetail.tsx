import React, { useState, useEffect, useMemo } from 'react'
import { useSearchParams, useNavigate, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { ArrowLeft, Users, ChevronRight } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { formatDateBR, parseDateToIso, calculateDeadlineStatus } from '@/lib/dateAndCpfUtils'

export const DashboardDetail: React.FC = () => {
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const { user, scopedCostCenterId, scopedSectorId } = useAuth()

  const indicator = searchParams.get('indicator') || 'all'
  const paramCostCenter = searchParams.get('cost_center')
  const paramSector = searchParams.get('sector')
  const admissionStart = searchParams.get('admission_start')
  const admissionEnd = searchParams.get('admission_end')

  const [collaborators, setCollaborators] = useState<any[]>([])
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let mounted = true
    const load = async () => {
      setLoading(true)
      try {
        const [colRes, evalRes] = await Promise.all([
          pb
            .collection('collaborators')
            .getFullList({
              expand: 'cost_center,sector',
              sort: '-created',
            })
            .catch((err) => {
              console.warn('Falha ao carregar colaboradores em DashboardDetail:', err)
              return []
            }),
          pb
            .collection('evaluations')
            .getFullList()
            .catch((err) => {
              console.warn('Falha ao carregar avaliações em DashboardDetail:', err)
              return []
            }),
        ])
        if (mounted) {
          setCollaborators(Array.isArray(colRes) ? colRes : [])
          setEvaluations(Array.isArray(evalRes) ? evalRes : [])
        }
      } catch (err) {
        console.error('Erro ao carregar detalhamento: ', err)
      } finally {
        if (mounted) {
          setLoading(false)
        }
      }
    }

    load()
    return () => {
      mounted = false
    }
  }, [])

  const getIndicatorTitle = () => {
    switch (indicator) {
      case 'in_experience':
        return 'Colaboradores em Experiência'
      case 'pending_45':
        return 'Pendentes de Avaliação de 45 Dias'
      case 'pending_90':
        return 'Pendentes de Avaliação de 90 Dias'
      case 'pending':
        return 'Colaboradores com Avaliação Pendente'
      case 'overdue':
        return 'Avaliações em Atraso'
      case 'effective':
        return 'Colaboradores Efetivados'
      case 'terminated':
        return 'Colaboradores Desligados / Contratos Encerrados'
      case 'other':
        return 'Colaboradores Inativos ou Sem Situação'
      case 'eval_45_done':
        return 'Avaliações de 45 Dias Concluídas'
      case 'eval_90_done':
        return 'Avaliações de 90 Dias Concluídas'
      case 'eval_total_done':
        return 'Total de Avaliações Realizadas'
      default:
        return 'Detalhamento de Colaboradores'
    }
  }

  const validCollaborators = useMemo(() => {
    return Array.isArray(collaborators)
      ? collaborators.filter((c) => c && typeof c === 'object' && c.id)
      : []
  }, [collaborators])

  const validEvaluations = useMemo(() => {
    return Array.isArray(evaluations) ? evaluations.filter((e) => e && typeof e === 'object') : []
  }, [evaluations])

  const filteredItems = useMemo(() => {
    return validCollaborators
      .filter((c) => {
        const cCostCenter = c.cost_center || c.expand?.cost_center?.id || ''
        const cSector = c.sector || c.expand?.sector?.id || ''

        if (scopedCostCenterId && cCostCenter !== scopedCostCenterId) return false
        if (scopedSectorId && cSector !== scopedSectorId) return false

        if (paramCostCenter && paramCostCenter !== 'all') {
          if (paramCostCenter === 'orphan') {
            if (cCostCenter) return false
          } else if (cCostCenter !== paramCostCenter) {
            return false
          }
        }
        if (paramSector && paramSector !== 'all' && cSector !== paramSector) return false

        const cAdmissionIso = parseDateToIso(c.admission_date)
        if (admissionStart) {
          const isoStart = parseDateToIso(admissionStart)
          if (isoStart && (!cAdmissionIso || cAdmissionIso < isoStart)) return false
        }
        if (admissionEnd) {
          const isoEnd = parseDateToIso(admissionEnd)
          if (isoEnd && (!cAdmissionIso || cAdmissionIso > isoEnd)) return false
        }

        const collabEvals = validEvaluations.filter(
          (e) => e && (e.collaborator === c.id || e.collaborator?.id === c.id),
        )
        const has45 = collabEvals.some((e) => (e.stage || '').toLowerCase().includes('45'))
        const has90 = collabEvals.some((e) => (e.stage || '').toLowerCase().includes('90'))
        const eval45 = collabEvals.find((e) => (e.stage || '').toLowerCase().includes('45'))
        const situation = (c.situation || '').trim()

        if (indicator === 'in_experience') {
          return situation === 'Em experiência'
        }
        if (indicator === 'effective') {
          return situation === 'Efetivado'
        }
        if (indicator === 'terminated') {
          return situation === 'Desligado'
        }
        if (indicator === 'other') {
          return (
            situation !== 'Em experiência' && situation !== 'Efetivado' && situation !== 'Desligado'
          )
        }
        if (indicator === 'eval_45_done') {
          return has45
        }
        if (indicator === 'eval_90_done') {
          return has90
        }
        if (indicator === 'eval_total_done') {
          return has45 || has90
        }

        if (indicator === 'pending_45') {
          return situation === 'Em experiência' && !has45
        }

        if (indicator === 'pending_90') {
          return situation === 'Em experiência' && has45 && eval45?.decision === 'EXTEND' && !has90
        }

        if (indicator === 'pending') {
          if (situation !== 'Em experiência') return false
          return !has45 || (eval45?.decision === 'EXTEND' && !has90)
        }

        if (indicator === 'overdue') {
          if (situation !== 'Em experiência') return false
          if (!has45) {
            const st45 = calculateDeadlineStatus(c.deadline_45)
            return st45.isOverdue
          }
          if (eval45?.decision === 'EXTEND' && !has90) {
            const st90 = calculateDeadlineStatus(c.deadline_90)
            return st90.isOverdue
          }
          return false
        }

        return true
      })
      .map((c) => {
        const collabEvals = validEvaluations.filter(
          (e) => e && (e.collaborator === c.id || e.collaborator?.id === c.id),
        )
        const has45 = collabEvals.some((e) => (e.stage || '').toLowerCase().includes('45'))
        const has90 = collabEvals.some((e) => (e.stage || '').toLowerCase().includes('90'))
        const eval45 = collabEvals.find((e) => (e.stage || '').toLowerCase().includes('45'))
        const situation = (c.situation || '').trim()

        let pendingStage = '-'
        let targetDeadline = ''

        if (situation === 'Em experiência') {
          if (!has45) {
            pendingStage = '45 dias'
            targetDeadline = c.deadline_45
          } else if (!has90 && eval45?.decision === 'EXTEND') {
            pendingStage = '90 dias'
            targetDeadline = c.deadline_90
          }
        }

        const deadlineInfo = targetDeadline ? calculateDeadlineStatus(targetDeadline) : null

        return {
          ...c,
          pendingStage,
          targetDeadline,
          deadlineInfo,
        }
      })
  }, [
    validCollaborators,
    validEvaluations,
    indicator,
    paramCostCenter,
    paramSector,
    admissionStart,
    admissionEnd,
    scopedCostCenterId,
    scopedSectorId,
  ])

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Button
            variant="ghost"
            size="sm"
            onClick={() => navigate('/dashboard')}
            className="text-gray-500 hover:text-black"
          >
            <ArrowLeft className="mr-1.5 h-4 w-4" /> Visão geral
          </Button>
          <h1 className="text-xl font-bold text-[#111111]">{getIndicatorTitle()}</h1>
        </div>

        <div className="text-xs text-gray-500">
          Total de registros: <span className="font-bold text-black">{filteredItems.length}</span>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E8E8E8] bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#111111] border-t-[#54D769]" />
            <p className="mt-3 text-sm text-gray-500">Carregando dados detalhados...</p>
          </div>
        ) : filteredItems.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <Users className="mx-auto h-10 w-10 text-gray-300" />
            <p className="mt-2 text-sm font-medium">Nenhum registro encontrado para este filtro.</p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs md:text-sm table-fixed">
              <thead className="bg-[#F9FAFB] text-[11px] md:text-xs font-semibold text-gray-600 uppercase border-b border-[#E8E8E8]">
                <tr>
                  <th className="w-[19%] px-2.5 md:px-3 py-2.5">Colaborador</th>
                  <th className="w-[14%] px-1.5 md:px-2 py-2.5">Função</th>
                  <th className="w-[14%] px-1.5 md:px-2 py-2.5">Centro de Custo</th>
                  <th className="w-[10%] px-1.5 md:px-2 py-2.5">Setor</th>
                  <th className="w-[8%] px-1 md:px-2 py-2.5">Admissão</th>
                  <th className="w-[8%] px-1 md:px-2 py-2.5">Etapa</th>
                  <th className="w-[8%] px-1 md:px-2 py-2.5">Prazo</th>
                  <th className="w-[9%] px-1 md:px-2 py-2.5">Status</th>
                  <th className="w-[9%] px-1.5 md:px-2 py-2.5">Situação</th>
                  <th className="w-[5%] px-1 md:px-2 py-2.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E8]">
                {filteredItems.map((item) => (
                  <tr
                    key={item.id}
                    className="hover:bg-gray-50/80 transition-colors cursor-pointer"
                    onClick={() => navigate(`/collaborators/${item.id}`)}
                  >
                    <td
                      className="px-2.5 md:px-3 py-2 font-bold text-gray-900 truncate"
                      title={item.name}
                    >
                      <Link
                        to={`/collaborators/${item.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="hover:text-[#54D769] truncate block"
                        title={item.name}
                      >
                        {item.name}
                      </Link>
                    </td>
                    <td className="px-1.5 md:px-2 py-2 text-gray-700 truncate" title={item.role}>
                      {item.role}
                    </td>
                    <td
                      className="px-1.5 md:px-2 py-2 text-gray-800 text-[11px] md:text-xs font-medium truncate"
                      title={item.expand?.cost_center?.name || '-'}
                    >
                      {item.expand?.cost_center?.name || '-'}
                    </td>
                    <td
                      className="px-1.5 md:px-2 py-2 text-gray-600 text-[11px] md:text-xs truncate"
                      title={item.expand?.sector?.name || '-'}
                    >
                      {item.expand?.sector?.name || '-'}
                    </td>
                    <td className="px-1 md:px-2 py-2 text-gray-600 text-[11px] md:text-xs whitespace-nowrap">
                      {formatDateBR(item.admission_date)}
                    </td>
                    <td className="px-1 md:px-2 py-2 text-gray-800 text-[11px] md:text-xs font-semibold whitespace-nowrap">
                      {item.pendingStage}
                    </td>
                    <td className="px-1 md:px-2 py-2 text-gray-600 text-[11px] md:text-xs whitespace-nowrap">
                      {item.targetDeadline ? formatDateBR(item.targetDeadline) : '-'}
                    </td>
                    <td className="px-1 md:px-2 py-2 whitespace-nowrap">
                      {item.deadlineInfo ? (
                        <span
                          className={`inline-flex items-center px-1.5 md:px-2 py-0.5 rounded-full text-[10px] md:text-xs font-semibold ${
                            item.deadlineInfo.isOverdue
                              ? 'bg-red-100 text-red-700'
                              : 'bg-green-100 text-green-700'
                          }`}
                        >
                          {item.deadlineInfo.badgeLabel}
                        </span>
                      ) : (
                        '-'
                      )}
                    </td>
                    <td className="px-1.5 md:px-2 py-2 text-[11px] md:text-xs truncate">
                      <span className="font-semibold text-gray-800">{item.situation}</span>
                    </td>
                    <td className="px-1 md:px-2 py-2 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/collaborators/${item.id}`)
                        }}
                        className="text-[11px] md:text-xs text-gray-500 hover:text-black h-7 md:h-8 px-1 md:px-2"
                      >
                        <span className="hidden sm:inline">Ver</span>
                        <ChevronRight className="sm:ml-1 h-3.5 w-3.5 inline" />
                      </Button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default DashboardDetail
