// ============================================================
// FORGOTTEN BLOCK — Level 1 environmental dressing data.
//
// This is the cohesive ruined-cyberpunk-district "skin" that
// turns the academy map from a generic dungeon into a real,
// atmospheric place. It does NOT change collisions or game
// logic — only how tiles are rendered visually.
//
// • CORRUPTION_TILES — coords where the floor renders with the
//   AI-corrupted purple variant of CyberTile instead of clean
//   pavement. Concentrate them around hazards and the Core.
//
// • ROAD_MARKINGS    — coords where a yellow road-stripe tile
//   replaces the floor, suggesting an old highway/avenue.
//
// • PROPS            — non-collision decorative overlays placed
//   on top of walkable floor tiles. Pure visual layer.
//
// • ENEMY_PACK_OVERRIDE — overworld sprite override for the
//   roaming enemies of this district. Keeps combat sprites
//   untouched while giving Level 1 a consistent enemy palette.
// ============================================================
import type { CyberPropKind } from '../components/cyber/CyberProp';

/** Tiles (x,y) that should render as the corrupted purple floor variant. */
export const CORRUPTION_TILES: ReadonlyArray<[number, number]> = [
  // Around the Sapphire Core (the AI-haunted centerpiece)
  [8, 3], [10, 3], [9, 4], [9, 2],
  // Around the spike pads (danger zones leak corruption)
  [7, 8], [9, 8], [11, 8],
  [8, 7], [10, 7],
  // South-east debris corner — patient zero
  [17, 5], [18, 5], [17, 6],
  // Dribble near the spiral staircase down (interface with the maze below)
  [3, 1], [5, 1], [4, 2],
];

/** Tiles (x,y) that should render with yellow road striping. */
export const ROAD_MARKINGS: ReadonlyArray<[number, number]> = [
  // A long broken highway down the middle corridor (row 10/12)
  [4, 10], [9, 10], [14, 10],
  [4, 12], [9, 12], [14, 12],
];

/**
 * Static decorative props placed on top of floor tiles. These are
 * pure visual overlays — they don't block movement (the source map
 * tile must already be walkable).
 */
export type ForgottenProp = { x: number; y: number; kind: CyberPropKind };
export const PROPS: ReadonlyArray<ForgottenProp> = [
  // Warning signs flanking the spike-pad approach
  { x: 7,  y: 7,  kind: 'warning-sign' },
  { x: 11, y: 7,  kind: 'warning-sign' },
  // Debris piles in dead corners — sells the abandonment
  { x: 2,  y: 1,  kind: 'debris-pile' },
  { x: 18, y: 6,  kind: 'debris-pile' },
  { x: 1,  y: 10, kind: 'debris-pile' },
  // A wrecked car blocking nothing visually, just storytelling
  { x: 13, y: 10, kind: 'car-wreck' },
  // Vertical pipes near walls — industrial backdrop
  { x: 1,  y: 4,  kind: 'pipe-vertical' },
  { x: 19, y: 12, kind: 'pipe-vertical' },
  // Toxic/energy barrels seeded along corridors
  { x: 5,  y: 4,  kind: 'barrel-energy' },
  { x: 15, y: 12, kind: 'barrel-radioactive' },
  // Generator + terminal cluster near the south entrance
  { x: 1,  y: 13, kind: 'generator' },
  { x: 17, y: 12, kind: 'terminal' },
  // Locked gate dressing on the boss door (visual only)
  { x: 16, y: 6,  kind: 'gate-locked' },
];

/** Quick O(1) lookup helpers (computed once at module load). */
export const CORRUPTION_SET: Set<string> = new Set(
  CORRUPTION_TILES.map(([x, y]) => `${x},${y}`)
);
export const ROAD_SET: Set<string> = new Set(
  ROAD_MARKINGS.map(([x, y]) => `${x},${y}`)
);

/**
 * Overworld sprite-pack override for roaming enemies in this district.
 * Map enemyId → CY sprite URI lookup KEY in SPRITE_ASSETS. We use a
 * lookup-key string instead of the URI directly so the consumer can
 * fall back gracefully if the asset isn't shipped.
 *
 * Triad: spider scout (light), tentacle caster (medium), mech titan (elite).
 */
export const ENEMY_PACK_OVERRIDE: Record<string, string> = {
  phreak_1:       'cySpiderScout',
  phreak_2:       'cySpiderScout',
  vrghost_1:      'cyTentacleCaster',
  vrghost_2:      'cyTentacleCaster',
  mech_1:         'cyMechTitan',
  mech_3:         'cyMechTitan',
  tinkerer_drone: 'cyDroneSpike',
};
