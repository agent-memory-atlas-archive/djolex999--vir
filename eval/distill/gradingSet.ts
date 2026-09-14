import { shuffle, type Rng } from "../rng.js";

export type Arm = "control" | "challenger";

export interface ArmNote {
  pairIdx: number;
  arm: Arm;
  body: string;
}

export interface GradingItem {
  id: string;
  body: string;
}

export interface MappingEntry {
  id: string;
  pairIdx: number;
  arm: Arm;
}

// Opaque 8-hex ids drawn from the seeded rng: the filename carries nothing a
// grader could decode, and the same seed reproduces the same set.
function opaqueId(rng: Rng, taken: Set<string>): string {
  for (;;) {
    let id = "";
    for (let i = 0; i < 8; i += 1) id += Math.floor(rng() * 16).toString(16);
    if (!taken.has(id)) {
      taken.add(id);
      return id;
    }
  }
}

export function buildGradingSet(
  notes: readonly ArmNote[],
  rng: Rng,
): { items: GradingItem[]; mapping: MappingEntry[] } {
  const taken = new Set<string>();
  const withIds = notes.map((n) => ({ ...n, id: opaqueId(rng, taken) }));
  const order = shuffle(withIds, rng);
  return {
    items: order.map((n) => ({ id: n.id, body: n.body })),
    mapping: withIds.map((n) => ({ id: n.id, pairIdx: n.pairIdx, arm: n.arm })),
  };
}
