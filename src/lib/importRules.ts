/**
 * Domain rules and logic for importing collaborators and the unified evaluations dataset.
 * Implements Section 11 specifications:
 * - Aliases for criteria columns
 * - Answer conversion (SELECIONE/empty -> Atende; PARCIAL -> Atende parcialmente; NAO ATENDE -> Nao atende; SUPERA/EXCEDE -> Supera)
 * - Decision conversion (TERMINATE/DESLIGAR -> Desligar; EXTEND/ATENDE -> Prorrogar; EFFECTIVATE -> Efetivar)
 * - Stage determination (45 dias or 90 dias) and collaborator matching (CPF -> Name+CC -> Name+Admission)
 * - Validation, duplicate prevention, and detailed simulation report.
 */

import {
  parseDateToIso,
  formatDateBR,
  isValidCPF,
  formatCPF,
  maskCPF,
  sha256,
  normalizeSearchText,
} from './dateAndCpfUtils'
import { ParsedSheet } from './spreadsheetReader'

export type EvaluationFileSlot = 'obras_45' | 'obras_90' | 'escritorio_45' | 'escritorio_90'

export interface CostCenterRecord {
  id: string
  name: string
  type: 'Escritório' | 'Obra'
}

export interface SectorRecord {
  id: string
  name: string
}

export interface EvaluationCriterionRecord {
  id: string
  name: string
  order: number
  category?: 'OBRAS' | 'ESCRITORIO'
}

export interface CollaboratorRecord {
  id: string
  name: string
  cpf_hash: string
  cost_center: string
  sector?: string
  role: string
  admission_date: string
  situation: string
}

export interface ExistingEvaluationRecord {
  id: string
  collaborator: string
  stage: '45 dias' | '90 dias'
  decision: 'EXTEND' | 'TERMINATE' | 'EFFECTIVATE'
  evaluated_at: string
}

export interface ParsedCollaboratorRow {
  lineNum: number
  rawName: string
  cleanCpf: string
  cpfHash: string
  costCenterId: string
  costCenterName: string
  sectorId: string | null
  sectorName: string | null
  role: string
  admissionIso: string
  isCpfInvalid: boolean
  isMissingCpf: boolean
}

export interface ParsedEvaluationAnswer {
  criterionId: string
  criterionName: string
  rawAnswer: string
  normalizedAnswer: 'PARTIALLY_MEETS' | 'MEETS' | 'DOES_NOT_MEET' | 'EXCEEDS'
  wasInferred: boolean
}

export interface ParsedEvaluationRow {
  sourceSlot: EvaluationFileSlot
  sourceFilename: string
  lineNum: number
  uniqueImportId: string
  rawCollabName: string
  rawCpf?: string
  rawCostCenter?: string
  rawAdmissionDate?: string
  matchedCollaboratorId: string | null
  matchedCollaboratorName: string | null
  matchMethod: 'safe_id' | 'cpf' | 'name_cc' | 'name_admission' | 'unmatched'
  stage: '45 dias' | '90 dias'
  evaluatedAtIso: string
  wasDateInferred: boolean
  decision: 'EXTEND' | 'TERMINATE' | 'EFFECTIVATE'
  wasDecisionInferred: boolean
  resultingSituation: 'Em experiência' | 'Efetivado' | 'Desligado'
  justification: string
  notes: string
  evaluatorName?: string
  answers: ParsedEvaluationAnswer[]
}

export interface FileSimulationReport {
  slotId: 'colaboradores' | EvaluationFileSlot
  slotLabel: string
  filename: string
  totalLines: number
  newCount: number
  existingCount: number
  duplicates: string[]
  suggestedCorrections: string[]
  inferredDates: string[]
  invalidCpfs: string[]
  unmatched: string[]
  rejected: string[]
  errors: string[]
  finalExpectedTotal: number
}

export interface UnifiedSimulationResult {
  fileReports: FileSimulationReport[]
  consolidated: {
    totalFiles: number
    totalLines: number
    newCollaboratorsCount: number
    existingCollaboratorsCount: number
    newEvaluationsCount: number
    existingEvaluationsCount: number
    duplicateEvaluationsCount: number
    invalidCpfsCount: number
    rejectedCount: number
    unmatchedEvaluationsCount: number
    totalNewRecordsToSave: number
  }
  parsedCollaborators: ParsedCollaboratorRow[]
  parsedEvaluations: ParsedEvaluationRow[]
  adminAuthorizationRequired: boolean
}

/**
 * Standard criteria aliases from Section 11:
 * - DISCIPLINA / POSTURA PROFISSIONAL E DISCIPLINA / DISCIPLINA E CUMPRIMENTO DE REGRAS
 * - QUALIDADE E PRODUTIVIDADE / ENTREGA DE RESULTADOS
 * - RELACIONAMENTO E TRABALHO EM EQUIPE / RELACIONAMENTO INTERPESSOAL
 * - ASSIDUIDADE
 */
export function matchCriterionId(
  headerText: string,
  criteria: EvaluationCriterionRecord[],
  targetCategory?: 'OBRAS' | 'ESCRITORIO',
): EvaluationCriterionRecord | null {
  const norm = normalizeSearchText(headerText)
  if (!norm) return null

  // Prioritize criteria in target category if specified
  const pool = targetCategory
    ? [
        ...criteria.filter((c) => c.category === targetCategory),
        ...criteria.filter((c) => c.category !== targetCategory),
      ]
    : criteria

  // Exact or direct inclusion match on criterion name
  const exactMatch = pool.find((c) => {
    const cNorm = normalizeSearchText(c.name)
    return cNorm === norm || norm.includes(cNorm) || cNorm.includes(norm)
  })
  if (exactMatch) return exactMatch

  // Specific keyword mapping for Escritório criteria
  if (
    norm.includes('capacidade tecnica') ||
    norm.includes('conhecimento') ||
    norm.includes('tecnica')
  ) {
    const found = pool.find(
      (c) =>
        normalizeSearchText(c.name).includes('tecnica') ||
        normalizeSearchText(c.name).includes('conhecimento'),
    )
    if (found) return found
  }

  if (norm.includes('proatividade') || norm.includes('iniciativa')) {
    const found = pool.find((c) => normalizeSearchText(c.name).includes('proatividade'))
    if (found) return found
  }

  if (norm.includes('dinamismo') || norm.includes('agilidade')) {
    const found = pool.find((c) => normalizeSearchText(c.name).includes('dinamismo'))
    if (found) return found
  }

  if (
    norm.includes('solucao de problemas') ||
    norm.includes('problemas') ||
    norm.includes('resolucao')
  ) {
    const found = pool.find((c) => normalizeSearchText(c.name).includes('problemas'))
    if (found) return found
  }

  // Standard/historical aliases
  if (norm.includes('disciplina') || norm.includes('postura') || norm.includes('regra')) {
    return (
      pool.find(
        (c) =>
          normalizeSearchText(c.name).includes('disciplina') ||
          normalizeSearchText(c.name).includes('regra') ||
          normalizeSearchText(c.name).includes('postura'),
      ) ||
      pool[0] ||
      null
    )
  }

  if (norm.includes('qualidade') || norm.includes('produtiv') || norm.includes('resultado')) {
    return (
      pool.find(
        (c) =>
          normalizeSearchText(c.name).includes('qualidade') ||
          normalizeSearchText(c.name).includes('produtividade') ||
          normalizeSearchText(c.name).includes('resultado'),
      ) ||
      pool[1] ||
      null
    )
  }

  if (norm.includes('relacionamento') || norm.includes('equipe') || norm.includes('interpessoal')) {
    return (
      pool.find(
        (c) =>
          normalizeSearchText(c.name).includes('relacionamento') ||
          normalizeSearchText(c.name).includes('equipe') ||
          normalizeSearchText(c.name).includes('interpessoal'),
      ) ||
      pool[2] ||
      null
    )
  }

  if (norm.includes('assiduidade') || norm.includes('frequencia') || norm.includes('falta')) {
    return pool.find((c) => normalizeSearchText(c.name).includes('assiduidade')) || pool[3] || null
  }

  return null
}

/**
 * Converts historical criteria answers according to Section 11:
 * - empty or "SELECIONE" -> suggested "Atende" (MEETS) with notification
 * - "ATENDE" -> MEETS
 * - containing "PARCIAL" -> PARTIALLY_MEETS
 * - "NÃO ATENDE" / "NAO ATENDE" -> DOES_NOT_MEET
 * - "SUPERA" or "EXCEDE" -> EXCEEDS
 * - unknown value -> flagged as error (does not convert silently)
 */
/**
 * Safely converts any value to trimmed string, returning empty string for null, undefined or empty.
 */
export function safeCellStr(val: unknown): string {
  if (val == null) return ''
  return String(val).trim()
}

/**
 * Checks if a table row is completely empty (no non-whitespace content in any cell).
 */
export function isRowCompletelyEmpty(row: unknown[] | null | undefined): boolean {
  if (!row || !Array.isArray(row) || row.length === 0) return true
  return !row.some((cell) => safeCellStr(cell).length > 0)
}

export function convertAnswerValue(rawVal: string): {
  normalized: 'PARTIALLY_MEETS' | 'MEETS' | 'DOES_NOT_MEET' | 'EXCEEDS' | null
  inferred: boolean
  error?: string
} {
  const norm = normalizeSearchText(rawVal)

  if (!norm || norm === 'selecione' || norm === '-' || norm === 'n/a') {
    return { normalized: 'MEETS', inferred: true }
  }

  if (norm.includes('parcial')) {
    return { normalized: 'PARTIALLY_MEETS', inferred: false }
  }

  if (norm.includes('nao atende') || norm === 'nao' || norm === 'reprovado') {
    return { normalized: 'DOES_NOT_MEET', inferred: false }
  }

  if (norm.includes('supera') || norm.includes('excede') || norm.includes('otimo')) {
    return { normalized: 'EXCEEDS', inferred: false }
  }

  if (norm.includes('atende') || norm === 'sim' || norm === 'bom' || norm === 'aprovado') {
    return { normalized: 'MEETS', inferred: false }
  }

  return {
    normalized: null,
    inferred: false,
    error: `Valor de critério desconhecido: "${rawVal}" (não convertido silenciosamente)`,
  }
}

/**
 * Converts decision text based on historical aliases and stage (45 vs 90 days):
 * - Contendo DESLIGAR/ENCERRAR/TERMINAR -> TERMINATE (resulting situation: Desligado)
 * - Stage 45 dias with empty / "ATENDE" / "PRORROGAR" -> EXTEND (resulting: Em experiência)
 * - Stage 90 dias with empty / "ATENDE" / "EFETIVAR" -> EFFECTIVATE (resulting: Efetivado)
 */
export function convertDecisionValue(
  rawVal: string,
  stage: '45 dias' | '90 dias',
): {
  decision: 'EXTEND' | 'TERMINATE' | 'EFFECTIVATE'
  inferred: boolean
  resultingSituation: 'Em experiência' | 'Efetivado' | 'Desligado'
} {
  const norm = normalizeSearchText(rawVal)

  if (
    norm.includes('deslig') ||
    norm.includes('encerr') ||
    norm.includes('termin') ||
    norm.includes('demit')
  ) {
    return { decision: 'TERMINATE', inferred: false, resultingSituation: 'Desligado' }
  }

  if (stage === '45 dias') {
    if (norm.includes('prorrog') || norm.includes('continua') || norm.includes('manter')) {
      return { decision: 'EXTEND', inferred: false, resultingSituation: 'Em experiência' }
    }
    // Default / positive on 45 days
    return {
      decision: 'EXTEND',
      inferred: !norm || norm.includes('atende') || norm.includes('selecione'),
      resultingSituation: 'Em experiência',
    }
  } else {
    // 90 dias
    if (norm.includes('efetiv') || norm.includes('aprov')) {
      return { decision: 'EFFECTIVATE', inferred: false, resultingSituation: 'Efetivado' }
    }
    return {
      decision: 'EFFECTIVATE',
      inferred: !norm || norm.includes('atende') || norm.includes('selecione'),
      resultingSituation: 'Efetivado',
    }
  }
}

/**
 * Simulates the inclusion file: BD_INCLUSAO-COLABORADOR
 */
export async function simulateCollaboratorsSheet(
  sheet: ParsedSheet,
  filename: string,
  costCenters: CostCenterRecord[],
  sectors: SectorRecord[],
  existingCollabs: CollaboratorRecord[],
): Promise<{ report: FileSimulationReport; parsedRows: ParsedCollaboratorRow[] }> {
  const report: FileSimulationReport = {
    slotId: 'colaboradores',
    slotLabel: 'Inclusão de Colaboradores',
    filename,
    totalLines: sheet.rows.length,
    newCount: 0,
    existingCount: 0,
    duplicates: [],
    suggestedCorrections: [],
    inferredDates: [],
    invalidCpfs: [],
    unmatched: [],
    rejected: [],
    errors: [],
    finalExpectedTotal: 0,
  }

  const parsedRows: ParsedCollaboratorRow[] = []
  const headers = sheet.headers.map((h) => normalizeSearchText(h))

  const idxName = headers.findIndex((h) => h.includes('nome'))
  const idxCpf = headers.findIndex((h) => h.includes('cpf'))
  const idxCc = headers.findIndex((h) => h.includes('centro') || h.includes('obra'))
  const idxSec = headers.findIndex((h) => h.includes('setor'))
  const idxRole = headers.findIndex((h) => h.includes('funcao') || h.includes('cargo'))
  const idxAdmission = headers.findIndex(
    (h) => h.includes('inicial') || h.includes('admissao') || h.includes('data'),
  )

  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]
    const lineNum = i + 2 // 1-based, considering header at row 1

    // Ignore completely empty or whitespace-only lines silently (do not reject or abort)
    if (isRowCompletelyEmpty(row)) {
      continue
    }

    const rawName = safeCellStr(idxName !== -1 ? row[idxName] : row[0]).toUpperCase()
    const rawCpf = safeCellStr(idxCpf !== -1 ? row[idxCpf] : row[1])
    const rawCc = safeCellStr(idxCc !== -1 ? row[idxCc] : row[2]).toUpperCase()
    const rawSec = safeCellStr(idxSec !== -1 ? row[idxSec] : row[3]).toUpperCase()
    const rawRole = safeCellStr(idxRole !== -1 ? row[idxRole] : row[4]).toUpperCase()
    const rawAdmission = safeCellStr(idxAdmission !== -1 ? row[idxAdmission] : row[5])

    if (!rawName) {
      report.rejected.push(`Linha ${lineNum}: Nome do colaborador não informado.`)
      continue
    }

    // CPF handling
    const cleanCpf = rawCpf.replace(/\D/g, '')
    const isMissingCpf = cleanCpf.length === 0
    let isCpfInvalid = false

    if (isMissingCpf) {
      report.suggestedCorrections.push(
        `Linha ${lineNum}: Colaborador "${rawName}" está sem CPF na planilha.`,
      )
    } else {
      if (!isValidCPF(cleanCpf)) {
        isCpfInvalid = true
        report.invalidCpfs.push(
          `Linha ${lineNum}: CPF matematicamente inválido para "${rawName}" (${maskCPF(cleanCpf)}). Requer autorização de ADMIN.`,
        )
      }
    }

    // Cost Center lookup
    const normRawCc = normalizeSearchText(rawCc)
    const matchedCc = costCenters.find((c) => {
      const normCcName = normalizeSearchText(c.name)
      if (normCcName === normRawCc) return true
      if (normRawCc.includes('escrit') && c.type === 'Escritório') return true
      if (normCcName.includes(normRawCc) || normRawCc.includes(normCcName)) return true
      return false
    })

    if (!matchedCc) {
      report.unmatched.push(
        `Linha ${lineNum}: Centro de custo "${rawCc}" não localizado no sistema.`,
      )
      report.rejected.push(
        `Linha ${lineNum}: Rejeitado por centro de custo inexistente ("${rawCc}").`,
      )
      continue
    }

    // Sector lookup
    let matchedSec: SectorRecord | null = null
    if (matchedCc.type === 'Escritório') {
      const normRawSec = normalizeSearchText(rawSec)
      matchedSec =
        sectors.find((s) => {
          const normSecName = normalizeSearchText(s.name)
          return normSecName === normRawSec || normSecName.includes(normRawSec)
        }) || null

      if (!matchedSec && rawSec) {
        report.suggestedCorrections.push(
          `Linha ${lineNum}: Setor "${rawSec}" não padronizado para "${rawName}".`,
        )
      }
    }

    // Admission date parsing (strict DD/MM/AAAA)
    const admissionIso = parseDateToIso(rawAdmission)
    if (!admissionIso) {
      report.inferredDates.push(
        `Linha ${lineNum}: Data de admissão ausente ou inválida ("${rawAdmission}") para "${rawName}".`,
      )
      report.rejected.push(
        `Linha ${lineNum}: Rejeitado por impossibilidade de determinar data de admissão.`,
      )
      continue
    }

    // Compute CPF hash or synthetic hash if missing CPF
    const cpfHash = cleanCpf
      ? await sha256(cleanCpf)
      : await sha256(`NO_CPF_${normalizeSearchText(rawName)}_${matchedCc.id}`)

    // Check duplicate against existing collaborators
    const existingMatch = existingCollabs.find(
      (c) =>
        (cleanCpf && c.cpf_hash === cpfHash) ||
        (normalizeSearchText(c.name) === normalizeSearchText(rawName) &&
          c.cost_center === matchedCc.id),
    )

    if (existingMatch) {
      report.duplicates.push(
        `Linha ${lineNum}: Colaborador "${rawName}" já existe cadastrado no centro "${matchedCc.name}" (Admissão: ${formatDateBR(existingMatch.admission_date)}).`,
      )
      report.existingCount++
      continue
    }

    report.newCount++
    parsedRows.push({
      lineNum,
      rawName,
      cleanCpf,
      cpfHash,
      costCenterId: matchedCc.id,
      costCenterName: matchedCc.name,
      sectorId: matchedSec?.id || null,
      sectorName: matchedSec?.name || null,
      role: rawRole || 'COLABORADOR',
      admissionIso,
      isCpfInvalid,
      isMissingCpf,
    })
  }

  report.finalExpectedTotal = report.newCount
  return { report, parsedRows }
}

/**
 * Matches an evaluation row to a collaborator following Section 11 priority:
 * 1. Safe identifier (if present)
 * 2. CPF (if present and matched)
 * 3. Normalized Name + Cost Center
 * 4. Normalized Name + Expected Admission Date
 * Homonyms or low confidence are not associated automatically.
 */
export function matchEvaluationToCollaborator(
  rawCollabName: string,
  rawCpf: string,
  rawCc: string,
  rawAdmission: string,
  allCollabs: Array<{
    id: string
    name: string
    cpf_digits?: string
    cpf_hash?: string
    cost_center_id: string
    cost_center_name?: string
    admission_date: string
  }>,
  targetCostCenterType?: 'Escritório' | 'Obra',
): {
  collaborator: (typeof allCollabs)[0] | null
  matchMethod: 'safe_id' | 'cpf' | 'name_cc' | 'name_admission' | 'unmatched'
  warning?: string
} {
  const normName = normalizeSearchText(rawCollabName)
  const cleanCpf = (rawCpf || '').replace(/\D/g, '')

  // 1. By CPF if available
  if (cleanCpf) {
    const byCpf = allCollabs.filter((c) => c.cpf_digits === cleanCpf)
    if (byCpf.length === 1) {
      return { collaborator: byCpf[0], matchMethod: 'cpf' }
    }
  }

  // Find by name
  const sameNameCollabs = allCollabs.filter((c) => normalizeSearchText(c.name) === normName)

  if (sameNameCollabs.length === 1) {
    return { collaborator: sameNameCollabs[0], matchMethod: 'name_cc' }
  }

  if (sameNameCollabs.length > 1) {
    // Homonym disambiguation by Cost Center
    if (rawCc) {
      const normCc = normalizeSearchText(rawCc)
      const disambiguated = sameNameCollabs.filter(
        (c) =>
          normalizeSearchText(c.cost_center_name || '').includes(normCc) ||
          normCc.includes(normalizeSearchText(c.cost_center_name || '')),
      )
      if (disambiguated.length === 1) {
        return { collaborator: disambiguated[0], matchMethod: 'name_cc' }
      }
    }

    // Disambiguation by admission date
    const isoAdmission = parseDateToIso(rawAdmission)
    if (isoAdmission) {
      const disambiguated = sameNameCollabs.filter((c) => c.admission_date === isoAdmission)
      if (disambiguated.length === 1) {
        return { collaborator: disambiguated[0], matchMethod: 'name_admission' }
      }
    }

    return {
      collaborator: null,
      matchMethod: 'unmatched',
      warning: `Homônimo detectado: existem ${sameNameCollabs.length} colaboradores com o nome "${rawCollabName}". Não associado automaticamente para garantir segurança.`,
    }
  }

  return { collaborator: null, matchMethod: 'unmatched' }
}

/**
 * Simulates one of the 4 evaluations sheets.
 */
export async function simulateEvaluationSheet(
  sheet: ParsedSheet,
  slot: EvaluationFileSlot,
  filename: string,
  criteria: EvaluationCriterionRecord[],
  allCollabs: Array<{
    id: string
    name: string
    cpf_digits?: string
    cpf_hash?: string
    cost_center_id: string
    cost_center_name?: string
    admission_date: string
  }>,
  existingEvals: ExistingEvaluationRecord[],
): Promise<{ report: FileSimulationReport; parsedRows: ParsedEvaluationRow[] }> {
  const stage: '45 dias' | '90 dias' = slot.includes('90') ? '90 dias' : '45 dias'
  const isEscritorio = slot.includes('escritorio')
  const slotLabels: Record<EvaluationFileSlot, string> = {
    obras_45: 'Avaliações Obras - 45 Dias',
    obras_90: 'Avaliações Obras - 90 Dias',
    escritorio_45: 'Avaliações Escritório - 45 Dias',
    escritorio_90: 'Avaliações Escritório - 90 Dias',
  }

  const report: FileSimulationReport = {
    slotId: slot,
    slotLabel: slotLabels[slot],
    filename,
    totalLines: sheet.rows.length,
    newCount: 0,
    existingCount: 0,
    duplicates: [],
    suggestedCorrections: [],
    inferredDates: [],
    invalidCpfs: [],
    unmatched: [],
    rejected: [],
    errors: [],
    finalExpectedTotal: 0,
  }

  const parsedRows: ParsedEvaluationRow[] = []
  const headers = sheet.headers.map((h) => normalizeSearchText(h))

  // Find column positions
  const idxCollab = headers.findIndex(
    (h) => h.includes('colaborador') || h.includes('funcionario') || h.includes('nome'),
  )
  const idxDate = headers.findIndex(
    (h) =>
      h.includes('data da avaliacao') ||
      h.includes('data avaliacao') ||
      h.includes('data') ||
      h.includes('periodo'),
  )
  const idxEvaluator = headers.findIndex(
    (h) => h.includes('avaliador') || h.includes('gestor') || h.includes('lider'),
  )
  const idxDecision = headers.findIndex(
    (h) =>
      h.includes('decisao') ||
      h.includes('situacao') ||
      h.includes('resultado') ||
      h.includes('parecer'),
  )
  const idxJustification = headers.findIndex(
    (h) => h.includes('justificativa') || h.includes('motivo') || h.includes('observacao'),
  )
  const idxCpf = headers.findIndex((h) => h.includes('cpf'))
  const idxCc = headers.findIndex((h) => h.includes('centro') || h.includes('obra'))

  // Match criteria columns
  const criteriaColIndices: Array<{
    colIdx: number
    criterion: EvaluationCriterionRecord
  }> = []

  const targetCategory: 'OBRAS' | 'ESCRITORIO' = isEscritorio ? 'ESCRITORIO' : 'OBRAS'

  sheet.headers.forEach((h, cIdx) => {
    const matchedCrit = matchCriterionId(h, criteria, targetCategory)
    if (matchedCrit && !criteriaColIndices.some((c) => c.criterion.id === matchedCrit.id)) {
      criteriaColIndices.push({ colIdx: cIdx, criterion: matchedCrit })
    }
  })

  for (let i = 0; i < sheet.rows.length; i++) {
    const row = sheet.rows[i]
    const lineNum = i + 2
    const uniqueImportId = `${slot}_L${lineNum}_${filename}`

    // Ignore completely empty or whitespace-only lines silently (do not reject or abort)
    if (isRowCompletelyEmpty(row)) {
      continue
    }

    const rawCollab = safeCellStr(idxCollab !== -1 ? row[idxCollab] : row[0])
    const rawDate = safeCellStr(idxDate !== -1 ? row[idxDate] : row[1])
    const rawEvaluator = safeCellStr(idxEvaluator !== -1 ? row[idxEvaluator] : row[2])
    const rawDecision = safeCellStr(idxDecision !== -1 ? row[idxDecision] : row[3])
    const rawJustification = safeCellStr(idxJustification !== -1 ? row[idxJustification] : row[4])
    const rawCpf = safeCellStr(idxCpf !== -1 ? row[idxCpf] : '')
    const rawCc = safeCellStr(idxCc !== -1 ? row[idxCc] : '')

    if (!rawCollab) {
      report.rejected.push(`Linha ${lineNum}: Nome do colaborador não preenchido.`)
      continue
    }

    // Match to collaborator
    const matchRes = matchEvaluationToCollaborator(
      rawCollab,
      rawCpf,
      rawCc,
      '',
      allCollabs,
      isEscritorio ? 'Escritório' : 'Obra',
    )

    if (!matchRes.collaborator) {
      if (matchRes.warning) {
        report.unmatched.push(`Linha ${lineNum}: ${matchRes.warning}`)
      } else {
        report.unmatched.push(
          `Linha ${lineNum}: Colaborador "${rawCollab}" não localizado na base cadastral.`,
        )
      }
      report.rejected.push(
        `Linha ${lineNum}: Avaliação de "${rawCollab}" rejeitada por ausência de cadastro do colaborador.`,
      )
      continue
    }

    const matchedCollab = matchRes.collaborator

    // Evaluation date parsing
    let evaluatedAtIso = parseDateToIso(rawDate)
    let wasDateInferred = false
    if (!evaluatedAtIso) {
      // Infer based on admission date + stage days
      evaluatedAtIso = parseDateToIso(matchedCollab.admission_date)
      wasDateInferred = true
      report.inferredDates.push(
        `Linha ${lineNum}: Data da avaliação para "${rawCollab}" não especificada; sugerida data de referência da admissão.`,
      )
    }

    // Decision conversion
    const decisionConv = convertDecisionValue(rawDecision, stage)
    if (decisionConv.inferred) {
      const suggestionLabel = stage === '45 dias' ? 'Prorrogar' : 'Efetivar'
      report.suggestedCorrections.push(
        `Linha ${lineNum}: Decisão vazia ou padrão ("${rawDecision || 'vazio'}") para "${rawCollab}"; sugerido "${suggestionLabel}".`,
      )
    }

    // Answers conversion for criteria
    const answers: ParsedEvaluationAnswer[] = []
    for (const cItem of criteriaColIndices) {
      const cellVal = safeCellStr(row[cItem.colIdx])
      const conv = convertAnswerValue(cellVal)
      if (conv.error) {
        report.errors.push(`Linha ${lineNum}: ${conv.error}`)
      }
      if (conv.inferred) {
        report.suggestedCorrections.push(
          `Linha ${lineNum}: Resposta do critério "${cItem.criterion.name}" vazia para "${rawCollab}"; sugerido "Atende".`,
        )
      }
      if (conv.normalized) {
        answers.push({
          criterionId: cItem.criterion.id,
          criterionName: cItem.criterion.name,
          rawAnswer: cellVal,
          normalizedAnswer: conv.normalized,
          wasInferred: conv.inferred,
        })
      }
    }

    // Check duplicate against existing evaluations (idempotency)
    const duplicateEval = existingEvals.find(
      (e) => e.collaborator === matchedCollab.id && e.stage === stage,
    )
    if (duplicateEval) {
      report.duplicates.push(
        `Linha ${lineNum}: Avaliação de ${stage} já existe no sistema para "${matchedCollab.name}" (Data: ${formatDateBR(duplicateEval.evaluated_at)}).`,
      )
      report.existingCount++
      continue
    }

    report.newCount++
    parsedRows.push({
      sourceSlot: slot,
      sourceFilename: filename,
      lineNum,
      uniqueImportId,
      rawCollabName: rawCollab,
      rawCpf,
      rawCostCenter: rawCc,
      matchedCollaboratorId: matchedCollab.id,
      matchedCollaboratorName: matchedCollab.name,
      matchMethod: matchRes.matchMethod,
      stage,
      evaluatedAtIso: evaluatedAtIso || parseDateToIso(new Date()),
      wasDateInferred,
      decision: decisionConv.decision,
      wasDecisionInferred: decisionConv.inferred,
      resultingSituation: decisionConv.resultingSituation,
      justification: rawJustification,
      notes: `Importado de ${filename} (linha ${lineNum})`,
      evaluatorName: rawEvaluator || undefined,
      answers,
    })
  }

  report.finalExpectedTotal = report.newCount
  return { report, parsedRows }
}
