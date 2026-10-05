// Renders a species to a PNG contact sheet, so a design can be looked at
// before it is wired in: one row per stage, one column per mood and action,
// the last column in the LCD skin.
//
//   npx -y tsx scripts/preview.ts <species-id|mochi> [out.png]
//   npx -y tsx scripts/preview.ts all          # docs/species/<id>.png for each
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname } from 'node:path'

import { type Scene, render } from '../hooks/pixels'
import { SPECIES } from '../hooks/species'

const W = 36
const H = 18
const Z = 8
const GAP = 2

const STAGES = ['egg', 'baby', 'child', 'teen', 'adult'] as const
const COLUMNS: { label: string; over: Partial<Scene> }[] = [
  { label: 'normal', over: {} },
  { label: 'happy', over: { mood: 'happy', icon: 'heart' } },
  { label: 'focus', over: { mood: 'focus', icon: 'write', tick: 5 } },
  { label: 'walk', over: { isWalking: true, facing: 'left', tick: 2 } },
  { label: 'sleep', over: { mood: 'sleep', tick: 4 } },
  { label: 'sick', over: { mood: 'sick', poop: 1 } },
  { label: 'eat', over: { isEating: true, mood: 'happy', icon: 'berry' } },
  { label: 'lcd', over: { skin: 'lcd', hasGround: true, ground: H - 2 } },
]

function sheet(species: string, out: string) {
  const base: Scene = {
    stage: 'baby', mood: 'normal', tick: 0, x: 11, ground: H - 1, lift: 0, facing: 'right',
    isWalking: false, isEating: false, xp: 8, isFlashing: false, species, skin: 'color', poop: 0,
    icon: null, isAlert: false, agents: 0, isSweating: false, hasGround: false,
  }
  const IW = COLUMNS.length * (W + GAP) * Z
  const IH = STAGES.length * (H + GAP) * Z
  const img = Buffer.alloc(IW * IH * 3)
  for (let i = 0; i < IW * IH; i++) img.set([30, 30, 34], i * 3)
  STAGES.forEach((stage, row) => {
    COLUMNS.forEach(({ over }, col) => {
      const c = render(W, H, { ...base, stage, ...over })
      const ox = col * (W + GAP)
      const oy = row * (H + GAP)
      for (let y = 0; y < H; y++) {
        for (let x = 0; x < W; x++) {
          let v = c.get(x, y)
          if (v === -1) v = (x + y) % 2 ? 0x26262a : 0x2c2c30
          for (let dy = 0; dy < Z; dy++) {
            for (let dx = 0; dx < Z; dx++) {
              const p = (((oy + y) * Z + dy) * IW + (ox + x) * Z + dx) * 3
              img.set([(v >> 16) & 255, (v >> 8) & 255, v & 255], p)
            }
          }
        }
      }
    })
  })
  mkdirSync(dirname(out), { recursive: true })
  writeFileSync(out, png(IW, IH, img))
  console.log(`${species} → ${out}  (rows: ${STAGES.join(', ')}; columns: ${COLUMNS.map(c => c.label).join(', ')})`)
}

function png(w: number, h: number, rgb: Buffer): Buffer {
  const raw = Buffer.alloc((w * 3 + 1) * h)
  for (let y = 0; y < h; y++) rgb.copy(raw, y * (w * 3 + 1) + 1, y * w * 3, (y + 1) * w * 3)
  const table = Array.from({ length: 256 }, (_, n) => {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    return c >>> 0
  })
  const crc = (b: Buffer) => {
    let c = 0xffffffff
    for (const x of b) c = table[(c ^ x) & 255]! ^ (c >>> 8)
    return (c ^ 0xffffffff) >>> 0
  }
  const chunk = (type: string, data: Buffer) => {
    const len = Buffer.alloc(4)
    len.writeUInt32BE(data.length)
    const body = Buffer.concat([Buffer.from(type), data])
    const sum = Buffer.alloc(4)
    sum.writeUInt32BE(crc(body))
    return Buffer.concat([len, body, sum])
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(w, 0)
  ihdr.writeUInt32BE(h, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  return Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw)),
    chunk('IEND', Buffer.alloc(0)),
  ])
}

const id = process.argv[2] ?? 'all'
if (id === 'all') for (const sp of ['mochi', ...SPECIES.map(s => s.id)]) sheet(sp, `docs/species/${sp}.png`)
else sheet(id, process.argv[3] ?? `docs/species/${id}.png`)
