import { generateUserManualPdfBytes } from './userManualGenerator'
import pb from './pocketbase/client'

let cachedBase64 = ''

export function getManualPdfBase64(): string {
  if (cachedBase64) return cachedBase64
  const bytes = generateUserManualPdfBytes()
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  if (typeof btoa === 'function') {
    cachedBase64 = btoa(binary)
  }
  return cachedBase64
}

export function downloadManualPdf(): void {
  // 1. Tentar primeiro o download do arquivo servido publicamente ou pelo backend
  // Se falhar ou estiver em ambiente estático, faz o download instantâneo via Blob client-side
  try {
    const bytes = generateUserManualPdfBytes()
    const blob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'manual-do-usuario-avaliacao-de-experiencia.pdf'
    document.body.appendChild(a)
    a.click()
    document.body.removeChild(a)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
  } catch (_err) {
    // Fallback: abrir a rota /manual-usuario.pdf
    window.open('/manual-usuario.pdf', '_blank')
  }
}

/**
 * Garante que o PDF do manual do usuário seja sincronizado com o PocketBase
 * na coleção `system_assets` se ainda não estiver presente,
 * permitindo que os hooks do backend leiam o arquivo e o enviem como anexo.
 */
export async function syncManualAssetToBackend(): Promise<void> {
  try {
    const existing = await pb
      .collection('system_assets')
      .getFirstListItem('key="manual-usuario.pdf"')
      .catch(() => null)

    if (existing && existing.file) {
      return
    }

    const bytes = generateUserManualPdfBytes()
    const fileBlob = new Blob([bytes.buffer as ArrayBuffer], { type: 'application/pdf' })
    const file = new File([fileBlob], 'manual-usuario.pdf', { type: 'application/pdf' })

    const formData = new FormData()
    formData.append('key', 'manual-usuario.pdf')
    formData.append('name', 'Manual do Usuário - Avaliação de Experiência')
    formData.append('file', file)

    if (existing) {
      await pb.collection('system_assets').update(existing.id, formData)
    } else {
      await pb.collection('system_assets').create(formData)
    }
  } catch (_err) {
    // Silencioso em caso de permissão de gravação restrita; o backend possui fallback
  }
}
