/**
 * Operator Framework — Synergy Tree
 *
 * Design pillar (per the spec):
 *   "The player is a rogue operator deploying corrupted AI entities into
 *    unstable sectors. The skill tree must directly affect deployed
 *    entities so leveling the operator ALWAYS matters."
 *
 * Every node here is a PASSIVE the OPERATOR invests in. The numeric
 * effects buff (or modify) any ENTITY that is currently deployed.
 * Combat code reads the resolved `SynergyEffects` instead of mutating
 * the underlying entity stats — keeps captures pure + deterministic.
 *
 * No fantasy wording. Tone: eerie, synthetic, illegal, tactical.
 *
 * Branches:
 *   • DEPLOYMENT   — cheaper / faster / multi-target deploys
 *   • STABILITY    — entity HP retention + damage buffering
 *   • OVERCLOCK    — raw entity power & burst protocols
 *   • CORRUPTION   — DoT spread, status fields, leech
 *   • PROTOCOL     — chained actions, signature-specific bonuses
 */

export type SynergyBranchId =
  | 'deployment'
  | 'stability'
  | 'overclock'
  | 'corruption'
  | 'protocol';

export type SynergyNode = {
  id: string;
  branch: SynergyBranchId;
  name: string;       // SHORT — max ~14 chars, fits a button
  desc: string;       // 1-line cyber-flavor description
  effectText: string; // mechanical breakdown (shown in tooltip)
  reqLevel: number;
  prereq?: string;
  /** Tier within the branch — also acts as visual column. */
  tier: 1 | 2 | 3 | 4;
};

export const SYNERGY_BRANCHES: Record<SynergyBranchId, { label: string; color: string; sub: string }> = {
  deployment: { label: 'DEPLOYMENT',  color: '#5cf7c4', sub: 'cost / speed / count' },
  stability:  { label: 'STABILITY',   color: '#5cb3ff', sub: 'entity retention' },
  overclock:  { label: 'OVERCLOCK',   color: '#ffb24c', sub: 'damage protocols' },
  corruption: { label: 'CORRUPTION',  color: '#c46cff', sub: 'spread // leech' },
  protocol:   { label: 'PROTOCOL',    color: '#ff7aa8', sub: 'chains // signatures' },
};

export const SYNERGY_NODES: SynergyNode[] = [
  // ── DEPLOYMENT ─────────────────────────────────────────────────
  { id: 'dep_cheap_1',  branch: 'deployment', tier: 1, reqLevel: 1,  name: 'COST CUT I',     desc: 'Patched deploy stack — less PWR per call.',     effectText: 'Deploy PWR cost −2.' },
  { id: 'dep_cheap_2',  branch: 'deployment', tier: 2, reqLevel: 5,  prereq: 'dep_cheap_1',  name: 'COST CUT II',    desc: 'Recompiled handshake — entities answer faster.', effectText: 'Deploy PWR cost −4 total. Deploy ignores 1 stun.' },
  { id: 'dep_reboot',   branch: 'deployment', tier: 2, reqLevel: 4,  name: 'FAST REBOOT',    desc: 'Disconnected entities re-spawn at higher % stab.', effectText: 'Redeploys begin at 30% stability (was 25%).' },
  { id: 'dep_multi',    branch: 'deployment', tier: 4, reqLevel: 12, prereq: 'dep_cheap_2',  name: 'TWIN-DEPLOY',    desc: 'Late-game illegal protocol: second entity stays in escort mode.', effectText: 'Escort entity grants +15% ATK to main deployed.' },

  // ── STABILITY ──────────────────────────────────────────────────
  { id: 'stab_shield_1', branch: 'stability', tier: 1, reqLevel: 1,  name: 'BUFFER I',       desc: 'Reroute incoming dmg through operator cache.',     effectText: 'Deployed entity takes −10% damage.' },
  { id: 'stab_shield_2', branch: 'stability', tier: 2, reqLevel: 6,  prereq: 'stab_shield_1', name: 'BUFFER II',      desc: 'Operator absorbs 15% of all hits on entity.',       effectText: 'Entity dmg −10%; operator absorbs 15% of entity dmg.' },
  { id: 'stab_retain',   branch: 'stability', tier: 3, reqLevel: 9,  prereq: 'stab_shield_2', name: 'BIO-LATCH',       desc: 'Entity retains 25% stability through phase shifts.', effectText: 'Entity stability decays 25% slower per turn.' },
  { id: 'stab_revive',   branch: 'stability', tier: 4, reqLevel: 14, prereq: 'stab_retain',   name: 'HOT-PATCH',       desc: 'Once per fight, force a soft reboot.',              effectText: '1× per battle: redeploy at 60% stab when DISCONNECTED.' },

  // ── OVERCLOCK ──────────────────────────────────────────────────
  { id: 'oc_pwr_1',     branch: 'overclock', tier: 1, reqLevel: 2,  name: 'OVERCLOCK I',    desc: 'Push entity registers past spec.',                  effectText: 'Deployed entity ATK +12%.' },
  { id: 'oc_pwr_2',     branch: 'overclock', tier: 2, reqLevel: 7,  prereq: 'oc_pwr_1',     name: 'OVERCLOCK II',   desc: 'Heat-sink optional. Risky but lethal.',             effectText: 'Entity ATK +25% but stability drains 5%/turn.' },
  { id: 'oc_crit',      branch: 'overclock', tier: 3, reqLevel: 10, prereq: 'oc_pwr_1',     name: 'SPIKE',          desc: 'Entity occasionally fires a corrupted payload.',     effectText: '20% chance entity skills crit (×1.5).' },
  { id: 'oc_signature', branch: 'overclock', tier: 4, reqLevel: 15, prereq: 'oc_crit',      name: 'SIGNATURE+',     desc: 'Empower an entity\'s signature move.',              effectText: 'Each entity\'s slot-4 skill: +35% damage.' },

  // ── CORRUPTION ─────────────────────────────────────────────────
  { id: 'corr_spread_1', branch: 'corruption', tier: 1, reqLevel: 3,  name: 'SPREAD I',       desc: 'Entity hits leave latent corruption residue.',     effectText: 'Hits apply 2-turn corruption: 4 dmg/turn.' },
  { id: 'corr_leech',    branch: 'corruption', tier: 2, reqLevel: 8,  prereq: 'corr_spread_1', name: 'BIO-LEECH',     desc: 'Corruption damage feeds your operator.',           effectText: '50% of corruption damage heals operator STAB.' },
  { id: 'corr_field',    branch: 'corruption', tier: 3, reqLevel: 11, prereq: 'corr_leech',    name: 'GLITCH FIELD',   desc: 'Persistent corruption field around the entity.',   effectText: 'Enemy turn: 25% chance to misfire (skip).' },
  { id: 'corr_purge',    branch: 'corruption', tier: 4, reqLevel: 16, prereq: 'corr_field',    name: 'FULL PURGE',     desc: 'On disconnect, entity detonates residue.',          effectText: 'When entity disconnects, deal 25% of its max stab to enemy.' },

  // ── PROTOCOL ───────────────────────────────────────────────────
  { id: 'proto_chain_1', branch: 'protocol', tier: 1, reqLevel: 4,  name: 'CHAIN I',        desc: '15% chance entity gets a second action.',           effectText: 'Entity acts twice on 15% of turns.' },
  { id: 'proto_quick',   branch: 'protocol', tier: 2, reqLevel: 8,  prereq: 'proto_chain_1', name: 'PRIORITY',       desc: 'Entity always acts before enemy after deploy.',     effectText: 'Deployed entity has +SPD priority next turn.' },
  { id: 'proto_chain_2', branch: 'protocol', tier: 3, reqLevel: 13, prereq: 'proto_chain_1', name: 'CHAIN II',       desc: 'Chain rate doubled.',                              effectText: 'Entity 2-action chance: 30%.' },
  { id: 'proto_passive', branch: 'protocol', tier: 4, reqLevel: 17, prereq: 'proto_chain_2', name: 'PASSIVE GRID',   desc: 'Operator\'s solo turns still empower the deployed.', effectText: 'Player attacks restore 6% entity stability.' },
];

/** Resolved synergy snapshot — read by combat code. */
export type SynergyEffects = {
  deployPwrCostMod: number;   // negative = cheaper
  redeployStabPct: number;    // 0.25..1.0
  hotPatchAvailable: boolean; // once-per-battle revive
  entityDmgTakenMod: number;  // -0.20 = 20% less
  operatorAbsorbPct: number;  // share of entity dmg → operator
  entityStabDecayMod: number; // -0.25 = decays 25% slower
  entityAtkMod: number;       // +0.25 = +25% atk
  entityStabSelfDrain: number; // per-turn % stab loss (overclock II cost)
  entityCritChance: number;   // 0..1
  entitySignatureBonus: number; // applied to slot-4 skills
  corruptionDpt: number;      // dmg per turn when applying corruption
  corruptionTurns: number;
  corruptionLeechPct: number; // operator heal
  glitchMisfireChance: number;
  purgeOnDisconnectPct: number;
  chainActionChance: number;
  priorityNextTurn: boolean;
  passiveStabRestorePct: number; // when operator attacks, restore % stab
  ownedNodes: string[];
};

const ZERO: SynergyEffects = {
  deployPwrCostMod: 0,
  redeployStabPct: 0.25,
  hotPatchAvailable: false,
  entityDmgTakenMod: 0,
  operatorAbsorbPct: 0,
  entityStabDecayMod: 0,
  entityAtkMod: 0,
  entityStabSelfDrain: 0,
  entityCritChance: 0,
  entitySignatureBonus: 0,
  corruptionDpt: 0,
  corruptionTurns: 0,
  corruptionLeechPct: 0,
  glitchMisfireChance: 0,
  purgeOnDisconnectPct: 0,
  chainActionChance: 0,
  priorityNextTurn: false,
  passiveStabRestorePct: 0,
  ownedNodes: [],
};

/**
 * Resolves the player's owned synergy node ids into a SynergyEffects
 * snapshot. Pure function — call once per combat turn.
 */
export function computeSynergy(ownedIds: string[] | undefined): SynergyEffects {
  const fx: SynergyEffects = { ...ZERO, ownedNodes: ownedIds ? [...ownedIds] : [] };
  if (!ownedIds || ownedIds.length === 0) return fx;
  const has = (id: string) => ownedIds.includes(id);

  // DEPLOYMENT
  if (has('dep_cheap_1')) fx.deployPwrCostMod -= 2;
  if (has('dep_cheap_2')) fx.deployPwrCostMod -= 2; // total −4
  if (has('dep_reboot'))  fx.redeployStabPct = 0.30;
  if (has('dep_multi'))   fx.entityAtkMod += 0.15;  // simulated escort buff

  // STABILITY
  if (has('stab_shield_1')) fx.entityDmgTakenMod -= 0.10;
  if (has('stab_shield_2')) fx.operatorAbsorbPct += 0.15;
  if (has('stab_retain'))   fx.entityStabDecayMod = -0.25;
  if (has('stab_revive'))   fx.hotPatchAvailable = true;

  // OVERCLOCK
  if (has('oc_pwr_1')) fx.entityAtkMod += 0.12;
  if (has('oc_pwr_2')) { fx.entityAtkMod += 0.13; fx.entityStabSelfDrain += 0.05; }
  if (has('oc_crit'))  fx.entityCritChance += 0.20;
  if (has('oc_signature')) fx.entitySignatureBonus += 0.35;

  // CORRUPTION
  if (has('corr_spread_1')) { fx.corruptionDpt = 4; fx.corruptionTurns = 2; }
  if (has('corr_leech'))    fx.corruptionLeechPct = 0.50;
  if (has('corr_field'))    fx.glitchMisfireChance = 0.25;
  if (has('corr_purge'))    fx.purgeOnDisconnectPct = 0.25;

  // PROTOCOL
  if (has('proto_chain_1')) fx.chainActionChance = 0.15;
  if (has('proto_chain_2')) fx.chainActionChance = 0.30;
  if (has('proto_quick'))   fx.priorityNextTurn = true;
  if (has('proto_passive')) fx.passiveStabRestorePct = 0.06;

  return fx;
}

/** Returns owned node list from a GameState player object safely. */
export function getOwnedSynergy(player: { synergyNodes?: string[] } | undefined): string[] {
  return player?.synergyNodes ?? [];
}
