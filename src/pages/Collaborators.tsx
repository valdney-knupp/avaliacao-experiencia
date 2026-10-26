import React, { useState, useEffect, useMemo } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  Users,
  UserPlus,
  Search,
  Filter,
  Building2,
  Briefcase,
  Calendar,
  AlertTriangle,
  ChevronRight,
  ShieldAlert,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { formatDateBR, maskCPF, normalizeSearchText } from '@/lib/dateAndCpfUtils'

export const Collaborators: React.FC = () => {
  const { canCreateCollaborator, scopedCostCenterId, scopedSectorId } = useAuth()
  const navigate = useNavigate()

  const [collaborators, setCollaborators] = useState<any[]>([])
  const [costCenters, setCostCenters] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [fetchError, setFetchError] = useState<string | null>(null)

  // Filters
  const [searchTerm, setSearchTerm] = useState('')
  const [selectedCostCenter, setSelectedCostCenter] = useState<string>('all')
  const [selectedSector, setSelectedSector] = useState<string>('all')
  const [selectedSituation, setSelectedSituation] = useState<string>('all')

  const loadData = async () => {
    setLoading(true)
    setFetchError(null)
    try {
      const [ccRes, secRes, colRes] = await Promise.all([
        pb.collection('cost_centers').getFullList({ sort: 'name' }),
        pb.collection('sectors').getFullList({ sort: 'name' }),
        pb.collection('collaborators').getFullList({
          sort: '-created',
          expand: 'cost_center,sector',
        }),
      ])

      setCostCenters(Array.isArray(ccRes) ? ccRes.filter(Boolean) : [])
      setSectors(Array.isArray(secRes) ? secRes.filter(Boolean) : [])
      setCollaborators(Array.isArray(colRes) ? colRes.filter(Boolean) : [])
    } catch (err: unknown) {
      setFetchError(
        'Erro ao carregar colaboradores do servidor: ' +
          (err instanceof Error ? err.message : 'Falha na conexão com o banco de dados'),
      )
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadData()
  }, [])

  // Filtered collaborators
  const filteredList = useMemo(() => {
    const safeCollaborators = Array.isArray(collaborators) ? collaborators.filter(Boolean) : []
    return safeCollaborators.filter((c) => {
      if (!c || !c.id) return false

      const cCostCenter = c.cost_center || c.expand?.cost_center?.id || ''
      const cSector = c.sector || c.expand?.sector?.id || ''

      // Scope filters
      if (scopedCostCenterId && cCostCenter !== scopedCostCenterId) return false
      if (scopedSectorId && cSector !== scopedSectorId) return false

      // Dropdown filters
      if (selectedCostCenter !== 'all' && cCostCenter !== selectedCostCenter) return false
      if (selectedSector !== 'all' && cSector !== selectedSector) return false
      if (selectedSituation !== 'all' && c.situation !== selectedSituation) return false

      // Diacritic-tolerant search across name, role, cost center, sector, situation
      if (searchTerm.trim()) {
        const normTerm = normalizeSearchText(searchTerm)
        const normName = normalizeSearchText(c.name || '')
        const normRole = normalizeSearchText(c.role || '')
        const normCC = normalizeSearchText(c.expand?.cost_center?.name || '')
        const normSec = normalizeSearchText(c.expand?.sector?.name || '')
        const normSit = normalizeSearchText(c.situation || '')

        const matches =
          normName.includes(normTerm) ||
          normRole.includes(normTerm) ||
          normCC.includes(normTerm) ||
          normSec.includes(normTerm) ||
          normSit.includes(normTerm)

        if (!matches) return false
      }

      return true
    })
  }, [
    collaborators,
    searchTerm,
    selectedCostCenter,
    selectedSector,
    selectedSituation,
    scopedCostCenterId,
    scopedSectorId,
  ])

  const getSituationBadge = (situation: string) => {
    switch (situation) {
      case 'Em experiência':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E3F2FD] text-[#1565C0] border border-blue-200">
            Em experiência
          </span>
        )
      case 'Efetivado':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#E8F5E9] text-[#2E7D32] border border-green-200">
            Efetivado
          </span>
        )
      case 'Desligado':
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#FFEBEE] text-[#C62828] border border-red-200">
            Desligado
          </span>
        )
      case 'Inativo':
      default:
        return (
          <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium bg-[#EEEEEE] text-[#616161] border border-gray-300">
            {situation || 'Inativo'}
          </span>
        )
    }
  }

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-[#111111]">Colaboradores</h1>
          <p className="text-sm text-gray-500">
            Cadastro, consulta e histórico do ciclo de experiência.
          </p>
        </div>

        {canCreateCollaborator && (
          <Button
            onClick={() => navigate('/collaborators/new')}
            className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] self-start sm:self-auto shadow-sm"
          >
            <UserPlus className="mr-2 h-4 w-4" />
            Novo colaborador
          </Button>
        )}
      </div>

      {/* Database error banner */}
      {fetchError && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-start gap-3">
          <ShieldAlert className="h-5 w-5 shrink-0 text-red-600 mt-0.5" />
          <div>
            <p className="font-semibold">Erro de comunicação com o banco de dados</p>
            <p className="mt-0.5 text-xs text-red-600">{fetchError}</p>
          </div>
        </div>
      )}

      {/* Filter Toolbar */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white p-4 shadow-xs space-y-3">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-3">
          {/* Search bar */}
          <div className="relative md:col-span-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
            <Input
              placeholder="Buscar (nome, função, centro...)"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="pl-9 h-10 border-[#E8E8E8] focus-visible:ring-[#54D769]"
            />
          </div>

          {/* Cost Center dropdown */}
          <div>
            <Select value={selectedCostCenter} onValueChange={setSelectedCostCenter}>
              <SelectTrigger className="h-10 border-[#E8E8E8]">
                <SelectValue placeholder="Centro de Custo" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Centros</SelectItem>
                {costCenters.map((cc) => (
                  <SelectItem key={cc.id} value={cc.id}>
                    {cc.name} ({cc.type})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Sector dropdown */}
          <div>
            <Select value={selectedSector} onValueChange={setSelectedSector}>
              <SelectTrigger className="h-10 border-[#E8E8E8]">
                <SelectValue placeholder="Setor (Escritório)" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todos os Setores</SelectItem>
                {sectors.map((sec) => (
                  <SelectItem key={sec.id} value={sec.id}>
                    {sec.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {/* Situation dropdown */}
          <div>
            <Select value={selectedSituation} onValueChange={setSelectedSituation}>
              <SelectTrigger className="h-10 border-[#E8E8E8]">
                <SelectValue placeholder="Situação" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Todas as Situações</SelectItem>
                <SelectItem value="Em experiência">Em experiência</SelectItem>
                <SelectItem value="Efetivado">Efetivado</SelectItem>
                <SelectItem value="Desligado">Desligado</SelectItem>
                <SelectItem value="Inativo">Inativo</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>

        {(searchTerm ||
          selectedCostCenter !== 'all' ||
          selectedSector !== 'all' ||
          selectedSituation !== 'all') && (
          <div className="flex justify-end">
            <Button
              variant="ghost"
              size="sm"
              onClick={() => {
                setSearchTerm('')
                setSelectedCostCenter('all')
                setSelectedSector('all')
                setSelectedSituation('all')
              }}
              className="text-xs text-gray-500 hover:text-black"
            >
              Limpar filtros
            </Button>
          </div>
        )}
      </div>

      {/* Collaborator Table */}
      <div className="rounded-xl border border-[#E8E8E8] bg-white shadow-xs overflow-hidden">
        {loading ? (
          <div className="p-12 text-center">
            <div className="mx-auto h-8 w-8 animate-spin rounded-full border-2 border-[#111111] border-t-[#54D769]" />
            <p className="mt-3 text-sm text-gray-500">Carregando colaboradores...</p>
          </div>
        ) : filteredList.length === 0 ? (
          <div className="p-12 text-center">
            <Users className="mx-auto h-12 w-12 text-gray-300" />
            <h3 className="mt-2 text-sm font-semibold text-gray-900">
              Nenhum colaborador encontrado
            </h3>
            <p className="mt-1 text-xs text-gray-500">
              Nenhum registro atende aos critérios de pesquisa selecionados.
            </p>
          </div>
        ) : (
          <div className="overflow-x-auto w-full">
            <table className="w-full text-left text-xs md:text-sm table-fixed">
              <thead className="bg-[#F9FAFB] border-b border-[#E8E8E8] text-[11px] md:text-xs font-semibold text-gray-600 uppercase tracking-wider">
                <tr>
                  <th className="w-[23%] px-2.5 md:px-3 py-2.5">Colaborador</th>
                  <th className="w-[11%] px-1.5 md:px-2 py-2.5">CPF</th>
                  <th className="w-[17%] px-1.5 md:px-2 py-2.5">Função</th>
                  <th className="w-[16%] px-1.5 md:px-2 py-2.5">Centro de Custo</th>
                  <th className="w-[11%] px-1.5 md:px-2 py-2.5">Setor</th>
                  <th className="w-[8%] px-1 md:px-2 py-2.5">Admissão</th>
                  <th className="w-[10%] px-1.5 md:px-2 py-2.5">Situação</th>
                  <th className="w-[7%] px-1 md:px-2 py-2.5 text-right">Ação</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-[#E8E8E8]">
                {filteredList.map((collab) => (
                  <tr
                    key={collab.id}
                    className="hover:bg-[#F9FAFB] transition-colors group cursor-pointer"
                    onClick={() => navigate(`/collaborators/${collab.id}`)}
                  >
                    <td
                      className="px-2.5 md:px-3 py-2 font-semibold text-gray-900 truncate"
                      title={collab.name}
                    >
                      <Link
                        to={`/collaborators/${collab.id}`}
                        onClick={(e) => e.stopPropagation()}
                        className="text-[#111111] hover:text-[#54D769] transition-colors truncate block"
                        title={collab.name}
                      >
                        {collab.name}
                      </Link>
                    </td>
                    <td className="px-1.5 md:px-2 py-2 text-[11px] md:text-xs font-mono text-gray-500 whitespace-nowrap">
                      {maskCPF()}
                    </td>
                    <td className="px-1.5 md:px-2 py-2 text-gray-700 truncate" title={collab.role}>
                      {collab.role}
                    </td>
                    <td
                      className="px-1.5 md:px-2 py-2 text-gray-700 truncate"
                      title={collab.expand?.cost_center?.name || '-'}
                    >
                      <span className="font-medium text-[10px] md:text-xs bg-gray-100 text-gray-800 px-1.5 md:px-2 py-0.5 rounded truncate inline-block max-w-full">
                        {collab.expand?.cost_center?.name || '-'}
                      </span>
                    </td>
                    <td
                      className="px-1.5 md:px-2 py-2 text-gray-600 text-[11px] md:text-xs truncate"
                      title={collab.expand?.sector?.name || '-'}
                    >
                      {collab.expand?.sector?.name || '-'}
                    </td>
                    <td className="px-1 md:px-2 py-2 text-gray-600 text-[11px] md:text-xs whitespace-nowrap">
                      {formatDateBR(collab.admission_date)}
                    </td>
                    <td className="px-1.5 md:px-2 py-2">{getSituationBadge(collab.situation)}</td>
                    <td className="px-1 md:px-2 py-2 text-right whitespace-nowrap">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={(e) => {
                          e.stopPropagation()
                          navigate(`/collaborators/${collab.id}`)
                        }}
                        className="text-[11px] md:text-xs text-gray-500 group-hover:text-black h-7 md:h-8 px-1.5 md:px-2"
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

        <div className="border-t border-[#E8E8E8] bg-gray-50/50 px-6 py-3 text-xs text-gray-500 flex items-center justify-between">
          <span>Total exibido: {filteredList.length} colaboradores</span>
          <span>CPF mascarado por política de segurança</span>
        </div>
      </div>
    </div>
  )
}

export default Collaborators
