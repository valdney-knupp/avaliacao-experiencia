// Rasteriza scripts/logo.svg (mesmo desenho do AppLogoSymbol, variante clara)
// para os PNGs estáticos em public/branding e gera scripts/logo-1200.b64.
// Uso: instale sharp localmente (npm i -D sharp) e rode: node scripts/generate-logo.mjs
// Sem sharp instalado, o script apenas avisa e sai sem erro.
import { readFile, writeFile, mkdir } from 'node:fs/promises'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const svgPath = path.join(root, 'scripts', 'logo.svg')
const outDir = path.join(root, 'public', 'branding')

let sharp
try {
  sharp = (await import('sharp')).default
} catch (error) {
  console.warn('[logo] sharp indisponível; PNGs não foram regenerados.', error?.message ?? error)
  process.exit(0)
}

const svg = await readFile(svgPath)
// O SVG tem viewBox 64; renderizamos em alta densidade e reduzimos para cada tamanho.
const BASE_PX = 1200
const density = (72 * BASE_PX) / 64

const targets = [
  { file: 'logo-1200.png', size: 1200 },
  { file: 'logo-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-32.png', size: 32 },
]

await mkdir(outDir, { recursive: true })

for (const { file, size } of targets) {
  await sharp(svg, { density }).resize(size, size).png().toFile(path.join(outDir, file))
}

const logo1200 = await readFile(path.join(outDir, 'logo-1200.png'))
await writeFile(path.join(root, 'scripts', 'logo-1200.b64'), logo1200.toString('base64') + '\n')

console.log('[logo] PNGs gerados em public/branding e scripts/logo-1200.b64 atualizado.')
