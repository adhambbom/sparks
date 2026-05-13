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
