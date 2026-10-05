// Pixel art for the terminal: the scene is drawn into a canvas of colors and
// packed into Raster cells, two pixels per cell with half blocks (▀: the top
// pixel is the foreground, the bottom one the background).
//
// All art is original: a round Claude-orange creature that hatches from an
// egg, grows feet, a sprout and at last a flower.
import type { ActivityKind, Skin, Stage } from '../types'
import type { Mood } from './pet'
import { speciesById } from './species'
import type { Species } from './species/types'


type Ink =
  | 'outline' | 'body' | 'light' | 'shade' | 'eye' | 'white' | 'blush'
  | 'leaf' | 'stem' | 'petal' | 'pollen' | 'red' | 'blue' | 'green' | 'gray'
  | 'ink' | 'paper' | 'cream' | 'spot' | 'poop' | 'poopDark'
  | 'sickBody' | 'sickLight' | 'sickShade' | 'ground'

type Palette = Record<Ink, number> & { bg: number | null }

const PALETTES: Record<Skin, Palette> = {
  color: {
    bg: null,
    outline: 0x3b2219,
    body: 0xd97757,
    light: 0xf2a582,
    shade: 0xb5573a,
    eye: 0x24160f,
    white: 0xffffff,
    blush: 0xf4858e,
    leaf: 0x6cc24a,
    stem: 0x3f8a2e,
    petal: 0xff8fb1,
    pollen: 0xffcc00,
    red: 0xff3b30,
    blue: 0x5ac8fa,
    green: 0x34c759,
    gray: 0x8e8e93,
    ink: 0x3a3a3c,
    paper: 0xf5f5f7,
    cream: 0xf5ead6,
    spot: 0xd97757,
    poop: 0x9a6a45,
    poopDark: 0x5e3a24,
    sickBody: 0xa3b86c,
    sickLight: 0xc4d690,
    sickShade: 0x7f9450,
    ground: 0x6e8f4e,
  },
  // A Tamagotchi screen: four greens, the background filled in.
  lcd: (() => {
    const bg = 0xc5cfa0
    const light = 0xa3b07e
    const mid = 0x6f7d55
    const dark = 0x27321f
    return {
      bg,
      outline: dark, body: light, light: bg, shade: mid, eye: dark, white: bg, blush: mid,
      leaf: mid, stem: dark, petal: mid, pollen: dark, red: dark, blue: mid, green: dark,
      gray: mid, ink: dark, paper: bg, cream: bg, spot: mid, poop: mid, poopDark: dark,
      sickBody: mid, sickLight: light, sickShade: dark, ground: mid,
    }
  })(),
}

export class Canvas {
  readonly px: Int32Array
  constructor(readonly w: number, readonly height: number) {
    this.px = new Int32Array(w * height).fill(-1)
  }
  get(x: number, y: number): number {
    if (x < 0 || y < 0 || x >= this.w || y >= this.height) return -1
    return this.px[y * this.w + x] ?? -1
  }
  set(x: number, y: number, c: number) {
    x = Math.round(x)
    y = Math.round(y)
    if (x < 0 || y < 0 || x >= this.w || y >= this.height) return
    this.px[y * this.w + x] = c
  }
}

/** Stamps a bitmap: each letter names an ink in `key`, '.' is clear. */
function stamp(c: Canvas, x: number, y: number, rows: readonly string[], key: Record<string, number>, flip = false) {
  rows.forEach((row, dy) => {
    for (let dx = 0; dx < row.length; dx++) {
      const ch = row[flip ? row.length - 1 - dx : dx]
      if (ch === undefined || ch === '.') continue
      const color = key[ch]
      if (color !== undefined) c.set(x + dx, y + dy, color)
    }
  })
}

// ---- Icons for the speech bubble, 7×7 ----

export type Icon =
  | 'think' | 'read' | 'write' | 'run' | 'web' | 'plan' | 'agent' | 'work'
  | 'done' | 'alert' | 'heart' | 'berry' | 'star' | 'sick'

const ICONS: Record<Exclude<Icon, 'think'>, readonly string[]> = {
  read: ['.kkk...', 'k...k..', 'k.w.k..', 'k...k..', '.kkkk..', '....kk.', '.....kk'],
  write: ['.....rr', '....yrr', '...yyk.', '..yyk..', '.yyk...', 'kkk....', 'k......'],
  run: ['kkkkkkk', 'kkkkkkk', 'kgkkkkk', 'kkgkkkk', 'kgkkkkk', 'kkkkggk', 'kkkkkkk'],
  web: ['..bbb..', '.bgbgb.', 'bbgbbgb', 'bgggggb', 'bbgbbgb', '.bgbgb.', '..bbb..'],
  plan: ['g.kkkk.', '.......', 'g.kkkk.', '.......', 'k.kkk..', '.......', 'k.kkkk.'],
  agent: ['.......', '..ooo..', '.obbbo.', '.ok.ko.', '.obbbo.', '..o.o..', '.......'],
  work: ['...k...', '.k.k.k.', '..kkk..', 'kkk.kkk', '..kkk..', '.k.k.k.', '...k...'],
  done: ['.......', '......g', '.....gg', 'g...gg.', 'gg.gg..', '.ggg...', '..g....'],
  alert: ['..ww...', '..ww...', '..ww...', '..ww...', '.......', '..ww...', '.......'],
  heart: ['.rr.rr.', 'rrrrrrr', 'rrrrrrr', 'rrrrrrr', '.rrrrr.', '..rrr..', '...r...'],
  berry: ['...l...', '..ll...', '.rrrr..', 'rrwrrr.', 'rrrrrr.', 'rrrrrr.', '.rrrr..'],
  star: ['...y...', '...y...', 'yyyyyyy', '.yyyyy.', '..yyy..', '.yy.yy.', 'y.....y'],
  sick: ['.......', '.kk.kk.', '..k.k..', '.......', '.kkkkk.', 'k.....k', '.......'],
}

export function iconFor(kind: ActivityKind): Icon | null {
  switch (kind) {
    case 'thinking':
      return 'think'
    case 'reading':
    case 'searching':
      return 'read'
    case 'writing':
      return 'write'
    case 'running':
      return 'run'
    case 'browsing':
      return 'web'
    case 'planning':
      return 'plan'
    case 'delegating':
      return 'agent'
    case 'working':
      return 'work'
    case 'asking':
    case 'approving':
      return 'alert'
    default:
      return null
  }
}

function iconKey(p: Palette): Record<string, number> {
  return { k: p.ink, w: p.white, r: p.red, y: p.pollen, g: p.green, b: p.blue, l: p.stem, o: p.outline }
}

function drawIcon(c: Canvas, x: number, y: number, icon: Icon, p: Palette, tick: number) {
  if (icon === 'think') {
    // Three dots filling in one by one
    const n = Math.floor(tick / 3) % 4
    for (let i = 0; i < 3; i++) {
      const on = i < n
      c.set(x + 1 + i * 2, y + 4, on ? p.ink : p.gray)
    }
    return
  }
  const key = iconKey(p)
  // The agent icon's face is the pet's own
  if (icon === 'agent') key.b = p.body
  stamp(c, x, y, ICONS[icon], key)
}

/** A rounded speech bubble 11×10 with a tail pointing down-left or down-right. */
function drawBubble(c: Canvas, x: number, y: number, tailLeft: boolean, edge: number, fill: number) {
  const w = 11
  const height = 9
  for (let dy = 0; dy < height; dy++) {
    for (let dx = 0; dx < w; dx++) {
      const corner = (dx === 0 || dx === w - 1) && (dy === 0 || dy === height - 1)
      if (corner) continue
      const border = dx === 0 || dy === 0 || dx === w - 1 || dy === height - 1
      c.set(x + dx, y + dy, border ? edge : fill)
    }
  }
  const tx = tailLeft ? x + 2 : x + w - 3
  c.set(tx, y + height - 1, fill)
  c.set(tx + (tailLeft ? 1 : -1), y + height - 1, fill)
  c.set(tx - (tailLeft ? 1 : -1), y + height - 1, edge)
  c.set(tx - (tailLeft ? 1 : -1), y + height, edge)
  c.set(tx - (tailLeft ? 2 : -2), y + height + 1, edge)
  c.set(tx, y + height, edge)
}

// ---- The creature ----

type Shape = { rx: number; ry: number; feet: boolean; top: 'none' | 'sprout' | 'flower'; eye: 1 | 2 }

const SHAPES: Record<Exclude<Stage, 'egg'>, Shape> = {
  baby: { rx: 5, ry: 4.2, feet: false, top: 'none', eye: 2 },
  child: { rx: 5.3, ry: 4.4, feet: true, top: 'none', eye: 2 },
  teen: { rx: 6.2, ry: 5, feet: true, top: 'sprout', eye: 2 },
  adult: { rx: 7, ry: 4.9, feet: true, top: 'flower', eye: 2 },
}

/** Pixels from the ground to the top of the pet: what a scene must fit. */
export function heightOf(stage: Stage, species = 'mochi'): number {
  if (stage === 'egg') return 11
  const sp = speciesById(species)
  if (sp !== undefined) return sp.stages[stage].body.length
  const s = SHAPES[stage]
  return Math.ceil(s.ry * 2) + (s.feet ? 2 : 0) + (s.top === 'flower' ? 4 : s.top === 'sprout' ? 3 : 0)
}

export type Pose = {
  stage: Stage
  mood: Mood
  tick: number
  /** Center x in pixels; feet stand on `ground`. */
  x: number
  ground: number
  /** Pixels off the ground. */
  lift: number
  facing: 'left' | 'right'
  isWalking: boolean
  isEating: boolean
  /** XP toward hatching, for the egg's cracks. */
  xp: number
  /** White flash while evolving. */
  isFlashing: boolean
  /** Which species draws it: `mochi` (drawn in code) or one of hooks/species. */
  species: string
}

/** Draws the pet; returns its bounding box for the bubble and the effects. */
function drawPet(c: Canvas, pose: Pose, p: Palette): { left: number; right: number; top: number; headY: number } {
  const { stage, mood, tick } = pose
  if (stage === 'egg') return drawEgg(c, pose, p)
  const sp = speciesById(pose.species)
  if (sp !== undefined) return drawSpecies(c, sp, pose, p)

  const shape = SHAPES[stage]
  const sick = mood === 'sick'
  const body = pose.isFlashing && tick % 2 === 0 ? p.white : sick ? p.sickBody : p.body
  const light = pose.isFlashing && tick % 2 === 0 ? p.white : sick ? p.sickLight : p.light
  const shade = pose.isFlashing && tick % 2 === 0 ? p.paper : sick ? p.sickShade : p.shade

  // Breathing, squash on landing, flatter asleep
  let rx = shape.rx
  let ry = shape.ry
  const breathe = Math.floor(tick / 5) % 2 === 1
  if (mood === 'sleep') {
    rx *= 1.1
    ry *= 0.85
  } else if (pose.lift === 0 && breathe && !pose.isWalking) {
    rx += 0.25
    ry -= 0.3
  }

  const feetH = shape.feet ? 2 : 0
  const cx = pose.x
  const bottom = pose.ground - feetH - pose.lift
  const cy = bottom - ry + 0.5

  // Feet first, so the body overlaps them; walking lifts one at a time
  if (shape.feet) {
    const step = pose.isWalking ? Math.floor(tick / 2) % 2 : -1
    for (const [i, fx] of [cx - rx * 0.45, cx + rx * 0.45].entries()) {
      const up = step === i ? 1 : 0
      const fy = pose.ground - pose.lift - 1 - up
      const x0 = Math.round(fx) - 1
      c.set(x0, fy, shade)
      c.set(x0 + 1, fy, shade)
      c.set(x0 + 2, fy, shade)
      c.set(x0, fy + 1, p.outline)
      c.set(x0 + 1, fy + 1, p.outline)
      c.set(x0 + 2, fy + 1, p.outline)
      c.set(x0 - 1, fy, p.outline)
      c.set(x0 + 3, fy, p.outline)
    }
  }

  // The body: an ellipse, outlined, lit from the upper left
  const inside = (x: number, y: number) => {
    const nx = (x + 0.5 - cx) / rx
    const ny = (y + 0.5 - cy) / ry
    return nx * nx + ny * ny <= 1
  }
  let top = Infinity
  let left = Infinity
  let right = -Infinity
  for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry) + 1; y++) {
    for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
      if (!inside(x, y)) continue
      top = Math.min(top, y)
      left = Math.min(left, x)
      right = Math.max(right, x)
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)
      if (edge) {
        c.set(x, y, p.outline)
        continue
      }
      const nx = (x + 0.5 - cx) / rx
      const ny = (y + 0.5 - cy) / ry
      const d = nx * nx + ny * ny
      const lit = -nx * 0.6 - ny * 0.8
      c.set(x, y, d > 0.45 && lit > 0.45 ? light : d > 0.5 && lit < -0.5 ? shade : body)
    }
  }
  // A glint on the upper left
  c.set(cx - rx * 0.5, cy - ry * 0.55, p.white)

  // Top: a sprout or a flower that sways
  const sway = Math.floor(tick / 6) % 2 === 0 ? 0 : 1
  const tx = Math.round(cx) - 2
  if (shape.top === 'sprout') {
    stamp(c, tx + sway, top - 3, ['ll.ll', '.lsl.'], { l: p.leaf, s: p.stem })
    c.set(tx + 2, top - 1, p.stem)
    top -= 3
  } else if (shape.top === 'flower') {
    stamp(c, tx + sway, top - 4, ['.p.p.', 'ppypp', '.psp.'], { p: p.petal, y: p.pollen, s: p.stem })
    c.set(tx + 2, top - 1, p.stem)
    c.set(tx + 1, top - 1, p.leaf)
    top -= 4
  }

  // Look the way it walks
  const look = pose.isWalking ? (pose.facing === 'left' ? -1 : 1) : 0
  const ey = Math.round(cy - ry * 0.15)
  const exL = Math.round(cx - rx * 0.4) + look
  const exR = Math.round(cx + rx * 0.4) - 1 + look
  // Overlays land only on the body, never past the outline
  const onBody = (x: number, y: number) => {
    const under = c.get(x, y)
    return under !== -1 && under !== p.outline
  }
  drawFace(c, [[exL, ey], [exR, ey]], [Math.round(cx) - 1 + look, ey + 3], pose, p, onBody)
  return { left, right, top, headY: Math.round(cy - ry * 0.4) }
}

/** Eyes (2×2, top-left anchors), blush and mouth for the mood, drawn where `canDraw` allows. */
function drawFace(
  c: Canvas,
  eyes: readonly (readonly [number, number])[],
  mouth: readonly [number, number],
  pose: Pose,
  p: Palette,
  canDraw: (x: number, y: number) => boolean,
) {
  const { mood, tick } = pose
  const blink = mood !== 'sleep' && tick % 25 === 24
  const on = (x: number, y: number, color: number) => {
    x = Math.round(x)
    y = Math.round(y)
    if (canDraw(x, y)) c.set(x, y, color)
  }
  const ey = eyes[0]?.[1] ?? 0

  for (const [ex, ey] of eyes) {
    if (mood === 'sleep' || blink) {
      on(ex, ey + 1, p.eye)
      on(ex + 1, ey + 1, p.eye)
    } else if (mood === 'happy') {
      on(ex, ey + 1, p.eye)
      on(ex + 1, ey, p.eye)
      on(ex + 2, ey + 1, p.eye)
    } else if (mood === 'sick') {
      on(ex, ey, p.eye)
      on(ex + 1, ey + 1, p.eye)
      on(ex + 2, ey, p.eye)
    } else if (mood === 'focus') {
      // Half-closed, determined
      on(ex, ey, p.shade)
      on(ex + 1, ey, p.shade)
      on(ex, ey + 1, p.eye)
      on(ex + 1, ey + 1, p.eye)
    } else {
      on(ex, ey, p.white)
      on(ex, ey + 1, p.eye)
      on(ex + 1, ey, p.eye)
      on(ex + 1, ey + 1, p.eye)
      if (mood === 'sad') on(ex, ey + 2, p.blue)
    }
  }

  // Blush when content
  if (mood === 'happy' || mood === 'normal' || mood === 'focus') {
    const first = eyes[0]
    const last = eyes[eyes.length - 1]
    if (first !== undefined) on(first[0] - 1, ey + 2, p.blush)
    if (last !== undefined) on(last[0] + 2, ey + 2, p.blush)
  }

  const [mx, my] = mouth
  if (pose.isEating) {
    const open = Math.floor(tick / 2) % 2 === 0
    on(mx, my, p.eye)
    on(mx + 1, my, p.eye)
    if (open) {
      on(mx, my + 1, p.red)
      on(mx + 1, my + 1, p.eye)
    }
  } else if (mood === 'happy') {
    on(mx - 1, my, p.eye)
    on(mx, my + 1, p.eye)
    on(mx + 1, my + 1, p.eye)
    on(mx + 2, my, p.eye)
  } else if (mood === 'sad' || mood === 'sick') {
    on(mx - 1, my + 1, p.eye)
    on(mx, my, p.eye)
    on(mx + 1, my, p.eye)
    on(mx + 2, my + 1, p.eye)
  } else if (mood === 'hungry') {
    on(mx, my, p.eye)
    on(mx + 1, my, p.eye)
    on(mx, my + 1, p.eye)
    on(mx + 1, my + 1, p.eye)
  } else if (mood === 'sleep') {
    on(mx + 1, my, p.eye)
  } else {
    on(mx, my, p.eye)
    on(mx + 1, my, p.eye)
  }
}

const SICK = 0x9db86c

function mix(a: number, b: number, t: number): number {
  const ch = (n: number, k: number) => (n >> k) & 255
  const m = (k: number) => Math.round(ch(a, k) * (1 - t) + ch(b, k) * t) << k
  return m(16) | m(8) | m(0)
}

/** A species color as the skin shows it: as is, or one of the LCD's greens by brightness. */
function shown(color: number, p: Palette): number {
  if (p.bg === null) return color
  const lum = 0.299 * ((color >> 16) & 255) + 0.587 * ((color >> 8) & 255) + 0.114 * (color & 255)
  return lum < 70 ? p.outline : lum < 140 ? p.shade : lum < 205 ? p.body : p.light
}

/** A bitmap species: mirrored when facing left, its alt frame for breathing and steps. */
function drawSpecies(c: Canvas, sp: Species, pose: Pose, p: Palette) {
  const { tick, mood } = pose
  if (pose.stage === 'egg') return drawEgg(c, pose, p)
  const st = sp.stages[pose.stage]
  const useAlt =
    st.alt !== undefined && mood !== 'sleep' && (pose.isWalking ? Math.floor(tick / 2) % 2 === 1 : Math.floor(tick / 5) % 2 === 1)
  const rows = useAlt && st.alt !== undefined ? st.alt : st.body
  const height = rows.length
  const w = rows[0]?.length ?? 0
  const flip = pose.facing === 'left'
  const left = Math.round(pose.x - w / 2)
  const top = pose.ground - pose.lift - height + 1
  const flash = pose.isFlashing && tick % 2 === 0
  const letterAt = (bx: number, by: number) => rows[by]?.[flip ? w - 1 - bx : bx]

  for (let by = 0; by < height; by++) {
    for (let bx = 0; bx < w; bx++) {
      const l = letterAt(bx, by)
      if (l === undefined || l === '.') continue
      const raw = sp.colors[l]
      if (raw === undefined) continue
      const color = flash ? p.white : shown(mood === 'sick' ? mix(raw, SICK, 0.45) : raw, p)
      c.set(left + bx, top + by, color)
    }
  }

  const mirror = (x: number) => (flip ? w - 2 - x : x)
  const eyes = st.eyes.map(([x, y]) => [left + mirror(x), top + y] as const)
  const mouth = [left + mirror(st.mouth[0]), top + st.mouth[1]] as const
  const onFace = (x: number, y: number) => {
    const l = letterAt(x - left, y - top)
    return l !== undefined && l !== '.' && sp.face.includes(l)
  }
  drawFace(c, eyes, mouth, pose, p, onFace)
  return { left, right: left + w - 1, top, headY: top + 2 }
}

function drawEgg(c: Canvas, pose: Pose, p: Palette) {
  // A wobble now and then
  const phase = pose.tick % 30
  const wob = phase < 8 ? [0, 1, 0, -1, 0, 1, 0, -1][phase] ?? 0 : 0
  const cx = pose.x + wob
  const rx = 5
  const ry = 6.2
  const cy = pose.ground - ry * 0.85 + 0.5
  // Narrower toward the top: an egg, not an ellipse
  const inside = (x: number, y: number) => {
    const ny = (y + 0.5 - cy) / ry
    const nx = (x + 0.5 - cx) / (rx * (ny < 0 ? 1 + ny * 0.35 : 1))
    return nx * nx + ny * ny * (ny > 0 ? 1.4 : 1) <= 1
  }
  let top = Infinity
  let left = Infinity
  let right = -Infinity
  for (let y = Math.floor(cy - ry) - 1; y <= Math.ceil(cy + ry); y++) {
    for (let x = Math.floor(cx - rx) - 1; x <= Math.ceil(cx + rx) + 1; x++) {
      if (!inside(x, y)) continue
      top = Math.min(top, y)
      left = Math.min(left, x)
      right = Math.max(right, x)
      const edge = !inside(x - 1, y) || !inside(x + 1, y) || !inside(x, y - 1) || !inside(x, y + 1)
      const lit = -(x + 0.5 - cx) / rx - (y + 0.5 - cy) / ry
      c.set(x, y, edge ? p.outline : lit < -0.9 ? p.shade : p.cream)
    }
  }
  const sx = Math.round(cx)
  const sy = Math.round(cy)
  for (const [dx, dy] of [[-2, -1], [-1, -1], [-2, 0], [1, 2], [2, 2], [2, 1], [1, -3], [-1, 3]] as const) {
    if (c.get(sx + dx, sy + dy) === p.cream) c.set(sx + dx, sy + dy, p.spot)
  }
  c.set(sx - 2, sy - 4, p.white)
  c.set(sx - 3, sy - 3, p.white)
  if (pose.xp >= 6) {
    // A crack across the middle, longer as it nears hatching
    // A zigzag crack, longer as it nears hatching
    const len = pose.xp >= 8 ? 4 : 2
    for (let i = -len; i <= len; i++) {
      const y = sy - 2 + (Math.abs(i) % 2)
      if (c.get(sx + i, y) !== -1 && c.get(sx + i, y) !== p.outline) c.set(sx + i, y, p.outline)
    }
  }
  return { left, right, top, headY: sy - 2 }
}

// ---- The scene ----

export type Scene = Pose & {
  skin: Skin
  poop: number
  /** What the bubble shows; null for no bubble. */
  icon: Icon | null
  isAlert: boolean
  /** Subagents running: a mini pet each, hopping by the pet. */
  agents: number
  isSweating: boolean
  /** Draw a ground line (the pane does, the band does not). */
  hasGround: boolean
}

export function render(w: number, height: number, s: Scene): Canvas {
  const p = PALETTES[s.skin]
  const c = new Canvas(w, height)
  if (p.bg !== null) c.px.fill(p.bg)

  if (s.hasGround) {
    for (let x = 0; x < w; x++) {
      c.set(x, height - 1, p.ground)
      if ((x * 7 + 3) % 11 === 0) c.set(x, height - 2, p.leaf)
    }
  }

  // Poop piles from the right edge, stink lines wavering
  for (let i = 0; i < s.poop; i++) {
    const x = w - 8 - i * 7
    if (x < 0) break
    stamp(c, x, s.ground - 3, ['..p..', '.ppd.', 'pdppp'], { p: p.poop, d: p.poopDark })
    const wave = Math.floor(s.tick / 3 + i) % 2
    c.set(x + 1 + wave, s.ground - 5, p.gray)
    c.set(x + 2 - wave, s.ground - 6, p.gray)
    c.set(x + 3 + wave, s.ground - 7, p.gray)
  }

  // Subagents: mini pets hopping on the far side
  for (let i = 0; i < Math.min(s.agents, 4); i++) {
    const side = s.x > w / 2 ? -1 : 1
    const ax = Math.round(s.x + side * (11 + i * 5))
    const hop = Math.floor(s.tick / 2 + i) % 3 === 0 ? 1 : 0
    stamp(c, ax - 1, s.ground - 3 - hop, ['.ooo.', 'obbbo', 'oekeo', '.ooo.'], {
      o: p.outline, b: p.light, e: p.body, k: p.eye,
    })
  }

  const box = drawPet(c, s, p)

  const asleep = s.mood === 'sleep'
  // Asleep, the pet shows only its Zs; a call for the person still gets through
  const icon = asleep && !s.isAlert ? null : s.icon
  const bw = 11
  const bubbleRight = box.right + 2 + bw <= w
  const showBubble = icon !== null && (!s.isAlert || s.tick % 4 < 3)

  // Sleep: Zs drifting up from the head, on the side the bubble does not take
  if (asleep) {
    const t = s.tick % 16
    const zRight = icon === null || !bubbleRight
    const drift = Math.floor(t / 6)
    const zx = zRight ? box.right + 1 + drift : box.left - 5 - drift
    const zy = Math.max(0, box.top + 1 - Math.floor(t / 4))
    stamp(c, zx, zy, ['zzzz', '..z.', '.z..', 'zzzz'], { z: p.gray })
    if (t > 8) stamp(c, zRight ? zx + 4 : zx - 3, zy - 4, ['zzz', '..z', '.z.', 'zzz'], { z: p.gray })
  }

  if (s.isSweating && !asleep) {
    // On the head's side away from the bubble
    const sx = icon !== null && bubbleRight ? box.left : box.right - 1
    stamp(c, sx, box.top, ['.b', 'bb', 'bb'], { b: p.blue })
  }

  // The bubble: right of the head where it fits, else left
  if (showBubble && icon !== null) {
    const bx = bubbleRight ? box.right + 2 : Math.max(0, box.left - 2 - bw)
    const by = Math.max(0, Math.min(box.top - 4, height - 12))
    drawBubble(c, bx, by, bubbleRight, s.isAlert ? p.red : p.ink, s.isAlert ? p.red : p.paper)
    drawIcon(c, bx + 2, by + 1, icon, p, s.tick)
  }
  return c
}

const DEFAULT = 0x01000000
const UPPER = 0x2580
const LOWER = 0x2584

/** Packs the canvas into RasterProps `cells`: `w` columns, `ceil(height/2)` rows. */
export function toCells(c: Canvas): string {
  const rows = Math.ceil(c.height / 2)
  const words = new Uint32Array(c.w * rows * 3)
  let i = 0
  for (let r = 0; r < rows; r++) {
    for (let x = 0; x < c.w; x++) {
      const top = c.get(x, r * 2)
      const bottom = c.get(x, r * 2 + 1)
      if (top === -1 && bottom === -1) {
        words[i++] = 0x20
        words[i++] = DEFAULT
        words[i++] = DEFAULT
      } else if (top === -1) {
        words[i++] = LOWER
        words[i++] = bottom
        words[i++] = DEFAULT
      } else {
        words[i++] = UPPER
        words[i++] = top
        words[i++] = bottom === -1 ? DEFAULT : bottom
      }
    }
  }
  const bytes = new Uint8Array(words.buffer)
  let text = ''
  for (let k = 0; k < bytes.length; k += 0x8000) {
    text += String.fromCharCode(...bytes.subarray(k, k + 0x8000))
  }
  return btoa(text)
}
