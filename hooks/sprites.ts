// Pixel-ish ASCII sprites. Every line of a sprite is padded to one width so
// the pet can bob left and right without the rest of the pane moving.
import type { Stage } from '../types'
import type { Mood } from './pet'

/** Eyes are three cells, mouths one. */
const EYES: Record<Mood, string> = {
  happy: '^ ^',
  normal: 'o o',
  sad: 'T T',
  sick: '@ @',
  sleep: '- -',
  focus: '• •',
  hungry: 'o o',
}

const MOUTH: Record<Mood, string> = {
  happy: 'w',
  normal: '_',
  sad: 'n',
  sick: '~',
  sleep: '.',
  focus: '-',
  hungry: 'O',
}

// `E` is replaced by the eyes, `M` by the mouth.
const BODIES: Record<Exclude<Stage, 'egg'>, readonly string[]> = {
  baby: [
    '           ',
    '   .---.   ',
    '  ( E )  ',
    '   ( M )   ',
    "   '---'   ",
  ],
  child: [
    '   /\\_/\\   ',
    '  ( E )  ',
    '  (  M  )  ',
    '  /|   |\\  ',
    '   ^^ ^^   ',
  ],
  teen: [
    '  ,/\\_/\\,  ',
    ' (  E  ) ',
    ' (   M   ) ',
    ' /|     |\\ ',
    '  (_| |_)  ',
  ],
  adult: [
    '   .-"""-.   ',
    '  /       \\  ',
    ' |   E   | ',
    '<|    M    |>',
    "  '-.___.-'  ",
  ],
}

const EGG: readonly (readonly string[])[] = [
  ['           ', '    .-.    ', '   /   \\   ', '  | . . |  ', "   '---'   "],
  ['           ', '    .-.    ', '   / ` \\   ', '  | .  .|  ', "   '---'   "],
]

const width = (lines: readonly string[]) => Math.max(...lines.map(l => l.length))

/**
 * The pet's lines for this frame: blinking every fourth frame, bobbing one
 * cell sideways on odd frames, a Z bubble while asleep.
 */
export function sprite(stage: Stage, mood: Mood, frame: number): string[] {
  let lines: string[]
  if (stage === 'egg') {
    lines = [...(EGG[frame % 2] ?? EGG[0]!)]
  } else {
    const blink = mood !== 'sleep' && frame % 4 === 3
    const eyes = blink ? '- -' : EYES[mood]
    lines = BODIES[stage].map(l => l.replace('E', eyes).replace('M', MOUTH[mood]))
  }
  const w = width(lines) + 1
  const shift = mood === 'sleep' || mood === 'sick' ? 0 : frame % 2
  lines = lines.map(l => (' '.repeat(shift) + l).padEnd(w + 1))
  // A row above the head for the Z bubble, blank while awake.
  const bubble = mood === 'sleep' ? (frame % 2 ? '        z Z' : '       Z z ') : ''
  return [bubble.padEnd(w + 1), ...lines]
}

/** The ground row: one `@` pile per poop, with a stink line above. */
export function ground(poop: number, frame: number): [string, string] {
  if (poop === 0) return ['', '']
  const stink = frame % 2 ? ' ~ ' : '~  '
  return [stink.repeat(poop), ' @ '.repeat(poop)]
}

/** A one-glyph face for the band and the status line. */
export function face(mood: Mood, frame: number): string {
  if (mood !== 'sleep' && frame % 4 === 3) return '(- -)'
  return `(${EYES[mood]})`
}

export function bar(value: number, cells = 8): string {
  const full = Math.round((Math.max(0, Math.min(100, value)) / 100) * cells)
  return '█'.repeat(full) + '░'.repeat(cells - full)
}
