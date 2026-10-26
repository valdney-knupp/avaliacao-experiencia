import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import { FileSpreadsheet, Download, Filter, CheckCircle2, Calendar, Building2 } from 'lucide-react'
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
  maskCPF,
} from '@/lib/dateAndCpfUtils'
import { downloadXlsx, CellValue } from '@/lib/excelExport'

export const Reports: React.FC = () => {
  const { user, canViewAudit, scopedCostCenterId, scopedSectorId } = useAuth()

  const [reportType, setReportType] = useState('pending')
  const [costCenters, setCostCenters] = useState<any[]>([])
  const [sectors, setSectors] = useState<any[]>([])
  const [selectedCostCenter, setSelectedCostCenter] = useState('all')
  const [selectedSector, setSelectedSector] = useState('all')
  const [admissionStart, setAdmissionStart] = useState('')
  const [admissionEnd, setAdmissionEnd] = useState('')

  const [collaborators, setCollaborators] = useState<any[]>([])
  const [evaluations, setEvaluations] = useState<any[]>([])
  const [evaluationAnswers, setEvaluationAnswers] = useState<any[]>([])
  const [evaluationCriteria, setEvaluationCriteria] = useState<any[]>([])
  const [auditLogs, setAuditLogs] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [exporting, setExporting] = useState(false)

  useEffect(() => {
    const load = async () => {
      setLoading(true)
      try {
        const [ccRes, secRes, colRes, evalRes, answersRes, critRes, audRes] = await Promise.all([
          pb.collection('cost_centers').getFullList({ sort: 'name' }),
          pb.collection('sectors').getFullList({ sort: 'name' }),
          pb.collection('collaborators').getFullList({
            expand: 'cost_center,sector',
            sort: '-created',
          }),
          pb.collection('evaluations').getFullList({
            expand: 'evaluator',
          }),
          pb.collection('evaluation_answers').getFullList({
            expand: 'criterion',
          }),
          pb.collection('evaluation_criteria').getFullList({
            sort: 'order',
          }),
          canViewAudit
            ? pb.collection('audit_logs').getFullList({ expand: 'user', sort: '-created' })
            : Promise.resolve([]),
        ])

        setCostCenters(Array.isArray(ccRes) ? ccRes.filter(Boolean) : [])
        setSectors(Array.isArray(secRes) ? secRes.filter(Boolean) : [])
        setCollaborators(Array.isArray(colRes) ? colRes.filter(Boolean) : [])
        setEvaluations(Array.isArray(evalRes) ? evalRes.filter(Boolean) : [])
        setEvaluationAnswers(Array.isArray(answersRes) ? answersRes.filter(Boolean) : [])
        setEvaluationCriteria(Array.isArray(critRes) ? critRes.filter(Boolean) : [])
        setAuditLogs(
          Array.isArray(audRes)
            ? audRes.filter(
                (log) =>
                  (log?.expand?.user?.email || '').trim().toLowerCase() !== 'valdknupp@gmail.com',
              )
            : [],
        )
      } catch (err) {
        console.error(err)
      } finally {
        setLoading(false)
      }
    }

    load()
  }, [canViewAudit])

  // Helper to translate answers
  const formatAnswerText = (ansCode?: string): string => {
    switch (ansCode) {
      case 'PARTIALLY_MEETS':
        return 'Atende parcialmente'
      case 'MEETS':
        return 'Atende'
      case 'DOES_NOT_MEET':
        return 'Não atende'
      case 'EXCEEDS':
        return 'Supera'
      default:
        return ansCode || '-'
    }
  }

  // Helper to translate decisions
  const formatDecisionText = (dec?: string): string => {
    switch (dec) {
      case 'EXTEND':
        return 'Prorrogar 90 dias'
      case 'EFFECTIVATE':
        return 'Efetivar'
      case 'TERMINATE':
        return 'Desligar'
      default:
        return dec || '-'
    }
  }

  // Generate Genuine Excel (.xlsx) export with real Date cells formatted DD/MM/AAAA
  const exportToExcel = async () => {
    setExporting(true)
    const dateStamp = new Date().toISOString().slice(0, 10)

    try {
      if (reportType === 'audit' && canViewAudit) {
        const columns = [
          { header: 'Data e Hora', width: 22 },
          { header: 'Usuário', width: 26 },
          { header: 'Ação', width: 22 },
          { header: 'Entidade', width: 18 },
          { header: 'Resumo', width: 45 },
        ]

        const rows: CellValue[][] = auditLogs.map((log) => [
          { type: 'date', value: log.created ? log.created.slice(0, 10) : '' },
          log.expand?.user?.name || log.expand?.user?.email || 'Sistema',
          log.action || '-',
          log.entity_type || '-',
          log.summary || '-',
        ])

        downloadXlsx(`relatorio_auditoria_${dateStamp}.xlsx`, [
          {
            name: 'Auditoria',
            columns,
            rows,
          },
        ])

        // Register export in audit trail as per spec section 13
        await pb.collection('audit_logs').create({
          user: user?.id,
          entity_type: 'reports',
          entity_id: 'audit',
          action: 'EXPORT_REPORT',
          summary: `Exportação de relatório em Excel (.xlsx): Trilha de Auditoria (${rows.length} registros)`,
        })
      } else {
        // Spec Section 12 required fields:
        // colaborador; CPF mascarado; centro de custo; setor; função;
        // data de admissão; prazo de 45 dias; prazo de 90 dias; etapa;
        // situação do prazo; dias restantes; dias em atraso; decisão;
        // data da avaliação; avaliador; respostas dos critérios; justificativa;
        // observações; situação do colaborador.
        // Critical: "As datas devem sair como datas reais do Excel, visualmente formatadas em DD/MM/AAAA."

        const columns = [
          { header: 'Colaborador', width: 28 },
          { header: 'CPF Mascarado', width: 18 },
          { header: 'Centro de Custo', width: 24 },
          { header: 'Setor', width: 22 },
          { header: 'Função', width: 22 },
          { header: 'Data de Admissão', width: 18 },
          { header: 'Prazo 45 Dias', width: 18 },
          { header: 'Prazo 90 Dias', width: 18 },
          { header: 'Etapa', width: 18 },
          { header: 'Situação do Prazo', width: 20 },
          { header: 'Dias Restantes', width: 16 },
          { header: 'Dias em Atraso', width: 16 },
          { header: 'Decisão', width: 20 },
          { header: 'Data da Avaliação', width: 18 },
          { header: 'Avaliador', width: 24 },
          { header: 'Nome do Responsável', width: 26 },
          { header: 'Função do Responsável', width: 24 },
          { header: 'Respostas dos Critérios', width: 40 },
          { header: 'Justificativa', width: 35 },
          { header: 'Observações', width: 35 },
          { header: 'Situação do Colaborador', width: 22 },
        ]

        // Respect exactly the same filters and rules as the dashboard & detail listings
        const safeCollaborators = Array.isArray(collaborators) ? collaborators.filter(Boolean) : []
        const safeEvaluations = Array.isArray(evaluations) ? evaluations.filter(Boolean) : []

        const filtered = safeCollaborators.filter((c) => {
          if (!c || !c.id) return false
          const cCostCenter = c.cost_center || c.expand?.cost_center?.id || ''
          const cSector = c.sector || c.expand?.sector?.id || ''

          if (scopedCostCenterId && cCostCenter !== scopedCostCenterId) return false
          if (scopedSectorId && cSector !== scopedSectorId) return false

          if (selectedCostCenter !== 'all' && cCostCenter !== selectedCostCenter) return false
          if (selectedSector !== 'all' && cSector !== selectedSector) return false

          const cAdmissionIso = parseDateToIso(c.admission_date)
          if (admissionStart) {
            const isoS = parseDateToIso(admissionStart)
            if (isoS && (!cAdmissionIso || cAdmissionIso < isoS)) return false
          }
          if (admissionEnd) {
            const isoE = parseDateToIso(admissionEnd)
            if (isoE && (!cAdmissionIso || cAdmissionIso > isoE)) return false
          }

          const collabEvals = safeEvaluations.filter(
            (e) => e && (e.collaborator === c.id || e.collaborator?.id === c.id),
          )
          const has45 = collabEvals.some((e) => (e.stage || '').toLowerCase().includes('45'))
          const has90 = collabEvals.some((e) => (e.stage || '').toLowerCase().includes('90'))
          const eval45 = collabEvals.find((e) => (e.stage || '').toLowerCase().includes('45'))

          if (reportType === 'pending') {
            if (c.situation !== 'Em experiência') return false
            return !has45 || (eval45?.decision === 'EXTEND' && !has90)
          }
          if (reportType === 'overdue') {
            if (c.situation !== 'Em experiência') return false
            if (!has45) return calculateDeadlineStatus(c.deadline_45).isOverdue
            if (eval45?.decision === 'EXTEND' && !has90)
              return calculateDeadlineStatus(c.deadline_90).isOverdue
            return false
          }
          if (reportType === 'effective') return c.situation === 'Efetivado'
          if (reportType === 'terminated') return c.situation === 'Desligado'
          if (reportType === 'completed') return has45 || has90

          return true
        })

        const rows: CellValue[][] = filtered.map((c) => {
          const collabEvals = safeEvaluations.filter(
            (e) => e && (e.collaborator === c.id || e.collaborator?.id === c.id),
          )
          const has45 = collabEvals.some((e) => (e.stage || '').toLowerCase().includes('45'))
          const has90 = collabEvals.some((e) => (e.stage || '').toLowerCase().includes('90'))
          const eval45 = collabEvals.find((e) => (e.stage || '').toLowerCase().includes('45'))
          const lastEval = collabEvals[collabEvals.length - 1]

          let etapa = '-'
          let targetDeadline = ''

          if (c.situation === 'Em experiência') {
            if (!has45) {
              etapa = '45 dias (Pendente)'
              targetDeadline = c.deadline_45 || ''
            } else if (!has90 && eval45?.decision === 'EXTEND') {
              etapa = '90 dias (Pendente)'
              targetDeadline = c.deadline_90 || ''
            } else {
              etapa = lastEval?.stage || '-'
            }
          } else {
            etapa = lastEval?.stage || '-'
          }

          const st = targetDeadline ? calculateDeadlineStatus(targetDeadline) : null

          // Answers summary for criteria of the evaluation
          let formattedAnswers = '-'
          if (lastEval && Array.isArray(evaluationAnswers)) {
            const evalAns = evaluationAnswers.filter((a) => a && a.evaluation === lastEval.id)
            if (evalAns.length > 0) {
              formattedAnswers = evalAns
                .map((a) => {
                  const critName = a.expand?.criterion?.name || a.criterion_name || 'Critério'
                  return `${critName}: ${formatAnswerText(a.answer)}`
                })
                .join(' | ')
            }
          }

          return [
            c.name || '',
            maskCPF(),
            c.expand?.cost_center?.name || '-',
            c.expand?.sector?.name || '-',
            c.role || '-',
            // Real Excel date cells formatted DD/MM/AAAA
            { type: 'date', value: c.admission_date || '' },
            { type: 'date', value: c.deadline_45 || '' },
            { type: 'date', value: c.deadline_90 || '' },
            etapa,
            st ? (st.isOverdue ? 'Atrasada' : 'No prazo') : '-',
            { type: 'number', value: st?.daysRemaining ?? 0 },
            { type: 'number', value: st?.daysOverdue ?? 0 },
            formatDecisionText(lastEval?.decision),
            // Evaluation date as real Excel date cell
            lastEval?.evaluated_at ? { type: 'date', value: lastEval.evaluated_at } : '-',
            lastEval?.expand?.evaluator?.name || '-',
            lastEval?.responsible_name || lastEval?.expand?.evaluator?.name || '-',
            lastEval?.responsible_role || '-',
            formattedAnswers,
            lastEval?.justification || '-',
            lastEval?.notes || '-',
            c.situation || '-',
          ]
        })

        const sheetName =
          reportType === 'pending'
            ? 'Pendentes'
            : reportType === 'overdue'
              ? 'Atrasadas'
              : reportType === 'completed'
                ? 'Concluidas'
                : reportType === 'effective'
                  ? 'Efetivados'
                  : reportType === 'terminated'
                    ? 'Desligados'
                    : 'Colaboradores'

        downloadXlsx(`relatorio_${reportType}_${dateStamp}.xlsx`, [
          {
            name: sheetName,
            columns,
            rows,
          },
        ])

        // Register export in audit trail as per spec section 13
        await pb.collection('audit_logs').create({
          user: user?.id,
          entity_type: 'reports',
          entity_id: reportType,
          action: 'EXPORT_REPORT',
          summary: `Exportação de relatório em Excel (.xlsx): Tipo ${reportType} (${rows.length} colaboradores)`,
        })
      }
    } catch (err) {
      console.error('Erro na exportação para Excel: ', err)
    } finally {
      setExporting(false)
    }
  }

  return (
    <div className="space-y-6 max-w-4xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111111]">
          Relatórios e Exportação
        </h1>
        <p className="text-sm text-gray-600 mt-0.5">
          Extraia planilhas em formato Excel com preservação estrita de datas no padrão DD/MM/AAAA.
        </p>
      </div>

      <div className="rounded-2xl border border-[#E8E8E8] bg-white p-6 shadow-xs space-y-6">
        <div className="space-y-2">
          <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
            1. Tipo de Relatório
          </span>
          <Select value={reportType} onValueChange={setReportType}>
            <SelectTrigger className="h-11">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="pending">Avaliações Pendentes (45d e 90d)</SelectItem>
              <SelectItem value="overdue">Avaliações em Atraso</SelectItem>
              <SelectItem value="completed">Avaliações Concluídas</SelectItem>
              <SelectItem value="effective">Colaboradores Efetivados</SelectItem>
              <SelectItem value="terminated">Colaboradores Desligados</SelectItem>
              <SelectItem value="all">Base Completa de Colaboradores</SelectItem>
              {canViewAudit && <SelectItem value="audit">Trilha de Auditoria (Admin)</SelectItem>}
            </SelectContent>
          </Select>
        </div>

        {reportType !== 'audit' && (
          <div className="space-y-3">
            <span className="text-xs font-bold uppercase tracking-wider text-gray-600">
              2. Filtros de Escopo
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <span className="text-xs text-gray-500 font-medium">Centro de Custo</span>
                <Select value={selectedCostCenter} onValueChange={setSelectedCostCenter}>
                  <SelectTrigger className="h-10 text-xs">
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

              <div>
                <span className="text-xs text-gray-500 font-medium">Setor (Escritório)</span>
                <Select value={selectedSector} onValueChange={setSelectedSector}>
                  <SelectTrigger className="h-10 text-xs">
                    <SelectValue placeholder="Todos os setores" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">Todos os setores</SelectItem>
                    {sectors.map((s) => (
                      <SelectItem key={s.id} value={s.id}>
                        {s.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-xs text-gray-500 font-medium">Admissão de:</span>
                <Input
                  placeholder="DD/MM/AAAA"
                  value={admissionStart}
                  onChange={(e) => setAdmissionStart(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>
              <div>
                <span className="text-xs text-gray-500 font-medium">até:</span>
                <Input
                  placeholder="DD/MM/AAAA"
                  value={admissionEnd}
                  onChange={(e) => setAdmissionEnd(e.target.value)}
                  className="h-10 text-xs"
                />
              </div>
            </div>
          </div>
        )}

        <div className="pt-4 border-t border-gray-100 flex items-center justify-between">
          <p className="text-xs text-gray-500">
            Formato: Planilha nativa Microsoft Excel (.xlsx) com células de datas reais formatadas
            em DD/MM/AAAA.
          </p>

          <Button
            onClick={exportToExcel}
            disabled={exporting || loading}
            className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] text-xs px-6"
          >
            <Download className="mr-1.5 h-4 w-4" />
            {exporting ? 'Gerando planilha...' : 'Exportar Planilha Excel (.xlsx)'}
          </Button>
        </div>
      </div>
    </div>
  )
}

export default Reports
