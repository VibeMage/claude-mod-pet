// Pure pet logic: no `$`, so the tests can call it directly.
import type { Activity, ActivityKind, Pet, Stage } from '../types'
import { type Lang, type Line, TEXT } from './text'

export const MINUTE = 60_000

/** XP needed to reach each stage. */
const STAGES: readonly (readonly [Stage, number])[] = [
  ['egg', 0],
  ['baby', 10],
  ['child', 60],
  ['teen', 200],
  ['adult', 500],
]

export function stageOf(xp: number): Stage {
  let stage: Stage = 'egg'
  for (const [name, need] of STAGES) if (xp >= need) stage = name
  return stage
}

/** XP still needed for the next stage, or null at the last one. */
export function nextStageIn(xp: number): number | null {
  for (const [, need] of STAGES) if (xp < need) return need - xp
  return null
}

const clamp = (n: number) => Math.max(0, Math.min(100, n))

export function newPet(now: number, name = TEXT.zh.defaultName): Pet {
  return {
    name,
    bornAt: now,
    xp: 0,
    fullness: 80,
    happiness: 80,
    energy: 90,
    poop: 0,
    isAsleep: false,
    lastTickAt: now,
    toolsSeen: 0,
    turnsSeen: 0,
  }
}

/** Fills fields an older saved pet lacks. */
export function revive(saved: unknown, now: number, name?: string): Pet {
  if (saved === null || typeof saved !== 'object') return newPet(now, name)
  return { ...newPet(now, name), ...(saved as Partial<Pet>) }
}

/**
 * Time passing. Away from the keyboard decay is capped at 8 hours and never
 * drops a stat under 15, so coming back is never cruel.
 */
export function decay(pet: Pet, now: number, isOffline = false): Pet {
  const minutes = Math.max(0, (now - pet.lastTickAt) / MINUTE)
  if (minutes < 1) return pet
  const m = Math.min(minutes, 8 * 60)
  const floor = isOffline ? 15 : 0
  // Never below the floor, unless it already was.
  const keep = (was: number, n: number) => clamp(Math.max(n, Math.min(was, floor)))
  const egg = stageOf(pet.xp) === 'egg'
  const next: Pet = {
    ...pet,
    lastTickAt: now,
    fullness: egg ? pet.fullness : keep(pet.fullness, pet.fullness - m * 0.4),
    happiness: egg ? pet.happiness : keep(pet.happiness, pet.happiness - m * (pet.poop > 0 ? 0.5 : 0.25)),
    energy: pet.isAsleep ? clamp(pet.energy + m * 2) : keep(pet.energy, pet.energy - m * 0.2),
  }
  // Roughly one pile every 45 minutes awake, at most four.
  if (!egg && !pet.isAsleep) {
    const piles = Math.floor(m / 45) + (Math.random() < (m % 45) / 45 ? 1 : 0)
    next.poop = Math.min(4, pet.poop + piles)
  }
  if (next.isAsleep && next.energy >= 100) next.isAsleep = false
  return next
}

export type Care = 'feed' | 'play' | 'clean' | 'sleep'

/** What the person did, and which line the pet answers with (hooks/text.ts has the words). */
export function care(pet: Pet, what: Care): { pet: Pet; line: Line } {
  if (stageOf(pet.xp) === 'egg' && what !== 'clean') return { pet, line: 'egg' }
  if (pet.isAsleep && what !== 'sleep') return { pet, line: 'asleep' }
  switch (what) {
    case 'feed':
      if (pet.fullness >= 95) return { pet: { ...pet, happiness: clamp(pet.happiness - 3) }, line: 'full' }
      return { pet: { ...pet, fullness: clamp(pet.fullness + 25), happiness: clamp(pet.happiness + 3) }, line: 'fed' }
    case 'play':
      if (pet.energy < 15) return { pet, line: 'tired' }
      return {
        pet: {
          ...pet,
          happiness: clamp(pet.happiness + 20),
          energy: clamp(pet.energy - 10),
          fullness: clamp(pet.fullness - 5),
        },
        line: 'played',
      }
    case 'clean':
      if (pet.poop === 0) return { pet, line: 'clean' }
      return { pet: { ...pet, poop: 0, happiness: clamp(pet.happiness + 8) }, line: 'cleaned' }
    case 'sleep':
      return pet.isAsleep ? { pet: { ...pet, isAsleep: false }, line: 'wake' } : { pet: { ...pet, isAsleep: true }, line: 'night' }
  }
}

/** Claude used a tool: the pet learns by watching. */
export function onTool(pet: Pet): Pet {
  return { ...pet, xp: pet.xp + 1, toolsSeen: pet.toolsSeen + 1, energy: clamp(pet.energy - 0.3) }
}

/** A turn ended. */
export function onTurn(pet: Pet, reason: string): Pet {
  const turnsSeen = pet.turnsSeen + 1
  if (reason === 'answer') return { ...pet, turnsSeen, xp: pet.xp + 2, happiness: clamp(pet.happiness + 3) }
  if (reason === 'error' || reason === 'refusal') return { ...pet, turnsSeen, happiness: clamp(pet.happiness - 4) }
  return { ...pet, turnsSeen }
}

export function onToolError(pet: Pet): Pet {
  return { ...pet, happiness: clamp(pet.happiness - 1) }
}

export type Mood = 'happy' | 'normal' | 'sad' | 'sick' | 'sleep' | 'focus' | 'hungry'

export function moodOf(pet: Pet, activity: ActivityKind): Mood {
  if (pet.isAsleep) return 'sleep'
  if (pet.poop >= 3 || (pet.fullness < 15 && pet.happiness < 15)) return 'sick'
  if (pet.fullness < 25) return 'hungry'
  if (pet.happiness < 30 || pet.energy < 15) return 'sad'
  if (isBusy(activity)) return 'focus'
  if (pet.happiness >= 70) return 'happy'
  return 'normal'
}

export const isBusy = (kind: ActivityKind) =>
  kind !== 'idle' && kind !== 'done' && kind !== 'error'

export function describe(a: Activity, lang: Lang): string {
  const verb = TEXT[lang].verb[a.kind]
  return a.detail ? `${verb} ${a.detail}` : verb
}

/** Maps a tool call to what Claude is doing, from the tool name and its input. */
export function activityOf(tool: string, input: Record<string, unknown>): { kind: ActivityKind; detail: string } {
  const str = (k: string) => (typeof input[k] === 'string' ? (input[k] as string) : '')
  const base = (p: string) => p.split('/').filter(Boolean).pop() ?? p
  switch (tool) {
    case 'Read':
    case 'NotebookRead':
      return { kind: 'reading', detail: base(str('file_path') || str('notebook_path')) }
    case 'Grep':
    case 'Glob':
      return { kind: 'searching', detail: short(str('pattern'), 48) }
    case 'Edit':
    case 'MultiEdit':
    case 'Write':
    case 'NotebookEdit':
      return { kind: 'writing', detail: base(str('file_path') || str('notebook_path')) }
    case 'Bash':
      return { kind: 'running', detail: short(str('description') || str('command'), 72) }
    case 'Agent':
    case 'Task':
      return { kind: 'delegating', detail: short(str('description'), 60) }
    case 'WebFetch':
      return { kind: 'browsing', detail: hostOf(str('url')) }
    case 'WebSearch':
      return { kind: 'browsing', detail: short(str('query'), 60) }
    case 'AskUserQuestion':
      return { kind: 'asking', detail: '' }
    case 'ExitPlanMode':
      return { kind: 'approving', detail: '' }
    case 'TodoWrite':
    case 'TaskCreate':
    case 'TaskUpdate':
      return { kind: 'planning', detail: '' }
    default:
      return { kind: 'working', detail: tool.startsWith('mcp__') ? tool.split('__').slice(1).join('/') : tool }
  }
}

function hostOf(url: string): string {
  const m = /^https?:\/\/([^/]+)/.exec(url)
  return m?.[1] ?? short(url, 24)
}

export function short(s: string, n: number): string {
  const one = s.replace(/\s+/g, ' ').trim()
  return one.length > n ? one.slice(0, n - 1) + '…' : one
}

export function pick<T>(list: readonly T[]): T {
  return list[Math.floor(Math.random() * list.length)] as T
}

export function ageText(pet: Pet, now: number, lang: Lang): string {
  return TEXT[lang].age((now - pet.bornAt) / MINUTE)
}
