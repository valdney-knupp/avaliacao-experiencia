import { generateUserManualPdfBytes } from './userManualGenerator'

/**
 * Retorna os bytes do manual do usuário codificados em Base64 padrão.
 * Esta string pode ser usada diretamente tanto no frontend quanto no backend
 * para gerar Data URIs ou converter em $filesystem.fileFromBytes() no PocketBase.
 */
export function getUserManualBase64(): string {
  const bytes = generateUserManualPdfBytes()
  let binary = ''
  const len = bytes.byteLength
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}
