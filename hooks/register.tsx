import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Activity, BandMode, LangWanted, LogEntry, Pet, Place, Skin, View } from '../types'
import {
  type Care,
  activityOf,
  ageText,
  care,
  decay,
  describe,
  isBusy,
  moodOf,
  newPet,
  nextStageIn,
  onTool,
  onToolError,
  onTurn,
  pick,
  revive,
  short,
  stageOf,
} from './pet'
import { type Icon, type Scene, heightOf, iconFor, render, toCells } from './pixels'
import { SPECIES, speciesById } from './species'
import { bar, face, ground, sprite } from './sprites'
import { type Lang, TEXT, careLine, langOf } from './text'

const PANE = 'pet'
const STORE_KEY = 'pet'
const RASTER = 'scene'
const TICK_MS = 180

const IDLE: Activity = { kind: 'idle', detail: '', since: 0, turnTools: 0 }

const petAtom = atom({ plugin: 'pixipet', key: 'pet' } as const, newPet(0))
const activityAtom = atom({ plugin: 'pixipet', key: 'activity' } as const, IDLE)
const logAtom = atom({ plugin: 'pixipet', key: 'log' } as const, [] as LogEntry[])
const speechAtom = atom({ plugin: 'pixipet', key: 'speech' } as const, null)
const bandModeAtom = atom({ plugin: 'pixipet', key: 'bandMode' } as const, 'full' as BandMode)
const skinAtom = atom({ plugin: 'pixipet', key: 'skin' } as const, 'color' as Skin)
const hasKeysAtom = atom({ plugin: 'pixipet', key: 'hasKeys' } as const, true)
const DEFAULT_SPECIES = 'mallow'
const speciesAtom = atom({ plugin: 'pixipet', key: 'species' } as const, DEFAULT_SPECIES)
const langAtom = atom({ plugin: 'pixipet', key: 'lang' } as const, 'zh' as Lang)
const hasButtonsAtom = atom({ plugin: 'pixipet', key: 'hasButtons' } as const, true)
const placeAtom = atom({ plugin: 'pixipet', key: 'place' } as const, 'above' as Place)
const viewAtom = atom({ plugin: 'pixipet', key: 'view' } as const, 'pet' as View)
const isConfirmingResetAtom = atom({ plugin: 'pixipet', key: 'isConfirmingReset' } as const, false)
const langWantedAtom = atom({ plugin: 'pixipet', key: 'langWanted' } as const, 'auto' as LangWanted)

type Engine = EngineInterface

/** iOS system colours, light or dark with the Claude Code theme. */
type Palette = {
  pet: string; green: string; red: string; orange: string; teal: string; indigo: string; yellow: string; text: string; sub: string
  /** Soft backgrounds for the care buttons, one per action. */
  chip: Record<Care, string>
}

const CUPERTINO: Record<'light' | 'dark', Palette> = {
  light: {
    pet: '#d30f45', green: '#248a3d', red: '#d70015', orange: '#c93400', teal: '#0071a4', indigo: '#6155f5', yellow: '#b25000', text: '#1d1d1f', sub: '#6e6e73',
    chip: { feed: '#ffe0e6', play: '#dff3d8', clean: '#dbedfc', sleep: '#e7e4ff', heal: '#fff1cc' },
  },
  dark: {
    pet: '#ff375f', green: '#4ad968', red: '#ff666a', orange: '#ffa056', teal: '#00d2e0', indigo: '#6d7cff', yellow: '#ffd600', text: '#f5f5f7', sub: '#98989f',
    chip: { feed: '#4a2630', play: '#233f29', clean: '#1f3550', sleep: '#302b55', heal: '#4a3c18' },
  },
}

// Read once per load: the render hooks run often.
let cached: Palette | undefined

async function palette($: Engine): Promise<Palette> {
  if (cached !== undefined) return cached
  try {
    cached = String((await $.settings.read()).theme ?? 'dark').includes('light') ? CUPERTINO.light : CUPERTINO.dark
  } catch {
    cached = CUPERTINO.dark
  }
  return cached
}

// ---- The animation's own state: module variables, which a reload resets ----

/** What the scene draws from, kept in step with every write below. */
const snap = { pet: newPet(0), activity: IDLE, skin: 'color' as Skin, species: DEFAULT_SPECIES, lang: 'zh' as Lang }

/** The words in the pet's language. */
const tx = () => TEXT[snap.lang]

let tick = 0
/** Where the pet stands, 0 (left) to 1 (right) of whichever scene draws it. */
let pos = 0.2
let target = 0.2
let facing: 'left' | 'right' = 'right'

type Effect = 'hop' | 'eat' | 'heart' | 'done' | 'sweat' | 'flash' | 'star'
const effects = new Map<Effect, { start: number; until: number }>()
const HOP = [0, 1, 3, 4, 4, 3, 1, 0]

function play(effect: Effect, ticks: number) {
  effects.set(effect, { start: tick, until: tick + ticks })
}

function playing(effect: Effect) {
  const e = effects.get(effect)
  return e !== undefined && e.until > tick ? e : undefined
}

/** Tool calls waiting on the person (a question, a plan), and subagents running. */
const asking = new Set<string>()
const agents = new Set<string>()

/** The sites the scene is mounted in: the band's id and size, the pane's size. */
let band: { id: string; columns: number; rows: number } | null = null
let pane: { columns: number; rows: number } | null = null
const sent = new Map<string, string>()
let refusedAt = -Infinity

// ---- State writes ----

async function changePet($: Engine, fn: (pet: Pet) => Pet): Promise<Pet> {
  let after: Pet | undefined
  await update($, petAtom, pet => (after = fn(pet)))
  snap.pet = after!
  return after!
}

async function save($: Engine) {
  await $.store.set(STORE_KEY, await read($, petAtom))
}

/** Fills `{feed}`, `{play}`, `{clean}` and `{sleep}` with how to do that right now. */
async function hints($: Engine, text: string): Promise<string> {
  if (!text.includes('{')) return text
  const takesDigits =
    (await read($, bandModeAtom)) !== 'hidden' &&
    (await read($, placeAtom)) === 'above' &&
    (await read($, hasButtonsAtom)) &&
    (await read($, hasKeysAtom))
  const digits: Record<Care, string> = { feed: '1', play: '2', clean: '3', sleep: '4', heal: '5' }
  return text.replace(/\{(feed|play|clean|sleep|heal)\}/g, (_, what: Care) =>
    tx().how(takesDigits ? digits[what] : null, `/pet ${what}`),
  )
}

async function say($: Engine, text: string, seconds = 8) {
  text = await hints($, text)
  const now = await $.clock.now()
  await update($, speechAtom, () => ({ text, until: now + seconds * 1000 }))
}

async function log($: Engine, text: string) {
  const at = await $.clock.now()
  await update($, logAtom, list => [...list, { at, text }].slice(-30))
}

/**
 * The status line carries the pet only while the band is hidden: with the
 * band showing it would say the same thing twice.
 */
async function refreshStatus($: Engine) {
  if ((await read($, bandModeAtom)) !== 'hidden') {
    $.ui.status(undefined)
    return
  }
  const pet = snap.pet
  const t = tx()
  const mood = moodOf(pet, snap.activity.kind)
  const stats = `${t.short.fullness} ${Math.round(pet.fullness)} ${t.short.happiness} ${Math.round(pet.happiness)} ${t.short.energy} ${Math.round(pet.energy)}`
  $.ui.status(`${face(mood, 0)} ${pet.name} ${stats} · Claude ${describe(snap.activity, snap.lang)}`)
}

async function setActivity($: Engine, next: Partial<Activity>) {
  const now = await $.clock.now()
  const before = snap.activity
  let after: Activity | undefined
  await update($, activityAtom, a => (after = { ...a, ...next, since: next.kind !== a.kind ? now : a.since }))
  snap.activity = after!
  if (next.kind !== undefined && next.kind !== before.kind) await refreshStatus($)
}

/** Applies care, says the answer, plays its animation, and persists. */
async function doCare($: Engine, what: Care) {
  const before = snap.pet
  const cared = care(before, what)
  // Woken by hand, it stays up a while before dozing off again
  const pet = before.isAsleep && !cared.pet.isAsleep ? { ...cared.pet, wokeAt: await $.clock.now() } : cared.pet
  const line = cared.line
  await changePet($, () => pet)
  if (pet !== before) {
    if (what === 'feed') play('eat', 14)
    if (what === 'play') {
      play('hop', 16)
      play('heart', 16)
    }
    if (what === 'clean') play('star', 10)
    if (what === 'heal') play('star', 14)
  }
  await say($, careLine(snap.lang, line))
  await save($)
  await refreshStatus($)
}

/** Evolution check after XP changed. */
async function checkEvolve($: Engine, before: Pet, after: Pet) {
  const from = stageOf(before.xp)
  const to = stageOf(after.xp)
  if (from === to) return
  const text = from === 'egg' ? tx().hatched(after.name) : tx().grew(after.name, tx().stage[to])
  $.ui.toast(text, { timeoutMs: 6000 })
  play('flash', 14)
  play('star', 20)
  await log($, text)
  await say($, from === 'egg' ? tx().hello(after.name) : tx().grownUp, 12)
  await save($)
}

// ---- The scene ----

function scene(w: number, h: number, hasGround: boolean): Scene {
  const pet = snap.pet
  const kind = snap.activity.kind
  const stage = stageOf(pet.xp)
  const mood = moodOf(pet, kind)
  const margin = 7
  // The poop piles sit at the right edge: the pet keeps clear of them
  const piles = pet.poop > 0 ? 3 + pet.poop * 7 : 0
  const x = Math.round(margin + pos * Math.max(0, w - piles - 2 * margin))
  const hop = playing('hop')
  const room = Math.max(0, h - (hasGround ? 2 : 1) - heightOf(stage, snap.species))
  const lift = hop ? Math.min(room, HOP[(tick - hop.start) % HOP.length] ?? 0) : 0
  const eating = playing('eat') !== undefined

  let icon: Icon | null = null
  if (asking.size > 0) icon = 'alert'
  else if (playing('heart')) icon = 'heart'
  else if (playing('star')) icon = 'star'
  else if (playing('done')) icon = 'done'
  else if (eating) icon = 'berry'
  else if (isBusy(kind)) icon = iconFor(kind)
  else if (mood === 'hungry') icon = 'berry'
  else if (mood === 'sick') icon = 'sick'
  if (stage === 'egg' && icon !== 'alert') icon = isBusy(kind) ? iconFor(kind) : null

  return {
    stage,
    mood: eating ? 'happy' : mood,
    tick,
    x,
    ground: hasGround ? h - 2 : h - 1,
    lift,
    facing,
    isWalking: Math.abs(target - pos) > 0.01 && lift === 0,
    isEating: eating,
    xp: pet.xp,
    isFlashing: playing('flash') !== undefined,
    species: snap.species,
    skin: snap.skin,
    poop: pet.poop,
    icon,
    isAlert: icon === 'alert',
    agents: agents.size,
    isSweating: playing('sweat') !== undefined,
    hasGround,
  }
}

/** Moves the pet: it wanders while Claude is idle and goes home while Claude works. */
function wander() {
  tick += 1
  const pet = snap.pet
  if (stageOf(pet.xp) === 'egg' || pet.isAsleep || playing('eat')) return
  if (isBusy(snap.activity.kind) || asking.size > 0) target = 0.15
  else if (Math.random() < 0.015) target = Math.random()
  const d = target - pos
  if (Math.abs(d) > 0.01) {
    facing = d < 0 ? 'left' : 'right'
    pos += Math.sign(d) * Math.min(Math.abs(d), 0.012)
  }
}

function cellsFor(columns: number, rows: number, hasGround: boolean) {
  return toCells(render(columns, rows * 2, scene(columns, rows * 2, hasGround)))
}

/** Sends a frame only when it differs from the last one the site has. */
function blit($: Engine, requestId: string, columns: number, rows: number, cells: string) {
  if (sent.get(requestId) === cells) return
  sent.set(requestId, cells)
  void $.ui.blit({ requestId, key: RASTER, columns, rows, cells }).then(result => {
    if (result.deny === undefined) return
    sent.delete(requestId)
    if (requestId === PANE) pane = null
    else band = null
    // A resize remounts the site: ask for a redraw, at most once a second
    if (tick - refusedAt < 6) return
    refusedAt = tick
    $.ui.invalidate('ui.render')
  })
}

function paint($: Engine) {
  if (band !== null) blit($, band.id, band.columns, band.rows, cellsFor(band.columns, band.rows, false))
  if (pane !== null) blit($, PANE, pane.columns, pane.rows, cellsFor(pane.columns, pane.rows, true))
}

type Elements = ReturnType<EngineInterface['ui']['resolve']>

/**
 * The four care actions as chips: a soft colour each, the hotkey in the
 * accent colour, pink under the pointer. A keyed Box per chip scopes its hover.
 */
function careButtons(
  Box: Elements['Box'],
  Button: Elements['Button'],
  c: Palette,
  t: (typeof TEXT)[Lang],
  pet: Pet,
  hotkey: (what: Care) => { hotkey?: string },
  onPress: (what: Care) => void,
) {
  const chips: [Care, string][] = [
    ['feed', t.feed],
    ['play', t.play],
    ['clean', t.clean],
    ['sleep', pet.isAsleep ? t.wake : t.sleep],
  ]
  // Medicine only while it is sick
  if (pet.isSick) chips.push(['heal', t.heal])
  return (
    <Box flexDirection="row" gap={1} flexWrap="wrap">
      {chips.map(([what, label]) => (
        <Box key={`care-${what}`} backgroundColor={c.chip[what]} paddingX={1}>
          <Button key={what} plain hover={{ color: c.pet }} {...hotkey(what)} label={label} onPress={() => onPress(what)} />
        </Box>
      ))}
    </Box>
  )
}

type PaneSite = Parameters<EngineInterface['ui']['resolve']>[0]

/**
 * The settings page: each setting a row of choices, the current one marked
 * and tinted; the species a picker; the name a text field; a reset that asks
 * twice. Every choice applies at once and is kept between sessions.
 */
async function drawSettings($: Engine, e: PaneSite, cols: number, c: Palette) {
  const t = tx()
  const o = t.settings
  const els = $.ui.resolve(e)
  const { Box, Text, Button } = els
  const [band, place, hasButtons, hasKeys, skin, species, langWanted, isConfirming] = await Promise.all([
    read($, bandModeAtom),
    read($, placeAtom),
    read($, hasButtonsAtom),
    read($, hasKeysAtom),
    read($, skinAtom),
    read($, speciesAtom),
    read($, langWantedAtom),
    read($, isConfirmingResetAtom),
  ])

  // One row: the label, then a chip per choice
  const row = <T extends string | boolean>(
    key: string,
    label: string,
    choices: readonly (readonly [T, string])[],
    current: T,
    pick: (value: T) => unknown,
  ) => (
    <Box key={`row-${key}`} flexDirection="row">
      <Box width={9} flexShrink={0}>
        <Text color={c.sub}>{label}</Text>
      </Box>
      <Box flexDirection="row" gap={1} flexWrap="wrap">
        {choices.map(([value, name]) => {
          const isOn = value === current
          return (
            <Box key={`${key}-${String(value)}`} backgroundColor={isOn ? c.chip.sleep : undefined} paddingX={1}>
              <Button
                key={`set-${key}-${String(value)}`}
                plain
                dimColor={!isOn}
                hover={{ color: c.pet }}
                label={`${isOn ? '●' : '○'} ${name}`}
                onPress={() => pick(value)}
              />
            </Box>
          )
        })}
      </Box>
    </Box>
  )

  const speciesRow =
    'Select' in els ? (
      <Box key="row-species" flexDirection="row">
        <Box width={9} flexShrink={0}>
          <Text color={c.sub}>{o.species}</Text>
        </Box>
        <els.Select
          key="set-species"
          value={species}
          options={speciesIds().map(id => ({ value: id, label: speciesName(id) }))}
          onSelect={id => setSpecies($, id)}
        />
      </Box>
    ) : (
      row('species', o.species, speciesIds().map(id => [id, speciesName(id)] as const), species, id => setSpecies($, id))
    )

  const nameRow =
    'Input' in els ? (
      <Box key="row-name" flexDirection="row">
        <Box width={9} flexShrink={0}>
          <Text color={c.sub}>{o.name}</Text>
        </Box>
        <els.Input
          key="set-name"
          value={snap.pet.name}
          placeholder={o.namePlaceholder}
          onSubmit={value => {
            const name = short(value, 12)
            if (name !== '') return rename($, name)
          }}
        />
      </Box>
    ) : null

  return (
    <Box flexDirection="column" width={cols} gap={0}>
      <Box justifyContent="space-between" marginBottom={1}>
        <Text bold color={c.pet}>
          {o.title}
        </Text>
        <Box key="back-to-pet">
          <Button
            key="back"
            plain
            hotkey="b"
            hover={{ color: c.pet }}
            label={o.back}
            onPress={async () => {
              await update($, isConfirmingResetAtom, () => false)
              await update($, viewAtom, () => 'pet')
            }}
          />
        </Box>
      </Box>
      {speciesRow}
      {row('place', o.place, [['above', o.above], ['below', o.below]] as const, place, v => setPlace($, v))}
      {row('band', o.band, [['full', o.full], ['mini', o.mini], ['hidden', o.hidden]] as const, band, v => setBand($, v))}
      {row('buttons', o.buttons, [[true, o.show], [false, o.hide]] as const, hasButtons, v => setButtons($, v))}
      {row('keys', o.keys, [[true, o.on], [false, o.off]] as const, hasKeys, v => setKeys($, v))}
      {row('skin', o.skin, [['color', o.color], ['lcd', o.lcd]] as const, skin, v => setSkin($, v))}
      {row('lang', o.lang, [['zh', '中文'], ['en', 'English'], ['auto', o.auto]] as const, langWanted, v => setLang($, v))}
      {nameRow}
      <Box key="row-reset" flexDirection="row" marginTop={1}>
        <Box width={9} flexShrink={0}>
          <Text color={c.sub}>{o.reset}</Text>
        </Box>
        {isConfirming ? (
          <Box flexDirection="row" gap={1}>
            <Text color={c.red}>{o.resetSure} </Text>
            <Box key="reset-yes" backgroundColor={c.chip.feed} paddingX={1}>
              <Button
                key="reset-confirm"
                plain
                hover={{ color: c.red }}
                label={o.resetYes}
                onPress={async () => {
                  await resetPet($)
                  await update($, isConfirmingResetAtom, () => false)
                  await update($, viewAtom, () => 'pet')
                }}
              />
            </Box>
            <Box key="reset-no" paddingX={1}>
              <Button key="reset-cancel" plain label={o.cancel} onPress={() => update($, isConfirmingResetAtom, () => false)} />
            </Box>
          </Box>
        ) : (
          <Box key="reset-ask" paddingX={1}>
            <Button key="reset" plain dimColor hover={{ color: c.red }} label={o.resetAsk} onPress={() => update($, isConfirmingResetAtom, () => true)} />
          </Box>
        )}
      </Box>
      <Text dimColor wrap="wrap">
        {o.hint}
      </Text>
    </Box>
  )
}

/** A species' display name in the pet's language. */
function speciesName(id: string): string {
  if (id === 'mochi') return tx().mochi.name
  const sp = speciesById(id)
  if (sp === undefined) return id
  return snap.lang === 'zh' ? sp.name : (sp.nameEn ?? sp.id[0]!.toUpperCase() + sp.id.slice(1))
}

function speciesBlurb(id: string): string {
  const sp = speciesById(id)
  return sp === undefined ? '' : snap.lang === 'zh' ? sp.description : (sp.descriptionEn ?? sp.description)
}

/**
 * The language: `zh` or `en` as the person chose it, or for `auto` (and
 * nothing chosen) Claude Code's `language` setting, then English.
 */
async function resolveLang($: Engine, wanted: unknown): Promise<Lang> {
  if (wanted === 'zh' || wanted === 'en') return wanted
  try {
    const fromSettings = langOf(String((await $.settings.read()).language ?? ''))
    if (fromSettings !== undefined) return fromSettings
  } catch {
    // No settings to read: English
  }
  return 'en'
}

// ---- Settings: one function each, shared by the commands and the settings view ----

const BAND_MODES: readonly BandMode[] = ['full', 'mini', 'hidden']
const PLACES: readonly Place[] = ['above', 'below']
const SKINS: readonly Skin[] = ['color', 'lcd']

/** Every species id, the default first and mochi last. */
function speciesIds(): string[] {
  return [DEFAULT_SPECIES, ...SPECIES.map(sp => sp.id).filter(id => id !== DEFAULT_SPECIES), 'mochi']
}

async function setBand($: Engine, mode: BandMode) {
  await update($, bandModeAtom, () => mode)
  await $.store.set('bandMode', mode)
  if (mode !== 'full') band = null
  await refreshStatus($)
  return mode
}

async function setPlace($: Engine, place: Place) {
  await update($, placeAtom, () => place)
  await $.store.set('place', place)
  band = null
  sent.clear()
  return place
}

async function setButtons($: Engine, on: boolean) {
  await update($, hasButtonsAtom, () => on)
  await $.store.set('hasButtons', on)
  return on
}

async function setKeys($: Engine, on: boolean) {
  await update($, hasKeysAtom, () => on)
  await $.store.set('hasKeys', on)
  return on
}

async function setSkin($: Engine, skin: Skin) {
  await update($, skinAtom, () => skin)
  snap.skin = skin
  await $.store.set('skin', skin)
  sent.clear()
  return skin
}

async function setSpecies($: Engine, id: string) {
  await update($, speciesAtom, () => id)
  snap.species = id
  await $.store.set('species', id)
  sent.clear()
  return id
}

/** `auto` follows Claude Code's language setting, else English. */
async function setLang($: Engine, wanted: 'zh' | 'en' | 'auto') {
  await $.store.set('lang', wanted)
  await update($, langWantedAtom, () => wanted)
  snap.lang = await resolveLang($, wanted)
  await update($, langAtom, () => snap.lang)
  await $.command.register({ name: 'pet', description: tx().command })
  // Retitle the pane only if it is open; never open it unasked
  if (pane !== null) {
    try {
      await $.ui.open({ id: PANE, title: tx().paneTitle })
    } catch {
      // A retitle refused leaves the old title: nothing to undo
    }
  }
  await refreshStatus($)
  return snap.lang
}

async function rename($: Engine, name: string) {
  await changePet($, p => ({ ...p, name }))
  await save($)
  await say($, tx().myName(name))
  await refreshStatus($)
}

async function resetPet($: Engine) {
  const now = await $.clock.now()
  await changePet($, p => newPet(now, p.name))
  await update($, logAtom, () => [])
  await save($)
  await log($, tx().newEgg)
  await refreshStatus($)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    const now = await $.clock.now()
    // A hot reload keeps $.state; a new session starts from the store.
    const held = await $.state.get({ plugin: 'pixipet', key: 'pet' })
    const saved = await $.store.get(STORE_KEY)
    // The choice is stored from the first session on: a pet saved with no
    // choice beside it was raised before the pet spoke English, in Chinese
    let wanted = await $.store.get('lang')
    if (wanted === undefined) {
      wanted = saved !== undefined ? 'zh' : 'auto'
      await $.store.set('lang', wanted)
    }
    snap.lang = await resolveLang($, wanted)
    await update($, langAtom, () => snap.lang)
    if (wanted === 'zh' || wanted === 'en' || wanted === 'auto') await update($, langWantedAtom, () => wanted)
    const pet =
      held.value !== undefined ? decay(held.value, now) : decay(revive(saved, now, tx().defaultName), now, true)
    await changePet($, () => pet)
    await setActivity($, { ...IDLE, since: now })
    if (held.value === undefined) {
      await log($, tx().wokeUp(pet.name))
      const mode = await $.store.get('bandMode')
      if (mode === 'full' || mode === 'mini' || mode === 'hidden') await update($, bandModeAtom, () => mode)
      const skin = await $.store.get('skin')
      if (skin === 'color' || skin === 'lcd') await update($, skinAtom, () => skin)
      const species = await $.store.get('species')
      if (typeof species === 'string' && (species === 'mochi' || speciesById(species))) {
        await update($, speciesAtom, () => species)
      }
      const place = await $.store.get('place')
      if (place === 'above' || place === 'below') await update($, placeAtom, () => place)
      const hasButtons = await $.store.get('hasButtons')
      if (typeof hasButtons === 'boolean') await update($, hasButtonsAtom, () => hasButtons)
      const hasKeys = await $.store.get('hasKeys')
      if (typeof hasKeys === 'boolean') await update($, hasKeysAtom, () => hasKeys)
    }
    snap.skin = await read($, skinAtom)
    snap.species = await read($, speciesAtom)
    await save($)

    await $.command.register({ name: 'pet', description: tx().command })

    // The animation: frames go straight to the Rasters, no redraw
    $.clock.every(TICK_MS, () => {
      wander()
      paint($)
    })

    // Life: decay once a minute, chatter now and then while Claude is idle.
    $.clock.every(60_000, async () => {
      const t = await $.clock.now()
      const before = snap.pet
      const after = await changePet($, p => decay(p, t))
      const kind = snap.activity.kind
      const mood = moodOf(after, kind)
      if (after.poop > before.poop) await log($, tx().pooped(after.name))
      if (after.isAsleep && !before.isAsleep) {
        await log($, tx().dozedOff(after.name))
        await say($, pick(tx().dozing), 10)
      } else if (!after.isAsleep && before.isAsleep) {
        await log($, tx().rested(after.name))
        await say($, pick(tx().morning), 10)
        play('hop', 8)
      }
      if (mood === 'hungry' && moodOf(before, kind) !== 'hungry') {
        $.ui.toast(await hints($, tx().hungry(after.name)))
      }
      const speech = await read($, speechAtom)
      if (!isBusy(kind) && (speech === null || speech.until < t) && Math.random() < 0.3) {
        await say($, tx().chatter(after, mood, new Date(t).getHours()), 15)
      }
      await save($)
      await refreshStatus($)
    })

    await refreshStatus($)
    // After a reload the sites were drawn by the old module: draw them again to learn their ids
    $.ui.invalidate('ui.render')
    return next(e)
  })

  on('session.end', async ($, e, next) => {
    await save($)
    return next(e)
  })

  // ---- Claude linkage: what is Claude doing right now? ----

  on('turn.start', async ($, e, next) => {
    // A subagent's run raises no turn.start; this is the main loop.
    await setActivity($, { kind: 'thinking', detail: '', turnTools: 0 })
    return next(e)
  })

  on('tool.call', async ($, e, next) => {
    const tool = String(e.tool)
    const { kind, detail } = activityOf(tool, e as unknown as Record<string, unknown>)
    const id = e.tool_use_id
    const isMain = e.agentId === undefined
    // A subagent's tools count for the pet but do not take over the headline.
    if (isMain) await setActivity($, { kind, detail, turnTools: snap.activity.turnTools + 1 })
    if (isMain && (kind === 'asking' || kind === 'approving')) asking.add(id)
    // A subagent shows from its first tool call until its turn ends
    if (!isMain) agents.add(e.agentId)

    const before = snap.pet
    const after = await changePet($, onTool)
    await checkEvolve($, before, after)

    try {
      const ran = await next(e)
      if (ran.deny === undefined && ran.isError === true) {
        await changePet($, onToolError)
        play('sweat', 14)
        if (isMain) await log($, tx().toolFailed(tool, after.name))
      }
      return ran
    } finally {
      asking.delete(id)
    }
  })

  on('turn.complete', async ($, e, next) => {
    if (e.agentId !== undefined) agents.delete(e.agentId)
    if (e.agentId === undefined) {
      const a = snap.activity
      const before = snap.pet
      const after = await changePet($, p => onTurn(p, e.reason))
      await checkEvolve($, before, after)
      const secs = Math.round(e.durationMs / 1000)
      asking.clear()
      if (e.reason === 'answer') {
        await setActivity($, { kind: 'done', detail: '' })
        play('done', 20)
        play('hop', 8)
        await log($, tx().turnDone(secs, a.turnTools))
        if (a.turnTools >= 5 || secs >= 60) {
          await say($, tx().longTurn(secs, a.turnTools))
        } else if (!after.isAsleep) {
          await say($, tx().okay, 5)
        }
      } else if (e.reason === 'aborted') {
        await setActivity($, { kind: 'idle', detail: '' })
        await log($, tx().aborted)
      } else {
        await setActivity($, { kind: 'error', detail: '' })
        play('sweat', 20)
        await log($, tx().turnError)
        await say($, tx().cheer)
      }
      await save($)
    }
    return next(e)
  })

  on('prompt.submit', async ($, e, next) => {
    // The pet notices you talking to Claude.
    if (snap.pet.isAsleep && Math.random() < 0.2) await say($, tx().rolledOver, 4)
    return next(e)
  })

  on('ui.close', async ($, e, next) => {
    if (e.id === PANE) {
      pane = null
      sent.delete(PANE)
    }
    return next(e)
  })

  // ---- Commands ----

  on('command.run', { command: 'pet' }, async ($, e) => {
    const [verb = '', ...rest] = e.args.trim().split(/\s+/)
    const asked = rest[0]
    const cares: Record<string, Care> = {
      feed: 'feed',
      play: 'play',
      clean: 'clean',
      sleep: 'sleep',
      wake: 'sleep',
      heal: 'heal',
      medicine: 'heal',
      喂: 'feed',
      玩: 'play',
      洗: 'clean',
      睡: 'sleep',
      药: 'heal',
    }
    const what = cares[verb]
    if (what !== undefined) {
      await doCare($, what)
      const speech = await read($, speechAtom)
      return { text: tx().says(snap.pet.name, speech?.text ?? '') }
    }
    // A setting named without a value turns to the next one
    const next = <T,>(order: readonly T[], now: T, value: unknown): T =>
      order.includes(value as T) ? (value as T) : (order[(order.indexOf(now) + 1) % order.length] as T)
    const onOff = (value: unknown, now: boolean) => (value === 'on' ? true : value === 'off' ? false : !now)
    switch (verb) {
      case 'name': {
        const name = short(rest.join(' '), 12)
        if (name === '') return { text: tx().nameUsage }
        await rename($, name)
        return { text: tx().renamed(name) }
      }
      case 'band':
        return { text: tx().band(await setBand($, next(BAND_MODES, await read($, bandModeAtom), asked))) }
      case 'place':
        return { text: tx().place(await setPlace($, next(PLACES, await read($, placeAtom), asked))) }
      case 'buttons':
        return { text: tx().buttons(await setButtons($, onOff(asked, await read($, hasButtonsAtom)))) }
      case 'keys':
        return { text: tx().keys(await setKeys($, onOff(asked, await read($, hasKeysAtom)))) }
      case 'skin':
        return { text: tx().skin(await setSkin($, next(SKINS, await read($, skinAtom), asked))) }
      case 'lang':
        if (asked !== 'zh' && asked !== 'en' && asked !== 'auto') return { text: tx().langUsage }
        return { text: tx().lang(await setLang($, asked)) }
      case 'species': {
        if (asked === undefined || !speciesIds().includes(asked)) {
          const t = tx()
          return { text: t.speciesUsage(speciesIds().map(id => t.speciesLine(id, speciesName(id), speciesBlurb(id), id === DEFAULT_SPECIES))) }
        }
        await setSpecies($, asked)
        return { text: tx().became(snap.pet.name, speciesName(asked)) }
      }
      case 'reset':
        if (asked !== 'confirm') return { text: tx().resetConfirm }
        await resetPet($)
        return { text: tx().eggReady }
      case 'status':
        return { text: tx().status(snap.pet, tx().stage[stageOf(snap.pet.xp)], describe(snap.activity, snap.lang)) }
    }
    // /pet opens the pane: care on its front, every setting behind ⚙ (/pet settings opens there)
    await update($, viewAtom, () => (verb === 'settings' ? 'settings' : 'pet'))
    await update($, isConfirmingResetAtom, () => false)
    const opened = await $.ui.open({ id: PANE, title: tx().paneTitle, focus: true })
    if (!opened.isPlaced) return { text: tx().tooNarrow }
    return {}
  })

  // ---- Drawing ----

  on('ui.render', { component: 'Pane', requestId: PANE }, async ($, e) => {
    const pet = await read($, petAtom)
    const activity = await read($, activityAtom)
    const speech = await read($, speechAtom)
    const logs = await read($, logAtom)
    snap.skin = await read($, skinAtom)
    snap.species = await read($, speciesAtom)
    snap.lang = await read($, langAtom)
    const t = TEXT[snap.lang]
    snap.pet = pet
    snap.activity = activity
    const now = await $.clock.now()
    const c = await palette($)

    const stage = stageOf(pet.xp)
    const mood = moodOf(pet, activity.kind)
    const toNext = nextStageIn(pet.xp)
    const busy = isBusy(activity.kind)
    const cols = Math.min(e.props.bodyColumns, 48)
    const spoken = speech !== null && speech.until > now ? speech.text : ''
    const room = Math.max(0, (e.viewport?.rows ?? 30) - 28)

    const { Box, Text, Button } = $.ui.resolve(e)
    if ((await read($, viewAtom)) === 'settings') {
      pane = null
      return await drawSettings($, e, cols, c)
    }
    let picture
    if (e.surface === 'terminal') {
      const { Raster } = $.ui.resolve(e)
      const rows = 12
      pane = { columns: cols, rows }
      const cells = cellsFor(cols, rows, true)
      sent.set(PANE, cells)
      picture = <Raster key={RASTER} columns={cols} rows={rows} cells={cells} />
    } else {
      pane = null
      const [stink, piles] = ground(pet.poop, 0)
      picture = (
        <Box flexDirection="row">
          <Box flexDirection="column">
            {sprite(stage, mood, 0).map((l, i) => (
              <Text key={`s${i}`} color={mood === 'sick' ? c.green : c.text}>
                {l}
              </Text>
            ))}
          </Box>
          <Box flexDirection="column" justifyContent="flex-end">
            <Text color={c.sub}>{stink}</Text>
            <Text color={c.yellow}>{piles}</Text>
          </Box>
        </Box>
      )
    }

    return (
      <Box flexDirection="column" width={cols}>
        <Box justifyContent="space-between">
          <Text bold color={c.pet}>
            {pet.name}
            <Text dimColor>
              {' '}
              · {t.stage[stage]} · {ageText(pet, now, snap.lang)}
            </Text>
          </Text>
          <Box key="open-settings">
            <Button
              key="settings"
              plain
              hotkey="o"
              hover={{ color: c.pet }}
              label={t.settings.open}
              onPress={() => update($, viewAtom, () => 'settings')}
            />
          </Box>
        </Box>
        <Text color={c.yellow} wrap="truncate">
          {spoken ? `「${short(spoken, cols - 4)}」` : ' '}
        </Text>
        {picture}

        <Box flexDirection="column" marginTop={1}>
          <Text>
            {t.fullness} <Text color={pet.fullness < 25 ? c.red : c.green}>{bar(pet.fullness, 10)}</Text> {Math.round(pet.fullness)}
          </Text>
          <Text>
            {t.happiness} <Text color={pet.happiness < 30 ? c.red : c.pet}>{bar(pet.happiness, 10)}</Text>{' '}
            {Math.round(pet.happiness)}
          </Text>
          <Text>
            {t.energy} <Text color={pet.energy < 15 ? c.red : c.teal}>{bar(pet.energy, 10)}</Text> {Math.round(pet.energy)}
          </Text>
          <Text dimColor>
            {t.xp} {pet.xp}
            {toNext === null ? t.grown : t.toGrow(toNext)}
          </Text>
        </Box>

        <Box flexDirection="column" marginTop={1}>
          <Text bold>{t.doing}</Text>
          <Text color={activity.kind === 'asking' || activity.kind === 'approving' ? c.red : busy ? c.teal : activity.kind === 'error' ? c.red : c.sub} wrap="wrap">
            {busy ? '● ' : '○ '}
            {describe(activity, snap.lang)}
            {busy ? t.turnTools(activity.turnTools) : ''}
          </Text>
        </Box>

        {logs.length > 0 && room > 0 && (
          <Box flexDirection="column" marginTop={1}>
            <Text bold>{t.log}</Text>
            {logs.slice(-Math.min(room, 5)).map((l, i) => (
              <Text key={`l${i}`} dimColor wrap="truncate">
                {clock(l.at)} {l.text}
              </Text>
            ))}
          </Box>
        )}

        <Box marginTop={1}>
          {careButtons(Box, Button, c, t, pet, what => ({ hotkey: what[0]! }), what => doCare($, what))}
        </Box>
        {e.surface === 'terminal' && (
          <Text dimColor wrap="truncate">
            {e.props.isFocused
              ? t.focused
              : t.unfocused}
          </Text>
        )}
      </Box>
    )
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    if (e.props.hasSurvey || (await read($, placeAtom)) !== 'above') return next(e)
    const theirs = await next(e)
    const ours = await drawBand($, e, e.props.bodyColumns, e.props.maxRows, true)
    if (ours === undefined) return theirs
    // Share the band with any other mod drawing there
    if (!theirs) return ours
    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {theirs}
        {ours}
      </Box>
    )
  })

  on('ui.render', { component: 'PromptHint' }, async ($, e, next) => {
    if ((await read($, placeAtom)) !== 'below') return next(e)
    const theirs = await next(e)
    // The hint line has no measure of its own: the surface's width, less a margin
    const ours = await drawBand($, e, Math.max(20, (e.viewport?.columns ?? 80) - 6), 12, false)
    if (ours === undefined) return theirs
    const { Box } = $.ui.resolve(e)
    return (
      <Box flexDirection="column">
        {ours}
        {theirs}
      </Box>
    )
  })
}

type BandSite = Parameters<EngineInterface['ui']['resolve']>[0] & { requestId: string }

/**
 * The pet's band, above the prompt or under it: the pixel scene with the
 * stats beside it, or one line of stats with the buttons under it. Digits
 * press the buttons only above the prompt, where the engine arms them.
 */
async function drawBand($: Engine, e: BandSite, width: number, maxRows: number, takesDigits: boolean) {
  const mode = await read($, bandModeAtom)
  if (mode === 'hidden') {
    band = null
    return undefined
  }
  const pet = await read($, petAtom)
  const activity = await read($, activityAtom)
  const speech = await read($, speechAtom)
  snap.skin = await read($, skinAtom)
  snap.species = await read($, speciesAtom)
  snap.lang = await read($, langAtom)
  const t = TEXT[snap.lang]
  snap.pet = pet
  snap.activity = activity
  const now = await $.clock.now()
  const c = await palette($)
  const mood = moodOf(pet, activity.kind)
  const busy = isBusy(activity.kind)
  const spoken = speech !== null && speech.until > now ? `「${speech.text}」` : ''
  const toNext = nextStageIn(pet.xp)
  const rows = 8
  const isFull = mode === 'full' && e.surface === 'terminal' && maxRows >= rows && width >= 64

  const hasKeys = takesDigits && (await read($, hasKeysAtom))
  const hasButtons = await read($, hasButtonsAtom)
  const { Box, Text, Button } = $.ui.resolve(e)
  const actColor = activity.kind === 'asking' || activity.kind === 'approving' ? c.red : busy ? c.teal : c.sub

  // A bare digit in an empty prompt presses a band Button: care without leaving the prompt
  const digits: Record<Care, string> = { feed: '1', play: '2', clean: '3', sleep: '4', heal: '5' }
  const buttons = careButtons(Box, Button, c, t, pet, what => (hasKeys ? { hotkey: digits[what] } : {}), what =>
    doCare($, what),
  )

  if (isFull && e.surface === 'terminal') {
    const { Raster } = $.ui.resolve(e)
    const columns = width >= 90 ? 44 : Math.max(26, width - 46)
    band = { id: e.requestId, columns, rows }
    const cells = cellsFor(columns, rows, false)
    sent.set(e.requestId, cells)
    return (
      <Box flexDirection="row">
        <Raster key={RASTER} columns={columns} rows={rows} cells={cells} />
        <Box flexDirection="column" justifyContent="flex-end" paddingLeft={1} width={Math.min(52, width - columns - 1)}>
          <Text wrap="truncate">
            <Text bold color={c.pet}>
              {pet.name}
            </Text>
            <Text color={c.sub}>
              {' '}
              · {t.stage[stageOf(pet.xp)]} · {t.xp} {pet.xp}
              {toNext === null ? '' : `/${pet.xp + toNext}`}
            </Text>
          </Text>
          <Text wrap="truncate">
            <Text color={c.sub}>{t.short.fullness} </Text>
            <Text color={pet.fullness < 25 ? c.red : c.green}>{bar(pet.fullness)}</Text>
            <Text color={c.sub}> {t.short.happiness} </Text>
            <Text color={pet.happiness < 30 ? c.red : c.pet}>{bar(pet.happiness)}</Text>
            <Text color={c.sub}> {t.short.energy} </Text>
            <Text color={pet.energy < 15 ? c.red : c.teal}>{bar(pet.energy)}</Text>
          </Text>
          <Text color={actColor} wrap="wrap">
            {busy ? '● ' : '○ '}Claude {describe(activity, snap.lang)}
            {busy && activity.turnTools > 0 ? t.tools(activity.turnTools) : ''}
          </Text>
          <Text color={c.yellow} wrap="wrap">
            {spoken || ' '}
          </Text>
          {hasButtons && buttons}
        </Box>
      </Box>
    )
  }

  // One line of stats that never gives way, Claude's activity after it, the buttons under it
  band = null
  return (
    <Box flexDirection="column" width={width}>
      <Box flexDirection="row">
        <Box flexShrink={0} flexDirection="row">
          <Text color={c.pet} bold>
            {stageOf(pet.xp) === 'egg' ? '(  .  )' : face(mood, 0)}{' '}
          </Text>
          <Text>{pet.name} </Text>
          <Text color={c.sub}>{t.short.fullness}</Text>
          <Text color={pet.fullness < 25 ? c.red : c.green}>{bar(pet.fullness, 5)} </Text>
          <Text color={c.sub}>{t.short.happiness}</Text>
          <Text color={pet.happiness < 30 ? c.red : c.pet}>{bar(pet.happiness, 5)} </Text>
          <Text color={c.sub}>{t.short.energy}</Text>
          <Text color={pet.energy < 15 ? c.red : c.teal}>{bar(pet.energy, 5)} </Text>
          {pet.poop > 0 && <Text color={c.yellow}>{'@'.repeat(pet.poop)} </Text>}
        </Box>
        <Text color={spoken ? c.yellow : actColor} wrap="truncate">
          {spoken || `│ Claude ${describe(activity, snap.lang)}`}
        </Text>
      </Box>
      {hasButtons && buttons}
    </Box>
  )
}

function clock(at: number): string {
  const d = new Date(at)
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
