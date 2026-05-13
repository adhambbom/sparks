// ============================================================
// ENEMY VISUAL — SINGLE SOURCE OF TRUTH
//
// Both the overworld (game.tsx) and the combat screen
// (combat.tsx) MUST call `getEnemyVisual(enemyId)` to resolve
// the sprite they show. This guarantees:
//
//   • Same enemyId  → same source PNG, everywhere.
//   • Same enemyId  → same faction glow, everywhere.
//   • Combat reads like a "zoomed-in version" of the overworld
//     creature, not a different one.
//
// Resolution order:
//   1. Hard override (a few hand-curated cyber-pack reskins).
//   2. Quantum-Minion sheet (sliced backend atlas).
//   3. Legacy scout/juggernaut from SPRITE_ASSETS.
// ============================================================
import { SPRITE_ASSETS, ENEMIES } from '../data/gameData';
import { ENEMY_FACTION, FACTIONS, getTierScale, FactionDef } from '../data/factions';
import { resolveMinionSpriteUri, hasMinionSprite } from './DynamicMinionRenderer';

export type EnemyVisual = {
  /** Source PNG URI — IDENTICAL across overworld + combat for this enemyId. */
  uri: string;
  faction: FactionDef;
  /** Base scale multiplier (relative to whatever container size the caller uses). */
  scale: number;
  /** Tier from the ENEMIES data (1..4). */
  tier: number;
  isBoss: boolean;
};

// ──────────────────────────────────────────────────────────
// HARD OVERRIDES — a handful of enemies whose default sprite
// is replaced with a better-fitting cyber-pack PNG.
//
// Rules followed when picking these:
//   - Pick a sprite that visually MATCHES the faction style.
//   - Same override is used in BOTH overworld and combat.
//   - If a sprite clashes hard, leave the default in place.
// ──────────────────────────────────────────────────────────
const HARD_OVERRIDE: Record<string, keyof typeof SPRITE_ASSETS> = {
  // 🟣 Corrupted AI Drones — use the cleanest, most "robot-spirit"
  // looking cyber-pack drones (no obvious soldier-with-rifle look).
  phreak_1:        'cyDroneSpike',         // floating spike-drone
  phreak_2:        'cyDroneSpike',
  // 🔴 Cyber Mutant — the floating tentacle/orb works perfectly.
  vrghost_1:       'cyTentacleCaster',
  vrghost_2:       'cyTentacleCaster',
  // 🔵 Industrial Bot — the heavy mech.
  mech_1:          'cyMechTitan',
  // 🟡 Rogue Military — keep the legacy juggernaut PNG (it actually
  //    reads "military" cleaner than any AI-generated alternative).
  // mech_3: handled by tier fallback.
};

export function getEnemyVisual(
  enemyId: string,
  opts?: { forceBoss?: boolean },
): EnemyVisual {
  const data = (ENEMIES as any)[enemyId] || {};
  const tier: number = data.tier ?? 1;
  const isBoss: boolean = !!(opts?.forceBoss || data.isBoss);

  // 1) Hard override always wins.
  const overrideKey = HARD_OVERRIDE[enemyId];
  let uri: string | null = null;
  if (overrideKey && (SPRITE_ASSETS as any)[overrideKey]) {
    uri = (SPRITE_ASSETS as any)[overrideKey];
  }
  // 2) Quantum-Minion atlas.
  if (!uri && hasMinionSprite(enemyId)) {
    uri = resolveMinionSpriteUri(enemyId);
  }
  // 3) Tier fallback.
  if (!uri) {
    uri = isBoss || tier >= 3 ? SPRITE_ASSETS.enemyJuggernaut : SPRITE_ASSETS.enemyScout;
  }

  // Faction — override boss enemies' faction to the unique 'boss' look.
  const baseFactionId = ENEMY_FACTION[enemyId] || 'corrupted_ai';
  const factionId = isBoss && baseFactionId !== 'boss' ? 'boss' : baseFactionId;
  const faction = FACTIONS[factionId];

  return {
    uri,
    faction,
    scale: getTierScale(tier, isBoss),
    tier,
    isBoss,
  };
}
