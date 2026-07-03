/**
 * ENTITY SIGNATURES + TRAITS
 *
 * Spec direction: every deployed entity must feel like a unique illegal
 * AI weapon. Two layers of identity:
 *
 *   1) SIGNATURE MOVE — one per faction. A unique high-cost protocol
 *      that replaces the entity's tier-4 slot when deployed. The
 *      OPERATOR SYNERGY node `oc_signature` (SIGNATURE+ mythic) buffs
 *      these by +35% — closing the loop on the synergy promise.
 *
 *   2) ROLE TRAIT — a passive characteristic baked into the entity's
 *      role class. Sometimes mechanical, always flavored. Shown as a
 *      chip under the deployed entity name so the player learns each
 *      species' identity by playing them.
 *
 * Tone: eerie, mechanical, illegal — no fantasy verbs.
 */

import type { FactionId } from './factions';
import type { MinionRole } from './combatBalance';
import { getSpeciesKit } from './combatBalance';

// ── SIGNATURE MOVES (faction-level) ────────────────────────────────
export type EntitySignature = {
  id: string;
  name: string;
  flavor: string;     // 1-line eerie description
  /** Power multiplier on the deployed minion's atk. Slot-4 weight. */
  power: number;
  /** Glyph used as the move's icon in combat. */
  glyph: string;
  /** Hex color — matches faction identity. */
  color: string;
  /** Optional status the move applies (mapped into existing pipeline). */
  status?: 'defense_down' | 'stun' | 'burn' | 'firewall_up';
  statusTurns?: number;
};

/**
 * FACTION CORRUPTION PASSIVE
 *
 * Each faction projects an eerie, distinctive background behavior
 * while one of its entities is deployed. These are NOT skill button
 * effects — they fire automatically every turn the entity stays
 * online, giving each faction a memorable battlefield identity
 * beyond its raw stats.
 *
 *   corrupted_ai  → BLEED THOUGHT   psi residue dmg every 2nd turn
 *   cyber_mutant  → PHASE FRAY      occasional dodge of incoming dmg
 *   industrial_bot→ RUST AURA       enemy ATK decays while deployed
 *   rogue_military→ KINETIC CHARGE  entity ATK ramps while deployed
 *   player        → (no passive — fallback only)
 */
export type FactionPassiveKind = 'bleed_thought' | 'phase_fray' | 'rust_aura' | 'kinetic_charge' | 'none';

export type FactionPassive = {
  kind: FactionPassiveKind;
  name: string;
  flavor: string;
  effectText: string;
  glyph: string;
  color: string;
};

export const FACTION_PASSIVE: Record<FactionId, FactionPassive> = {
  corrupted_ai: {
    kind: 'bleed_thought',
    name: 'BLEED THOUGHT',
    flavor: 'Hallucinated subroutines leak into the enemy\'s stack.',
    effectText: 'Every 2 turns deployed: enemy takes 3 residual dmg.',
    glyph: '✦',
    color: '#c46cff',
  },
  cyber_mutant: {
    kind: 'phase_fray',
    name: 'PHASE FRAY',
    flavor: 'Frames stutter. Some hits never land.',
    effectText: '12% chance each enemy turn: dodge all damage.',
    glyph: '◈',
    color: '#5cf7ff',
  },
  industrial_bot: {
    kind: 'rust_aura',
    name: 'RUST AURA',
    flavor: 'Forced repair cycles corrode the enemy\'s power output.',
    effectText: 'Enemy ATK −1 per turn deployed (max −5).',
    glyph: '▣',
    color: '#ffb24c',
  },
  rogue_military: {
    kind: 'kinetic_charge',
    name: 'KINETIC CHARGE',
    flavor: 'Capacitors charge with every idle frame.',
    effectText: 'Entity ATK +1 per turn deployed (max +5).',
    glyph: '▲',
    color: '#ff6b6b',
  },
  player: {
    kind: 'none',
    name: '—',
    flavor: '',
    effectText: '',
    glyph: '',
    color: '#888',
  },
  npc_friendly: {
    kind: 'none',
    name: '—',
    flavor: '',
    effectText: '',
    glyph: '',
    color: '#888',
  },
  boss: {
    kind: 'none',
    name: '—',
    flavor: '',
    effectText: '',
    glyph: '',
    color: '#888',
  },
};

export const SIGNATURE_BY_FACTION: Record<FactionId, EntitySignature> = {
  // Glitched neural malware — psi disruption.
  corrupted_ai: {
    id: 'sig_mind_crack',
    name: 'MIND CRACK',
    flavor: 'Inject a corrupted thought-loop. The enemy stutters.',
    power: 1.55,
    glyph: '✦',
    color: '#c46cff',
    status: 'stun',
    statusTurns: 1,
  },
  // Phase-shifting flesh-machines — multi-frame bleed.
  cyber_mutant: {
    id: 'sig_phase_stride',
    name: 'PHASE STRIDE',
    flavor: 'Slip through frames. The enemy bleeds across timelines.',
    power: 1.50,
    glyph: '◈',
    color: '#5cf7ff',
    status: 'burn',
    statusTurns: 2,
  },
  // Heavy industrial — siege protocols.
  industrial_bot: {
    id: 'sig_armor_lock',
    name: 'ARMOR LOCK',
    flavor: 'Latch the enemy into a forced repair cycle. They stagger.',
    power: 1.45,
    glyph: '▣',
    color: '#ffb24c',
    status: 'defense_down',
    statusTurns: 3,
  },
  // Decommissioned military hardware — direct payload.
  rogue_military: {
    id: 'sig_rail_volley',
    name: 'RAIL VOLLEY',
    flavor: 'Discharge stored kinetic payload. No warnings logged.',
    power: 1.70,
    glyph: '▲',
    color: '#ff6b6b',
  },
  // Player fallback — never deployed but kept for type safety.
  player: {
    id: 'sig_operator_strike',
    name: 'OPERATOR STRIKE',
    flavor: 'Direct manual override. Rare but precise.',
    power: 1.30,
    glyph: '⌬',
    color: '#5cb3ff',
  },
  // Non-combatant / boss fallbacks — never deployed as party minions but
  // kept for exhaustive-Record type safety.
  npc_friendly: {
    id: 'sig_operator_strike',
    name: 'OPERATOR STRIKE',
    flavor: 'Direct manual override. Rare but precise.',
    power: 1.30,
    glyph: '⌬',
    color: '#5cb3ff',
  },
  boss: {
    id: 'sig_operator_strike',
    name: 'OPERATOR STRIKE',
    flavor: 'Direct manual override. Rare but precise.',
    power: 1.30,
    glyph: '⌬',
    color: '#5cb3ff',
  },
};

// ── ROLE TRAITS (5 roles) ──────────────────────────────────────────
export type EntityTrait = {
  id: string;
  name: string;
  flavor: string;
  effectText: string;
  color: string;
  glyph: string;
};

export const TRAIT_BY_ROLE: Record<MinionRole, EntityTrait> = {
  tank: {
    id: 'trait_plating',
    name: 'PLATING',
    flavor: 'Reinforced chassis. Hits glance off.',
    effectText: '+5 flat damage reduction on every incoming hit.',
    color: '#5cb3ff',
    glyph: '◈',
  },
  striker: {
    id: 'trait_first_strike',
    name: 'FIRST STRIKE',
    flavor: 'Frontloaded firmware. First action burns hot.',
    effectText: 'First attack after deploy deals +25% damage.',
    color: '#ffb24c',
    glyph: '▲',
  },
  disruptor: {
    id: 'trait_jammer',
    name: 'JAMMER',
    flavor: 'Background packet noise corrodes enemy targeting.',
    effectText: '20% chance basic attack lowers enemy DEF.',
    color: '#c46cff',
    glyph: '✦',
  },
  support: {
    id: 'trait_relay',
    name: 'RELAY',
    flavor: 'Mirror channel siphons damage back to the operator.',
    effectText: 'Operator regenerates 4 STAB every 3rd entity turn.',
    color: '#5cf7c4',
    glyph: '◇',
  },
  artillery: {
    id: 'trait_backload',
    name: 'BACKLOAD',
    flavor: 'Capacitors prime during idle. First skill spikes.',
    effectText: 'First minion skill this fight deals +50% damage.',
    color: '#ff7aa8',
    glyph: '⌬',
  },
  swarm: {
    id: 'trait_swarm',
    name: 'SWARM',
    flavor: 'Fast, fragile, and numerous. Death by a thousand cuts.',
    effectText: 'Rapid weak strikes apply stacking bleed.',
    color: '#5cf7c4',
    glyph: '◇',
  },
};

// ── PUBLIC RESOLVER ────────────────────────────────────────────────
export type EntityIdentity = {
  signature: EntitySignature;
  trait: EntityTrait;
  faction: FactionId;
  role: MinionRole;
};

export function getEntityIdentity(speciesId: string): EntityIdentity {
  const kit = getSpeciesKit(speciesId);
  return {
    signature: SIGNATURE_BY_FACTION[kit.faction],
    trait: TRAIT_BY_ROLE[kit.role],
    faction: kit.faction,
    role: kit.role,
  };
}
