// ============================================================
// FACTIONS — Visual identity families for every enemy / NPC /
// player in the Synthetic Sparks universe.
//
// Each faction has LOCKED rules that drive:
//   • glowColor      — outer rim-shadow tint (the #1 readability cue)
//   • innerGlow      — soft inner halo behind the sprite
//   • outlineColor   — drop-shadow outline that unifies silhouettes
//   • saturation     — CSS filter saturate() amount applied to normalize
//                      AI-art over-saturation drift
//   • contrast       — CSS filter contrast() amount
//   • brightness     — CSS filter brightness() amount
//   • bobFreq        — idle bob speed (Hz) — gives each faction a
//                      slightly different feel of life/movement
//   • bobAmp         — idle bob amplitude in px
//   • style          — short human-readable rule (kept in the file as
//                      living documentation — every new sprite must
//                      respect these rules)
//
// Adding a new enemy?  Pick a faction, add it to ENEMY_FACTION below.
// Never invent a one-off colour — it breaks visual cohesion.
// ============================================================

export type FactionId =
  | 'corrupted_ai'      // 🟣 unstable / glitchy / purple
  | 'industrial_bot'    // 🔵 clean / heavy / cyan
  | 'cyber_mutant'      // 🔴 organic / aggressive / red
  | 'rogue_military'    // 🟡 tactical / armored / amber
  | 'player'            // 🟢 the player & allies — friendly cyan-green
  | 'npc_friendly'      // ⚪ unaffiliated quest-givers
  | 'boss';             // 🔴🔴 unique elites — magenta apocalyptic glow

export type FactionDef = {
  id: FactionId;
  label: string;
  /** Outer rim-glow tint — the strongest faction-identity cue. */
  glowColor: string;
  /** Secondary inner halo behind the sprite. */
  innerGlow: string;
  /** Outline drop-shadow — unifies silhouettes across mixed art sources. */
  outlineColor: string;
  /** CSS filter saturation 0..2 (1 = neutral, <1 desaturates). */
  saturation: number;
  /** CSS filter contrast. */
  contrast: number;
  /** CSS filter brightness. */
  brightness: number;
  /** Optional hue rotation in degrees (0 = none). */
  hueRotate?: number;
  /** Idle bob frequency (Hz). */
  bobFreq: number;
  /** Idle bob amplitude (px). */
  bobAmp: number;
  /** Short style note — living art-direction doc. */
  style: string;
};

// 🔒 LOCKED PALETTE — every new sprite MUST respect these values.
// READABILITY-FIRST tuning: brightness ≥ 1.05, saturation 0.95–1.10.
// Sprites should ALWAYS pop against the dark cyberpunk floor — atmospheric
// darkness lives in the environment + AtmosphereLayer, NOT in the entities.
export const FACTIONS: Record<FactionId, FactionDef> = {
  corrupted_ai: {
    id: 'corrupted_ai',
    label: 'CORRUPTED AI',
    glowColor:    'rgba(200,90,255,0.95)',
    innerGlow:    'rgba(232,92,255,0.42)',
    outlineColor: 'rgba(15,2,28,1.0)',
    saturation: 1.05,
    contrast:   1.06,
    brightness: 1.12,
    hueRotate: -6,
    bobFreq: 2.4,
    bobAmp:  2.5,
    style: 'unstable · glitchy · purple veins · floats',
  },

  industrial_bot: {
    id: 'industrial_bot',
    label: 'INDUSTRIAL BOT',
    glowColor:    'rgba(64,240,255,0.90)',
    innerGlow:    'rgba(144,255,255,0.35)',
    outlineColor: 'rgba(2,10,20,1.0)',
    saturation: 1.00,
    contrast:   1.04,
    brightness: 1.10,
    bobFreq: 1.0,
    bobAmp:  1.2,
    style: 'clean · heavy · brushed steel · cyan lenses',
  },

  cyber_mutant: {
    id: 'cyber_mutant',
    label: 'CYBER MUTANT',
    glowColor:    'rgba(255,80,110,0.92)',
    innerGlow:    'rgba(255,120,140,0.38)',
    outlineColor: 'rgba(28,2,8,1.0)',
    saturation: 1.08,
    contrast:   1.08,
    brightness: 1.10,
    bobFreq: 3.2,
    bobAmp:  3.0,
    style: 'organic · aggressive · red eyes · twitchy',
  },

  rogue_military: {
    id: 'rogue_military',
    label: 'ROGUE MILITARY',
    glowColor:    'rgba(255,200,40,0.80)',
    innerGlow:    'rgba(255,230,120,0.30)',
    outlineColor: 'rgba(18,12,2,1.0)',
    saturation: 0.95,
    contrast:   1.05,
    brightness: 1.08,
    bobFreq: 1.6,
    bobAmp:  1.6,
    style: 'tactical · armored · amber HUD · disciplined',
  },

  player: {
    id: 'player',
    label: 'PLAYER',
    glowColor:    'rgba(120,255,210,0.65)',
    innerGlow:    'rgba(160,255,210,0.24)',
    outlineColor: 'rgba(4,16,12,0.95)',
    saturation: 1.00,
    contrast:   1.02,
    brightness: 1.10,
    bobFreq: 2.0,
    bobAmp:  1.8,
    style: 'friendly · cyan-green halo · the anchor of readability',
  },

  npc_friendly: {
    id: 'npc_friendly',
    label: 'ALLY',
    glowColor:    'rgba(255,220,140,0.55)',
    innerGlow:    'rgba(255,240,180,0.22)',
    outlineColor: 'rgba(8,8,12,0.95)',
    saturation: 0.98,
    contrast:   1.02,
    brightness: 1.08,
    bobFreq: 1.2,
    bobAmp:  1.0,
    style: 'warm · steady · quest-giver glow',
  },

  boss: {
    id: 'boss',
    label: 'ELITE',
    glowColor:    'rgba(255,80,220,1.0)',
    innerGlow:    'rgba(255,140,230,0.48)',
    outlineColor: 'rgba(20,0,16,1.0)',
    saturation: 1.10,
    contrast:   1.08,
    brightness: 1.12,
    bobFreq: 1.4,
    bobAmp:  2.4,
    style: 'apocalyptic · magenta corona · larger silhouette',
  },
};

// ──────────────────────────────────────────────────────────
// ENEMY → FACTION MAP — single source of truth.
// Adding a new enemyId without a faction here makes it
// fall back to `corrupted_ai` (the safest default for an
// AI-controlled-ruin setting).
// ──────────────────────────────────────────────────────────
export const ENEMY_FACTION: Record<string, FactionId> = {
  // Quantum-Minion species — base atlas
  phreak_1:        'corrupted_ai',
  phreak_2:        'corrupted_ai',
  phreak_3:        'corrupted_ai',
  phreak_4:        'corrupted_ai',
  vrghost_1:       'cyber_mutant',
  vrghost_2:       'cyber_mutant',
  vrghost_3:       'cyber_mutant',
  vrghost_4:       'cyber_mutant',
  mech_1:          'industrial_bot',
  mech_2:          'industrial_bot',
  mech_3:          'rogue_military',
  mech_4:          'boss',

  // Legacy academy enemies
  tinkerer_drone:  'industrial_bot',
  gear_golem:      'industrial_bot',
  rust_scout:      'industrial_bot',
  tesla_drone:     'corrupted_ai',
  alpha_juggernaut:'boss',
};

export function getFaction(enemyId: string): FactionDef {
  const id = ENEMY_FACTION[enemyId] || 'corrupted_ai';
  return FACTIONS[id];
}

/** Tier-based base scale (relative to TILE). Same rule across screens. */
export const TIER_SCALE: Record<number, number> = {
  1: 1.00,   // scout
  2: 1.08,   // standard
  3: 1.18,   // elite
  4: 1.34,   // boss
};
export function getTierScale(tier: number, isBoss?: boolean): number {
  if (isBoss) return TIER_SCALE[4];
  return TIER_SCALE[Math.max(1, Math.min(4, tier))] ?? 1.0;
}
