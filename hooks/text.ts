// Every word the pet shows, in Chinese and English.
import type { ActivityKind, BandMode, Pet, Place, Skin, Stage } from '../types'
import type { Mood } from './pet'

export type Lang = 'zh' | 'en'

/** What the pet answers a care action with; text picks the words. */
export type Line =
  | 'egg' | 'asleep' | 'full' | 'fed' | 'tired' | 'played' | 'clean' | 'cleaned' | 'wake' | 'night'
  | 'healed' | 'healthy' | 'sickPlay'

/** Reads a language from a Claude Code `language` setting or a locale (`zh_CN.UTF-8`, `chinese`). */
export function langOf(value: string | undefined): Lang | undefined {
  if (value === undefined || value === '') return undefined
  const v = value.toLowerCase()
  if (/^(zh|cn)|chinese|中文|简体|繁體|繁体/.test(v)) return 'zh'
  return 'en'
}

const pick = <T,>(list: readonly T[]): T => list[Math.floor(Math.random() * list.length)] as T

type Text = {
  defaultName: string
  stage: Record<Stage, string>
  verb: Record<ActivityKind, string>
  care: Record<Line, readonly string[]>
  chatter: (pet: Pet, mood: Mood, hour: number) => string
  age: (minutes: number) => string
  hatched: (name: string) => string
  grew: (name: string, stage: string) => string
  hello: (name: string) => string
  grownUp: string
  wokeUp: (name: string) => string
  pooped: (name: string) => string
  dozedOff: (name: string) => string
  dozing: readonly string[]
  rested: (name: string) => string
  morning: readonly string[]
  hungry: (name: string) => string
  toolFailed: (tool: string, name: string) => string
  turnDone: (secs: number, tools: number) => string
  longTurn: (secs: number, tools: number) => string
  okay: string
  aborted: string
  turnError: string
  cheer: string
  rolledOver: string
  command: string
  nameUsage: string
  renamed: (name: string) => string
  myName: (name: string) => string
  band: (mode: BandMode) => string
  place: (place: Place) => string
  speciesUsage: (lines: string[]) => string
  speciesLine: (id: string, name: string, description: string, isDefault: boolean) => string
  mochi: { name: string; description: string }
  became: (pet: string, species: string) => string
  keys: (on: boolean) => string
  /** How to do a care action now: a digit while the band takes them, else the command. */
  how: (digit: string | null, command: string) => string
  /** A care command's answer: the pet's name and what it says. */
  says: (name: string, line: string) => string
  buttons: (on: boolean) => string
  skin: (skin: Skin) => string
  lang: (lang: Lang) => string
  langUsage: string
  resetConfirm: string
  newEgg: string
  eggReady: string
  status: (pet: Pet, stage: string, doing: string) => string
  paneTitle: string
  tooNarrow: string
  fullness: string
  happiness: string
  energy: string
  xp: string
  grown: string
  toGrow: (n: number) => string
  doing: string
  turnTools: (n: number) => string
  tools: (n: number) => string
  log: string
  feed: string
  play: string
  clean: string
  sleep: string
  wake: string
  heal: string
  focused: string
  unfocused: string
  /** The band's short meter labels. */
  short: { fullness: string; happiness: string; energy: string }
}

const zh: Text = {
  defaultName: '小克',
  stage: { egg: '蛋', baby: '幼年', child: '童年', teen: '少年', adult: '成年' },
  verb: {
    idle: '在发呆',
    thinking: '在思考',
    reading: '在读',
    searching: '在搜索',
    writing: '在写',
    running: '在运行',
    delegating: '派了小助手去',
    browsing: '在上网查',
    planning: '在列计划',
    working: '在用',
    asking: '在等你回答',
    approving: '在等你审批计划',
    done: '刚完成一轮',
    error: '遇到了点问题',
  },
  care: {
    egg: ['……（蛋轻轻晃了一下，让 Claude 多干点活就能孵化）'],
    asleep: ['Zzz……（睡着了，{sleep}叫醒）'],
    full: ['吃不下了啦！'],
    fed: ['好吃！', '嗷呜～', '再来一口！', '谢谢投喂 (*^ω^*)'],
    tired: ['好累……想睡觉'],
    played: ['耶！', '再玩一次！', '抓到你啦～', '嘿嘿嘿'],
    clean: ['已经很干净啦'],
    cleaned: ['清爽！✧'],
    healed: ['苦苦的……不过好多了！', '咕咚，感觉好多了～', '谢谢你照顾我 (｡•ᴗ•｡)'],
    healthy: ['我很健康，不用吃药啦'],
    sickPlay: ['生病了，玩不动……（{heal}给我吃药）'],
    wake: ['早上好～'],
    night: ['晚安……'],
  },
  chatter: (pet, mood, hour) => {
    if (mood === 'hungry') return pick(['肚子饿了……（{feed}喂我）', '咕噜咕噜～'])
    if (mood === 'sick') return pick(['不太舒服……（{heal}吃药）', pet.poop > 0 ? '呜……好臭（{clean}打扫，{heal}吃药）' : '呜……'])
    if (mood === 'sad') return pick(['陪我玩一会嘛（{play}）', '有点无聊……'])
    if (pet.poop > 0) return '那边好像有点臭……'
    if (hour >= 0 && hour < 6) return pick(['这么晚还在写代码吗？早点睡呀', '夜深了，记得休息～'])
    if (hour >= 6 && hour < 10) return pick(['早上好！今天写点什么？', '先喝杯咖啡吧 ☕'])
    if (hour >= 12 && hour < 14) return '午饭吃了吗？'
    return pick([
      '我在这儿陪着你～',
      '今天也辛苦啦',
      '要不要起来伸个懒腰？',
      '喝口水吧',
      `我已经看 Claude 用了 ${pet.toolsSeen} 次工具了！`,
      '嘿嘿',
    ])
  },
  age: minutes =>
    minutes < 60 ? `${Math.max(1, Math.round(minutes))} 分钟` : minutes < 48 * 60 ? `${Math.round(minutes / 60)} 小时` : `${Math.round(minutes / 1440)} 天`,
  hatched: name => `🥚 ${name} 孵化了！`,
  grew: (name, stage) => `✨ ${name} 长大了：${stage}！`,
  hello: name => `你好呀！我是${name}～`,
  grownUp: '我长大啦！',
  wokeUp: name => `${name} 醒来了`,
  pooped: name => `${name} 拉了一坨便便`,
  dozedOff: name => `${name} 困了，自己睡着了`,
  dozing: ['好困……我先睡啦', '呼……晚安', '眼皮好重……'],
  rested: name => `${name} 睡饱了，自己醒了`,
  morning: ['睡饱啦～', '伸个懒腰，早上好！', '精神满满！'],
  hungry: name => `${name} 饿了，{feed}喂一下吧`,
  toolFailed: (tool, name) => `Claude 的 ${tool} 出错了，${name} 有点担心`,
  turnDone: (secs, tools) => `Claude 完成一轮：${secs}s，${tools} 次工具`,
  longTurn: (secs, tools) => `辛苦啦！Claude 刚刚忙了 ${secs} 秒，用了 ${tools} 次工具`,
  okay: '好啦～',
  aborted: '这一轮被打断了',
  turnError: 'Claude 这一轮出错了',
  cheer: '别灰心，再试一次！',
  rolledOver: '(翻了个身)',
  command: '电子宠物：打开面板，或 /pet feed|play|clean|sleep|heal|name|species|band|place|buttons|skin|keys|lang|status|reset',
  nameUsage: '用法：/pet name <名字>',
  renamed: name => `宠物改名为 ${name}`,
  myName: name => `我叫${name}啦！`,
  band: mode =>
    `输入框上方：${{ full: '像素宠物', mini: '一行精简', hidden: '隐藏' }[mode]}（/pet band full|mini|hidden）`,
  place: place =>
    place === 'above'
      ? '宠物放在输入框上方（/pet place below 移到下方）'
      : '宠物移到了输入框下方。数字快捷键只在上方生效，在下方请用鼠标点按钮或 /pet feed 等命令（/pet place above 移回上方）',
  speciesUsage: lines => `用法：/pet species <id>\n${lines.join('\n')}`,
  speciesLine: (id, name, description, isDefault) => `${id}（${name}${isDefault ? '，默认' : ''}）：${description}`,
  mochi: { name: '团子', description: '最早的橙色圆团子' },
  became: (pet, species) => `${pet} 变成了${species}`,
  keys: on =>
    on
      ? '数字快捷键已开启：输入框为空时按 1 喂食 · 2 玩耍 · 3 清洁 · 4 睡觉'
      : '数字快捷键已关闭：数字照常输入，按钮仍可用鼠标点（/pet keys on 重新开启）',
  how: (digit, command) => (digit === null ? `${command} ` : `按 ${digit} `),
  says: (name, line) => `${name}：${line}`,
  buttons: on =>
    on ? '小栏按钮已显示' : '小栏按钮已隐藏，数字快捷键也随之停用（/pet buttons on 恢复，也可以用 /pet feed 等命令）',
  skin: skin => (skin === 'lcd' ? '换上了拓麻歌子液晶屏皮肤' : '换回了彩色皮肤'),
  lang: lang => (lang === 'zh' ? '已切换为中文' : 'Switched to English'),
  langUsage: '用法：/pet lang zh|en|auto（auto 跟随 Claude Code 的 language 设置和系统语言）',
  resetConfirm: '这会让宠物重新从蛋开始。确定的话输入：/pet reset confirm',
  newEgg: '一颗新蛋出现了',
  eggReady: '新的蛋已就位 🥚',
  status: (pet, stage, doing) =>
    `${pet.name}（${stage}）温饱 ${Math.round(pet.fullness)} · 心情 ${Math.round(pet.happiness)} · ` +
    `精力 ${Math.round(pet.energy)} · 经验 ${pet.xp} · Claude ${doing}`,
  paneTitle: '电子宠物',
  tooNarrow: '终端太窄，放不下宠物面板，拉宽一点再试 /pet',
  fullness: '温饱',
  happiness: '心情',
  energy: '精力',
  xp: '经验',
  grown: ' · 已完全长大',
  toGrow: n => ` · 再 ${n} 点长大`,
  doing: 'Claude 正在做什么',
  turnTools: n => ` · 本轮 ${n} 次工具`,
  tools: n => ` · ${n} 次工具`,
  log: '日志',
  feed: '🍓喂食',
  play: '🎾玩耍',
  clean: '🧼清洁',
  sleep: '🌙睡觉',
  wake: '🌞叫醒',
  heal: '💊吃药',
  focused: 'Tab 切换按钮 · Enter 按下 · Esc 回到输入框',
  unfocused: 'ctrl+x tab 选中面板后按字母键 · ctrl+x x 关闭',
  short: { fullness: '温饱', happiness: '心情', energy: '精力' },
}

const en: Text = {
  defaultName: 'Pip',
  stage: { egg: 'egg', baby: 'baby', child: 'child', teen: 'teen', adult: 'adult' },
  verb: {
    idle: 'is idle',
    thinking: 'is thinking',
    reading: 'is reading',
    searching: 'is searching',
    writing: 'is writing',
    running: 'is running',
    delegating: 'sent a helper to',
    browsing: 'is looking up',
    planning: 'is planning',
    working: 'is using',
    asking: 'is waiting for your answer',
    approving: 'is waiting for plan approval',
    done: 'just finished a turn',
    error: 'hit a snag',
  },
  care: {
    egg: ['… (the egg wobbles: let Claude work a bit more and it will hatch)'],
    asleep: ['Zzz… (asleep: {sleep} to wake me)'],
    full: ["I'm full!"],
    fed: ['Yum!', 'Nom nom~', 'One more bite!', 'Thanks for the snack (*^ω^*)'],
    tired: ['So tired… sleepy'],
    played: ['Yay!', 'Again, again!', 'Got you~', 'Hehehe'],
    clean: ['Already squeaky clean'],
    cleaned: ['So fresh! ✧'],
    healed: ['Bitter… but I feel better!', 'Gulp. Much better~', 'Thanks for looking after me (｡•ᴗ•｡)'],
    healthy: ["I'm healthy, no medicine for me"],
    sickPlay: ['Too sick to play… ({heal} for my medicine)'],
    wake: ['Good morning~'],
    night: ['Good night…'],
  },
  chatter: (pet, mood, hour) => {
    if (mood === 'hungry') return pick(['Hungry… ({feed} to feed me)', '*tummy rumbles*'])
    if (mood === 'sick') return pick(['Not feeling great… ({heal} for medicine)', pet.poop > 0 ? 'Ugh… it stinks ({clean} to clean, {heal} for medicine)' : 'Ugh…'])
    if (mood === 'sad') return pick(['Play with me a little? ({play})', 'Kinda bored…'])
    if (pet.poop > 0) return 'Something smells over there…'
    if (hour >= 0 && hour < 6) return pick(['Still coding this late? Get some sleep', "It's late, take a rest~"])
    if (hour >= 6 && hour < 10) return pick(['Morning! What are we building today?', 'Coffee first ☕'])
    if (hour >= 12 && hour < 14) return 'Had lunch yet?'
    return pick([
      "I'm right here with you~",
      'You are doing great today',
      'Time for a stretch?',
      'Drink some water',
      `I've watched Claude use ${pet.toolsSeen} tools so far!`,
      'Hehe',
    ])
  },
  age: minutes =>
    minutes < 60 ? `${Math.max(1, Math.round(minutes))} min` : minutes < 48 * 60 ? `${Math.round(minutes / 60)} h` : `${Math.round(minutes / 1440)} days`,
  hatched: name => `🥚 ${name} hatched!`,
  grew: (name, stage) => `✨ ${name} grew up: ${stage}!`,
  hello: name => `Hi there! I'm ${name}~`,
  grownUp: 'I grew up!',
  wokeUp: name => `${name} woke up`,
  pooped: name => `${name} pooped`,
  dozedOff: name => `${name} got sleepy and dozed off`,
  dozing: ['So sleepy… nap time', 'Zzz… good night', 'My eyelids are heavy…'],
  rested: name => `${name} slept well and woke up`,
  morning: ['All rested~', '*stretches* Good morning!', 'Full of energy!'],
  hungry: name => `${name} is hungry: {feed} to feed`,
  toolFailed: (tool, name) => `Claude's ${tool} failed, ${name} is a little worried`,
  turnDone: (secs, tools) => `Claude finished a turn: ${secs}s, ${tools} tools`,
  longTurn: (secs, tools) => `Nice work! Claude was busy for ${secs}s and used ${tools} tools`,
  okay: 'Done~',
  aborted: 'That turn was interrupted',
  turnError: 'Claude hit an error this turn',
  cheer: "Don't give up, try again!",
  rolledOver: '(rolls over)',
  command: 'Your pet: open the pane, or /pet feed|play|clean|sleep|heal|name|species|band|place|buttons|skin|keys|lang|status|reset',
  nameUsage: 'Usage: /pet name <name>',
  renamed: name => `Your pet is now called ${name}`,
  myName: name => `I'm ${name} now!`,
  band: mode =>
    `Above the prompt: ${{ full: 'pixel pet', mini: 'one line', hidden: 'hidden' }[mode]} (/pet band full|mini|hidden)`,
  place: place =>
    place === 'above'
      ? 'The pet sits above the prompt (/pet place below to move it under)'
      : 'The pet moved under the prompt. Digit keys work only above it: click the buttons or use /pet feed and friends here (/pet place above to move it back)',
  speciesUsage: lines => `Usage: /pet species <id>\n${lines.join('\n')}`,
  speciesLine: (id, name, description, isDefault) => `${id} (${name}${isDefault ? ', default' : ''}): ${description}`,
  mochi: { name: 'Mochi', description: 'the first design, a round orange blob' },
  became: (pet, species) => `${pet} is now a ${species}`,
  keys: on =>
    on
      ? 'Digit keys on: in an empty prompt press 1 feed · 2 play · 3 clean · 4 sleep'
      : 'Digit keys off: digits type as usual, the buttons still take clicks (/pet keys on to turn back on)',
  how: (digit, command) => (digit === null ? command : `press ${digit}`),
  says: (name, line) => `${name}: ${line}`,
  buttons: on =>
    on
      ? 'Band buttons shown'
      : 'Band buttons hidden, and the digit keys with them (/pet buttons on to bring them back, or use /pet feed and friends)',
  skin: skin => (skin === 'lcd' ? 'Switched to the Tamagotchi LCD skin' : 'Back to the colour skin'),
  lang: lang => (lang === 'zh' ? '已切换为中文' : 'Switched to English'),
  langUsage: "Usage: /pet lang zh|en|auto (auto follows Claude Code's language setting, then the system locale)",
  resetConfirm: 'This starts your pet over from an egg. To go ahead: /pet reset confirm',
  newEgg: 'A new egg appeared',
  eggReady: 'A fresh egg is ready 🥚',
  status: (pet, stage, doing) =>
    `${pet.name} (${stage}) food ${Math.round(pet.fullness)} · mood ${Math.round(pet.happiness)} · ` +
    `energy ${Math.round(pet.energy)} · xp ${pet.xp} · Claude ${doing}`,
  paneTitle: 'Pet',
  tooNarrow: 'The terminal is too narrow for the pet pane: widen it and try /pet again',
  fullness: 'Food  ',
  happiness: 'Mood  ',
  energy: 'Energy',
  xp: 'XP',
  grown: ' · fully grown',
  toGrow: n => ` · ${n} to grow`,
  doing: 'What Claude is doing',
  turnTools: n => ` · ${n} tools this turn`,
  tools: n => ` · ${n} tools`,
  log: 'Log',
  feed: '🍓Feed',
  play: '🎾Play',
  clean: '🧼Clean',
  sleep: '🌙Sleep',
  wake: '🌞Wake',
  heal: '💊Medicine',
  focused: 'Tab moves · Enter presses · Esc back to the prompt',
  unfocused: 'ctrl+x tab to focus, then the letter keys · ctrl+x x closes',
  short: { fullness: 'Food', happiness: 'Mood', energy: 'Energy' },
}

export const TEXT: Record<Lang, Text> = { zh, en }

/** A care answer in the pet's language. */
export function careLine(lang: Lang, line: Line): string {
  return pick(TEXT[lang].care[line])
}
