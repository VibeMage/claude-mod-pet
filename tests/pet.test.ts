import { expect, mock, test } from 'claude-code/testing'
import type { Engine } from 'claude-code/testing'

import { activityOf, care, decay, moodOf, newPet, stageOf } from '../hooks/pet'
import { TEXT, langOf } from '../hooks/text'
import { Canvas, render, toCells } from '../hooks/pixels'
import type { Scene } from '../hooks/pixels'
import { SPECIES } from '../hooks/species'
import { sprite } from '../hooks/sprites'

const NOON = Date.UTC(2026, 9, 5, 12)

const mountPane = ($: Engine, surface: 'terminal' | 'desktop') =>
  $.ui.mount({
    plugin: 'pixipet',
    surface,
    component: 'Pane',
    requestId: 'pet',
    props: { title: '电子宠物', isFocused: false, bodyColumns: 48, placement: 'dock' } as never,
  })

const mountBand = ($: Engine, surface: 'terminal' | 'desktop', bodyColumns = 100) =>
  $.ui.mount({
    plugin: 'pixipet',
    surface,
    component: 'AbovePrompt',
    props: { hasSurvey: false, isWorking: true, maxRows: 12, bodyColumns } as never,
  })

test('the pane draws pixels on the terminal and text elsewhere, and says what Claude is doing', async ($, on) => {
  mock.clock(on, { now: NOON })
  mock.store(on)
  on('tool.call', () => ({ result: { ok: true } }) as never)
  for (let i = 0; i < 9; i++) await $.tool.call({ tool: 'Read', file_path: `/tmp/f${i}.ts` } as never)
  await $.tool.call({ tool: 'Edit', file_path: '/src/app/main.ts', old_string: 'a', new_string: 'b' } as never)

  const terminal = await mountPane($, 'terminal')
  expect(await terminal.find({ type: 'Raster', key: 'scene' })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: /在写 main\.ts/ })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: /幼年/ })).toBeDefined()
  expect(await terminal.find({ type: 'Button', key: 'feed' })).toBeDefined()
  expect(await terminal.find({ type: 'Text', text: /ctrl\+x tab/ })).toBeDefined()
  await terminal.unmount()

  const desktop = await mountPane($, 'desktop')
  expect(await desktop.find({ type: 'Raster' })).toBeUndefined()
  expect(await desktop.find({ type: 'Text', text: /在写 main\.ts/ })).toBeDefined()
  await desktop.unmount()
})

test('the band is a pixel scene when wide, one line when narrow', async ($, on) => {
  mock.clock(on, { now: NOON })
  mock.store(on)
  // The engine's own band: an empty box
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  const wide = await mountBand($, 'terminal')
  expect(await wide.find({ type: 'Raster', key: 'scene' })).toBeDefined()
  expect((await wide.find({ type: 'Button', key: 'feed' }))?.props.hotkey).toBe('1')
  expect((await wide.find({ type: 'Button', key: 'sleep' }))?.props.hotkey).toBe('4')
  // Each button sits on its own coloured chip
  expect((await wide.find({ type: 'Box', key: 'care-feed' }))?.props.backgroundColor).toBeDefined()
  await wide.press({ key: 'clean' })
  expect(await wide.find({ type: 'Text', text: /「.+」/ })).toBeDefined()
  await wide.unmount()

  await $.command.run({ command: 'pet', args: 'keys off' } as never)
  const off = await mountBand($, 'terminal')
  expect((await off.find({ type: 'Button', key: 'feed' }))?.props.hotkey).toBeUndefined()
  await off.unmount()

  await $.command.run({ command: 'pet', args: 'buttons off' } as never)
  const hidden = await mountBand($, 'terminal')
  expect(await hidden.find({ type: 'Button' })).toBeUndefined()
  expect(await hidden.find({ type: 'Raster', key: 'scene' })).toBeDefined()
  await hidden.unmount()
  await $.command.run({ command: 'pet', args: 'buttons on' } as never)
  const narrow = await mountBand($, 'terminal', 50)
  expect(await narrow.find({ type: 'Raster' })).toBeUndefined()
  expect(await narrow.find({ type: 'Text', text: /小克/ })).toBeDefined()
  expect(await narrow.find({ type: 'Button', key: 'feed' })).toBeDefined()
  await narrow.unmount()
})

test('feeding from the pane answers', async ($, on) => {
  mock.clock(on, { now: NOON })
  mock.store(on)
  on('tool.call', () => ({ result: { ok: true } }) as never)
  for (let i = 0; i < 12; i++) await $.tool.call({ tool: 'Bash', command: 'ls', description: 'list' } as never)
  const ui = await mountPane($, 'terminal')
  await ui.press({ key: 'play' })
  await ui.press({ key: 'feed' })
  expect(await ui.find({ type: 'Text', text: /「.+」/ })).toBeDefined()
  await ui.unmount()
})

test('tools map to activities', () => {
  expect(activityOf('Read', { file_path: '/a/b/c.ts' })).toEqual({ kind: 'reading', detail: 'c.ts' })
  expect(activityOf('Grep', { pattern: 'TODO' }).kind).toBe('searching')
  expect(activityOf('Bash', { command: 'x', description: 'Run the whole test suite with coverage and the slow integration tests' }).detail.length).toBeGreaterThan(60)
  expect(activityOf('Bash', { command: 'npm test', description: 'Run tests' })).toEqual({
    kind: 'running',
    detail: 'Run tests',
  })
  expect(activityOf('WebFetch', { url: 'https://claude.com/blog/x' }).detail).toBe('claude.com')
  expect(activityOf('AskUserQuestion', {}).kind).toBe('asking')
  expect(activityOf('mcp__claude_ai_Notion__notion-search', {}).detail).toBe('claude_ai_Notion/notion-search')
})

test('pet life: stages, care, offline decay floor, moods', () => {
  expect(stageOf(0)).toBe('egg')
  expect(stageOf(10)).toBe('baby')
  expect(stageOf(500)).toBe('adult')

  const egg = newPet(0)
  expect(care(egg, 'feed')).toEqual({ pet: egg, line: 'egg' })

  const baby = { ...newPet(0), xp: 20, fullness: 40 }
  expect(care(baby, 'feed').pet.fullness).toBe(65)

  const away = decay(baby, 24 * 60 * 60_000, true)
  expect(away.fullness).toBe(15)
  expect(away.happiness).toBeGreaterThanOrEqual(15)

  expect(moodOf({ ...baby, fullness: 10 }, 'idle')).toBe('hungry')
  expect(moodOf({ ...baby, isAsleep: true }, 'running')).toBe('sleep')
  expect(moodOf({ ...baby, happiness: 90, fullness: 90 }, 'running')).toBe('focus')
})

const SCENE: Scene = {
  stage: 'adult', mood: 'happy', tick: 3, x: 10, ground: 15, lift: 0, facing: 'right',
  isWalking: false, isEating: false, xp: 600, isFlashing: false, species: 'mochi', skin: 'color', poop: 2,
  icon: 'alert', isAlert: true, agents: 2, isSweating: true, hasGround: false,
}

test('every stage draws in both skins and packs into whole cells', () => {
  for (const stage of ['egg', 'baby', 'child', 'teen', 'adult'] as const) {
    for (const skin of ['color', 'lcd'] as const) {
      const c = render(44, 16, { ...SCENE, stage, skin })
      expect(c.px.some(v => v !== -1)).toBe(true)
      expect(toCells(c).length).toBe(Math.ceil((44 * 8 * 12) / 3) * 4)
    }
  }
  // An odd height still packs whole rows
  expect(toCells(new Canvas(3, 3)).length).toBe(Math.ceil((3 * 2 * 12) / 3) * 4)
})

test('ASCII sprites keep one width across frames', () => {
  for (const stage of ['egg', 'baby', 'child', 'teen', 'adult'] as const) {
    for (const frame of [0, 1, 2, 3]) {
      const lines = sprite(stage, 'happy', frame)
      expect(new Set(lines.map(l => l.length)).size).toBe(1)
    }
  }
})

test('every species keeps the contract in hooks/species/types.ts', () => {
  const ids = new Set<string>(['mochi'])
  for (const sp of SPECIES) {
    expect(/^[a-z][a-z0-9-]*$/.test(sp.id)).toBe(true)
    expect(ids.has(sp.id)).toBe(false)
    ids.add(sp.id)
    for (const stage of ['baby', 'child', 'teen', 'adult'] as const) {
      const st = sp.stages[stage]
      for (const rows of st.alt === undefined ? [st.body] : [st.body, st.alt]) {
        const w = rows[0]?.length ?? 0
        expect(rows.length).toBeLessThanOrEqual(15)
        expect(w).toBeLessThanOrEqual(22)
        expect(rows.length).toBe(st.body.length)
        for (const row of rows) {
          expect(row.length).toBe(w)
          for (const ch of row) if (ch !== '.') expect(sp.colors[ch]).toBeDefined()
        }
        // The face sits on face letters: each eye's 2×2 and the mouth's 2×1
        const at = (x: number, y: number) => rows[y]?.[x] ?? '.'
        for (const [x, y] of st.eyes) {
          for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]] as const) {
            expect(sp.face.includes(at(x + dx, y + dy))).toBe(true)
          }
        }
        expect(sp.face.includes(at(st.mouth[0], st.mouth[1]))).toBe(true)
        expect(sp.face.includes(at(st.mouth[0] + 1, st.mouth[1]))).toBe(true)
      }
      expect(render(36, 16, { ...SCENE, stage, species: sp.id }).px.some(v => v !== -1)).toBe(true)
    }
  }
})

test('English mode: the pane, the band and the commands speak English', async ($, on) => {
  mock.clock(on, { now: NOON })
  mock.store(on)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  on('tool.call', () => ({ result: { ok: true } }) as never)
  // The engine's side of re-registering /pet with English words
  on('command.register', () => ({ value: { command: 'pet' } }))
  const switched = await $.command.run({ command: 'pet', args: 'lang en' } as never)
  expect(switched.text).toBe('Switched to English')
  // The pet's name is the person's to choose; give it an English one for the checks below
  await $.command.run({ command: 'pet', args: 'name Pip' } as never)
  // Log lines keep the language they were written in: hatch after switching
  for (let i = 0; i < 10; i++) await $.tool.call({ tool: 'Read', file_path: `/tmp/f${i}.ts` } as never)
  expect(await (async () => {
    const pane = await mountPane($, 'terminal')
    const hatched = await pane.find({ type: 'Text', text: /Pip hatched!/ })
    await pane.unmount()
    return hatched
  })()).toBeDefined()
  await $.tool.call({ tool: 'Grep', pattern: 'TODO' } as never)

  const pane = await mountPane($, 'terminal')
  expect(await pane.find({ type: 'Text', text: /is searching TODO/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /What Claude is doing/ })).toBeDefined()
  expect(await pane.find({ type: 'Text', text: /baby/ })).toBeDefined()
  expect((await pane.find({ type: 'Button', key: 'feed' }))?.props.label).toBe('🍓Feed')
  expect(await pane.find({ type: 'Text', text: /[一-龥]/ })).toBeUndefined()
  await pane.press({ key: 'clean' })
  expect(await pane.find({ type: 'Text', text: /Already squeaky clean/ })).toBeDefined()
  await pane.unmount()

  for (const bodyColumns of [100, 50]) {
    const band = await mountBand($, 'terminal', bodyColumns)
    expect(await band.find({ type: 'Text', text: /[一-龥]/ })).toBeUndefined()
    expect((await band.find({ type: 'Button', key: 'sleep' }))?.props.label).toBe('🌙Sleep')
    await band.unmount()
  }

  for (const args of ['feed', 'sleep', 'status', 'species', 'band mini', 'keys off', 'buttons off', 'skin lcd', 'reset', 'name', 'lang xx']) {
    const out = await $.command.run({ command: 'pet', args } as never)
    expect(/[一-龥\u3000-\u303f\uff00-\uffef]/.test(out.text ?? '')).toBe(false)
  }

  const back = await $.command.run({ command: 'pet', args: 'lang zh' } as never)
  expect(back.text).toBe('已切换为中文')
})

test('the language follows a setting or a locale', () => {
  expect(langOf('chinese')).toBe('zh')
  expect(langOf('zh_CN.UTF-8')).toBe('zh')
  expect(langOf('en_US.UTF-8')).toBe('en')
  expect(langOf('japanese')).toBe('en')
  expect(langOf('')).toBeUndefined()
  // Both languages have every line
  for (const lang of ['zh', 'en'] as const) {
    for (const lines of Object.values(TEXT[lang].care)) expect(lines.length).toBeGreaterThan(0)
  }
})

test('hints name the key that works now: a digit while the band takes them, else the command', async ($, on) => {
  mock.clock(on, { now: NOON })
  mock.store(on)
  on('tool.call', () => ({ result: { ok: true } }) as never)
  for (let i = 0; i < 12; i++) await $.tool.call({ tool: 'Read', file_path: `/tmp/f${i}.ts` } as never)
  await $.command.run({ command: 'pet', args: 'sleep' } as never)
  const withKeys = await $.command.run({ command: 'pet', args: 'feed' } as never)
  expect(withKeys.text).toContain('按 4')
  await $.command.run({ command: 'pet', args: 'keys off' } as never)
  const withoutKeys = await $.command.run({ command: 'pet', args: 'feed' } as never)
  expect(withoutKeys.text).toContain('/pet sleep')
  expect(withoutKeys.text).not.toContain('{')
})

test('the band moves under the prompt, and the one-line band keeps its stats', async ($, on) => {
  mock.clock(on, { now: NOON })
  mock.store(on)
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  on('ui.render', { component: 'PromptHint' }, ($, e) => $.ui.resolve(e).Text({ children: ['? for shortcuts'] }))
  const HINT = { isDraft: false, isWorking: false, hint: '? for shortcuts' }
  const viewport = { columns: 120, rows: 40 }

  // Above by default: nothing of the pet's under the prompt
  const hintBefore = await $.ui.mount({ plugin: 'pixipet', surface: 'terminal', component: 'PromptHint', props: HINT, viewport } as never)
  expect(await hintBefore.find({ type: 'Raster' })).toBeUndefined()
  await hintBefore.unmount()

  await $.command.run({ command: 'pet', args: 'place below' } as never)
  const above = await mountBand($, 'terminal')
  expect(await above.find({ type: 'Raster' })).toBeUndefined()
  await above.unmount()
  const below = await $.ui.mount({ plugin: 'pixipet', surface: 'terminal', component: 'PromptHint', props: HINT, viewport } as never)
  expect(await below.find({ type: 'Raster', key: 'scene' })).toBeDefined()
  // Under the prompt the digits are not armed: the buttons take clicks only
  expect((await below.find({ type: 'Button', key: 'feed' }))?.props.hotkey).toBeUndefined()
  expect(await below.find({ type: 'Text', text: '? for shortcuts' })).toBeDefined()
  await below.unmount()

  await $.command.run({ command: 'pet', args: 'band mini' } as never)
  const mini = await $.ui.mount({ plugin: 'pixipet', surface: 'terminal', component: 'PromptHint', props: HINT, viewport } as never)
  for (const label of ['温饱', '心情', '精力']) expect(await mini.find({ type: 'Text', text: label })).toBeDefined()
  await mini.unmount()
})

test('sickness: three piles make it sick, cleaning does not cure it, medicine does', () => {
  const now = 10 * 60 * 60_000
  const baby = { ...newPet(0), xp: 20, lastTickAt: 0 }
  // A long time away: at most three piles, and sick from them
  const back = decay(baby, now, true)
  expect(back.poop).toBeLessThanOrEqual(3)
  const sick = { ...baby, poop: 3 }
  const ill = decay({ ...sick, lastTickAt: now - 60_000 }, now)
  expect(ill.isSick).toBe(true)
  expect(moodOf(ill, 'idle')).toBe('sick')

  const cleaned = care(ill, 'clean').pet
  expect(cleaned.poop).toBe(0)
  expect(cleaned.isSick).toBe(true)
  expect(care(cleaned, 'play').line).toBe('sickPlay')

  const healed = care(cleaned, 'heal')
  expect(healed.line).toBe('healed')
  expect(healed.pet.isSick).toBe(false)
  expect(care(healed.pet, 'heal').line).toBe('healthy')
})

test('the medicine button shows only while the pet is sick', async ($, on) => {
  mock.clock(on, { now: NOON })
  mock.store(on, { pet: { ...newPet(NOON), xp: 30, isSick: true, poop: 3 }, lang: 'zh' })
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  on('command.register', () => ({ value: { command: 'pet' } }))
  // The engine's own side of a session starting
  on('session.start', ($, e) => ({ cwd: e.cwd }) as never)
  // The store is read as the session starts
  await $.session.start({ cwd: '/tmp', surface: 'terminal', isInteractive: true } as never)
  const band = await mountBand($, 'terminal')
  const heal = await band.find({ type: 'Button', key: 'heal' })
  expect(heal?.props.hotkey).toBe('5')
  await band.press({ key: 'heal' })
  expect(await band.find({ type: 'Button', key: 'heal' })).toBeUndefined()
  await band.unmount()
})

test('bedtime: it dozes off when tired or late at night, and gets up rested after the night', () => {
  const day = () => 14
  const night = () => 2
  // Last woken by hand long ago
  const grown = { ...newPet(0), xp: 80, fullness: 100, happiness: 100, poop: 0, lastTickAt: 0, wokeAt: -60 * 60_000 }

  // Tired in the daytime: asleep within ten minutes
  const tired = decay({ ...grown, energy: 21 }, 20 * 60_000, false, day)
  expect(tired.isAsleep).toBe(true)

  // Late at night it goes to bed with energy to spare
  expect(decay({ ...grown, energy: 45 }, 10 * 60_000, false, night).isAsleep).toBe(true)
  expect(decay({ ...grown, energy: 45 }, 10 * 60_000, false, day).isAsleep).toBe(false)

  // Rested by day it wakes; at night it sleeps on, full or not
  const asleep = { ...grown, energy: 90, isAsleep: true }
  expect(decay(asleep, 10 * 60_000, false, day).isAsleep).toBe(false)
  expect(decay(asleep, 10 * 60_000, false, night).isAsleep).toBe(true)

  // Woken by hand, it stays up half an hour before dozing off again
  const woken = { ...grown, energy: 10, wokeAt: 0 }
  expect(decay(woken, 20 * 60_000, false, day).isAsleep).toBe(false)
  expect(decay(woken, 40 * 60_000, false, day).isAsleep).toBe(true)

  // Three hours away from a tired pet: it napped, so it comes back rested
  const away = decay({ ...grown, energy: 25 }, 3 * 60 * 60_000, true, day)
  expect(away.energy).toBeGreaterThan(25)
  // Eggs never sleep
  expect(decay({ ...newPet(0), energy: 5 }, 30 * 60_000, false, night).isAsleep).toBe(false)
})

test('settings live in the pane: every choice is a chip, the species a picker, reset asks twice', async ($, on) => {
  mock.clock(on, { now: NOON })
  mock.store(on)
  on('ui.open', () => ({ value: { isPlaced: true } }))
  on('command.register', () => ({ value: { command: 'pet' } }))
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Box({}))
  on('tool.call', () => ({ result: { ok: true } }) as never)
  for (let i = 0; i < 12; i++) await $.tool.call({ tool: 'Read', file_path: `/tmp/f${i}.ts` } as never)

  // The pet page has a way in
  const front = await mountPane($, 'terminal')
  expect((await front.find({ type: 'Button', key: 'settings' }))?.props.hotkey).toBe('o')
  await front.press({ key: 'settings' })
  expect(await front.find({ type: 'Select', key: 'set-species' })).toBeDefined()
  await front.unmount()

  const ui = await mountPane($, 'terminal')
  expect((await ui.find({ type: 'Button', key: 'set-place-above' }))?.props.label).toBe('● 输入框上方')
  await ui.press({ key: 'set-place-below' })
  expect((await ui.find({ type: 'Button', key: 'set-place-below' }))?.props.label).toBe('● 输入框下方')
  await ui.select({ key: 'set-species', value: 'tuck' })
  expect((await ui.find({ type: 'Select', key: 'set-species' }))?.props.value).toBe('tuck')
  await ui.press({ key: 'set-lang-en' })
  expect(await ui.find({ type: 'Text', text: '⚙ Settings' })).toBeDefined()
  await ui.input({ key: 'set-name', text: 'Boo' })

  // Reset asks first, then starts over from an egg
  await ui.press({ key: 'reset' })
  expect(await ui.find({ type: 'Button', key: 'reset-confirm' })).toBeDefined()
  await ui.press({ key: 'reset-cancel' })
  expect(await ui.find({ type: 'Button', key: 'reset-confirm' })).toBeUndefined()
  await ui.press({ key: 'back' })
  expect(await ui.find({ type: 'Text', text: /Boo/ })).toBeDefined()
  expect(await ui.find({ type: 'Raster', key: 'scene' })).toBeDefined()
  await ui.unmount()

  // /pet settings opens straight onto the settings page
  await $.command.run({ command: 'pet', args: 'settings' } as never)
  const direct = await mountPane($, 'desktop')
  expect(await direct.find({ type: 'Select', key: 'set-species' })).toBeDefined()
  await direct.unmount()
})
