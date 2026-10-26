// Date manipulation and formatting utilities for America/Fortaleza timezone (UTC-3)
// Guarantees strict DD/MM/AAAA preservation across all operations without timezone shift or MM/DD/AAAA inversion.

/**
 * Parses a date string into standard ISO YYYY-MM-DD.
 * Supports:
 * - DD/MM/YYYY
 * - YYYY-MM-DD
 * - Date object
 * - Excel serial number
 */
export function parseDateToIso(input: string | number | Date | null | undefined): string {
  if (!input) return ''

  if (typeof input === 'number') {
    // Excel serial number (1900 date system)
    const utcDays = Math.floor(input - 25569)
    const utcValue = utcDays * 86400
    const dateInfo = new Date(utcValue * 1000)
    const y = dateInfo.getUTCFullYear()
    const m = String(dateInfo.getUTCMonth() + 1).padStart(2, '0')
    const d = String(dateInfo.getUTCDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  if (input instanceof Date) {
    const y = input.getFullYear()
    const m = String(input.getMonth() + 1).padStart(2, '0')
    const d = String(input.getDate()).padStart(2, '0')
    return `${y}-${m}-${d}`
  }

  const str = String(input).trim()
  // Check if YYYY-MM-DD or ISO timestamp (e.g. 2026-09-24 00:00:00.000Z or 2026-09-24T00:00:00Z)
  const isoMatch = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/)
  if (isoMatch) {
    const year = isoMatch[1]
    const month = isoMatch[2].padStart(2, '0')
    const day = isoMatch[3].padStart(2, '0')
    return `${year}-${month}-${day}`
  }

  // Check if DD/MM/YYYY or DD-MM-YYYY
  const brMatch = str.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})/)
  if (brMatch) {
    const day = brMatch[1].padStart(2, '0')
    const month = brMatch[2].padStart(2, '0')
    const year = brMatch[3]
    return `${year}-${month}-${day}`
  }

  return ''
}

/**
 * Formats any date input strictly into DD/MM/AAAA.
 * Never inverts month and day.
 */
export function formatDateBR(input: string | number | Date | null | undefined): string {
  if (!input) return '-'
  const iso = parseDateToIso(input)
  if (!iso || !iso.includes('-')) return '-'
  const [y, m, d] = iso.split('-')
  return `${d}/${m}/${y}`
}

/**
 * Formats a timestamp into DD/MM/AAAA HH:mm (Fortaleza timezone / standard local display)
 */
export function formatDateTimeBR(input: string | Date | null | undefined): string {
  if (!input) return '-'
  try {
    const d = typeof input === 'string' ? new Date(input) : input
    if (isNaN(d.getTime())) return '-'
    // Format using America/Fortaleza if Intl available, or standard local
    return new Intl.DateTimeFormat('pt-BR', {
      timeZone: 'America/Fortaleza',
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d)
  } catch {
    return formatDateBR(input)
  }
}

/**
 * Adds calendar days to an ISO date string (YYYY-MM-DD)
 * 45 days = admission + 45 days
 * 90 days = admission + 90 days
 */
export function addDaysToIsoDate(
  isoDate: string | number | Date | null | undefined,
  days: number,
): string {
  if (!isoDate) return ''
  const sanitized = parseDateToIso(isoDate)
  if (!sanitized || !sanitized.includes('-')) return ''

  const [y, m, d] = sanitized.split('-').map(Number)
  if (isNaN(y) || isNaN(m) || isNaN(d)) return ''

  // Construct UTC date at noon to avoid DST/boundary issues
  const date = new Date(Date.UTC(y, m - 1, d, 12, 0, 0))
  date.setUTCDate(date.getUTCDate() + days)
  const resY = date.getUTCFullYear()
  const resM = String(date.getUTCMonth() + 1).padStart(2, '0')
  const resD = String(date.getUTCDate()).padStart(2, '0')
  return `${resY}-${resM}-${resD}`
}

/**
 * Computes difference in calendar days between today and a target date.
 * If target is in the past: overdue > 0
 * If target is in the future: remaining >= 0
 */
export function calculateDeadlineStatus(
  deadlineInput: string | number | Date | null | undefined,
  todayInput?: string | number | Date | null | undefined,
): {
  isOverdue: boolean
  daysRemaining: number
  daysOverdue: number
  badgeLabel: string
} {
  if (!deadlineInput) {
    return { isOverdue: false, daysRemaining: 0, daysOverdue: 0, badgeLabel: 'Sem prazo' }
  }

  const deadlineIso = parseDateToIso(deadlineInput)
  if (!deadlineIso || !deadlineIso.includes('-')) {
    return { isOverdue: false, daysRemaining: 0, daysOverdue: 0, badgeLabel: 'Sem prazo' }
  }

  const nowIso = todayInput
    ? parseDateToIso(todayInput)
    : new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Fortaleza' }).format(new Date())

  if (!nowIso || !nowIso.includes('-')) {
    return { isOverdue: false, daysRemaining: 0, daysOverdue: 0, badgeLabel: 'Sem prazo' }
  }

  const [ty, tm, td] = nowIso.split('-').map(Number)
  const [dy, dm, dd] = deadlineIso.split('-').map(Number)

  if (isNaN(ty) || isNaN(tm) || isNaN(td) || isNaN(dy) || isNaN(dm) || isNaN(dd)) {
    return { isOverdue: false, daysRemaining: 0, daysOverdue: 0, badgeLabel: 'Sem prazo' }
  }

  const todayUtc = Date.UTC(ty, tm - 1, td)
  const targetUtc = Date.UTC(dy, dm - 1, dd)
  const diffTime = targetUtc - todayUtc
  const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24))

  if (diffDays < 0) {
    const overdue = Math.abs(diffDays)
    return {
      isOverdue: true,
      daysRemaining: 0,
      daysOverdue: overdue,
      badgeLabel: `Atrasada (${overdue}d)`,
    }
  }

  return {
    isOverdue: false,
    daysRemaining: diffDays,
    daysOverdue: 0,
    badgeLabel: diffDays === 0 ? 'Vence hoje' : `No prazo (${diffDays}d)`,
  }
}

/**
 * Validates a Brazilian CPF using standard modulo 11 checksum algorithm.
 */
export function isValidCPF(cpfRaw: string): boolean {
  if (!cpfRaw) return false
  const cpf = cpfRaw.replace(/\D/g, '')
  if (cpf.length !== 11) return false
  // All digits equal (e.g. 111.111.111-11) is invalid
  if (/^(\d)\1{10}$/.test(cpf)) return false

  let sum = 0
  for (let i = 0; i < 9; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (10 - i)
  }
  let rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(cpf.charAt(9), 10)) return false

  sum = 0
  for (let i = 0; i < 10; i++) {
    sum += parseInt(cpf.charAt(i), 10) * (11 - i)
  }
  rev = 11 - (sum % 11)
  if (rev === 10 || rev === 11) rev = 0
  if (rev !== parseInt(cpf.charAt(10), 10)) return false

  return true
}

/**
 * Formats digits into CPF mask: 000.000.000-00
 */
export function formatCPF(cpfRaw: string): string {
  const digits = (cpfRaw || '').replace(/\D/g, '').slice(0, 11)
  if (!digits) return ''
  return digits
    .replace(/^(\d{3})(\d)/, '$1.$2')
    .replace(/^(\d{3})\.(\d{3})(\d)/, '$1.$2.$3')
    .replace(/^(\d{3})\.(\d{3})\.(\d{3})(\d)/, '$1.$2.$3-$4')
}

/**
 * Mask CPF strictly as ***.***.***-** for all generic listings
 */
export function maskCPF(cpfRaw?: string): string {
  if (!cpfRaw) return '***.***.***-**'
  const digits = cpfRaw.replace(/\D/g, '')
  if (digits.length === 11) {
    return `***.***.***-${digits.slice(9, 11)}`
  }
  return '***.***.***-**'
}

/**
 * Computes SHA-256 hash of a normalized string (client-side via Web Crypto)
 */
export async function sha256(text: string): Promise<string> {
  const enc = new TextEncoder()
  const data = enc.encode(text)
  const hashBuffer = await crypto.subtle.digest('SHA-256', data)
  const hashArray = Array.from(new Uint8Array(hashBuffer))
  return hashArray.map((b) => b.toString(16).padStart(2, '0')).join('')
}

/**
 * Simple AES-GCM client-side encryption / decryption for CPF storage
 * Uses an obfuscated application secret key
 */
const CPF_SECRET_SEED = 'R_PONTES_CONSTRUTORA_AVALIACAO_EXP_KEY_2026'

async function getKey(): Promise<CryptoKey> {
  const enc = new TextEncoder()
  const keyMaterial = await crypto.subtle.importKey(
    'raw',
    enc.encode(CPF_SECRET_SEED),
    { name: 'PBKDF2' },
    false,
    ['deriveKey'],
  )
  return crypto.subtle.deriveKey(
    {
      name: 'PBKDF2',
      salt: enc.encode('r_pontes_salt_fixed'),
      iterations: 100000,
      hash: 'SHA-256',
    },
    keyMaterial,
    { name: 'AES-GCM', length: 256 },
    false,
    ['encrypt', 'decrypt'],
  )
}

export async function encryptCPF(cpfDigits: string): Promise<string> {
  const key = await getKey()
  const iv = crypto.getRandomValues(new Uint8Array(12))
  const enc = new TextEncoder()
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(cpfDigits))
  const ivHex = Array.from(iv)
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  const dataHex = Array.from(new Uint8Array(encrypted))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
  return `${ivHex}:${dataHex}`
}

export async function decryptCPF(encryptedStr: string): Promise<string> {
  try {
    if (!encryptedStr || !encryptedStr.includes(':')) return ''
    const [ivHex, dataHex] = encryptedStr.split(':')
    const iv = new Uint8Array(ivHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)))
    const data = new Uint8Array(dataHex.match(/.{1,2}/g)!.map((byte) => parseInt(byte, 16)))
    const key = await getKey()
    const decrypted = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data)
    const dec = new TextDecoder()
    return dec.decode(decrypted)
  } catch {
    return ''
  }
}

/**
 * Diacritic and case-insensitive search helper
 */
export function normalizeSearchText(str: string): string {
  if (!str) return ''
  return str
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
}
