// The contract a species of pet fills in. A species is pixel art: one bitmap
// per stage (a second one for its idle animation), and where the face goes.
// The engine draws the eyes and mouth on top for every mood, mirrors the
// bitmap when the pet walks left, tints it when sick, and maps it to the
// green LCD skin by brightness, so a species needs none of that.

export type SpeciesStage = {
  /**
   * Rows of palette letters, '.' clear, all rows one width. The bottom row
   * stands on the ground. At most 22 wide and 15 tall, so the stage fits the
   * band's 16-pixel scene with a pixel to hop.
   */
  body: readonly string[]
  /** Optional second frame, same size: breathing, a wag, a bob. */
  alt?: readonly string[]
  /** Top-left pixel of each 2×2 eye, as [x, y] in `body`; usually two. */
  eyes: readonly (readonly [number, number])[]
  /** Left pixel of the 2-wide mouth, as [x, y] in `body`, below the eyes. */
  mouth: readonly [number, number]
}

export type Species = {
  /** Lowercase id, what `/pet species <id>` takes. */
  id: string
  /** Display name in Chinese. */
  name: string
  /** One line about the design, in Chinese. */
  description: string
  /** English display name; the id, capitalised, when absent. */
  nameEn?: string
  /** The same line in English. */
  descriptionEn?: string
  /**
   * Palette: letter → 0xRRGGBB. Letters are the species' own; '.' is clear.
   * Leave the eyes and mouth out of the bitmaps: the engine draws them.
   */
  colors: Readonly<Record<string, number>>
  /** The letters the face may be drawn over (the skin around the eyes and mouth). */
  face: string
  stages: {
    baby: SpeciesStage
    child: SpeciesStage
    teen: SpeciesStage
    adult: SpeciesStage
  }
}
