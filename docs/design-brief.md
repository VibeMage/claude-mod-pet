# Design brief: new pet species

You are designing pixel-art species for `pet`, a Tamagotchi-style companion that
lives in the Claude Code terminal (this repo). The current and only species,
`mochi` (a round orange blob drawn in code), reads as "not cute enough" to the
owner. We want **3 new species** to choose from.

## What to make

Three clearly different, **original** directions (do not copy Tamagotchi/Bandai,
Pokémon, Sanrio, or any existing character). Kawaii, readable at tiny size,
with a silhouette that says what it is at 10 pixels tall. Some ideas, pick or
replace: a chick that grows into a little bird, a cat or fox kit with ears and
a tail, a ghost or jelly, a tiny dragon, a seal, a mushroom sprite. Each grows
through 4 stages (baby → child → teen → adult) with a visible progression.
The egg is shared and already drawn; skip it.

## Steps

1. **Concept art first.** Generate one concept image per species showing the 4
   stages side by side in a pixel-art style. Save to `docs/concepts/<id>.png`.
2. **Pixel bitmaps.** Translate each concept into the contract in
   `hooks/species/types.ts` (read it: every field is documented). One file per
   species, `hooks/species/<id>.ts`, exporting a `Species` const; add it to
   `SPECIES` in `hooks/species/index.ts`.
3. **Look at it.** `npx -y tsx scripts/preview.ts <id>` writes
   `docs/species/<id>.png`: rows are the stages, columns are moods and actions
   (normal, happy, focus, walk, sleep, sick, eat, LCD skin). Open the image and
   iterate until it is genuinely cute. `npx -y tsx scripts/preview.ts mochi`
   shows the current design for comparison.
4. **Check.** `claude plugin test .` (a test validates every species against
   the contract) and `npx -y -p typescript@5 tsc -p .` must pass.

## Pixel rules

- Sizes: baby about 8–10 px tall, adult about 13–15 px; max 22 wide, 15 tall.
  Widths of about 10–20 read best. Every row of a bitmap is the same width.
- A 1 px dark outline (a dark warm color, not pure black), 3–5 fill colors
  including one highlight and one shadow. Light from the upper left.
- **Do not draw eyes or a mouth.** Leave a plain patch of a `face` letter where
  they go: the engine draws 2×2 eyes (with a white glint), blush, and a 2-wide
  mouth for every mood (happy ^ ^, sleep – –, sick, eating…). Put the eye
  anchors 3–5 px apart with one face pixel between them and the blush spots,
  and the mouth 1–2 px under the eyes, centered.
- `alt` (optional but recommended): a second frame for breathing/bobbing and
  walking, e.g. ears twitch, tail wags, body squashes by one pixel.
- Colors as `0xRRGGBB`. The LCD skin maps them to four greens by brightness,
  so keep a spread of light and dark values.

## Boundaries

- Touch only `hooks/species/`, `docs/concepts/` and `docs/species/`.
- Do not edit `hooks/pixels.ts`, `hooks/register.tsx` or the tests, and do not
  commit.
- When done, reply with: each species' id, Chinese name, one-line idea, and the
  paths of its concept image and preview sheet.
