import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  CalendarCheck,
  Search,
  Filter,
  Building2,
  Briefcase,
  AlertTriangle,
  Clock,
  CheckCircle2,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  formatDateBR,
  parseDateToIso,
  calculateDeadlineStatus,
  normalizeSearchText,
} from '@/lib/dateAndCpfUtils'

export const Evaluations: React.FC = () => {
  const navigate = useNavigate()
  const { user, canEvaluate, scopedCostCenterId, scopedSectorId } = useAuth()

  const [collaborators, setCollaborators] = useState<any[]>([])
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [costCenters, setCostCenters] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [filterStage, setFilterStage] = useState('all') // all, 45, 90
  const [filterCostCenter, setFilterCostCenter] = useState('all')
  const [filterSector, setFilterSector] = useState('all')
  const [admissionStart, setAdmissionStart] = useState('')
  const [admissionEnd, setAdmissionEnd] = useState('')
  const [filterStatus, setFilterStatus] = useState('all') // all, on_time, overdue

  const loadData = async () => {
    setLoading(true)
    try {
      const [ccRes, secRes, colRes, evalRes] = await Promise.all([
        pb.collection('cost_centers').getFullList({ sort: 'name' }),
        pb.collection('sectors').getFullList({ sort: 'name' }),
        pb.collection('collaborators').getFullList({
          filter: "situation = 'Em experiência'",
          sort: 'admission_date',
          expand: 'cost_center,sector',
        }),
        pb.collection('evaluations').getFullList(),
      ])

      setCostCenters(ccRes)
      setSectors(secRes)
      setCollaborators(colRes)
      setEvaluations(evalRes)
    } catch (err) {
      console.error('Erro ao carregar próximas avaliações:', err)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  const selectedCostCenterObj = costCenters.find((c) => c.id === filterCostCenter)
  const isEscritorio = selectedCostCenterObj?.type === 'Escritório'

  // Build list of upcoming evaluation items
  const upcomingList = useMemo(() => {
    const list: any[] = []

    const safeCollaborators = Array.isArray(collaborators) ? collaborators.filter(Boolean) : []
    const safeEvaluations = Array.isArray(evaluations) ? evaluations.filter(Boolean) : []

    for (const c of safeCollaborators) {
      if (!c || !c.id) continue

      const cCostCenter = c.cost_center || c.expand?.cost_center?.id || ''
      const cSector = c.sector || c.expand?.sector?.id || ''

      // Profile scopes
      if (scopedCostCenterId && cCostCenter !== scopedCostCenterId) continue
      if (scopedSectorId && cSector !== scopedSectorId) continue

      // Dropdown filters
      if (filterCostCenter !== 'all' && cCostCenter !== filterCostCenter) continue
      if (filterSector !== 'all' && cSector !== filterSector) continue

      const cAdmissionIso = parseDateToIso(c.admission_date)
      if (admissionStart) {
        const isoStart = parseDateToIso(admissionStart)
        if (isoStart && (!cAdmissionIso || cAdmissionIso < isoStart)) continue
      }
      if (admissionEnd) {
        const isoEnd = parseDateToIso(admissionEnd)
        if (isoEnd && (!cAdmissionIso || cAdmissionIso > isoEnd)) continue
      }

      if (searchTerm.trim()) {
        const normTerm = normalizeSearchText(searchTerm)
        const normName = normalizeSearchText(c.name || '')
        const normRole = normalizeSearchText(c.role || '')
        const normCC = normalizeSearchText(c.expand?.cost_center?.name || '')
        if (
          !normName.includes(normTerm) &&
          !normRole.includes(normTerm) &&
          !normCC.includes(normTerm)
        ) {
          continue
        }
      }

      const collabEvals = safeEvaluations.filter(
        (e) => e && (e.collaborator === c.id || e.collaborator?.id === c.id),
      )
      const eval45 = collabEvals.find((e) => (e.stage || '').toLowerCase().includes('45'))
      const eval90 = collabEvals.find((e) => (e.stage || '').toLowerCase().includes('90'))

      let pendingStage = ''
      let deadlineDate = ''

      if (!eval45) {
        pendingStage = '45 dias'
        deadlineDate = c.deadline_45 || ''
      } else if (!eval90 && eval45.decision === 'EXTEND') {
        pendingStage = '90 dias'
        deadlineDate = c.deadline_90 || ''
      }

      if (!pendingStage) continue // no pending evaluation

      if (filterStage === '45' && pendingStage !== '45 dias') continue
      if (filterStage === '90' && pendingStage !== '90 dias') continue

      const deadlineInfo = calculateDeadlineStatus(deadlineDate)

      if (filterStatus === 'overdue' && !deadlineInfo.isOverdue) continue
      if (filterStatus === 'on_time' && deadlineInfo.isOverdue) continue

      list.push({
        collaborator: c,
        pendingStage,
        deadlineDate,
        deadlineInfo,
        stageNumber: pendingStage === '45 dias' ? 45 : 90,
      })
    }

    // Sort: overdue first, then by earliest deadline date
    list.sort((a, b) => {
      if (a.deadlineInfo.isOverdue && !b.deadlineInfo.isOverdue) return -1
      if (!a.deadlineInfo.isOverdue && b.deadlineInfo.isOverdue) return 1
      return (a.deadlineDate || '').localeCompare(b.deadlineDate || '')
    })

    return list
  }, [
    collaborators,
    evaluations,
    filterCostCenter,
    filterSector,
    filterStage,
    filterStatus,
    admissionStart,
    admissionEnd,
    searchTerm,
    scopedCostCenterId,
    scopedSectorId,
  ])

  const handleClearFilters = () => {
    setSearchTerm('')
    setFilterStage('all')
    setFilterCostCenter('all')
    setFilterSector('all')
    setAdmissionStart('')
    setAdmissionEnd('')
    setFilterStatus('all')
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111111]">Próximas avaliações</h1>
        <p className="text-sm text-gray-600 mt-0.5">
          Consulte prazos e realize as avaliações de 45 e 90 dias.
        </p>
      </div>

      {/* Filter Card */}
      <div className="rounded-2xl border border-[#E8E8E8] bg-white p-5 shadow-xs space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-medium">Pesquisar colaborador</span>
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-gray-400" />
              <Input
                placeholder="Nome ou função..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-8 h-9 text-xs border-[#E8E8E8]"
              />
            </div>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-medium">Etapa</span>
            <Select value={filterStage} onValueChange={setFilterStage}>
              <SelectTrigger className="h-9 text-xs border-[#E8E8E8]">
                <SelectValue placeholder="Todas as etapas" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as etapas</SelectItem>
                <SelectItem value="45">45 dias</SelectItem>
                <SelectItem value="90">90 dias</SelectItem>
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-medium">Centro de Custo</span>
            <Select value={filterCostCenter} onValueChange={setFilterCostCenter}>
              <SelectTrigger className="h-9 text-xs border-[#E8E8E8]">
                <SelectValue placeholder="Todos os centros" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os centros</SelectItem>
                {costCenters.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>
                    {cc.name} ({cc.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isEscritorio ? (
            <div className="space-y-1">
              <span className="text-xs text-gray-500 font-medium">Setor (Escritório)</span>
              <Select value={filterSector} onValueChange={setFilterSector}>
                <SelectTrigger className="h-9 text-xs border-[#E8E8E8]">
                  <SelectValue placeholder="Todos os setores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {sectors.map((sec) => (
                    <SelectItem key={sec.id} value={sec.id}>
                      {sec.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1">
              <span className="text-xs text-gray-500 font-medium">Situação do Prazo</span>
              <Select value={filterStatus} onValueChange={setFilterStatus}>
                <SelectTrigger className="h-9 text-xs border-[#E8E8E8]">
                  <SelectValue placeholder="Todas" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas</SelectItem>
                  <SelectItem value="on_time">No prazo</SelectItem>
                  <SelectItem value="overdue">Atrasadas</SelectItem>
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-1 border-t border-gray-100">
          <div className="flex items-center gap-2 w-full sm:w-auto">
            <span className="text-xs text-gray-500 whitespace-nowrap">Admissão de:</span>
            <Input
              placeholder="DD/MM/AAAA"
              value={admissionStart}
              onChange={(e) => setAdmissionStart(e.target.value)}
              className="h-8 text-xs w-28 border-[#E8E8E8]"
            />
            <span className="text-xs text-gray-500">até:</span>
            <Input
              placeholder="DD/MM/AAAA"
              value={admissionEnd}
              onChange={(e) => setAdmissionEnd(e.target.value)}
              className="h-8 text-xs w-28 border-[#E8E8E8]"
            />
          </div>

          <Button
            variant="ghost"
            size="sm"
            onClick={handleClearFilters}
            className="text-xs text-gray-500 hover:text-black self-end sm:self-auto"
          >
            Limpar
          </Button>
        </div>
      </div>

      {/* Upcoming Table */}
      <div className="rounded-2xl border border-[#E8E8E8] bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#111111] border-t-[#54D769]" />
            <p className="mt-3 text-sm text-gray-500">Carregando avaliações pendentes...</p>
          </div>
        ) : upcomingList.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <CheckCircle2 className="mx-auto h-12 w-12 text-[#54D769]" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">
              Nenhuma avaliação pendente no momento
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Todos os colaboradores em experiência estão com as etapas em dia.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs md:text-sm table-fixed">
              <thead className="bg-[#F9FAFB] text-[11px] md:text-xs font-semibold text-gray-600 uppercase border-b border-[#E8E8E8]">
                <tr>
                  <th className="w-[21%] px-2.5 md:px-3 py-2.5">Colaborador</th>
                  <th className="w-[15%] px-1.5 md:px-2 py-2.5">Função</th>
                  <th className="w-[14%] px-1.5 md:px-2 py-2.5">Centro de Custo</th>
                  <th className="w-[11%] px-1.5 md:px-2 py-2.5">Setor</th>
                  <th className="w-[8%] px-1 md:px-2 py-2.5">Admissão</th>
                  <th className="w-[9%] px-1 md:px-2 py-2.5">Etapa</th>
                  <th className="w-[8%] px-1 md:px-2 py-2.5">Prazo</th>
                  <th className="w-[8%] px-1 md:px-2 py-2.5">Status</th>
                  <th className="w-[6%] px-1 md:px-2 py-2.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E8]">
                {upcomingList.map((item) => {
                  const isOverdue = item.deadlineInfo.isOverdue
                  return (
                    <tr
                      key={`${item.collaborator.id}_${item.stageNumber}`}
                      className={`transition-colors ${
                        isOverdue
                          ? 'bg-red-50/60 hover:bg-red-50 border-l-4 border-l-red-500'
                          : 'hover:bg-gray-50/80'
                      }`}
                    >
                      <td
                        className="px-2.5 md:px-3 py-2 font-bold text-gray-900 truncate"
                        title={item.collaborator.name}
                      >
                        <Link
                          to={`/collaborators/${item.collaborator.id}`}
                          className="hover:text-[#54D769] transition-colors truncate block"
                          title={item.collaborator.name}
                        >
                          {item.collaborator.name}
                        </Link>
                      </td>
                      <td
                        className="px-1.5 md:px-2 py-2 text-gray-700 truncate"
                        title={item.collaborator.role}
                      >
                        {item.collaborator.role}
                      </td>
                      <td
                        className="px-1.5 md:px-2 py-2 text-gray-800 text-[11px] md:text-xs font-medium truncate"
                        title={item.collaborator.expand?.cost_center?.name || '-'}
                      >
                        {item.collaborator.expand?.cost_center?.name || '-'}
                      </td>
                      <td
                        className="px-1.5 md:px-2 py-2 text-gray-600 text-[11px] md:text-xs truncate"
                        title={item.collaborator.expand?.sector?.name || '-'}
                      >
                        {item.collaborator.expand?.sector?.name || '-'}
                      </td>
                      <td className="px-1 md:px-2 py-2 text-gray-600 text-[11px] md:text-xs whitespace-nowrap">
                        {formatDateBR(item.collaborator.admission_date)}
                      </td>
                      <td className="px-1 md:px-2 py-2">
                        <span className="inline-block font-bold text-[10px] md:text-xs px-1.5 md:px-2 py-0.5 rounded-full bg-blue-100 text-blue-800 whitespace-nowrap">
                          {item.pendingStage}
                        </span>
                      </td>
                      <td className="px-1 md:px-2 py-2 text-gray-800 text-[11px] md:text-xs font-semibold whitespace-nowrap">
                        {formatDateBR(item.deadlineDate)}
                      </td>
                      <td className="px-1 md:px-2 py-2">
                        <span
                          className={`inline-flex items-center px-1 md:px-1.5 py-0.5 rounded-full text-[10px] md:text-xs font-semibold whitespace-nowrap ${
                            isOverdue
                              ? 'bg-red-100 text-red-700 border border-red-200'
                              : 'bg-green-100 text-green-700 border border-green-200'
                          }`}
                        >
                          {item.deadlineInfo.badgeLabel}
                        </span>
                      </td>
                      <td className="px-1 md:px-2 py-2 text-right whitespace-nowrap">
                        {canEvaluate ? (
                          <Button
                            size="sm"
                            onClick={() =>
                              navigate(
                                `/collaborators/${item.collaborator.id}/evaluate?etapa=${item.stageNumber}`,
                              )
                            }
                            className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] text-[11px] md:text-xs h-7 md:h-8 px-1.5 md:px-2.5 shadow-xs"
                          >
                            Avaliar
                          </Button>
                        ) : (
                          <span className="text-[10px] md:text-xs text-gray-400">Consulta</span>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}

        <div className="border-t border-[#E8E8E8] bg-gray-50/50 px-5 py-3 text-xs text-gray-500 flex items-center justify-between">
          <span>Total de avaliações pendentes: {upcomingList.length}</span>
          <span>Linhas destacadas em vermelho indicam prazo vencido</span>
        </div>
      </div>
    </div>
  )
}

export default Evaluations
