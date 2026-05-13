// ============================================================
// MINION SKILLS — exclusive moveset for deployed Quantum Minions
// (Faithful translation of the design brief's `TamedCombatInterceptor`
//  switch-case into idiomatic data-driven TS so we don't need a switch
//  inside the combat loop.)
//
// Each skill modulates the existing CombatPipeline primitives:
//   • damage (multiplier on the deployed minion's atk)
//   • optional status (DefenseDown / Stun / Burn / FirewallUp)
// Combat code consumes these via `runMinionSkill()` in TamedCombat.ts.
// ============================================================

export type MinionStatus = 'defense_down' | 'stun' | 'burn' | 'firewall_up';

export type MinionSkill = {
  id: string;
  /** Display label in the battle UI button. */
  name: string;
  /** Multiplier applied to the deployed minion's atk stat. */
  power: number;
  /** Optional status effect applied on hit. */
  status?: MinionStatus;
  /** Duration in turns for stun / burn / debuff (defaults: stun=1, burn=3, debuff=3). */
  statusTurns?: number;
  /** Short flavor line shown below the button. */
  desc: string;
};

export const MINION_SKILLS: Record<string, MinionSkill> = {
  data_leak: {
    id: 'data_leak',
    name: 'Malware Blitz',
    power: 1.2,
    status: 'defense_down',
    statusTurns: 3,
    desc: 'Cryptic siphon — 120% atk; weakens target DEF.',
  },
  ddos_overload: {
    id: 'ddos_overload',
    name: 'DDOS Barrage',
    power: 0.8,
    status: 'stun',
    statusTurns: 1,
    desc: 'Flood the bus — 80% atk; target loses next turn.',
  },
  firewall_spike: {
    id: 'firewall_spike',
    name: 'Trojan Injector',
    power: 1.0,
    status: 'firewall_up',
    statusTurns: 2,
    desc: 'Pierce + harden. Player gains 50% DEF for 2 turns.',
  },
  packet_storm: {
    id: 'packet_storm',
    name: 'System Reboot',
    power: 1.5,
    status: 'burn',
    statusTurns: 2,
    desc: 'Burst flood — 150% atk + light burn.',
  },
  // ── FACTION SIGNATURE MOVES (slot-4 replaces packet_storm for deployed entities) ──
  // Mirrors src/data/entitySignatures.ts so executeMinionSkill resolves
  // these via the same record without circular imports.
  sig_mind_crack: {
    id: 'sig_mind_crack',
    name: 'MIND CRACK',
    power: 1.55,
    status: 'stun',
    statusTurns: 1,
    desc: 'Corrupted thought-loop — 155% atk; target stutters.',
  },
  sig_phase_stride: {
    id: 'sig_phase_stride',
    name: 'PHASE STRIDE',
    power: 1.50,
    status: 'burn',
    statusTurns: 2,
    desc: 'Slip frames — 150% atk + cross-timeline bleed.',
  },
  sig_armor_lock: {
    id: 'sig_armor_lock',
    name: 'ARMOR LOCK',
    power: 1.45,
    status: 'defense_down',
    statusTurns: 3,
    desc: 'Forced repair cycle — 145% atk; target staggers (DEF↓).',
  },
  sig_rail_volley: {
    id: 'sig_rail_volley',
    name: 'RAIL VOLLEY',
    power: 1.70,
    desc: 'Pure kinetic discharge — 170% atk. No status, raw payload.',
  },
};

/**
 * Default minion skill loadout per species TIER.
 * Higher-tier minions know more powerful skills.
 * Keys: 1/2/3/4 = ENEMIES[].tier.
 */
export const TIER_SKILL_LOADOUT: Record<number, string[]> = {
  1: ['data_leak'],
  2: ['data_leak', 'ddos_overload'],
  3: ['data_leak', 'ddos_overload', 'firewall_spike'],
  4: ['data_leak', 'ddos_overload', 'firewall_spike', 'packet_storm'],
};

export function skillsForTier(tier: number): string[] {
  return TIER_SKILL_LOADOUT[Math.max(1, Math.min(4, tier))] || ['data_leak'];
}
