import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  Users,
  Clock,
  AlertTriangle,
  CheckCircle2,
  UserX,
  Filter,
  ArrowUpRight,
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
  ResponsiveContainer,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  Legend,
  CartesianGrid,
} from 'recharts'
import { formatDateBR, parseDateToIso, calculateDeadlineStatus } from '@/lib/dateAndCpfUtils'
import { ErrorBoundary } from '@/components/ErrorBoundary'

export const Dashboard: React.FC = () => {
  const navigate = useNavigate()
  const { user, scopedCostCenterId, scopedSectorId } = useAuth()

  const [collaborators, setCollaborators] = useState<any[]>([])
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [costCenters, setCostCenters] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  // Filters
  const [admissionStart, setAdmissionStart] = useState('')
  const [admissionEnd, setAdmissionEnd] = useState('')
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('all')
  const [selectedSector, setSelectedSector] = useState<string>('all')

  const loadData = async (isMounted = () => true) => {
    setLoading(true)
    try {
      const [ccRes, secRes, colRes, evalRes] = await Promise.all([
        pb
          .collection('cost_centers')
          .getFullList({ sort: 'name' })
          .catch((err) => {
            console.warn('Falha ao carregar centros de custo no dashboard:', err)
            return []
          }),
        pb
          .collection('sectors')
          .getFullList({ sort: 'name' })
          .catch((err) => {
            console.warn('Falha ao carregar setores no dashboard:', err)
            return []
          }),
        pb
          .collection('collaborators')
          .getFullList({
            sort: '-created',
            expand: 'cost_center,sector',
          })
          .catch((err) => {
            console.warn('Falha ao carregar colaboradores no dashboard:', err)
            return []
          }),
        pb
          .collection('evaluations')
          .getFullList({
            sort: '-created',
          })
          .catch((err) => {
            console.warn('Falha ao carregar avaliações no dashboard:', err)
            return []
          }),
      ])

      if (isMounted()) {
        setCostCenters(Array.isArray(ccRes) ? ccRes : [])
        setSectors(Array.isArray(secRes) ? secRes : [])
        setCollaborators(Array.isArray(colRes) ? colRes : [])
        setEvaluations(Array.isArray(evalRes) ? evalRes : [])
      }
    } catch (err) {
      console.error('Erro ao carregar dados do dashboard: ', err)
    } finally {
      if (isMounted()) {
        setLoading(false)
      }
    }
  }

  useEffect(() => {
    let mounted = true
    const isMounted = () => mounted

    loadData(isMounted)

    let unsubCollabs: (() => void) | undefined
    let unsubEvals: (() => void) | undefined

    pb.collection('collaborators')
      .subscribe('*', () => {
        if (mounted) loadData(isMounted)
      })
      .then((unsub) => {
        unsubCollabs = unsub
      })
      .catch(() => {})

    pb.collection('evaluations')
      .subscribe('*', () => {
        if (mounted) loadData(isMounted)
      })
      .then((unsub) => {
        unsubEvals = unsub
      })
      .catch(() => {})

    return () => {
      mounted = false
      if (unsubCollabs) unsubCollabs()
      if (unsubEvals) unsubEvals()
    }
  }, [])

  const validCostCenters = useMemo(() => {
    return Array.isArray(costCenters)
      ? costCenters.filter((c) => c && typeof c === 'object' && c.id)
      : []
  }, [costCenters])

  const validSectors = useMemo(() => {
    return Array.isArray(sectors) ? sectors.filter((s) => s && typeof s === 'object' && s.id) : []
  }, [sectors])

  const validCollaborators = useMemo(() => {
    return Array.isArray(collaborators)
      ? collaborators.filter((c) => c && typeof c === 'object' && c.id)
      : []
  }, [collaborators])

  const validEvaluations = useMemo(() => {
    return Array.isArray(evaluations) ? evaluations.filter((e) => e && typeof e === 'object') : []
  }, [evaluations])

  const selectedCostCenterObj = validCostCenters.find((c) => c.id === selectedCostCenter)
  const isEscritorio = selectedCostCenterObj?.type === 'Escritório'

  const filteredCollaborators = useMemo(() => {
    return validCollaborators.filter((c) => {
      const cCostCenter = c.cost_center || c.expand?.cost_center?.id || ''
      const cSector = c.sector || c.expand?.sector?.id || ''

      if (scopedCostCenterId && cCostCenter !== scopedCostCenterId) return false
      if (scopedSectorId && cSector !== scopedSectorId) return false

      if (selectedCostCenter !== 'all' && cCostCenter !== selectedCostCenter) return false
      if (selectedSector !== 'all' && cSector !== selectedSector) return false

      const cAdmissionIso = parseDateToIso(c.admission_date)
      if (admissionStart) {
        const isoStart = parseDateToIso(admissionStart)
        if (isoStart && (!cAdmissionIso || cAdmissionIso < isoStart)) return false
      }
      if (admissionEnd) {
        const isoEnd = parseDateToIso(admissionEnd)
        if (isoEnd && (!cAdmissionIso || cAdmissionIso > isoEnd)) return false
      }

      return true
    })
  }, [
    validCollaborators,
    scopedCostCenterId,
    scopedSectorId,
    selectedCostCenter,
    selectedSector,
    admissionStart,
    admissionEnd,
  ])

  const kpis = useMemo(() => {
    let inExperience = 0
    let pending45 = 0
    let pending90 = 0
    let overdue = 0
    let effective = 0
    let terminated = 0
    let terminated45 = 0
    let terminated90 = 0

    for (const c of filteredCollaborators) {
      const situation = (c.situation || '').trim()
      if (situation === 'Efetivado') {
        effective++
        continue
      }
      if (situation === 'Desligado') {
        terminated++

        // Descobrir a etapa da avaliação de desligamento do colaborador
        const collabEvals = validEvaluations.filter(
          (e) => e && (e.collaborator === c.id || e.collaborator?.id === c.id),
        )

        const terminateEvals = collabEvals.filter((e) => {
          const dec = (e.decision || '').trim().toUpperCase()
          return dec === 'TERMINATE' || dec === 'DESLIGAR' || dec === 'ENCERRAR'
        })

        const hasTerm45 = terminateEvals.some((e) => (e.stage || '').toLowerCase().includes('45'))
        const hasTerm90 = terminateEvals.some((e) => (e.stage || '').toLowerCase().includes('90'))

        if (hasTerm45 && !hasTerm90) {
          terminated45++
        } else if (hasTerm90 && !hasTerm45) {
          terminated90++
        } else if (hasTerm45 && hasTerm90) {
          // Caso ambíguo: se houver desligamento em ambas as etapas, atribui à primeira etapa (45 dias)
          terminated45++
        } else {
          // Desligamento sem avaliação explícita TERMINATE (ou com dados corrompidos/incompletos):
          // tenta inferir pela presença de avaliação registrada
          const any45 = collabEvals.some((e) => (e.stage || '').toLowerCase().includes('45'))
          const any90 = collabEvals.some((e) => (e.stage || '').toLowerCase().includes('90'))
          if (any90) {
            terminated90++
          } else if (any45) {
            terminated45++
          }
        }

        continue
      }
      if (situation === 'Inativo') {
        continue
      }

      if (situation === 'Em experiência') {
        inExperience++

        const collabEvals = validEvaluations.filter(
          (e) => e && (e.collaborator === c.id || e.collaborator?.id === c.id),
        )
        const has45 = collabEvals.some((e) => (e.stage || '').toLowerCase().includes('45'))
        const has90 = collabEvals.some((e) => (e.stage || '').toLowerCase().includes('90'))

        if (!has45) {
          pending45++
          const status45 = calculateDeadlineStatus(c.deadline_45)
          if (status45.isOverdue) {
            overdue++
          }
        } else if (!has90) {
          const eval45 = collabEvals.find((e) => (e.stage || '').toLowerCase().includes('45'))
          if (eval45?.decision === 'EXTEND') {
            pending90++
            const status90 = calculateDeadlineStatus(c.deadline_90)
            if (status90.isOverdue) {
              overdue++
            }
          }
        }
      }
    }

    const pctTerminated45 =
      terminated > 0 ? `${Math.round((terminated45 / terminated) * 100)}%` : '—'
    const pctTerminated90 =
      terminated > 0 ? `${Math.round((terminated90 / terminated) * 100)}%` : '—'

    return {
      inExperience,
      pending45,
      pending90,
      overdue,
      effective,
      terminated,
      terminated45,
      terminated90,
      pctTerminated45,
      pctTerminated90,
    }
  }, [filteredCollaborators, validEvaluations])

  const costCenterBreakdown = useMemo(() => {
    const centersInScope = validCostCenters.filter((cc) => {
      if (scopedCostCenterId && cc.id !== scopedCostCenterId) return false
      return true
    })

    const calculateCollabMetrics = (collabs: any[]) => {
      let count45 = 0
      let count90 = 0
      let countPending = 0
      let countEffective = 0
      let countTerminated = 0
      let countOther = 0

      for (const c of collabs) {
        const situation = (c?.situation || '').trim()
        const collabEvals = validEvaluations.filter(
          (e) => e && c && (e.collaborator === c.id || e.collaborator?.id === c.id),
        )
        if (collabEvals.some((e) => (e.stage || '').toLowerCase().includes('45'))) count45++
        if (collabEvals.some((e) => (e.stage || '').toLowerCase().includes('90'))) count90++

        if (situation === 'Efetivado') {
          countEffective++
        } else if (situation === 'Desligado') {
          countTerminated++
        } else if (situation === 'Em experiência') {
          countPending++
        } else {
          // Inativo ou sem situação cadastrada
          countOther++
        }
      }

      return {
        total: collabs.length,
        eval_45: count45,
        eval_90: count90,
        total_evals: count45 + count90,
        pending: countPending,
        effective: countEffective,
        terminated: countTerminated,
        other: countOther,
      }
    }

    const rows = centersInScope.map((cc) => {
      const collabsInCenter = filteredCollaborators.filter(
        (c) => (c?.cost_center || c?.expand?.cost_center?.id) === cc.id,
      )
      const metrics = calculateCollabMetrics(collabsInCenter)

      return {
        id: cc.id,
        name: cc.name || 'Sem nome',
        type: cc.type || 'Obra',
        ...metrics,
      }
    })

    // Also check for collaborators without cost center or orphan cost center
    const orphanCollabs = filteredCollaborators.filter((c) => {
      if (!c) return false
      const cCc = c.cost_center || c.expand?.cost_center?.id
      return !cCc || !validCostCenters.some((cc) => cc.id === cCc)
    })

    if (orphanCollabs.length > 0 && !scopedCostCenterId) {
      const metrics = calculateCollabMetrics(orphanCollabs)

      rows.push({
        id: 'orphan',
        name: 'Não informado / Outros',
        type: '-',
        ...metrics,
      })
    }

    return rows
  }, [validCostCenters, filteredCollaborators, validEvaluations, scopedCostCenterId])

  const hasAnyOther = useMemo(() => {
    return costCenterBreakdown.some((r) => r.other > 0)
  }, [costCenterBreakdown])
  const handleDrilldown = (indicatorSlug: string, costCenterId?: string) => {
    const params = new URLSearchParams()
    params.set('indicator', indicatorSlug)
    if (costCenterId) params.set('cost_center', costCenterId)
    else if (selectedCostCenter !== 'all') params.set('cost_center', selectedCostCenter)

    if (selectedSector !== 'all') params.set('sector', selectedSector)
    if (admissionStart) params.set('admission_start', admissionStart)
    if (admissionEnd) params.set('admission_end', admissionEnd)

    navigate(`/dashboard/detail?${params.toString()}`)
  }

  const handleClearFilters = () => {
    setAdmissionStart('')
    setAdmissionEnd('')
    setSelectedCostCenter('all')
    setSelectedSector('all')
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111111]">Visão geral</h1>
        <p className="text-sm text-gray-600 mt-0.5">
          Acompanhe os ciclos e aja antes dos vencimentos.
        </p>
      </div>

      <div className="rounded-2xl border border-[#E8E8E8] bg-white p-5 shadow-xs space-y-4">
        <div className="flex items-center gap-2 text-xs font-bold uppercase tracking-wider text-gray-600">
          <Filter className="h-4 w-4 text-[#54D769]" />
          <span>Filtros do Painel</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-medium">Admissão inicial (DD/MM/AAAA)</span>
            <Input
              placeholder="01/01/2026"
              value={admissionStart}
              onChange={(e) => setAdmissionStart(e.target.value)}
              className="h-10 text-xs border-[#E8E8E8]"
            />
          </div>

          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-medium">Admissão final (DD/MM/AAAA)</span>
            <Input
              placeholder="31/12/2026"
              value={admissionEnd}
              onChange={(e) => setAdmissionEnd(e.target.value)}
              className="h-10 text-xs border-[#E8E8E8]"
            />
          </div>

          <div className="space-y-1">
            <span className="text-xs text-gray-500 font-medium">Centro de Custo</span>
            <Select value={selectedCostCenter} onValueChange={setSelectedCostCenter}>
              <SelectTrigger className="h-10 text-xs border-[#E8E8E8] bg-white">
                <SelectValue placeholder="Todos os centros" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os centros</SelectItem>
                {validCostCenters.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>
                    {cc.name || 'Centro'} ({cc.type || 'Obra'})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isEscritorio ? (
            <div className="space-y-1">
              <span className="text-xs text-gray-500 font-medium">Setor (Escritório)</span>
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectTrigger className="h-10 text-xs border-[#E8E8E8] bg-white">
                  <SelectValue placeholder="Todos os setores" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todos os setores</SelectItem>
                  {validSectors.map((sec) => (
                    <SelectItem key={sec.id} value={sec.id}>
                      {sec.name || 'Setor'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="space-y-1 opacity-50">
              <span className="text-xs text-gray-400 font-medium">Setor</span>
              <Input
                disabled
                placeholder="Disponível para Escritório"
                className="h-10 text-xs bg-gray-50"
              />
            </div>
          )}
        </div>

        <div className="flex justify-end pt-1">
          <Button
            variant="outline"
            size="sm"
            onClick={handleClearFilters}
            className="text-xs border-[#E8E8E8] text-gray-600 hover:text-black"
          >
            Limpar filtros
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-3 sm:gap-4">
        <div
          onClick={() => handleDrilldown('in_experience')}
          className="group rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer border-l-4 border-l-blue-500"
        >
          <div className="flex items-center justify-between text-blue-600 mb-2">
            <Users className="h-5 w-5" />
            <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis.inExperience}</p>
          <p className="text-xs text-gray-600 font-medium mt-1 leading-tight">Em experiência</p>
        </div>

        <div
          onClick={() => handleDrilldown('pending_45')}
          className="group rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer border-l-4 border-l-amber-500"
        >
          <div className="flex items-center justify-between text-amber-600 mb-2">
            <Clock className="h-5 w-5" />
            <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis.pending45}</p>
          <p className="text-xs text-gray-600 font-medium mt-1 leading-tight">
            Pendentes de 45 dias
          </p>
        </div>

        <div
          onClick={() => handleDrilldown('pending_90')}
          className="group rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer border-l-4 border-l-orange-500"
        >
          <div className="flex items-center justify-between text-orange-600 mb-2">
            <Clock className="h-5 w-5" />
            <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis.pending90}</p>
          <p className="text-xs text-gray-600 font-medium mt-1 leading-tight">
            Pendentes de 90 dias
          </p>
        </div>

        <div
          onClick={() => handleDrilldown('overdue')}
          className="group rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer border-l-4 border-l-red-500"
        >
          <div className="flex items-center justify-between text-red-600 mb-2">
            <AlertTriangle className="h-5 w-5" />
            <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-2xl font-bold text-red-600">{kpis.overdue}</p>
          <p className="text-xs text-gray-600 font-medium mt-1 leading-tight">
            Avaliações atrasadas
          </p>
        </div>

        <div
          onClick={() => handleDrilldown('effective')}
          className="group rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer border-l-4 border-l-[#54D769]"
        >
          <div className="flex items-center justify-between text-emerald-600 mb-2">
            <CheckCircle2 className="h-5 w-5" />
            <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis.effective}</p>
          <p className="text-xs text-gray-600 font-medium mt-1 leading-tight">Efetivados</p>
        </div>

        <div
          onClick={() => handleDrilldown('terminated')}
          className="group rounded-2xl border border-[#E8E8E8] bg-white p-4 shadow-xs hover:shadow-md hover:-translate-y-1 transition-all cursor-pointer border-l-4 border-l-gray-600"
        >
          <div className="flex items-center justify-between text-gray-600 mb-2">
            <UserX className="h-5 w-5" />
            <ArrowUpRight className="h-4 w-4 opacity-0 group-hover:opacity-100 transition-opacity" />
          </div>
          <p className="text-2xl font-bold text-gray-900">{kpis.terminated}</p>
          <p className="text-xs text-gray-600 font-medium mt-1 leading-tight">Desligados</p>
          <div className="mt-2 pt-2 border-t border-gray-100 flex flex-col gap-0.5 text-[11px] text-gray-500 font-normal">
            <div className="flex items-center justify-between">
              <span>45 dias:</span>
              <span className="font-semibold text-gray-700">{kpis.pctTerminated45}</span>
            </div>
            <div className="flex items-center justify-between">
              <span>90 dias:</span>
              <span className="font-semibold text-gray-700">{kpis.pctTerminated90}</span>
            </div>
          </div>
        </div>
      </div>

      <div className="rounded-2xl border border-[#E8E8E8] bg-white p-6 shadow-xs space-y-4">
        <div>
          <h2 className="text-base font-bold text-gray-900">Análise por Centro de Custo</h2>
          <p className="text-xs text-gray-500">
            Distribuição de pendências, efetivações e desligamentos por obra/setor
          </p>
        </div>

        <div className="h-72 w-full pt-4 min-h-[250px]">
          {costCenterBreakdown.length === 0 ? (
            <div className="h-full flex items-center justify-center text-xs text-gray-400">
              Nenhum centro de custo disponível para exibição no gráfico.
            </div>
          ) : (
            <ErrorBoundary
              fallbackTitle="Não foi possível carregar o gráfico"
              fallbackMessage="Os dados continuam íntegros e listados na tabela detalhada abaixo."
              showHomeButton={false}
            >
              <ResponsiveContainer width="100%" height={260} minWidth={100} minHeight={200}>
                <BarChart
                  data={costCenterBreakdown}
                  margin={{ top: 10, right: 10, left: 0, bottom: 20 }}
                >
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#EEEEEE" />
                  <XAxis dataKey="name" tick={{ fontSize: 11 }} interval={0} />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip
                    contentStyle={{
                      backgroundColor: '#111111',
                      color: '#FFFFFF',
                      borderRadius: '8px',
                      fontSize: '12px',
                    }}
                  />
                  <Legend wrapperStyle={{ fontSize: '12px' }} />
                  <Bar dataKey="pending" name="Pendentes" fill="#F5A623" radius={[4, 4, 0, 0]} />
                  <Bar dataKey="effective" name="Efetivados" fill="#54D769" radius={[4, 4, 0, 0]} />
                  <Bar
                    dataKey="terminated"
                    name="Desligados"
                    fill="#D32F2F"
                    radius={[4, 4, 0, 0]}
                  />
                </BarChart>
              </ResponsiveContainer>
            </ErrorBoundary>
          )}
        </div>
      </div>

      <div className="rounded-2xl border border-[#E8E8E8] bg-white shadow-xs overflow-hidden">
        <div className="p-5 border-b border-[#E8E8E8] flex flex-col md:flex-row md:items-center md:justify-between gap-3">
          <div>
            <h2 className="text-base font-bold text-gray-900">Detalhamento por Centro de Custo</h2>
            <p className="text-xs text-gray-500">
              Clique em qualquer indicador para abrir a listagem detalhada correspondente.
            </p>
          </div>

          {/* Legenda explicativa restaurada da versão 0.0.41 */}
          <div className="rounded-lg bg-blue-50/70 border border-blue-200/60 px-3 py-2 text-[11px] text-blue-900 leading-relaxed max-w-xl">
            <span className="font-semibold">Como entender os números:</span> O{' '}
            <span className="font-semibold text-blue-950">Total</span> representa o número real de
            colaboradores cadastrados vinculados ao centro (Pendentes + Efetivados + Desligados{' '}
            {hasAnyOther ? '+ Outros ' : ''}= Total). As colunas{' '}
            <span className="font-semibold text-blue-950">45d Concluídas</span> e{' '}
            <span className="font-semibold text-blue-950">90d Concluídas</span> mostram quantos já
            realizaram cada etapa.
          </div>
        </div>

        <div className="overflow-x-auto w-full">
          <table className="w-full text-left text-xs md:text-sm table-fixed">
            <thead className="bg-[#F9FAFB] text-[11px] md:text-xs font-semibold text-gray-600 uppercase border-b border-[#E8E8E8]">
              <tr>
                <th
                  className={
                    hasAnyOther ? 'w-[26%] px-3 md:px-4 py-2.5' : 'w-[29%] px-3 md:px-4 py-2.5'
                  }
                >
                  Centro de Custo
                </th>
                <th className="w-[10%] px-2 py-2.5 text-center">Tipo</th>
                <th className="w-[10%] px-1.5 md:px-2 py-2.5 text-center text-amber-700">
                  Pendentes
                </th>
                <th className="w-[10%] px-1.5 md:px-2 py-2.5 text-center text-emerald-700">
                  Efetivados
                </th>
                <th className="w-[10%] px-1.5 md:px-2 py-2.5 text-center text-red-700">
                  Desligados
                </th>
                {hasAnyOther && (
                  <th
                    className="w-[8%] px-1 md:px-2 py-2.5 text-center text-gray-500"
                    title="Inativos ou sem situação cadastrada"
                  >
                    Outros
                  </th>
                )}
                <th
                  className="w-[9%] px-1.5 md:px-2 py-2.5 text-center font-bold text-gray-900"
                  title="Total de colaboradores vinculados ao centro de custo"
                >
                  Total
                </th>
                <th
                  className="w-[12%] px-1.5 md:px-2 py-2.5 text-center text-blue-800"
                  title="Colaboradores que já realizaram/concluíram a avaliação de 45 dias"
                >
                  45d Concluídas
                </th>
                <th
                  className="w-[12%] px-1.5 md:px-2 py-2.5 text-center text-blue-800"
                  title="Colaboradores que já realizaram/concluíram a avaliação de 90 dias"
                >
                  90d Concluídas
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#E8E8E8]">
              {costCenterBreakdown.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50/80 transition-colors">
                  <td
                    className="px-3 md:px-4 py-2 font-bold text-gray-900 truncate"
                    title={row.name}
                  >
                    {row.name}
                  </td>
                  <td className="px-2 py-2 text-center text-[11px] md:text-xs text-gray-500 whitespace-nowrap">
                    {row.type}
                  </td>
                  <td className="px-1.5 md:px-2 py-2 text-center text-amber-600 font-semibold">
                    <button
                      onClick={() => handleDrilldown('pending', row.id)}
                      className="hover:underline px-1 py-0.5"
                      title="Ver colaboradores com avaliação pendente neste centro"
                    >
                      {row.pending}
                    </button>
                  </td>
                  <td className="px-1.5 md:px-2 py-2 text-center text-emerald-600 font-semibold">
                    <button
                      onClick={() => handleDrilldown('effective', row.id)}
                      className="hover:underline px-1 py-0.5"
                      title="Ver colaboradores efetivados neste centro"
                    >
                      {row.effective}
                    </button>
                  </td>
                  <td className="px-1.5 md:px-2 py-2 text-center text-red-600 font-semibold">
                    <button
                      onClick={() => handleDrilldown('terminated', row.id)}
                      className="hover:underline px-1 py-0.5"
                      title="Ver colaboradores desligados neste centro"
                    >
                      {row.terminated}
                    </button>
                  </td>
                  {hasAnyOther && (
                    <td className="px-1 md:px-2 py-2 text-center text-gray-500 font-medium">
                      {row.other > 0 ? (
                        <button
                          onClick={() => handleDrilldown('other', row.id)}
                          className="hover:underline px-1 py-0.5"
                          title="Ver colaboradores inativos ou sem situação"
                        >
                          {row.other}
                        </button>
                      ) : (
                        <span>0</span>
                      )}
                    </td>
                  )}
                  <td className="px-1.5 md:px-2 py-2 text-center font-bold text-gray-900">
                    <button
                      onClick={() => handleDrilldown('all', row.id)}
                      className="hover:underline hover:text-[#54D769] px-2 py-0.5 rounded font-bold"
                      title="Ver todos os colaboradores deste centro"
                    >
                      {row.total}
                    </button>
                  </td>
                  <td className="px-1.5 md:px-2 py-2 text-center text-gray-700">
                    <button
                      onClick={() => handleDrilldown('eval_45_done', row.id)}
                      className="hover:underline hover:text-blue-600 px-1 py-0.5"
                      title="Ver colaboradores com avaliação de 45 dias concluída"
                    >
                      {row.eval_45}
                    </button>
                  </td>
                  <td className="px-1.5 md:px-2 py-2 text-center text-gray-700">
                    <button
                      onClick={() => handleDrilldown('eval_90_done', row.id)}
                      className="hover:underline hover:text-blue-600 px-1 py-0.5"
                      title="Ver colaboradores com avaliação de 90 dias concluída"
                    >
                      {row.eval_90}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  )
}

export default Dashboard
