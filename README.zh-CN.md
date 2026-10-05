[English](README.md) | 简体中文

# pixipet

住在 Claude Code 里的像素电子宠物，致敬 90 年代的掌上电子宠物。它看着 Claude 干活、靠 Claude 的工作长大，在你写代码的时候陪着你。

用半块字符画的像素小生物（每个终端格子画上下两个像素），约每秒 5 帧直接动画在终端里。形象都是原创的。默认物种是 **桃绒狐 mallow**：花瓣耳朵的粉色小狐狸，长大后尾巴越来越蓬松；`/pet species` 可以换成 **芽啾 sprig**（顶着双叶的奶油小鸟）、**滴露灵 dewdrop**（戴卷卷水滴帽的露珠精灵）、**绒伞菇 plumcap**（伞边越长越波浪的紫莓小蘑菇）、**月绒蛾 luma**（长出月牙纹翅膀的毛绒小蛾）、**苔卷蜗 mossroll**（背着苔绿螺壳的小蜗牛）、**折墨猫 inkfold**（石墨色折纸小猫）、**陶火犬 kilnby**（戴釉色围兜的赤陶小狗）、**眠毯灵 tuck**（住在旧棉毯里的害羞幽灵）或 **团子 mochi**（最早的橙色圆团子）。

![各成长阶段、表情和气泡，由 hooks/pixels.ts 渲染](docs/species/mallow.png)

## 功能

- **看着 Claude。** 每次工具调用都会被翻译成宠物能理解的一句话：在读 `foo.ts`、在搜索 `TODO`、在运行 `npm test`、派了小助手去……、在上网查 `claude.com`。面板里显示当前动作、已持续多久、本轮用了几次工具。
- **跟着你的工作长大。** 每次工具调用 +1 经验，每完成一轮 +2。蛋 → 幼年（10）→ 童年（60）→ 少年（200）→ 成年（500），每次进化都有提示。
- **需要照顾。** 温饱、心情、精力会随时间下降，偶尔还会拉便便。喂食、玩耍、清洁、哄睡；不管它也会自己作息：精力低于 20 会自己睡，深夜 0–6 点精力低于 50 就犯困去睡，睡饱且过了深夜会自己醒，被你叫醒后会撑半小时再睡。便便堆到 3 坨、或者又饿又不开心，就会生病：身体变绿、不能玩，要吃药才能好（生病时会多出一个 `5: 💊吃药` 按钮），只打扫治不好。离开期间最多积 3 坨便便，数值也不会降到 15 以下，回来时不会太惨。
- **陪伴。** Claude 空闲时它会自言自语：深夜提醒你睡觉、提醒喝水、长任务结束后夸你辛苦、工具出错时替你担心。
- **气泡显示 Claude 在干嘛。** 放大镜是在读/搜索，铅笔是在改文件，终端是在跑命令，地球是在上网，清单是在列计划，每个子 agent 是一只迷你小宠物。Claude 向你提问或等你批准计划时，会闪红色的 **!**。
- **会有反应。** 一轮完成时跳一下并冒 ✓，工具出错时冒汗，喂食时吧唧嘴，玩耍时冒爱心，睡觉时冒 Z，进化时闪光。Claude 空闲时它到处溜达，Claude 开始干活它就回到原位。
- **会说中文和英文。** 跟随 Claude Code 的 `language` 设置，其次是系统语言；`/pet lang zh|en` 可以手动指定。
- **三处可见：** 输入框上方的像素小栏、面板（`/pet`）、状态栏。桌面端等不支持像素的界面会退回文字显示。

## 安装

```sh
claude plugin marketplace add VibeMage/claude-mod-pet
claude plugin install pixipet@claude-mod-pet
```

然后新开一个会话（或运行 `/reload-plugins`），输入 `/pet`。

不安装、只试一次：`git clone https://github.com/VibeMage/claude-mod-pet && claude --plugin-dir ./claude-mod-pet`。

## 命令

| 命令 | |
| --- | --- |
| `/pet` | 打开宠物面板（面板选中时，`ctrl+x tab`：`f` 喂食、`p` 玩耍、`c` 清洁、`s` 睡觉/叫醒） |
| `/pet feed` · `play` · `clean` · `sleep` · `heal` | 不开面板直接照顾；`heal` 给生病的宠物吃药 |
| `/pet status` | 一行状态 |
| `/pet name <名字>` | 给宠物改名 |
| `/pet band [full\|mini\|hidden]` | 输入框上方：像素场景（8 行）、一行精简、关闭；不带参数则轮换 |
| `/pet place [above\|below]` | 宠物放在输入框上方（默认）或下方；数字快捷键只在上方生效 |
| `/pet buttons [on\|off]` | 显示/隐藏小栏的照顾按钮（`1: 🍓喂食` `2: 🎾玩耍` `3: 🧼清洁` `4: 🌙睡觉`，每个都是一颗彩色小按钮）；隐藏能省一行，数字快捷键也随之停用 |
| `/pet keys [on\|off]` | 输入框为空时按数字操作小栏按钮：`1` 喂食、`2` 玩耍、`3` 清洁、`4` 睡觉。默认开启；关闭后数字照常输入 |
| `/pet species [id]` | 换物种：`mallow`、`sprig`、`dewdrop`、`plumcap`、`luma`、`mossroll`、`inkfold`、`kilnby`、`tuck`、`mochi`；不带参数则列出全部 |
| `/pet skin [color\|lcd]` | 彩色像素，或复古掌机的四色绿液晶屏 |
| `/pet lang [zh\|en\|auto]` | 宠物的语言；`auto` 跟随 Claude Code 的 `language` 设置，其次是 `LC_ALL` / `LC_MESSAGES` / `LANG` |
| `/pet reset confirm` | 重新从一颗蛋开始 |

## 它读取、保存、发送什么

所有数据都留在本机。宠物不发任何网络请求，也不运行任何命令。

- **读取：** 本会话的工具调用和轮次（工具名、文件名、Bash 命令的描述或命令本身、搜索关键词、访问网址的域名），用来显示 Claude 在做什么；Claude Code 的 `theme` 和 `language` 设置；环境变量 `LC_ALL`、`LC_MESSAGES`、`LANG`。
- **保存：** 宠物数值和你的选项（小栏、按钮、快捷键、皮肤、物种、语言），存在它自己的插件存储 `~/.claude/plugins/store/` 里。不保存任何代码或 prompt 内容。
- **显示：** 输入框上方的小栏、面板、状态栏和提示。它从不修改或拦截工具调用、prompt 和 Claude 的回答。

## 原理

一个 Claude Code mod（function hooks 插件）。`tool.call`、`turn.start`、`turn.complete` 提供 Claude 的动态；`$.clock.every` 驱动动画（每帧通过 `$.ui.blit` 直接送进 `Raster`，不重绘界面）和每分钟的生命周期；`$.state` 存放界面读取的数据，`$.store` 跨会话保存宠物。配色使用 iOS 系统色，跟随 Claude Code 主题切换浅色/深色。

```
hooks/register.tsx   hooks、面板、小栏、命令
hooks/pet.ts         纯逻辑（数值、成长阶段、照顾、工具 → 动作）
hooks/pixels.ts      像素画：小生物、图标、气泡、半块字符打包
hooks/species/       各物种的像素位图及其格式定义
hooks/text.ts        所有中英文文案
hooks/sprites.ts     不支持像素的界面用的文字形象，以及进度条
types/index.d.ts     $.state 类型契约
tests/pet.test.ts    claude plugin test .
```

## 开发

```sh
claude plugin validate --strict .
claude plugin test .
npx -y tsx scripts/preview.ts all   # 为每个物种渲染 docs/species/<id>.png
```

欢迎贡献新物种：现有物种就是按 [docs/design-brief.md](docs/design-brief.md) 画的，`hooks/species/types.ts` 是格式定义，测试会逐个检查每个物种。

## 许可

MIT
