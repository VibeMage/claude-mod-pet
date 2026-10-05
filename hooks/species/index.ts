import type { Species } from './types'
import { sprig } from './sprig'
import { mallow } from './mallow'
import { dewdrop } from './dewdrop'
import { plumcap } from './plumcap'
import { luma } from './luma'
import { mossroll } from './mossroll'
import { inkfold } from './inkfold'
import { kilnby } from './kilnby'
import { tuck } from './tuck'

/**
 * Every species but the default. `mochi`, the round orange one, is drawn in
 * code (hooks/pixels.ts) and is not listed here.
 */
export const SPECIES: readonly Species[] = [sprig, mallow, dewdrop, plumcap, luma, mossroll, inkfold, kilnby, tuck]

export function speciesById(id: string): Species | undefined {
  return SPECIES.find(s => s.id === id)
}
