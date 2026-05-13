// ============================================================
// QUANTUM STORAGE — capture math + slot management
// ------------------------------------------------------------
// Standalone module: no JSX, no React. Pure data + functions so
// it can be unit-tested in isolation and consumed from:
//   • app/combat.tsx        — `attemptQuarantine()` from the QUARANTINE button
//   • app/registry.tsx      — `MAX_PARTY` and species rollup helpers
//   • src/contexts/GameContext.tsx — `addCapturedMinion()` slice integration
//
// Faithfully ports the C# `QuantumStorageComponent` blueprint:
//   chance = baseCaptureChance * itemMultiplier * (1 - currentHp/maxHp)
// ============================================================
import { ENEMIES } from '../data/gameData';
import { skillsForTier } from '../data/minionSkills';
import {
  EntityIVs,
  EntityRarity,
  entityXpToNext,
  rollIVs,
  rollRarity,
} from '../data/entityProgression';

export const MAX_PARTY = 6;
export const BASE_CAPTURE_CHANCE = 0.5;

/** Containment-spike tiers map to chance multipliers. */
export const SPIKE_MULTIPLIER: Record<string, number> = {
  containment_spike: 1.0,
  quantum_spike: 1.7,
  glitched_spike: 2.8,
};

export type CapturedMinion = {
  /** Unique runtime id so two captures of the same species can coexist. */
  uid: string;
  speciesId: string;
  name: string;
  level: number;
  hp: number;
  maxHp: number;
  atk: number;
  def: number;
  spd: number;
  /** Minion-skill ids defined in src/data/minionSkills.ts */
  skills: string[];
  /** Tier inherited from the source enemy (drives loadout, art, lore). */
  tier: number;
  /** ISO timestamp — used by the registry for sort/lore. */
  capturedAt: string;
  // ── PROGRESSION ADDICTION LOOP (all OPTIONAL for legacy save compat) ─
  /** Hidden 0..31 per-stat rolls. Locked at capture time. */
  ivs?: EntityIVs;
  /** Capture-time rarity roll. Drives stat mult + visual upgrades. */
  rarity?: EntityRarity;
  /** Independent DATA level. Defaults to capture `level`. */
  dataLevel?: number;
  /** DATA xp toward next entity level. */
  dataXp?: number;
  /** Cached xp-to-next so combat doesn't recompute every tick. */
  dataXpToNext?: number;
  /** Level at which this entity was originally captured (for level-scaling math). */
  baseLevel?: number;
};

/** Build a CapturedMinion from an enemy id + battle-time stats. */
export function buildCapturedMinion(args: {
  speciesId: string;
  currentHp?: number;
  enemyMaxHp?: number;
  enemyAtk?: number;
  enemyDef?: number;
  enemySpd?: number;
  playerLevel?: number;
}): CapturedMinion | null {
  const e = ENEMIES[args.speciesId];
  if (!e) return null;
  const tier = e.tier ?? 1;
  const lvl = args.playerLevel ?? Math.max(1, Math.floor((e.hp || 30) / 10));
  // ── PROGRESSION ADDICTION ROLLS ──
  //  • IVs: hidden 0..31 each (Pokémon-style perfect-roll hunting).
  //  • RARITY: weighted random (common 70 / rare 22 / glitched 7 / ascended 1).
  // These are persisted alongside the entity and drive effective stats
  // through entityProgression.effectiveStat() on read.
  const ivs = rollIVs();
  const rarity = rollRarity();
  return {
    uid: `${args.speciesId}_${Date.now()}_${Math.floor(Math.random() * 1e6)}`,
    speciesId: args.speciesId,
    name: e.name,
    level: lvl,
    hp: args.enemyMaxHp ?? e.hp,
    maxHp: args.enemyMaxHp ?? e.hp,
    atk: args.enemyAtk ?? e.atk,
    def: args.enemyDef ?? e.def,
    spd: args.enemySpd ?? e.spd,
    skills: skillsForTier(tier),
    tier,
    capturedAt: new Date().toISOString(),
    // Progression fields
    ivs,
    rarity,
    dataLevel: lvl,
    dataXp: 0,
    dataXpToNext: entityXpToNext(lvl),
    baseLevel: lvl,
  };
}

/**
 * Faithful port of the C# AttemptQuarantine formula.
 * Returns { success, chance } so the UI can preview the odds.
 */
export function rollQuarantine(args: {
  currentHp: number;
  maxHp: number;
  multiplier: number;
  /** Bosses are intentionally non-capturable in v1 (gameplay safety). */
  isBoss?: boolean;
}): { success: boolean; chance: number } {
  if (args.isBoss) return { success: false, chance: 0 };
  const hpFactor = args.maxHp <= 0 ? 0 : args.currentHp / args.maxHp;
  // Add a small floor so a freshly engaged enemy at full HP still has a sliver of
  // hope with a Glitched Spike — keeps the mechanic from feeling completely dead.
  const chance = Math.max(0.02, Math.min(0.98,
    BASE_CAPTURE_CHANCE * args.multiplier * (1.0 - hpFactor)
  ));
  const roll = Math.random();
  return { success: roll <= chance, chance };
}

/**
 * Pure slot router — never mutates inputs.
 * Returns the next (party, extendedStorage, slotUsed).
 */
export function routeToStorage(
  party: CapturedMinion[],
  extendedStorage: CapturedMinion[],
  minion: CapturedMinion,
): { party: CapturedMinion[]; extendedStorage: CapturedMinion[]; slot: 'party' | 'extended' } {
  if (party.length < MAX_PARTY) {
    return {
      party: [...party, minion],
      extendedStorage,
      slot: 'party',
    };
  }
  return {
    party,
    extendedStorage: [...extendedStorage, minion],
    slot: 'extended',
  };
}

/** Registry helper — returns { seenIds, capturedIds } for the registry screen. */
export function summarizeRegistry(
  seen: string[],
  party: CapturedMinion[],
  extendedStorage: CapturedMinion[],
): { seen: string[]; captured: string[] } {
  const captured = new Set<string>();
  party.forEach((m) => captured.add(m.speciesId));
  extendedStorage.forEach((m) => captured.add(m.speciesId));
  return {
    seen: Array.from(new Set([...(seen || []), ...Array.from(captured)])),
    captured: Array.from(captured),
  };
}
