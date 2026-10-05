import type { Species } from './types'
import { sprig } from './sprig'
import { mallow } from './mallow'
import { dewdrop } from './dewdrop'

/**
 * Every species but the default. `mochi`, the round orange one, is drawn in
 * code (hooks/pixels.ts) and is not listed here.
 */
export const SPECIES: readonly Species[] = [sprig, mallow, dewdrop]

export function speciesById(id: string): Species | undefined {
  return SPECIES.find(s => s.id === id)
}
