export type Stage = 'egg' | 'baby' | 'child' | 'teen' | 'adult'

export type Pet = {
  name: string
  bornAt: number
  /** Experience: Claude's work feeds it, and it decides the stage. */
  xp: number
  /** 0..100 */
  fullness: number
  /** 0..100 */
  happiness: number
  /** 0..100 */
  energy: number
  /** Piles to clean, 0..4. */
  poop: number
  isAsleep: boolean
  /** Sick until it takes its medicine; cleaning alone does not cure it. */
  isSick: boolean
  /** When the person last woke it: it stays up a while before dozing off again. */
  wokeAt: number
  /** Last time decay was applied, ms since the epoch. */
  lastTickAt: number
  /** Counters for the pane's footer. */
  toolsSeen: number
  turnsSeen: number
}

export type ActivityKind =
  | 'idle'
  | 'thinking'
  | 'reading'
  | 'searching'
  | 'writing'
  | 'running'
  | 'delegating'
  | 'browsing'
  | 'planning'
  | 'working'
  | 'asking'
  | 'approving'
  | 'done'
  | 'error'

export type Activity = {
  kind: ActivityKind
  /** A short subject: a file name, a command, a URL host. */
  detail: string
  since: number
  /** Tool calls in the current turn. */
  turnTools: number
}

export type Skin = 'color' | 'lcd'

export type BandMode = 'full' | 'mini' | 'hidden'

/** Where the band goes: above the prompt, or under it in the hint line. */
export type Place = 'above' | 'below'

/** The pane's page: the pet, or its settings. */
export type View = 'pet' | 'settings'

/** The language as chosen; `auto` follows the setting and the locale. */
export type LangWanted = 'zh' | 'en' | 'auto'

export type LogEntry = { at: number; text: string }

declare module 'claude-code' {
  interface PluginState {
    'pixipet': {
      pet: Pet
      activity: Activity
      log: LogEntry[]
      /** A line the pet says, and when it stops saying it. */
      speech: { text: string; until: number } | null
      bandMode: BandMode
      place: Place
      skin: Skin
      /** Digits 1–4 in an empty prompt press the band's care buttons. */
      hasKeys: boolean
      /** The band's care buttons shown (the digit keys need them). */
      hasButtons: boolean
      /** A species id from hooks/species (`mallow` by default), or `mochi`. */
      species: string
      /** The language the pet speaks. */
      lang: 'zh' | 'en'
      langWanted: LangWanted
      view: View
      isConfirmingReset: boolean
    }
  }
}
