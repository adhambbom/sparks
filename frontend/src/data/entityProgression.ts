/**
 * ENTITY PROGRESSION — IVs · Rarity · Independent DATA Leveling
 *
 * The "addiction loop" core. Every captured entity is unique in three
 * ways simultaneously:
 *
 *  1. IVs (Individual Variables) — 0..31 per stat. Hidden roll at
 *     capture time. Translates into flat stat bonuses at any level.
 *     Pokémon-style: gives players a reason to re-capture the same
 *     species hunting for a "perfect" IV roll.
 *
 *  2. RARITY — pulled at capture time with weighted random. Multiplies
 *     all of the entity's base stats and unlocks visual upgrades:
 *       COMMON   — 70% — grey rim
 *       RARE     — 22% — cyan rim
 *       GLITCHED —  7% — magenta rim + glitch chevrons in UI
 *       ASCENDED —  1% — gold rim + halo pulse (true endgame trophy)
 *
 *  3. DATA LEVEL — entities level up independently of the player by
 *     gaining DATA from every battle they survive. This is the second
 *     progression hook: the player CAN keep an entity for many fights
 *     to push its DATA tier and unlock its full stat ceiling.
 *
 * All three are computed PURE — read by combat.tsx and registry.tsx.
 * Persisted through GameContext into the existing /api/game/save blob.
 */

export type EntityRarity = 'common' | 'rare' | 'glitched' | 'ascended';

export type EntityIVs = {
  hp: number;   // 0..31
  atk: number;  // 0..31
  def: number;  // 0..31
  spd: number;  // 0..31
};

/** Visual + mechanical metadata per rarity. */
export const RARITY_META: Record<
  EntityRarity,
  {
    label: string;
    rim: string;
    bg: string;
    statMult: number;
    /** XP gain multiplier — higher rarity grinds harder for the same DATA. */
    xpMult: number;
    pulse: 0 | 1 | 2;
  }
> = {
  common:   { label: 'COMMON',   rim: '#888c9c', bg: 'rgba(60,60,80,0.35)',   statMult: 1.00, xpMult: 1.0, pulse: 0 },
  rare:     { label: 'RARE',     rim: '#5cb3ff', bg: 'rgba(40,80,140,0.40)',  statMult: 1.10, xpMult: 1.1, pulse: 1 },
  glitched: { label: 'GLITCHED', rim: '#c46cff', bg: 'rgba(80,30,120,0.45)',  statMult: 1.25, xpMult: 1.2, pulse: 1 },
  ascended: { label: 'ASCENDED', rim: '#ffd24a', bg: 'rgba(90,60,10,0.55)',   statMult: 1.45, xpMult: 1.35, pulse: 2 },
};

/** Rarity ordering — used for upgrade flows + collection completion. */
export const RARITY_RANK: Record<EntityRarity, number> = {
  common: 0, rare: 1, glitched: 2, ascended: 3,
};

// ── ROLL HELPERS ────────────────────────────────────────────────────

/** Weighted random rarity roll at capture time. */
export function rollRarity(): EntityRarity {
  const r = Math.random();
  if (r < 0.01) return 'ascended';
  if (r < 0.08) return 'glitched';
  if (r < 0.30) return 'rare';
  return 'common';
}

/** Independent 0..31 IV roll per stat. */
export function rollIVs(): EntityIVs {
  const r = () => Math.floor(Math.random() * 32);
  return { hp: r(), atk: r(), def: r(), spd: r() };
}

/** Quick "perfect IV" summary — for the registry sort/filter. */
export function ivTotal(iv: EntityIVs): number {
  return iv.hp + iv.atk + iv.def + iv.spd;
}

/** 0..1 normalised IV quality score. Used for "GOD ROLL" tag in UI. */
export function ivQualityPct(iv: EntityIVs): number {
  return ivTotal(iv) / (31 * 4);
}

/**
 * IV quality classification. Drives a small text tag next to the
 * rarity badge so the player IMMEDIATELY feels each capture's roll:
 *   < 40%   → "ROUGH"     dim grey
 *   < 65%   → "STABLE"    text default
 *   < 85%   → "PRIMED"    cyan
 *   < 95%   → "OVERTUNED" magenta
 *   ≥ 95%   → "GOD ROLL"  gold + pulse
 */
export function ivQualityTag(iv: EntityIVs): { label: string; color: string } {
  const q = ivQualityPct(iv);
  if (q >= 0.95) return { label: 'GOD ROLL',  color: '#ffd24a' };
  if (q >= 0.85) return { label: 'OVERTUNED', color: '#c46cff' };
  if (q >= 0.65) return { label: 'PRIMED',    color: '#5cb3ff' };
  if (q >= 0.40) return { label: 'STABLE',    color: '#a0a4b4' };
  return                  { label: 'ROUGH',     color: '#6a6e80' };
}

// ── EFFECTIVE STAT FORMULA ──────────────────────────────────────────
// Inspired by Pokémon's stat formula but flattened for our tier system:
//   final = floor((base * statMult(rarity)) * levelScale(level)) + iv * 0.5
// IVs add up to +15 flat to each stat at max roll. Rarity multiplies the
// curve. DATA Level adds +5% per level above the capture level.

export function levelScale(level: number, baseLevel: number): number {
  // 1.0 at capture-level, +5% per level over, capped at 3.0 (=lvl 40 boost)
  const delta = Math.max(0, level - baseLevel);
  return Math.min(3.0, 1.0 + delta * 0.05);
}

export function effectiveStat(
  base: number,
  iv: number,
  level: number,
  baseLevel: number,
  rarity: EntityRarity,
): number {
  const r = RARITY_META[rarity];
  return Math.floor(base * r.statMult * levelScale(level, baseLevel)) + Math.floor(iv * 0.5);
}

// ── ENTITY DATA LEVELING ───────────────────────────────────────────
// Independent XP curve so entities can outpace or fall behind the
// operator depending on usage. Slightly faster than the player curve to
// keep the "use them, evolve them" loop satisfying.

export function entityXpToNext(level: number): number {
  // 50, 75, 113, 169, 254, 380, ... — feels great on a mobile cadence.
  return Math.floor(50 * Math.pow(1.5, Math.max(0, level - 1)));
}

/**
 * Pure DATA award helper. Returns the updated level/xp/xpToNext + a
 * `leveled` flag so combat can play a level-up sound + log line.
 * Stat scaling is purely via the level-scale function above — we do
 * NOT mutate base atk/def/spd here. Effective stats are computed on
 * read so old saves remain compatible.
 */
export function applyEntityXp(args: {
  level: number;
  xp: number;
  xpToNext: number;
  rarity: EntityRarity;
  amount: number;
}): { level: number; xp: number; xpToNext: number; leveled: boolean; gained: number } {
  const gained = Math.max(1, Math.floor(args.amount * RARITY_META[args.rarity].xpMult));
  let lvl = args.level;
  let xp = args.xp + gained;
  let next = args.xpToNext;
  let leveled = false;
  while (xp >= next) {
    xp -= next;
    lvl += 1;
    next = entityXpToNext(lvl);
    leveled = true;
  }
  return { level: lvl, xp, xpToNext: next, leveled, gained };
}
