import React, { useState, useEffect } from 'react'
import pb from '@/lib/pocketbase/client'
import { useAuth } from '@/hooks/use-auth'
import {
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  Download,
  RotateCcw,
  ShieldAlert,
  Clock,
  Layers,
  FileCheck2,
  XCircle,
  Check,
  AlertTriangle,
  Trash2,
  Loader2,
  ShieldCheck,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { Checkbox } from '@/components/ui/checkbox'
import { Input } from '@/components/ui/input'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { formatDateTimeBR, addDaysToIsoDate, encryptCPF } from '@/lib/dateAndCpfUtils'
import { parseSpreadsheetFile } from '@/lib/spreadsheetReader'
import {
  EvaluationFileSlot,
  CostCenterRecord,
  SectorRecord,
  EvaluationCriterionRecord,
  CollaboratorRecord,
  ExistingEvaluationRecord,
  FileSimulationReport,
  UnifiedSimulationResult,
  simulateCollaboratorsSheet,
  simulateEvaluationSheet,
} from '@/lib/importRules'
import { downloadImportTemplate } from '@/lib/importTemplates'

interface FileSlotState {
  id: 'colaboradores' | EvaluationFileSlot
  title: string
  subtitle: string
  expectedFileName: string
  required: boolean
  file: File | null
  badge: string
}

export const DataImport: React.FC = () => {
  const { isMasterUser, canAccessImport } = useAuth()

  // 5 slots configuration
  const [slots, setSlots] = useState<FileSlotState[]>([
    {
      id: 'colaboradores',
      title: '1. Inclusão de Colaboradores',
      subtitle: 'Base cadastral com nome, CPF, centro de custo, setor, função e admissão.',
      expectedFileName: 'BD_INCLUSAO-COLABORADOR.xlsx',
      required: false,
      file: null,
      badge: 'Cadastro',
    },
    {
      id: 'obras_45',
      title: '2. Avaliações Obras (45 dias)',
      subtitle: 'Avaliações da 1ª etapa dos colaboradores em obras.',
      expectedFileName: 'OBRAS_45D.xlsx',
      required: false,
      file: null,
      badge: 'Obras • 45d',
    },
    {
      id: 'obras_90',
      title: '3. Avaliações Obras (90 dias)',
      subtitle: 'Avaliações da 2ª etapa dos colaboradores em obras.',
      expectedFileName: 'OBRAS_90D.xlsx',
      required: false,
      file: null,
      badge: 'Obras • 90d',
    },
    {
      id: 'escritorio_45',
      title: '4. Avaliações Escritório (45 dias)',
      subtitle: 'Avaliações da 1ª etapa dos colaboradores do escritório.',
      expectedFileName: 'ESCRITORIO_45D.xlsx',
      required: false,
      file: null,
      badge: 'Escritório • 45d',
    },
    {
      id: 'escritorio_90',
      title: '5. Avaliações Escritório (90 dias)',
      subtitle: 'Avaliações da 2ª etapa dos colaboradores do escritório.',
      expectedFileName: 'ESCRITORIO_90D.xlsx',
      required: false,
      file: null,
      badge: 'Escritório • 90d',
    },
  ])

  const [simulating, setSimulating] = useState(false)
  const [simulateProgressText, setSimulateProgressText] = useState<string>('')
  const [executing, setExecuting] = useState(false)
  const [executeProgressText, setExecuteProgressText] = useState<string>('')
  const [simulationResult, setSimulationResult] = useState<UnifiedSimulationResult | null>(null)
  const [executionResult, setExecutionResult] = useState<string | null>(null)
  const [errorMsg, setErrorMsg] = useState<string | null>(null)
  const [partialLoadDetected, setPartialLoadDetected] = useState<{
    importId: string
    filename: string
    date: string
  } | null>(null)
  const [adminAuthorized, setAdminAuthorized] = useState(false)

  // Past imports list for "Substituir histórico importado"
  const [pastImports, setPastImports] = useState<any[]>([])

  // Modal e estado para Limpeza do Banco de Dados (exclusivo ADMIN)
  const [isResetDialogOpen, setIsResetDialogOpen] = useState(false)
  const [resetConfirmationInput, setResetConfirmationInput] = useState('')
  const [resetAgreementChecked, setResetAgreementChecked] = useState(false)
  const [resetting, setResetting] = useState(false)
  const [resetFeedback, setResetFeedback] = useState<{
    type: 'success' | 'error'
    message: string
  } | null>(null)

  const loadPastImports = async () => {
    try {
      const records = await pb.collection('imports').getFullList({
        sort: '-created',
        expand: 'user',
      })
      setPastImports(records)

      // Check if there was an executed import that might be partial or recent
      if (records.length > 0 && records[0].status === 'executed') {
        const latest = records[0]
        try {
          const rep = latest.report ? JSON.parse(latest.report) : {}
          // Verify if collaborators count or evaluations count in DB matches report
          const actualCollabs = await pb.collection('collaborators').getList(1, 1, {
            filter: `import_reference = '${latest.id}'`,
          })
          const expectedCollabs = rep.newCollaborators || 0
          if (expectedCollabs > 0 && actualCollabs.totalItems < expectedCollabs) {
            setPartialLoadDetected({
              importId: latest.id,
              filename: latest.filename,
              date: formatDateTimeBR(latest.created),
            })
          } else {
            setPartialLoadDetected(null)
          }
        } catch (_) {
          setPartialLoadDetected(null)
        }
      } else {
        setPartialLoadDetected(null)
      }
    } catch (err) {
      console.error('Erro ao carregar histórico de importações:', err)
    }
  }

  useEffect(() => {
    loadPastImports()
  }, [])

  // Handle single file assignment to slot
  const handleSetSlotFile = (slotId: string, file: File | null) => {
    setSlots((prev) => prev.map((s) => (s.id === slotId ? { ...s, file } : s)))
    setSimulationResult(null)
    setExecutionResult(null)
    setErrorMsg(null)
  }

  // Handle multiple files dropped or selected at once (auto-route to matching slot by filename)
  const handleMultiFilesAutoAssign = (files: FileList | File[]) => {
    const fileList = Array.from(files)
    setSlots((prev) =>
      prev.map((slot) => {
        const found = fileList.find((f) => {
          const norm = f.name.toLowerCase()
          if (
            slot.id === 'colaboradores' &&
            (norm.includes('inclus') || norm.includes('colaborador'))
          ) {
            return true
          }
          if (
            slot.id === 'obras_45' &&
            (norm.includes('obra') || norm.includes('obras')) &&
            norm.includes('45')
          ) {
            return true
          }
          if (
            slot.id === 'obras_90' &&
            (norm.includes('obra') || norm.includes('obras')) &&
            norm.includes('90')
          ) {
            return true
          }
          if (slot.id === 'escritorio_45' && norm.includes('escrit') && norm.includes('45')) {
            return true
          }
          if (slot.id === 'escritorio_90' && norm.includes('escrit') && norm.includes('90')) {
            return true
          }
          return false
        })
        return found ? { ...slot, file: found } : slot
      }),
    )
    setSimulationResult(null)
    setExecutionResult(null)
    setErrorMsg(null)
  }

  // Total chosen files
  const chosenSlots = slots.filter((s) => s.file !== null)

  // Run Unified Simulation across all chosen slots
  const handleSimulate = async () => {
    if (chosenSlots.length === 0) {
      setErrorMsg('Por favor, selecione ao menos um arquivo para simulação.')
      return
    }

    setSimulating(true)
    setSimulateProgressText('Carregando cadastros e tabelas de apoio do sistema...')
    setErrorMsg(null)
    setExecutionResult(null)
    setAdminAuthorized(false)

    // Helper to yield control to the browser render frame so the UI never freezes
    const yieldTick = () => new Promise<void>((resolve) => setTimeout(resolve, 60))

    try {
      await yieldTick()

      // Global safety timeout for the simulation (90 seconds max)
      let simTimeoutTimer: ReturnType<typeof setTimeout> | undefined
      const simTimeoutPromise = new Promise<never>((_, reject) => {
        simTimeoutTimer = setTimeout(() => {
          reject(
            new Error(
              'Tempo limite global da simulação excedido (90s). Verifique os arquivos selecionados.',
            ),
          )
        }, 90000)
      })

      const runSimulationInner = async () => {
        // Load current system lookups with individual error capture
        let costCenters: CostCenterRecord[] = []
        let sectors: SectorRecord[] = []
        let existingCollabs: CollaboratorRecord[] = []
        let existingEvals: ExistingEvaluationRecord[] = []
        let criteria: EvaluationCriterionRecord[] = []

        try {
          const [ccList, secList, collabList, evalList, critList] = await Promise.all([
            pb.collection('cost_centers').getFullList<CostCenterRecord>({ sort: 'name' }),
            pb.collection('sectors').getFullList<SectorRecord>({ sort: 'name' }),
            pb.collection('collaborators').getFullList<CollaboratorRecord>(),
            pb.collection('evaluations').getFullList<ExistingEvaluationRecord>(),
            pb
              .collection('evaluation_criteria')
              .getFullList<EvaluationCriterionRecord>({ sort: 'order' }),
          ])
          costCenters = ccList
          sectors = secList
          existingCollabs = collabList
          existingEvals = evalList
          criteria = critList
        } catch (dbErr: any) {
          throw new Error(
            `Falha ao consultar tabelas do sistema (centros de custo, critérios ou colaboradores): ${dbErr?.message || dbErr}`,
          )
        }

        const fileReports: FileSimulationReport[] = []
        let parsedCollaborators: any[] = []
        let parsedEvaluations: any[] = []

        // Total files to process
        const totalToProcess = chosenSlots.length
        let processedCount = 0

        // 1. Process Collaborator inclusion file FIRST if present
        const collabSlot = slots.find((s) => s.id === 'colaboradores' && s.file)
        if (collabSlot && collabSlot.file) {
          processedCount++
          setSimulateProgressText(
            `Processando arquivo ${processedCount} de ${totalToProcess}: ${collabSlot.title} (${collabSlot.file.name})...`,
          )
          await yieldTick()

          let sheet
          try {
            sheet = await parseSpreadsheetFile(collabSlot.file)
          } catch (sheetErr: any) {
            throw new Error(
              `Erro no arquivo do Slot "1. Inclusão de Colaboradores" (${collabSlot.file.name}): ${sheetErr?.message || sheetErr}`,
            )
          }
          try {
            const simRes = await simulateCollaboratorsSheet(
              sheet,
              collabSlot.file.name,
              costCenters,
              sectors,
              existingCollabs,
            )
            fileReports.push(simRes.report)
            parsedCollaborators = simRes.parsedRows
          } catch (simErr: any) {
            throw new Error(
              `Erro na simulação do Slot "1. Inclusão de Colaboradores" (${collabSlot.file.name}): ${simErr?.message || simErr}`,
            )
          }
        }

        // Build unified collaborator pool for evaluation matching
        // (combines existing database collaborators + newly simulated ones)
        const combinedCollabPool: Array<{
          id: string
          name: string
          cpf_digits?: string
          cpf_hash?: string
          cost_center_id: string
          cost_center_name?: string
          admission_date: string
        }> = [
          ...existingCollabs.map((c) => {
            const cc = costCenters.find((x) => x.id === c.cost_center)
            return {
              id: c.id,
              name: c.name,
              cpf_hash: c.cpf_hash,
              cost_center_id: c.cost_center,
              cost_center_name: cc?.name || '',
              admission_date: c.admission_date,
            }
          }),
          ...parsedCollaborators.map((c, idx) => ({
            id: `NEW_COLLAB_${idx}`,
            name: c.rawName,
            cpf_digits: c.cleanCpf,
            cpf_hash: c.cpfHash,
            cost_center_id: c.costCenterId,
            cost_center_name: c.costCenterName,
            admission_date: c.admissionIso,
          })),
        ]

        // 2. Process all 4 evaluation slots and unify them into ONE collection of evaluations
        const evalSlots: EvaluationFileSlot[] = [
          'obras_45',
          'obras_90',
          'escritorio_45',
          'escritorio_90',
        ]

        for (const slotId of evalSlots) {
          const slotConfig = slots.find((s) => s.id === slotId && s.file)
          if (!slotConfig || !slotConfig.file) continue

          processedCount++
          setSimulateProgressText(
            `Processando arquivo ${processedCount} de ${totalToProcess}: ${slotConfig.title} (${slotConfig.file.name})...`,
          )
          await yieldTick()

          let sheet
          try {
            sheet = await parseSpreadsheetFile(slotConfig.file)
          } catch (sheetErr: any) {
            throw new Error(
              `Erro no arquivo do Slot "${slotConfig.title}" (${slotConfig.file.name}): ${sheetErr?.message || sheetErr}`,
            )
          }

          try {
            const simRes = await simulateEvaluationSheet(
              sheet,
              slotId,
              slotConfig.file.name,
              criteria,
              combinedCollabPool,
              existingEvals,
            )
            fileReports.push(simRes.report)
            parsedEvaluations.push(...simRes.parsedRows)
          } catch (simErr: any) {
            throw new Error(
              `Erro na simulação do Slot "${slotConfig.title}" (${slotConfig.file.name}): ${simErr?.message || simErr}`,
            )
          }
        }

        // Consolidate totals
        const totalLines = fileReports.reduce((acc, r) => acc + r.totalLines, 0)
        const newCollaboratorsCount = parsedCollaborators.length
        const existingCollaboratorsCount =
          fileReports.find((r) => r.slotId === 'colaboradores')?.existingCount || 0
        const newEvaluationsCount = parsedEvaluations.length
        const duplicateEvaluationsCount = fileReports
          .filter((r) => r.slotId !== 'colaboradores')
          .reduce((acc, r) => acc + r.duplicates.length, 0)
        const invalidCpfsCount = fileReports.reduce((acc, r) => acc + r.invalidCpfs.length, 0)
        const rejectedCount = fileReports.reduce((acc, r) => acc + r.rejected.length, 0)
        const unmatchedEvaluationsCount = fileReports
          .filter((r) => r.slotId !== 'colaboradores')
          .reduce((acc, r) => acc + r.unmatched.length, 0)

        const unifiedResult: UnifiedSimulationResult = {
          fileReports,
          consolidated: {
            totalFiles: fileReports.length,
            totalLines,
            newCollaboratorsCount,
            existingCollaboratorsCount,
            newEvaluationsCount,
            existingEvaluationsCount: duplicateEvaluationsCount,
            duplicateEvaluationsCount,
            invalidCpfsCount,
            rejectedCount,
            unmatchedEvaluationsCount,
            totalNewRecordsToSave: newCollaboratorsCount + newEvaluationsCount,
          },
          parsedCollaborators,
          parsedEvaluations,
          adminAuthorizationRequired: invalidCpfsCount > 0,
        }

        return unifiedResult
      }

      const result = await Promise.race([runSimulationInner(), simTimeoutPromise])
      if (simTimeoutTimer) clearTimeout(simTimeoutTimer)
      setSimulationResult(result)
    } catch (err: unknown) {
      console.error('Falha na simulação unificada:', err)
      setErrorMsg(
        'Falha na simulação unificada: ' + (err instanceof Error ? err.message : String(err)),
      )
    } finally {
      setSimulating(false)
      setSimulateProgressText('')
    }
  }

  // Execute Definitive Unified Load via secure server-side endpoint with client chunking & backoff
  const handleExecute = async () => {
    if (!simulationResult || simulationResult.consolidated.totalNewRecordsToSave === 0) return

    if (simulationResult.adminAuthorizationRequired && !adminAuthorized) {
      setErrorMsg(
        'A carga contém CPFs matematicamente inválidos. É obrigatório que o Administrador marque a autorização expressa antes de prosseguir.',
      )
      return
    }

    setExecuting(true)
    setErrorMsg(null)
    setExecutionResult(null)

    const filenames = slots
      .filter((s) => s.file)
      .map((s) => s.file!.name)
      .join(', ')

    const totalCollabs = simulationResult.parsedCollaborators.length
    const totalEvals = simulationResult.parsedEvaluations.length

    try {
      // 1. Prepare collaborators payload with encrypted CPFs and deadline calculations
      setExecuteProgressText('Criptografando dados sensíveis e preparando carga...')
      const preparedCollabs = await Promise.all(
        simulationResult.parsedCollaborators.map(async (c, i) => {
          const encryptedCpf = c.cleanCpf ? await encryptCPF(c.cleanCpf) : ''
          const deadline45 = addDaysToIsoDate(c.admissionIso, 45)
          const deadline90 = addDaysToIsoDate(c.admissionIso, 90)

          return {
            client_key: `NEW_COLLAB_${i}`,
            name: c.rawName,
            cpf_hash: c.cpfHash,
            cpf_encrypted: encryptedCpf,
            cost_center: c.costCenterId,
            sector: c.sectorId,
            role: c.role,
            admission_date: c.admissionIso,
            deadline_45: deadline45,
            deadline_90: deadline90,
            import_line: c.lineNum,
          }
        }),
      )

      // 2. Prepare evaluations payload
      const preparedEvals = simulationResult.parsedEvaluations.map((ev) => ({
        collaborator_id: ev.matchedCollaboratorId,
        stage: ev.stage,
        decision: ev.decision,
        justification: ev.justification || '',
        notes: ev.notes || '',
        unique_import_id: ev.uniqueImportId,
        evaluated_at: ev.evaluatedAtIso,
        answers: ev.answers.map((a) => ({
          criterion_id: a.criterionId,
          answer: a.normalizedAnswer,
        })),
      }))

      // Send to server in chunks of up to 150 items to ensure low server memory footprint and real progress
      const CHUNK_SIZE = 150
      let masterImportId: string | null = null
      let cumulativeInsertedCollabs = 0
      let cumulativeSkippedCollabs = 0
      let cumulativeInsertedEvals = 0
      let cumulativeSkippedEvals = 0
      let cumulativeInsertedAnswers = 0

      // Helper function with exponential backoff on 429
      const postWithBackoff = async (payload: any, maxRetries = 4): Promise<any> => {
        for (let attempt = 0; attempt <= maxRetries; attempt++) {
          try {
            return await pb.send('/backend/v1/imports/batch-execute', {
              method: 'POST',
              body: payload,
            })
          } catch (fetchErr: any) {
            const status = fetchErr?.status || fetchErr?.response?.status
            const isRateLimit =
              status === 429 ||
              String(fetchErr?.message || '').includes('429') ||
              String(fetchErr?.message || '').includes('Too Many Requests')
            if (isRateLimit && attempt < maxRetries) {
              const delayMs = 1500 * Math.pow(2, attempt)
              setExecuteProgressText(
                `Aguardando liberação do servidor (${Math.round(delayMs / 1000)}s)... Carga retomável sem duplicação.`,
              )
              await new Promise((r) => setTimeout(r, delayMs))
              continue
            }
            throw fetchErr
          }
        }
      }

      // Step A: Send collaborators in chunks
      const collabChunks: (typeof preparedCollabs)[] = []
      for (let i = 0; i < preparedCollabs.length; i += CHUNK_SIZE) {
        collabChunks.push(preparedCollabs.slice(i, i + CHUNK_SIZE))
      }

      if (collabChunks.length === 0) {
        // No collaborators, maybe only evaluations
        collabChunks.push([])
      }

      for (let cIdx = 0; cIdx < collabChunks.length; cIdx++) {
        const chunk = collabChunks[cIdx]
        const currentProcessed = Math.min((cIdx + 1) * CHUNK_SIZE, totalCollabs)
        setExecuteProgressText(
          totalCollabs > 0
            ? `Gravando colaboradores: ${currentProcessed} de ${totalCollabs}...`
            : 'Iniciando carga...',
        )

        const res = await postWithBackoff({
          import_id: masterImportId,
          filenames,
          adminAuthorized,
          report: {
            filesCount: simulationResult.fileReports.length,
            newCollaborators: simulationResult.consolidated.newCollaboratorsCount,
            newEvaluations: simulationResult.consolidated.newEvaluationsCount,
            duplicatesBlocked: simulationResult.consolidated.duplicateEvaluationsCount,
            invalidCpfs: simulationResult.consolidated.invalidCpfsCount,
            rejectedRows: simulationResult.consolidated.rejectedCount,
          },
          collaborators: chunk,
          evaluations: [],
        })

        if (!masterImportId && res.import_id) {
          masterImportId = res.import_id
        }

        cumulativeInsertedCollabs += res.inserted_collaborators || 0
        cumulativeSkippedCollabs += res.skipped_collaborators || 0

        // Short pause between chunks for smooth server breathing
        if (collabChunks.length > 1) {
          await new Promise((r) => setTimeout(r, 100))
        }
      }

      // Step B: Send evaluations in chunks
      const evalChunks: (typeof preparedEvals)[] = []
      for (let j = 0; j < preparedEvals.length; j += CHUNK_SIZE) {
        evalChunks.push(preparedEvals.slice(j, j + CHUNK_SIZE))
      }

      for (let eIdx = 0; eIdx < evalChunks.length; eIdx++) {
        const chunk = evalChunks[eIdx]
        const currentProcessed = Math.min((eIdx + 1) * CHUNK_SIZE, totalEvals)
        setExecuteProgressText(
          `Gravando avaliações consolidadas: ${currentProcessed} de ${totalEvals}...`,
        )

        const res = await postWithBackoff({
          import_id: masterImportId,
          filenames,
          adminAuthorized,
          report: {
            filesCount: simulationResult.fileReports.length,
            newCollaborators: simulationResult.consolidated.newCollaboratorsCount,
            newEvaluations: simulationResult.consolidated.newEvaluationsCount,
            duplicatesBlocked: simulationResult.consolidated.duplicateEvaluationsCount,
            invalidCpfs: simulationResult.consolidated.invalidCpfsCount,
            rejectedRows: simulationResult.consolidated.rejectedCount,
          },
          collaborators: [],
          evaluations: chunk,
        })

        cumulativeInsertedEvals += res.inserted_evaluations || 0
        cumulativeSkippedEvals += res.skipped_evaluations || 0
        cumulativeInsertedAnswers += res.inserted_answers || 0

        if (evalChunks.length > 1) {
          await new Promise((r) => setTimeout(r, 100))
        }
      }

      const summaryDetails = []
      if (cumulativeInsertedCollabs > 0)
        summaryDetails.push(`${cumulativeInsertedCollabs} colaboradores inseridos`)
      if (cumulativeSkippedCollabs > 0)
        summaryDetails.push(`${cumulativeSkippedCollabs} colaboradores já existentes preservados`)
      if (cumulativeInsertedEvals > 0)
        summaryDetails.push(
          `${cumulativeInsertedEvals} avaliações unificadas (${cumulativeInsertedAnswers} respostas de critérios)`,
        )
      if (cumulativeSkippedEvals > 0)
        summaryDetails.push(`${cumulativeSkippedEvals} avaliações já existentes ignoradas`)

      setExecutionResult(
        `Importação unificada concluída com sucesso! ${summaryDetails.join(', ')}.`,
      )

      // Clear state and reload past imports
      setSimulationResult(null)
      setSlots((prev) => prev.map((s) => ({ ...s, file: null })))
      setPartialLoadDetected(null)
      loadPastImports()
    } catch (err: unknown) {
      console.error('Falha na carga definitiva:', err)
      const errStr = err instanceof Error ? err.message : String(err)
      const isRateLimit =
        errStr.includes('429') ||
        errStr.includes('Too Many Requests') ||
        (err as any)?.status === 429

      if (isRateLimit) {
        setErrorMsg(
          'O servidor limitou a taxa de requisições temporariamente. A carga foi pausada e pode ser retomada com total segurança — o mecanismo de idempotência garante que nenhuma duplicidade será criada.',
        )
      } else {
        setErrorMsg('Falha ao executar carga definitiva: ' + errStr)
      }
      // Reload history to check if partial records were created
      loadPastImports()
    } finally {
      setExecuting(false)
      setExecuteProgressText('')
    }
  }

  // Revert / Replace imported history (preserves manual data)
  const handleReplaceImport = async (importId: string) => {
    if (
      !window.confirm(
        'Tem certeza que deseja reverter e remover os dados desta importação? Registros manuais e cadastros de outras origens NÃO serão apagados.',
      )
    ) {
      return
    }

    try {
      const res = await pb.send(`/backend/v1/imports/${importId}/replace`, {
        method: 'POST',
      })
      alert(
        `Importação revertida com sucesso: ${res.deleted_collaborators} colaboradores e ${res.deleted_evaluations} avaliações removidos.`,
      )
      loadPastImports()
    } catch (err: unknown) {
      alert('Erro ao reverter importação: ' + (err instanceof Error ? err.message : ''))
    }
  }

  // Handler para Limpar Banco de Dados (ADMIN only)
  const handleOpenResetDialog = () => {
    setResetConfirmationInput('')
    setResetAgreementChecked(false)
    setResetFeedback(null)
    setIsResetDialogOpen(true)
  }

  const handleExecuteResetDatabase = async () => {
    if (!isMasterUser) {
      setResetFeedback({
        type: 'error',
        message: 'Apenas o Administrador Dono possui autorização para executar esta ação.',
      })
      return
    }

    if (resetConfirmationInput.trim().toUpperCase() !== 'LIMPAR' || !resetAgreementChecked) {
      setResetFeedback({
        type: 'error',
        message:
          'É necessário digitar "LIMPAR" e marcar a caixa de confirmação para autorizar a limpeza.',
      })
      return
    }

    setResetting(true)
    setResetFeedback(null)

    try {
      const res = await pb.send('/backend/v1/admin/reset-data', {
        method: 'POST',
        body: {
          confirmation: 'LIMPAR',
        },
      })

      const d = res.deleted || {}
      const summaryMsg = `Banco de dados limpo com sucesso! Registros removidos: ${d.collaborators || 0} colaboradores, ${d.evaluations || 0} avaliações, ${d.evaluation_answers || 0} respostas de critérios, ${d.imports || 0} lotes de importação e ${d.notifications || 0} notificações operacionais. Usuários, centros de custo, setores, critérios, configurações e histórico de auditoria foram preservados.`

      setIsResetDialogOpen(false)
      setExecutionResult(summaryMsg)
      setErrorMsg(null)
      setSimulationResult(null)
      setPartialLoadDetected(null)
      setSlots((prev) => prev.map((s) => ({ ...s, file: null })))
      await loadPastImports()
    } catch (err: unknown) {
      console.error('Falha ao limpar banco de dados:', err)
      const msg =
        (err as any)?.response?.data?.error ||
        (err instanceof Error
          ? err.message
          : 'Não foi possível concluir a limpeza do banco de dados. Tente novamente mais tarde.')
      setResetFeedback({
        type: 'error',
        message: msg,
      })
    } finally {
      setResetting(false)
    }
  }

  // Download simulation report as text
  const downloadReportTxt = () => {
    if (!simulationResult) return

    let content = `================================================================================
RELATÓRIO DE SIMULAÇÃO DE IMPORTAÇÃO UNIFICADA
Sistema de Avaliação de Experiência
Data: ${formatDateTimeBR(new Date())}
================================================================================

RESUMO CONSOLIDADO:
- Arquivos processados: ${simulationResult.consolidated.totalFiles}
- Total de linhas lidas: ${simulationResult.consolidated.totalLines}
- Novos colaboradores previstos: ${simulationResult.consolidated.newCollaboratorsCount}
- Novas avaliações unificadas previstas: ${simulationResult.consolidated.newEvaluationsCount}
- Duplicidades bloqueadas: ${simulationResult.consolidated.duplicateEvaluationsCount}
- CPFs matematicamente inválidos: ${simulationResult.consolidated.invalidCpfsCount}
- Linhas rejeitadas: ${simulationResult.consolidated.rejectedCount}
- Registros não correspondidos: ${simulationResult.consolidated.unmatchedEvaluationsCount}
- Total final de registros a gravar: ${simulationResult.consolidated.totalNewRecordsToSave}

================================================================================
DETALHAMENTO POR ARQUIVO:
================================================================================
`

    for (const rep of simulationResult.fileReports) {
      content += `\n[${rep.slotLabel.toUpperCase()}] - Arquivo: ${rep.filename}
Linhas lidas: ${rep.totalLines} | Novos: ${rep.newCount} | Já existentes: ${rep.existingCount}
Duplicidades: ${rep.duplicates.length} | CPFs inválidos: ${rep.invalidCpfs.length} | Rejeitados: ${rep.rejected.length}
`
      if (rep.suggestedCorrections.length > 0) {
        content += `\n  Sugestões e Conversões:\n`
        rep.suggestedCorrections.forEach((c) => (content += `    • ${c}\n`))
      }
      if (rep.inferredDates.length > 0) {
        content += `\n  Datas Inferidas:\n`
        rep.inferredDates.forEach((d) => (content += `    • ${d}\n`))
      }
      if (rep.invalidCpfs.length > 0) {
        content += `\n  CPFs Inválidos:\n`
        rep.invalidCpfs.forEach((c) => (content += `    • ${c}\n`))
      }
      if (rep.unmatched.length > 0) {
        content += `\n  Não Correspondidos:\n`
        rep.unmatched.forEach((u) => (content += `    • ${u}\n`))
      }
      if (rep.rejected.length > 0) {
        content += `\n  Ocorrências Rejeitadas:\n`
        rep.rejected.forEach((r) => (content += `    • ${r}\n`))
      }
      content += `--------------------------------------------------------------------------------\n`
    }

    const blob = new Blob([content], { type: 'text/plain;charset=utf-8' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = `relatorio_simulacao_unificada_${new Date().toISOString().slice(0, 10)}.txt`
    a.click()
    URL.revokeObjectURL(url)
  }

  return (
    <div className="space-y-6 max-w-5xl mx-auto">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-[#111111]">
          Importação Unificada de Dados
        </h1>
        <p className="text-sm text-gray-600 mt-0.5">
          Carga consolidada do cadastro de colaboradores e das 4 bases de avaliações em uma única
          base de dados operacional.
        </p>
      </div>

      {executionResult && (
        <div className="rounded-xl border border-green-200 bg-green-50 p-4 text-xs font-semibold text-green-800 flex items-center gap-2">
          <CheckCircle2 className="h-5 w-5 text-green-600 shrink-0" />
          <span>{executionResult}</span>
        </div>
      )}

      {partialLoadDetected && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4 text-xs text-amber-900 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5 sm:mt-0" />
            <div>
              <span className="font-bold block text-sm text-amber-950">
                Atenção: Carga anterior incompleta ou parcial detectada
              </span>
              <span className="text-amber-800">
                A importação &ldquo;{partialLoadDetected.filename}&rdquo; (
                {partialLoadDetected.date}) teve gravação parcial. Você pode reverter os registros
                parciais na aba Histórico ou reenviar as planilhas para completar a carga com
                segurança de idempotência (sem duplicar).
              </span>
            </div>
          </div>
          {canAccessImport && (
            <Button
              variant="outline"
              size="sm"
              onClick={() => handleReplaceImport(partialLoadDetected.importId)}
              className="border-amber-300 text-amber-900 hover:bg-amber-100 text-xs shrink-0"
            >
              <RotateCcw className="mr-1.5 h-3.5 w-3.5" /> Reverter Carga Parcial
            </Button>
          )}
        </div>
      )}

      {errorMsg && (
        <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-xs text-red-800 flex items-center gap-2">
          <AlertCircle className="h-5 w-5 text-red-600 shrink-0" />
          <div className="flex-1">
            <span className="font-semibold block text-red-900">Erro na Operação:</span>
            <span>{errorMsg}</span>
          </div>
        </div>
      )}

      <Tabs defaultValue="upload" className="space-y-6">
        <TabsList className="bg-white border border-[#E8E8E8]">
          <TabsTrigger
            value="upload"
            className="data-[state=active]:bg-[#54D769] data-[state=active]:text-[#111111] text-xs"
          >
            <Layers className="mr-1.5 h-3.5 w-3.5" />
            Área de Importação Unificada
          </TabsTrigger>
          <TabsTrigger
            value="history"
            className="data-[state=active]:bg-[#54D769] data-[state=active]:text-[#111111] text-xs"
          >
            <Clock className="mr-1.5 h-3.5 w-3.5" />
            Histórico e Substituições ({pastImports.length})
          </TabsTrigger>
        </TabsList>

        <TabsContent value="upload" className="space-y-6">
          {/* Multi-file batch dropzone */}
          <div className="rounded-2xl border-2 border-dashed border-gray-300 bg-white p-6 text-center hover:border-[#54D769] transition-all">
            <div className="mx-auto flex h-12 w-12 items-center justify-center rounded-full bg-[#54D769]/10 text-[#111111]">
              <Upload className="h-6 w-6 text-[#111111]" />
            </div>
            <h3 className="mt-3 text-sm font-semibold text-gray-900">
              Seleção Rápida: Arraste os arquivos juntos ou use os slots abaixo
            </h3>
            <p className="mt-1 text-xs text-gray-500 max-w-xl mx-auto">
              Você pode selecionar ou arrastar de uma só vez o arquivo de colaboradores e os 4
              arquivos de avaliações (.xlsx ou .csv). O sistema identifica e preenche
              automaticamente cada slot pelo nome do arquivo.
            </p>
            <div className="mt-4 flex justify-center">
              <label className="inline-flex items-center gap-2 px-4 py-2 rounded-xl bg-gray-100 hover:bg-gray-200 text-xs font-semibold text-gray-800 cursor-pointer transition-colors">
                <FileSpreadsheet className="h-4 w-4" />
                <span>Selecionar múltiplos arquivos do computador</span>
                <input
                  type="file"
                  multiple
                  accept=".csv,.xlsx"
                  className="hidden"
                  onChange={(e) => {
                    if (e.target.files) {
                      handleMultiFilesAutoAssign(e.target.files)
                    }
                  }}
                />
              </label>
            </div>
          </div>

          {/* 5 Slots Section */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="text-sm font-bold uppercase tracking-wider text-gray-700">
                  Slots de Arquivos da Importação Unificada
                </h2>
                <p className="text-xs text-gray-500">
                  Preencha os arquivos que deseja importar. Os 4 arquivos de avaliações convergem
                  automaticamente para a mesma base consolidada.
                </p>
              </div>
              <span className="text-xs font-semibold px-2.5 py-1 rounded-full bg-gray-100 text-gray-700">
                {chosenSlots.length} de {slots.length} selecionados
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
              {slots.map((slot) => {
                const isSelected = slot.file !== null
                return (
                  <div
                    key={slot.id}
                    className={`rounded-2xl border p-4 transition-all flex flex-col justify-between ${
                      isSelected
                        ? 'border-[#54D769] bg-white shadow-xs ring-1 ring-[#54D769]'
                        : 'border-[#E8E8E8] bg-white hover:border-gray-300'
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-gray-100 text-gray-700">
                          {slot.badge}
                        </span>
                        {isSelected ? (
                          <span className="text-[11px] font-semibold text-green-700 flex items-center gap-1">
                            <Check className="h-3.5 w-3.5 text-green-600" /> Pronto
                          </span>
                        ) : (
                          <span className="text-[11px] text-gray-400">Vazio</span>
                        )}
                      </div>

                      <h4 className="text-xs font-bold text-gray-900 mt-2">{slot.title}</h4>
                      <p className="text-[11px] text-gray-500 mt-1 line-clamp-2">{slot.subtitle}</p>

                      <div className="mt-2 text-[10px] text-gray-400 font-mono">
                        Padrão: {slot.expectedFileName}
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-gray-100 space-y-2">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => downloadImportTemplate(slot.id)}
                        className="w-full text-xs border-[#54D769]/50 text-gray-800 hover:bg-[#54D769]/10 hover:text-gray-950 font-medium h-8"
                        title="Baixar planilha modelo .xlsx com as colunas corretas e dados de exemplo"
                      >
                        <Download className="mr-1.5 h-3.5 w-3.5 text-green-600 shrink-0" />
                        <span>Baixar planilha modelo (.xlsx)</span>
                      </Button>

                      {isSelected ? (
                        <div className="flex items-center justify-between bg-green-50/60 p-2 rounded-xl border border-green-100">
                          <div className="flex items-center gap-2 overflow-hidden">
                            <FileSpreadsheet className="h-4 w-4 text-green-600 shrink-0" />
                            <span
                              className="text-xs font-semibold text-gray-800 truncate"
                              title={slot.file?.name}
                            >
                              {slot.file?.name}
                            </span>
                          </div>
                          <button
                            type="button"
                            onClick={() => handleSetSlotFile(slot.id, null)}
                            className="text-gray-400 hover:text-red-600 p-1 rounded-full transition-colors"
                            title="Remover arquivo"
                          >
                            <XCircle className="h-4 w-4" />
                          </button>
                        </div>
                      ) : (
                        <label className="flex items-center justify-center gap-1.5 w-full py-2 px-3 border border-[#E8E8E8] rounded-xl text-xs font-medium text-gray-700 hover:bg-gray-50 cursor-pointer transition-colors text-center">
                          <Upload className="h-3.5 w-3.5 text-gray-500" />
                          <span>Escolher arquivo</span>
                          <input
                            type="file"
                            accept=".csv,.xlsx"
                            className="hidden"
                            onChange={(e) =>
                              handleSetSlotFile(slot.id, e.target.files?.[0] || null)
                            }
                          />
                        </label>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>

            {/* Simulation trigger button */}
            <div className="flex items-center justify-end gap-3 pt-3">
              {chosenSlots.length > 0 && (
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    setSlots((prev) => prev.map((s) => ({ ...s, file: null })))
                    setSimulationResult(null)
                  }}
                  className="text-xs text-gray-600"
                >
                  Limpar todos os slots
                </Button>
              )}
              {simulating && simulateProgressText && (
                <div className="flex items-center gap-2 text-xs text-amber-800 bg-amber-50 px-3 py-2 rounded-xl border border-amber-200 shadow-xs">
                  <div className="h-2 w-2 rounded-full bg-amber-500 animate-ping shrink-0" />
                  <span className="font-semibold">{simulateProgressText}</span>
                </div>
              )}
              <Button
                onClick={handleSimulate}
                disabled={chosenSlots.length === 0 || simulating}
                className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] px-6 text-xs h-10 shadow-xs disabled:opacity-50"
              >
                {simulating
                  ? simulateProgressText || 'Processando simulação unificada...'
                  : `Simular ${chosenSlots.length} Arquivo(s) (Sem Gravar)`}
              </Button>
            </div>
          </div>

          {/* SIMULATION REPORT ACCORDION / RESULTS */}
          {simulationResult && (
            <div className="rounded-2xl border border-amber-200 bg-amber-50/40 p-6 shadow-xs space-y-6">
              {/* Header */}
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-amber-200/60 pb-4">
                <div className="flex items-center gap-2.5">
                  <div className="p-2 bg-amber-100 rounded-xl text-amber-800">
                    <FileCheck2 className="h-5 w-5" />
                  </div>
                  <div>
                    <h3 className="font-bold text-base text-amber-950">
                      Resultado da Simulação Unificada
                    </h3>
                    <p className="text-xs text-amber-800">
                      Nenhum registro foi gravado ainda. Revise os números consolidados e por
                      arquivo antes de confirmar.
                    </p>
                  </div>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  onClick={downloadReportTxt}
                  className="text-xs border-amber-300 text-amber-900 hover:bg-amber-100 shrink-0"
                >
                  <Download className="mr-1.5 h-3.5 w-3.5" /> Baixar Relatório Completo (.txt)
                </Button>
              </div>

              {/* Consolidated Metrics */}
              <div>
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block mb-2">
                  Totais Consolidados da Carga
                </span>
                <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-2.5 text-xs">
                  <div className="p-3 bg-white rounded-xl border border-amber-100">
                    <span className="text-gray-500 block text-[11px]">Linhas Lidas:</span>
                    <span className="font-bold text-base text-gray-900">
                      {simulationResult.consolidated.totalLines}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-amber-100">
                    <span className="text-gray-500 block text-[11px]">Novos Colaboradores:</span>
                    <span className="font-bold text-base text-green-700">
                      {simulationResult.consolidated.newCollaboratorsCount}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-amber-100">
                    <span className="text-gray-500 block text-[11px]">Avaliações Unificadas:</span>
                    <span className="font-bold text-base text-blue-700">
                      {simulationResult.consolidated.newEvaluationsCount}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-amber-100">
                    <span className="text-gray-500 block text-[11px]">
                      Duplicidades Bloqueadas:
                    </span>
                    <span className="font-bold text-base text-amber-700">
                      {simulationResult.consolidated.duplicateEvaluationsCount}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-amber-100">
                    <span className="text-gray-500 block text-[11px]">CPFs Inválidos:</span>
                    <span
                      className={`font-bold text-base ${simulationResult.consolidated.invalidCpfsCount > 0 ? 'text-red-600' : 'text-gray-800'}`}
                    >
                      {simulationResult.consolidated.invalidCpfsCount}
                    </span>
                  </div>
                  <div className="p-3 bg-white rounded-xl border border-amber-100">
                    <span className="text-gray-500 block text-[11px]">Rejeitados / Erros:</span>
                    <span
                      className={`font-bold text-base ${simulationResult.consolidated.rejectedCount > 0 ? 'text-red-600' : 'text-gray-800'}`}
                    >
                      {simulationResult.consolidated.rejectedCount}
                    </span>
                  </div>
                </div>
              </div>

              {/* Per-File Summary Cards */}
              <div className="space-y-2">
                <span className="text-[11px] font-bold uppercase tracking-wider text-amber-900 block">
                  Discriminação por Arquivo
                </span>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                  {simulationResult.fileReports.map((rep) => (
                    <div
                      key={rep.slotId}
                      className="p-3.5 bg-white rounded-xl border border-amber-200/80 text-xs space-y-2"
                    >
                      <div className="flex items-center justify-between">
                        <span className="font-bold text-gray-900 truncate" title={rep.filename}>
                          {rep.slotLabel}
                        </span>
                        <span className="text-[10px] font-mono bg-gray-100 px-2 py-0.5 rounded text-gray-700 truncate max-w-[150px]">
                          {rep.filename}
                        </span>
                      </div>

                      <div className="grid grid-cols-4 gap-1 text-[11px] pt-1">
                        <div>
                          <span className="text-gray-400 block">Lidas:</span>
                          <span className="font-bold">{rep.totalLines}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block">Novos:</span>
                          <span className="font-bold text-green-700">{rep.newCount}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block">Duplicados:</span>
                          <span className="font-bold text-amber-700">{rep.duplicates.length}</span>
                        </div>
                        <div>
                          <span className="text-gray-400 block">Rejeitados:</span>
                          <span className="font-bold text-red-600">{rep.rejected.length}</span>
                        </div>
                      </div>

                      {rep.suggestedCorrections.length > 0 && (
                        <div className="text-[11px] text-amber-800 bg-amber-50/80 p-2 rounded-lg">
                          <span className="font-semibold block">Avisos e Correções Sugeridas:</span>
                          <span className="line-clamp-2">
                            {rep.suggestedCorrections.slice(0, 2).join(' • ')}
                            {rep.suggestedCorrections.length > 2 &&
                              ` (+${rep.suggestedCorrections.length - 2})`}
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>

              {/* Admin Authorization for Invalid CPFs if detected */}
              {simulationResult.adminAuthorizationRequired && (
                <div className="p-4 bg-red-50 border border-red-200 rounded-2xl text-xs space-y-2">
                  <div className="flex items-center gap-2 text-red-900 font-bold text-sm">
                    <ShieldAlert className="h-5 w-5 text-red-600" />
                    <span>Autorização de Administrador Obrigatória (Regra Seção 11)</span>
                  </div>
                  <p className="text-red-700">
                    Foram detectados {simulationResult.consolidated.invalidCpfsCount} registros
                    históricos com CPF matematicamente inválido na planilha. De acordo com as
                    diretrizes do sistema, tais registros somente podem ser importados com
                    autorização explícita do Administrador.
                  </p>
                  {canAccessImport ? (
                    <label className="flex items-center gap-2 pt-2 cursor-pointer font-semibold text-red-950">
                      <Checkbox
                        checked={adminAuthorized}
                        onCheckedChange={(checked) => setAdminAuthorized(!!checked)}
                      />
                      <span>
                        Eu, Administrador, autorizo expressamente a importação destes registros com
                        ressalva histórica de CPF.
                      </span>
                    </label>
                  ) : (
                    <div className="p-2 bg-white/80 rounded-lg text-red-800 font-semibold border border-red-200">
                      Apenas usuários com perfil ADMIN podem autorizar a carga deste lote com CPFs
                      inválidos.
                    </div>
                  )}
                </div>
              )}

              {/* Action Bar */}
              <div className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-4 border-t border-amber-200/80">
                <div className="text-xs text-amber-900">
                  Total de novos registros a gravar:{' '}
                  <span className="font-bold text-sm text-gray-900">
                    {simulationResult.consolidated.totalNewRecordsToSave}
                  </span>{' '}
                  ({simulationResult.consolidated.newCollaboratorsCount} colaboradores +{' '}
                  {simulationResult.consolidated.newEvaluationsCount} avaliações unificadas).
                </div>

                <div className="flex items-center gap-3">
                  {executing && executeProgressText && (
                    <div className="flex items-center gap-2 text-xs text-green-900 bg-green-100/70 px-3 py-1.5 rounded-xl border border-green-200 shadow-xs">
                      <div className="h-2 w-2 rounded-full bg-green-600 animate-ping shrink-0" />
                      <span className="font-semibold">{executeProgressText}</span>
                    </div>
                  )}
                  <Button
                    onClick={handleExecute}
                    disabled={
                      executing ||
                      simulationResult.consolidated.totalNewRecordsToSave === 0 ||
                      (simulationResult.adminAuthorizationRequired && !adminAuthorized)
                    }
                    className="bg-[#54D769] text-[#111111] font-semibold hover:bg-[#3DBE52] px-6 text-xs h-10 shadow-xs disabled:opacity-50"
                  >
                    {executing
                      ? executeProgressText || 'Gravando base unificada...'
                      : 'Confirmar e Executar Carga Definitiva Unificada'}
                  </Button>
                </div>
              </div>
            </div>
          )}
        </TabsContent>

        {/* TAB 2: HISTORY & REPLACEMENT */}
        <TabsContent value="history" className="space-y-4">
          <div className="rounded-2xl border border-[#E8E8E8] bg-white shadow-xs overflow-hidden">
            <div className="p-4 border-b border-[#E8E8E8] bg-gray-50/50 flex items-center justify-between">
              <div>
                <h3 className="text-xs font-bold uppercase tracking-wider text-gray-700">
                  Histórico de Importações
                </h3>
                <p className="text-xs text-gray-500">
                  Substituir ou reverter uma importação remove apenas os colaboradores e avaliações
                  originados por ela, preservando cadastros manuais e configurações.
                </p>
              </div>
            </div>

            <div className="overflow-x-auto w-full">
              <table className="w-full text-left text-xs md:text-sm table-fixed">
                <thead className="bg-[#F9FAFB] text-[11px] md:text-xs font-semibold text-gray-600 uppercase border-b border-[#E8E8E8]">
                  <tr>
                    <th className="w-[38%] px-2.5 md:px-3 py-2.5">Arquivo(s)</th>
                    <th className="w-[18%] px-1.5 md:px-2 py-2.5">Data da Carga</th>
                    <th className="w-[18%] px-1.5 md:px-2 py-2.5">Usuário</th>
                    <th className="w-[14%] px-1.5 md:px-2 py-2.5 text-center">Status</th>
                    <th className="w-[12%] px-1.5 md:px-2 py-2.5 text-right">Ação</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-[#E8E8E8]">
                  {pastImports.length === 0 ? (
                    <tr>
                      <td colSpan={5} className="p-8 text-center text-xs text-gray-500">
                        Nenhuma importação gravada anteriormente.
                      </td>
                    </tr>
                  ) : (
                    pastImports.map((imp) => (
                      <tr key={imp.id} className="hover:bg-gray-50/80">
                        <td
                          className="px-2.5 md:px-3 py-2 font-bold text-gray-900 truncate"
                          title={imp.filename}
                        >
                          {imp.filename}
                        </td>
                        <td className="px-1.5 md:px-2 py-2 text-[11px] md:text-xs text-gray-600 font-mono whitespace-nowrap">
                          {formatDateTimeBR(imp.created)}
                        </td>
                        <td
                          className="px-1.5 md:px-2 py-2 text-[11px] md:text-xs text-gray-600 truncate"
                          title={
                            (imp.expand?.user?.email || '').trim().toLowerCase() ===
                            'valdknupp@gmail.com'
                              ? 'Sistema'
                              : imp.expand?.user?.name || imp.expand?.user?.email || '-'
                          }
                        >
                          {(imp.expand?.user?.email || '').trim().toLowerCase() ===
                          'valdknupp@gmail.com'
                            ? 'Sistema'
                            : imp.expand?.user?.name || imp.expand?.user?.email || '-'}
                        </td>
                        <td className="px-1.5 md:px-2 py-2 text-center whitespace-nowrap">
                          <span
                            className={`text-[10px] md:text-xs px-2 py-0.5 rounded-full font-semibold ${
                              imp.status === 'executed'
                                ? 'bg-green-100 text-green-700'
                                : 'bg-gray-100 text-gray-600'
                            }`}
                          >
                            {imp.status === 'executed' ? 'Ativo' : 'Substituído'}
                          </span>
                        </td>
                        <td className="px-1.5 md:px-2 py-2 text-right whitespace-nowrap">
                          {imp.status === 'executed' && canAccessImport && (
                            <Button
                              variant="ghost"
                              size="sm"
                              onClick={() => handleReplaceImport(imp.id)}
                              className="text-[11px] md:text-xs text-red-600 hover:text-red-800 hover:bg-red-50 h-7 md:h-8 px-1.5 md:px-2"
                            >
                              <RotateCcw className="mr-1 h-3.5 w-3.5" /> Reverter
                            </Button>
                          )}
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </div>
        </TabsContent>
      </Tabs>

      {/* Zona de Perigo: Limpeza do Banco de Dados (Restrito exclusivamente ao Administrador Dono) */}
      {isMasterUser && (
        <div className="rounded-2xl border-2 border-red-200 bg-red-50/40 p-6 shadow-xs mt-10">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="flex items-start gap-3">
              <div className="p-2.5 bg-red-100 text-red-700 rounded-xl shrink-0 mt-0.5 sm:mt-0">
                <Trash2 className="h-5 w-5" />
              </div>
              <div className="space-y-1">
                <div className="flex items-center gap-2">
                  <h3 className="text-sm font-bold uppercase tracking-wider text-red-950">
                    Zona de Perigo • Limpeza do Banco de Dados
                  </h3>
                  <span className="text-[10px] uppercase font-bold tracking-wider px-2 py-0.5 rounded-full bg-red-200 text-red-900">
                    Acesso exclusivo Administrador
                  </span>
                </div>
                <p className="text-xs text-red-800 leading-relaxed max-w-2xl">
                  Remove os registros operacionais de <strong>colaboradores</strong>,{' '}
                  <strong>avaliações</strong>, <strong>respostas de critérios</strong> e{' '}
                  <strong>histórico de importações</strong>. Cadastros mestres de usuários, centros
                  de custo, setores, critérios de avaliação, configurações e o registro de auditoria
                  são rigorosamente preservados.
                </p>
              </div>
            </div>

            <Button
              type="button"
              variant="destructive"
              onClick={handleOpenResetDialog}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs px-5 h-10 shadow-xs shrink-0 self-start sm:self-center"
            >
              <Trash2 className="mr-2 h-4 w-4" />
              Limpar Banco de Dados
            </Button>
          </div>
        </div>
      )}

      {/* Modal de Dupla Confirmação para Limpeza do Banco de Dados */}
      <Dialog
        open={isResetDialogOpen}
        onOpenChange={(open) => !resetting && setIsResetDialogOpen(open)}
      >
        <DialogContent className="max-w-lg">
          <DialogHeader className="space-y-2">
            <div className="flex items-center gap-2.5 text-red-700">
              <div className="p-2 bg-red-100 rounded-lg">
                <AlertTriangle className="h-5 w-5" />
              </div>
              <DialogTitle className="text-lg font-bold text-red-950">
                Limpeza Geral do Banco de Dados
              </DialogTitle>
            </div>
            <DialogDescription className="text-xs text-gray-600 leading-relaxed">
              Esta é uma operação destrutiva e irreversível. Leia atentamente o resumo abaixo antes
              de autorizar:
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2 text-xs">
            {/* O que será apagado vs o que será mantido */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="p-3 bg-red-50 border border-red-200 rounded-xl space-y-1.5">
                <span className="font-bold text-red-900 block flex items-center gap-1.5">
                  <Trash2 className="h-3.5 w-3.5" /> O que SERÁ APAGADO:
                </span>
                <ul className="text-red-800 list-disc list-inside space-y-0.5 pl-0.5">
                  <li>Todos os colaboradores</li>
                  <li>Todas as avaliações (45 e 90 dias)</li>
                  <li>Respostas de todos os critérios</li>
                  <li>Histórico de lotes de importação</li>
                  <li>Notificações operacionais enviadas</li>
                </ul>
              </div>

              <div className="p-3 bg-green-50 border border-green-200 rounded-xl space-y-1.5">
                <span className="font-bold text-green-900 block flex items-center gap-1.5">
                  <ShieldCheck className="h-3.5 w-3.5" /> O que SERÁ PRESERVADO:
                </span>
                <ul className="text-green-800 list-disc list-inside space-y-0.5 pl-0.5">
                  <li>Contas de usuários e senhas</li>
                  <li>Centros de custo e obras</li>
                  <li>Setores e departamentos</li>
                  <li>Critérios de avaliação</li>
                  <li>Configurações do sistema</li>
                  <li>Histórico de logs de auditoria</li>
                </ul>
              </div>
            </div>

            {/* Checkbox de concordância explícita */}
            <div className="p-3.5 bg-gray-50 border border-gray-200 rounded-xl space-y-3">
              <label className="flex items-start gap-2.5 cursor-pointer">
                <Checkbox
                  id="confirm-reset-checkbox"
                  checked={resetAgreementChecked}
                  disabled={resetting}
                  onCheckedChange={(checked) => setResetAgreementChecked(!!checked)}
                  className="mt-0.5"
                />
                <span className="text-xs text-gray-800 font-medium leading-tight">
                  Confirmo que desejo apagar todos os colaboradores, avaliações, respostas e
                  importações do sistema, mantendo os cadastros essenciais.
                </span>
              </label>

              {/* Digitar frase de confirmação */}
              <div className="space-y-1.5 pt-1">
                <label
                  htmlFor="confirm-reset-phrase"
                  className="block text-[11px] font-semibold text-gray-700"
                >
                  Para confirmar, digite{' '}
                  <span className="font-mono font-bold text-red-700">LIMPAR</span> abaixo:
                </label>
                <Input
                  id="confirm-reset-phrase"
                  type="text"
                  placeholder="Digite LIMPAR"
                  value={resetConfirmationInput}
                  disabled={resetting}
                  onChange={(e) => setResetConfirmationInput(e.target.value)}
                  className="h-9 text-xs font-mono uppercase tracking-wider"
                  autoComplete="off"
                />
              </div>
            </div>

            {resetFeedback && resetFeedback.type === 'error' && (
              <div className="rounded-xl border border-red-200 bg-red-50 p-3 text-xs text-red-800 flex items-center gap-2">
                <AlertCircle className="h-4 w-4 text-red-600 shrink-0" />
                <span>{resetFeedback.message}</span>
              </div>
            )}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              disabled={resetting}
              onClick={() => setIsResetDialogOpen(false)}
              className="text-xs"
            >
              Cancelar
            </Button>
            <Button
              type="button"
              variant="destructive"
              disabled={
                resetting ||
                !resetAgreementChecked ||
                resetConfirmationInput.trim().toUpperCase() !== 'LIMPAR'
              }
              onClick={handleExecuteResetDatabase}
              className="bg-red-600 hover:bg-red-700 text-white font-semibold text-xs shadow-xs"
            >
              {resetting ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Limpando banco de dados...
                </>
              ) : (
                <>
                  <Trash2 className="mr-2 h-4 w-4" />
                  Confirmar e Limpar Banco de Dados
                </>
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}

export default DataImport
