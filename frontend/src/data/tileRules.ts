// ============================================================
// TILE RULES — Single source of truth for collision, interaction,
// and visual category of every tile and prop in Level 1.
//
// The promise this module makes:
//   "Looking at a tile, the player can ALWAYS tell what it does."
//
// To enforce that promise, every interactive thing in the world
// is mapped to ONE of these categories:
//
//   FLOOR          walkable, plain pavement
//   WALL           solid, never walkable
//   PROP_SMALL     decorative, walkable underneath
//   PROP_LARGE     solid prop (debris, car wreck, machinery)
//   HALF_COVER     blocks bullets, walkable around (future)
//   INTERACTABLE   press A to use (terminal, store, staircase)
//   HAZARD         walkable but damages on entry (spike pad)
//   SECRET         hidden path / revealed later
//
// Both ACADEMY_MAP tile IDs and CyberProp kinds resolve to one of
// these. The collision pipeline in game.tsx asks this module
// "is X,Y walkable?" — no more scattered if-checks elsewhere.
// ============================================================
import { PROPS as FORGOTTEN_PROPS } from './forgottenBlock';
import type { CyberPropKind } from '../components/cyber/CyberProp';

export type TileCategory =
  | 'FLOOR'
  | 'WALL'
  | 'PROP_SMALL'
  | 'PROP_LARGE'
  | 'HALF_COVER'
  | 'INTERACTABLE'
  | 'HAZARD'
  | 'SECRET';

export type TileRule = {
  category: TileCategory;
  walkable: boolean;
  /** Debug-overlay tint. */
  debugColor: string;
  /** Short label for the debug overlay. */
  debugLabel: string;
};

// ──────────────────────────────────────────────────────────
// 1. Numeric tile IDs in ACADEMY_MAP → category.
//    These mirror the comment in gameData.ts (around line 558).
// ──────────────────────────────────────────────────────────
export const ACADEMY_TILE_RULES: Record<number, TileRule> = {
  0:  { category: 'FLOOR',        walkable: true,  debugColor: 'rgba(0,200,80,0.20)',   debugLabel: 'F' },
  1:  { category: 'WALL',         walkable: false, debugColor: 'rgba(255,40,40,0.40)',  debugLabel: 'W' },
  2:  { category: 'INTERACTABLE', walkable: true,  debugColor: 'rgba(0,220,255,0.35)',  debugLabel: '⚑' },  // trial door
  3:  { category: 'INTERACTABLE', walkable: true,  debugColor: 'rgba(0,220,255,0.35)',  debugLabel: '⚑' },
  4:  { category: 'INTERACTABLE', walkable: true,  debugColor: 'rgba(0,220,255,0.35)',  debugLabel: 'P' },  // launch pad
  5:  { category: 'INTERACTABLE', walkable: true,  debugColor: 'rgba(0,220,255,0.35)',  debugLabel: '$' },  // store
  6:  { category: 'INTERACTABLE', walkable: true,  debugColor: 'rgba(0,220,255,0.35)',  debugLabel: '!' },  // skill chamber
  7:  { category: 'INTERACTABLE', walkable: true,  debugColor: 'rgba(255,80,200,0.40)', debugLabel: 'B' },  // final trial (boss)
  8:  { category: 'INTERACTABLE', walkable: true,  debugColor: 'rgba(0,220,255,0.35)',  debugLabel: '?' },  // npc tile
  9:  { category: 'INTERACTABLE', walkable: true,  debugColor: 'rgba(80,180,255,0.45)', debugLabel: '★' }, // sapphire core
  10: { category: 'INTERACTABLE', walkable: true,  debugColor: 'rgba(0,220,255,0.35)',  debugLabel: '⚙' }, // power console
  11: { category: 'WALL',         walkable: false, debugColor: 'rgba(255,40,40,0.40)',  debugLabel: 'D' },  // immovable debris
  12: { category: 'WALL',         walkable: false, debugColor: 'rgba(255,40,40,0.40)',  debugLabel: 'S' },  // stone wall
  13: { category: 'FLOOR',        walkable: true,  debugColor: 'rgba(0,200,80,0.20)',   debugLabel: 'f' },  // banner (deco floor)
  14: { category: 'PROP_LARGE',   walkable: false, debugColor: 'rgba(255,180,40,0.45)', debugLabel: '◆' },  // destructible barrel
  15: { category: 'INTERACTABLE', walkable: true,  debugColor: 'rgba(0,220,255,0.45)',  debugLabel: '▼' },  // spiral staircase
  // Reserved future tile IDs:
  16: { category: 'HAZARD',       walkable: true,  debugColor: 'rgba(255,255,40,0.55)', debugLabel: '☣' },
  17: { category: 'HALF_COVER',   walkable: false, debugColor: 'rgba(200,200,40,0.40)', debugLabel: '▢' },
};

export function ruleForTile(tileId: number): TileRule {
  return ACADEMY_TILE_RULES[tileId] ?? {
    category: 'FLOOR',
    walkable: true,
    debugColor: 'rgba(0,200,80,0.18)',
    debugLabel: '·',
  };
}

// ──────────────────────────────────────────────────────────
// 2. CyberProp kinds → category.
//    These are the decorative overlays placed on top of floor
//    tiles via /app/frontend/src/data/forgottenBlock.ts.
//    Most should occupy their tile and block movement so the
//    player can't "stand on" a generator or a car wreck.
// ──────────────────────────────────────────────────────────
export const PROP_RULES: Record<CyberPropKind, TileRule> = {
  'warning-sign':       { category: 'PROP_SMALL', walkable: true,  debugColor: 'rgba(255,200,40,0.30)', debugLabel: 's' },
  'pipe-vertical':      { category: 'PROP_SMALL', walkable: true,  debugColor: 'rgba(255,200,40,0.30)', debugLabel: '|' },
  'debris-pile':        { category: 'PROP_LARGE', walkable: false, debugColor: 'rgba(255,140,40,0.45)', debugLabel: '◇' },
  'car-wreck':          { category: 'PROP_LARGE', walkable: false, debugColor: 'rgba(255,140,40,0.45)', debugLabel: '◇' },
  'barrel-energy':      { category: 'PROP_LARGE', walkable: false, debugColor: 'rgba(80,220,140,0.45)', debugLabel: '◇' },
  'barrel-radioactive': { category: 'PROP_LARGE', walkable: false, debugColor: 'rgba(120,255,80,0.45)', debugLabel: '◇' },
  'generator':          { category: 'PROP_LARGE', walkable: false, debugColor: 'rgba(0,200,255,0.45)',  debugLabel: '⚙' },
  'terminal':           { category: 'INTERACTABLE', walkable: false, debugColor: 'rgba(0,220,255,0.55)', debugLabel: '⌬' },
  'gate-locked':        { category: 'INTERACTABLE', walkable: false, debugColor: 'rgba(255,40,40,0.55)', debugLabel: '🔒' },
  'crate':              { category: 'PROP_LARGE', walkable: false, debugColor: 'rgba(200,160,80,0.45)',  debugLabel: '▢' },
  'fence':              { category: 'PROP_SMALL', walkable: false, debugColor: 'rgba(180,180,180,0.40)', debugLabel: '#' },
};

// Reverse-lookup map at module load — props at (x,y) by tile key.
// Build once; consumers should treat it as immutable. Saves a linear
// scan on every collision check.
const PROP_INDEX = new Map<string, TileRule>();
for (const p of FORGOTTEN_PROPS) {
  PROP_INDEX.set(`${p.x},${p.y}`, PROP_RULES[p.kind]);
}
/** Lookup the prop rule covering tile (x,y), or null if none. */
export function propRuleAt(x: number, y: number): TileRule | null {
  return PROP_INDEX.get(`${x},${y}`) ?? null;
}

// ──────────────────────────────────────────────────────────
// 3. Composite walkability — combine base tile + any prop on top.
//    Use this as the ONE collision-query in game.tsx.
// ──────────────────────────────────────────────────────────
export function isTileBlocked(
  tileId: number,
  x: number,
  y: number,
  brokenBarrels?: Set<string>,
): boolean {
  // 14 = destructible barrel: only blocked while intact.
  if (tileId === 14) {
    if (brokenBarrels && brokenBarrels.has(`${x},${y}`)) return false;
    return true;
  }
  const t = ruleForTile(tileId);
  if (!t.walkable) return true;
  const p = propRuleAt(x, y);
  if (p && !p.walkable) return true;
  return false;
}

/** Combined category for the debug overlay — prop overrides tile. */
export function categoryAt(tileId: number, x: number, y: number): TileRule {
  const p = propRuleAt(x, y);
  if (p) return p;
  return ruleForTile(tileId);
}
