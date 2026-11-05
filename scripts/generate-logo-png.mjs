// Rasteriza o símbolo do logo (mesmo desenho de scripts/logo.svg, variante clara,
// isDark=false) para PNGs estáticos, usando apenas módulos nativos do Node
// (node:zlib e node:fs). Não há dependências: o PNG é codificado aqui mesmo
// (assinatura, IHDR, IDAT, IEND; RGBA 8 bits; filtro 0) e o desenho é feito
// procedural com supersampling 4x por eixo.
// Uso: node scripts/generate-logo-png.mjs
import { deflateSync } from 'node:zlib'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const outDir = path.join(root, 'public', 'branding')
const b64Path = path.join(root, 'scripts', 'logo-1200.b64')

const SS = 4 // supersampling por eixo
const TAU = Math.PI * 2
const K = 1 / 255

const hex = (h) => [
  parseInt(h.slice(1, 3), 16),
  parseInt(h.slice(3, 5), 16),
  parseInt(h.slice(5, 7), 16),
]
const BG_TOP = hex('#EDF8EE')
const BG_BOTTOM = hex('#DDF0E1')
const GREEN = hex('#54D769')
const GREEN_LIGHT = hex('#6EE787')
const GREEN_DARK = hex('#2CA840')
const MINT = hex('#A3F3B1')
const WHITE = [255, 255, 255]
const SHIELD_STROKE = [44, 168, 64]

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v)
const lerp = (a, b, t) => a + (b - a) * t
const mod2pi = (v) => {
  const r = v % TAU
  return r < 0 ? r + TAU : r
}

// ---- Geometria do arco: "M 12 36 A 23 23 0 1 1 52 38" ----
const ARC_R = 23
const ARC_HW = 1.6 // metade da largura 3.2
const P1 = [12, 36]
const P2 = [52, 38]
const dxA = P2[0] - P1[0]
const dyA = P2[1] - P1[1]
const lenA = Math.hypot(dxA, dyA)
const hA = Math.sqrt(ARC_R * ARC_R - (lenA / 2) ** 2)
// Centro do arco (escolha que passa pelo topo, large-arc=1, sweep=1)
const ARC_CX = 32 + hA * (dyA / lenA)
const ARC_CY = 37 - hA * (dxA / lenA)
const ARC_START = Math.atan2(P1[1] - ARC_CY, P1[0] - ARC_CX)
const ARC_END = Math.atan2(P2[1] - ARC_CY, P2[0] - ARC_CX)
const ARC_SWEEP = mod2pi(ARC_END - ARC_START)
// Guia tracejada: arco inferior (mesmo círculo), de ARC_END até ARC_START
const GUIDE_SWEEP = mod2pi(ARC_START - ARC_END)

// Gradiente ao longo do arco: rgba(84,215,105,0.35) → #54D769 → #A3F3B1
function arcColor(u) {
  if (u < 0.5) {
    const t = u * 2
    return [
      lerp(GREEN[0], GREEN[0], t),
      lerp(GREEN[1], GREEN[1], t),
      lerp(GREEN[2], GREEN[2], t),
      lerp(0.35, 1, t),
    ]
  }
  const t = (u - 0.5) * 2
  return [lerp(GREEN[0], MINT[0], t), lerp(GREEN[1], MINT[1], t), lerp(GREEN[2], MINT[2], t), 1]
}

// Retorna posição 0..1 ao longo do arco, ou -1 se fora dele
function arcSample(x, y) {
  const dx = x - ARC_CX
  const dy = y - ARC_CY
  const d = Math.hypot(dx, dy)
  const a = mod2pi(Math.atan2(dy, dx) - ARC_START)
  if (a <= ARC_SWEEP && Math.abs(d - ARC_R) <= ARC_HW) return a / ARC_SWEEP
  if (Math.hypot(x - P1[0], y - P1[1]) <= ARC_HW) return 0
  if (Math.hypot(x - P2[0], y - P2[1]) <= ARC_HW) return 1
  return -1
}

// Guia tracejada (largura 2, traço 2 / espaço 4, pontas arredondadas)
function guideHit(x, y) {
  const dx = x - ARC_CX
  const dy = y - ARC_CY
  if (Math.abs(Math.hypot(dx, dy) - ARC_R) > 1) return false
  const a = mod2pi(Math.atan2(dy, dx) - ARC_END)
  if (a > GUIDE_SWEEP) return false
  const m = (ARC_R * a) % 6 // traço de 2 seguido de gap de 4
  return m < 2
}

// ---- Utilidades geométricas ----
function segDist2(x, y, ax, ay, bx, by) {
  const vx = bx - ax
  const vy = by - ay
  const wx = x - ax
  const wy = y - ay
  const len2 = vx * vx + vy * vy
  let t = len2 === 0 ? 0 : (wx * vx + wy * vy) / len2
  t = t < 0 ? 0 : t > 1 ? 1 : t
  const px = ax + vx * t - x
  const py = ay + vy * t - y
  return px * px + py * py
}

function polyDist(x, y, pts, closed) {
  let best = Infinity
  const n = pts.length
  const last = closed ? n : n - 1
  for (let i = 0; i < last; i++) {
    const a = pts[i]
    const b = pts[(i + 1) % n]
    const d2 = segDist2(x, y, a[0], a[1], b[0], b[1])
    if (d2 < best) best = d2
  }
  return Math.sqrt(best)
}

// ---- Camadas (composição "over" com cor pré-multiplicada, 0..1) ----
function over(d, r, g, b, a) {
  const ia = 1 - a
  d[0] = r * K * a + d[0] * ia
  d[1] = g * K * a + d[1] * ia
  d[2] = b * K * a + d[2] * ia
  d[3] = a + d[3] * ia
}

// Nó de marco: preenchido com contorno branco (stroke centrado na borda)
function drawNode(d, x, y, cx, cy, r, dotR) {
  const dist = Math.hypot(x - cx, y - cy)
  if (dist > r + 0.75) return
  if (dist <= dotR) over(d, 255, 255, 255, 1)
  else if (dist <= r - 0.75) over(d, GREEN[0], GREEN[1], GREEN[2], 1)
  else over(d, 255, 255, 255, 1)
}

// Escudo: Bézier achatada em segmentos
const SHIELD = (() => {
  const pts = [
    [32, 15],
    [43, 21],
    [43, 34],
  ]
  const bez = (p0, p1, p2, p3, n = 24) => {
    for (let i = 1; i <= n; i++) {
      const t = i / n
      const u = 1 - t
      const x =
        u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0]
      const y =
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]
      pts.push([x, y])
    }
  }
  bez([43, 34], [43, 41.5], [38, 46.5], [32, 49])
  bez([32, 49], [26, 46.5], [21, 41.5], [21, 34])
  pts.push([21, 21])
  return pts
})()

function shieldSample(d, x, y) {
  if (x < 20 || x > 44 || y < 14 || y > 50) return
  let inside = false
  const n = SHIELD.length
  for (let i = 0; i < n; i++) {
    const a = SHIELD[i]
    const b = SHIELD[(i + 1) % n]
    if (a[1] > y !== b[1] > y && x < ((b[0] - a[0]) * (y - a[1])) / (b[1] - a[1]) + a[0])
      inside = !inside
  }
  if (inside) over(d, 255, 255, 255, 1)
  if (polyDist(x, y, SHIELD, true) <= 0.75)
    over(d, SHIELD_STROKE[0], SHIELD_STROKE[1], SHIELD_STROKE[2], 0.35)
}

// Barras arredondadas com gradiente diagonal
const BARS = [
  { x: 25.5, y: 32, h: 7.5, op: 0.55 },
  { x: 30.4, y: 28, h: 11.5, op: 0.85 },
  { x: 35.3, y: 23.5, h: 16, op: 1 },
]
const BAR_W = 3.2
const BAR_RX = 1.2

function barSample(d, x, y, bar) {
  const x0 = bar.x
  const y0 = bar.y
  if (x < x0 || x > x0 + BAR_W || y < y0 || y > y0 + bar.h) return
  const cxl = Math.min(Math.max(x, x0 + BAR_RX), x0 + BAR_W - BAR_RX)
  const cyl = Math.min(Math.max(y, y0 + BAR_RX), y0 + bar.h - BAR_RX)
  if (Math.hypot(x - cxl, y - cyl) > BAR_RX) return
  const t = ((x - x0) / BAR_W + (y - y0) / bar.h) / 2
  over(
    d,
    lerp(GREEN_LIGHT[0], GREEN_DARK[0], t),
    lerp(GREEN_LIGHT[1], GREEN_DARK[1], t),
    lerp(GREEN_LIGHT[2], GREEN_DARK[2], t),
    bar.op,
  )
}

// Checkmark: traço branco grosso e traço verde fino por cima
const CHECK = [
  [26, 31],
  [31.5, 36.5],
  [44, 24],
]

function shade(d, x, y) {
  // Tudo fora do círculo de fundo (raio 30) fica transparente
  if (Math.hypot(x - 32, y - 32) > 30) return

  const t = clamp01((y - 2) / 60)
  over(
    d,
    lerp(BG_TOP[0], BG_BOTTOM[0], t),
    lerp(BG_TOP[1], BG_BOTTOM[1], t),
    lerp(BG_TOP[2], BG_BOTTOM[2], t),
    1,
  )

  const u = arcSample(x, y)
  if (u >= 0) {
    const c = arcColor(u)
    over(d, c[0], c[1], c[2], c[3])
  } else if (guideHit(x, y)) {
    over(d, 0, 0, 0, 0.08)
  }

  drawNode(d, x, y, 17, 20, 3, 1.2)
  drawNode(d, x, y, 47, 20, 3.5, 1.4)

  shieldSample(d, x, y)

  for (const bar of BARS) barSample(d, x, y, bar)

  if (x >= 25 && x <= 45 && y >= 23 && y <= 32) {
    const dc = polyDist(x, y, CHECK, false)
    if (dc <= 1.4) over(d, 255, 255, 255, 1)
    if (dc <= 0.8) over(d, GREEN[0], GREEN[1], GREEN[2], 1)
  }
}

function render(size) {
  const out = Buffer.alloc(size * size * 4)
  const acc = new Float64Array(4)
  const dst = new Float64Array(4)
  const scale = 64 / size
  const n = SS * SS
  for (let py = 0; py < size; py++) {
    for (let px = 0; px < size; px++) {
      acc.fill(0)
      for (let sy = 0; sy < SS; sy++) {
        for (let sx = 0; sx < SS; sx++) {
          const x = (px + (sx + 0.5) / SS) * scale
          const y = (py + (sy + 0.5) / SS) * scale
          dst.fill(0)
          shade(dst, x, y)
          acc[0] += dst[0]
          acc[1] += dst[1]
          acc[2] += dst[2]
          acc[3] += dst[3]
        }
      }
      const a = acc[3] / n
      const o = (py * size + px) * 4
      if (a > 0) {
        out[o] = Math.round(clamp01(acc[0] / n / a) * 255)
        out[o + 1] = Math.round(clamp01(acc[1] / n / a) * 255)
        out[o + 2] = Math.round(clamp01(acc[2] / n / a) * 255)
        out[o + 3] = Math.round(clamp01(a) * 255)
      }
    }
  }
  return out
}

// ---- Codificador PNG mínimo ----
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()

function crc32(buf) {
  let c = 0xffffffff
  for (const b of buf) c = CRC_TABLE[(c ^ b) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crc])
}

function encodePng(rgba, w, h) {
  const stride = w * 4
  const raw = Buffer.alloc((stride + 1) * h)
  for (let y = 0; y < h; y++) {
    raw[y * (stride + 1)] = 0 // filtro 0
    rgba.copy(raw, y * (stride + 1) + 1, y * stride, (y + 1) * stride)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8 // profundidade de bits
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0 // compressão
  ihdr[11] = 0 // filtro
  ihdr[12] = 0 // sem interlace
  const signature = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a])
  return Buffer.concat([
    signature,
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const targets = [
  { file: 'logo-1200.png', size: 1200 },
  { file: 'logo-512.png', size: 512 },
  { file: 'apple-touch-icon.png', size: 180 },
  { file: 'favicon-32.png', size: 32 },
]

mkdirSync(outDir, { recursive: true })

let logo1200 = null
for (const { file, size } of targets) {
  const png = encodePng(render(size), size, size)
  if (!png.subarray(0, 4).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47]))) {
    throw new Error(`assinatura PNG inválida em ${file}`)
  }
  writeFileSync(path.join(outDir, file), png)
  if (size === 1200) logo1200 = png
  console.log(`[logo] ${file}: ${size}x${size}, ${png.length} bytes`)
}

const b64 = logo1200.toString('base64') + '\n'
writeFileSync(b64Path, b64)
const decoded = Buffer.from(readFileSync(b64Path, 'utf8').trim(), 'base64')
if (decoded.length !== logo1200.length || !decoded.equals(logo1200)) {
  throw new Error('base64 não decodifica para o mesmo PNG')
}
console.log(`[logo] scripts/logo-1200.b64 OK (${decoded.length} bytes decodificados)`)
