import fs from 'node:fs'
import path from 'node:path'
import { generateUserManualPdfBytes } from './src/lib/userManualGenerator'

function main() {
  console.log('Gerando PDF do Manual do Usuário...')
  const pdfBytes = generateUserManualPdfBytes()
  console.log(`PDF gerado com sucesso: ${pdfBytes.length} bytes`)

  // 1. Salvar em public/manual-usuario.pdf
  const publicPath = path.resolve(process.cwd(), 'public', 'manual-usuario.pdf')
  fs.writeFileSync(publicPath, Buffer.from(pdfBytes))
  console.log(`Salvo em ${publicPath}`)

  // 2. Salvar em pocketbase/hooks/assets/manual-usuario.pdf
  const hooksAssetsDir = path.resolve(process.cwd(), 'pocketbase', 'hooks', 'assets')
  if (!fs.existsSync(hooksAssetsDir)) {
    fs.mkdirSync(hooksAssetsDir, { recursive: true })
  }
  const hooksAssetPath = path.resolve(hooksAssetsDir, 'manual-usuario.pdf')
  fs.writeFileSync(hooksAssetPath, Buffer.from(pdfBytes))
  console.log(`Salvo em ${hooksAssetPath}`)
}

main()
