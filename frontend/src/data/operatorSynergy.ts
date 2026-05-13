/**
 * Operator Framework — Synergy Grid v2 (Cyber Identity Pass)
 *
 * Theme rule: every node MUST read as an illegal AI modification.
 * No fantasy / RPG terms. No "buff", "boost", "heal" — use BLEED,
 * BUFFER, REBOOT, CRASH, PATCH, LEAK, INJECTION.
 *
 * Five branches — each a school of forbidden engineering:
 *   ▸ DEPLOYMENT — handshake / spawn / network
 *   ▸ STABILITY  — armor / shielding / latch
 *   ▸ OVERCLOCK  — damage / spikes / signatures
 *   ▸ CORRUPTION — DoT / spread / leech / detonation
 *   ▸ PROTOCOL   — chains / priority / passive grid
 *
 * Rarity tiers control visual weight in the grid:
 *   common  — T1 utility (subtle border)
 *   rare    — T2 specialised mod (cyan rim)
 *   illegal — T3 high-risk illegal patch (magenta/violet rim + pulse)
 *   mythic  — T4 capstone signature mod (gold rim + double pulse)
 */

export type SynergyBranchId =
  | 'deployment'
  | 'stability'
  | 'overclock'
  | 'corruption'
  | 'protocol';

export type SynergyRarity = 'common' | 'rare' | 'illegal' | 'mythic';

export type SynergyNode = {
  id: string;
  branch: SynergyBranchId;
  name: string;       // SHORT (≤14 chars)
  flavor: string;     // 1-line eerie description
  effectText: string; // mechanical breakdown
  reqLevel: number;
  prereq?: string;
  tier: 1 | 2 | 3 | 4;
  rarity: SynergyRarity;
};

export const SYNERGY_BRANCHES: Record<
  SynergyBranchId,
  { label: string; color: string; rimColor: string; sub: string; glyph: string }
> = {
  deployment: {
    label: 'DEPLOYMENT',
    color: '#5cf7c4',
    rimColor: '#00ffae',
    sub: 'handshake // spawn // escort',
    glyph: '◇',
  },
  stability: {
    label: 'STABILITY',
    color: '#5cb3ff',
    rimColor: '#3aa0ff',
    sub: 'shielding // dmg buffer',
    glyph: '◈',
  },
  overclock: {
    label: 'OVERCLOCK',
    color: '#ffb24c',
    rimColor: '#ff8c00',
    sub: 'spikes // damage protocols',
    glyph: '▲',
  },
  corruption: {
    label: 'CORRUPTION',
    color: '#c46cff',
    rimColor: '#a040ff',
    sub: 'spread // leech // detonate',
    glyph: '✦',
  },
  protocol: {
    label: 'PROTOCOL',
    color: '#ff7aa8',
    rimColor: '#ff4789',
    sub: 'chains // priority',
    glyph: '⌬',
  },
};

export const RARITY_VISUAL: Record<
  SynergyRarity,
  { rim: string; bgGlow: string; pulse: 0 | 1 | 2; label: string }
> = {
  common:  { rim: '#3a3a55', bgGlow: 'transparent',           pulse: 0, label: 'COMMON'  },
  rare:    { rim: '#5cb3ff', bgGlow: 'rgba(92,179,255,0.10)', pulse: 1, label: 'RARE'    },
  illegal: { rim: '#c46cff', bgGlow: 'rgba(196,108,255,0.14)', pulse: 1, label: 'ILLEGAL' },
  mythic:  { rim: '#ffd24a', bgGlow: 'rgba(255,210,74,0.18)', pulse: 2, label: 'MYTHIC'  },
};

export const SYNERGY_NODES: SynergyNode[] = [
  // ── DEPLOYMENT ────────────────────────────────────────────────────
  { id: 'dep_cheap_1',  branch: 'deployment', tier: 1, rarity: 'common',  reqLevel: 1,
    name: 'HANDSHAKE',
    flavor: 'Patched deploy stack — entities answer for less.',
    effectText: 'Deploy PWR cost −2.' },
  { id: 'dep_cheap_2',  branch: 'deployment', tier: 2, rarity: 'rare',    reqLevel: 5, prereq: 'dep_cheap_1',
    name: 'NULL CALL',
    flavor: 'Bypass the auth gate. Network never logs the deploy.',
    effectText: 'Deploy PWR cost −4 total. Deploy ignores 1 stun.' },
  { id: 'dep_reboot',   branch: 'deployment', tier: 2, rarity: 'rare',    reqLevel: 4,
    name: 'FAST REBOOT',
    flavor: 'Force-mount entities from cache. Memory leaks ignored.',
    effectText: 'Redeploys begin at 30% stability (was 25%).' },
  { id: 'dep_multi',    branch: 'deployment', tier: 4, rarity: 'mythic',  reqLevel: 12, prereq: 'dep_cheap_2',
    name: 'HIVE LINK',
    flavor: 'Second entity tethered in shadow-escort. Network screams.',
    effectText: 'Escort entity grants +15% ATK to main deployed.' },

  // ── STABILITY ─────────────────────────────────────────────────────
  { id: 'stab_shield_1', branch: 'stability', tier: 1, rarity: 'common',  reqLevel: 1,
    name: 'NULL SHIELD',
    flavor: 'Route incoming damage through the operator\'s null cache.',
    effectText: 'Deployed entity takes −10% damage.' },
  { id: 'stab_shield_2', branch: 'stability', tier: 2, rarity: 'rare',    reqLevel: 6, prereq: 'stab_shield_1',
    name: 'PROXY ABSORB',
    flavor: 'Operator absorbs 15% of all hits. Pain is shared.',
    effectText: 'Entity dmg −10%; operator absorbs 15% of entity dmg.' },
  { id: 'stab_retain',   branch: 'stability', tier: 3, rarity: 'illegal', reqLevel: 9, prereq: 'stab_shield_2',
    name: 'BIO-LATCH',
    flavor: 'Entity bonds to the operator\'s nervous system. Decay slows.',
    effectText: 'Entity stability decays 25% slower per turn.' },
  { id: 'stab_revive',   branch: 'stability', tier: 4, rarity: 'mythic',  reqLevel: 14, prereq: 'stab_retain',
    name: 'HOT-PATCH',
    flavor: 'Illegal soft-reboot — once. Network noticed.',
    effectText: '1× per battle: redeploy at 60% stab when DISCONNECTED.' },

  // ── OVERCLOCK ─────────────────────────────────────────────────────
  { id: 'oc_pwr_1',     branch: 'overclock', tier: 1, rarity: 'common',   reqLevel: 2,
    name: 'STACK PUSH',
    flavor: 'Force the entity past spec. Heat warnings ignored.',
    effectText: 'Deployed entity ATK +12%.' },
  { id: 'oc_pwr_2',     branch: 'overclock', tier: 2, rarity: 'rare',     reqLevel: 7, prereq: 'oc_pwr_1',
    name: 'CORE LEAK',
    flavor: 'Burn fuel through the entity\'s core. Risky.',
    effectText: 'Entity ATK +25% but stability drains 5%/turn.' },
  { id: 'oc_crit',      branch: 'overclock', tier: 3, rarity: 'illegal',  reqLevel: 10, prereq: 'oc_pwr_1',
    name: 'SIGNAL BLEED',
    flavor: 'Hits leak corrupted instruction packets. Random spikes.',
    effectText: '20% chance entity skills crit (×1.5).' },
  { id: 'oc_signature', branch: 'overclock', tier: 4, rarity: 'mythic',   reqLevel: 15, prereq: 'oc_crit',
    name: 'SIGNATURE+',
    flavor: 'Empower the entity\'s deepest signature subroutine.',
    effectText: 'Each entity\'s slot-4 skill: +35% damage.' },

  // ── CORRUPTION ────────────────────────────────────────────────────
  { id: 'corr_spread_1', branch: 'corruption', tier: 1, rarity: 'common',  reqLevel: 3,
    name: 'STACK INJECT',
    flavor: 'Inject latent malware on every hit. Slow decay.',
    effectText: 'Hits apply 2-turn corruption: 4 dmg/turn.' },
  { id: 'corr_leech',    branch: 'corruption', tier: 2, rarity: 'rare',    reqLevel: 8, prereq: 'corr_spread_1',
    name: 'BIO-LEECH',
    flavor: 'Corruption data is rerouted into the operator\'s veins.',
    effectText: '50% of corruption damage heals operator STAB.' },
  { id: 'corr_field',    branch: 'corruption', tier: 3, rarity: 'illegal', reqLevel: 11, prereq: 'corr_leech',
    name: 'GLITCH FIELD',
    flavor: 'Persistent corruption field. The enemy\'s targeting falters.',
    effectText: 'Enemy turn: 25% chance to misfire (skip).' },
  { id: 'corr_purge',    branch: 'corruption', tier: 4, rarity: 'mythic',  reqLevel: 16, prereq: 'corr_field',
    name: 'FULL PURGE',
    flavor: 'When the entity dies, it detonates everything it absorbed.',
    effectText: 'On DISCONNECT, deal 25% of entity max stab to enemy.' },

  // ── PROTOCOL ──────────────────────────────────────────────────────
  { id: 'proto_chain_1', branch: 'protocol', tier: 1, rarity: 'common',   reqLevel: 4,
    name: 'THREAD SPLIT',
    flavor: 'Fork the entity\'s action thread. Sometimes it runs twice.',
    effectText: 'Entity acts twice on 15% of turns.' },
  { id: 'proto_quick',   branch: 'protocol', tier: 2, rarity: 'rare',     reqLevel: 8, prereq: 'proto_chain_1',
    name: 'MIRROR-PING',
    flavor: 'Echo the deploy command. Entity acts first.',
    effectText: 'Deployed entity has +SPD priority next turn.' },
  { id: 'proto_chain_2', branch: 'protocol', tier: 3, rarity: 'illegal',  reqLevel: 13, prereq: 'proto_chain_1',
    name: 'EXECUTE CHAIN',
    flavor: 'Chain rate doubled. Network throttles you for it.',
    effectText: 'Entity 2-action chance: 30%.' },
  { id: 'proto_passive', branch: 'protocol', tier: 4, rarity: 'mythic',   reqLevel: 17, prereq: 'proto_chain_2',
    name: 'GHOST GRID',
    flavor: 'Operator\'s solo strikes feed the deployed entity in shadow.',
    effectText: 'Player attacks restore 6% entity stability.' },
];

/** Resolved synergy snapshot — read by combat code. */
export type SynergyEffects = {
  deployPwrCostMod: number;
  redeployStabPct: number;
  hotPatchAvailable: boolean;
  entityDmgTakenMod: number;
  operatorAbsorbPct: number;
  entityStabDecayMod: number;
  entityAtkMod: number;
  entityStabSelfDrain: number;
  entityCritChance: number;
  entitySignatureBonus: number;
  corruptionDpt: number;
  corruptionTurns: number;
  corruptionLeechPct: number;
  glitchMisfireChance: number;
  purgeOnDisconnectPct: number;
  chainActionChance: number;
  priorityNextTurn: boolean;
  passiveStabRestorePct: number;
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

export function computeSynergy(ownedIds: string[] | undefined): SynergyEffects {
  const fx: SynergyEffects = { ...ZERO, ownedNodes: ownedIds ? [...ownedIds] : [] };
  if (!ownedIds || ownedIds.length === 0) return fx;
  const has = (id: string) => ownedIds.includes(id);

  if (has('dep_cheap_1')) fx.deployPwrCostMod -= 2;
  if (has('dep_cheap_2')) fx.deployPwrCostMod -= 2;
  if (has('dep_reboot'))  fx.redeployStabPct = 0.30;
  if (has('dep_multi'))   fx.entityAtkMod += 0.15;

  if (has('stab_shield_1')) fx.entityDmgTakenMod -= 0.10;
  if (has('stab_shield_2')) fx.operatorAbsorbPct += 0.15;
  if (has('stab_retain'))   fx.entityStabDecayMod = -0.25;
  if (has('stab_revive'))   fx.hotPatchAvailable = true;

  if (has('oc_pwr_1')) fx.entityAtkMod += 0.12;
  if (has('oc_pwr_2')) { fx.entityAtkMod += 0.13; fx.entityStabSelfDrain += 0.05; }
  if (has('oc_crit'))  fx.entityCritChance += 0.20;
  if (has('oc_signature')) fx.entitySignatureBonus += 0.35;

  if (has('corr_spread_1')) { fx.corruptionDpt = 4; fx.corruptionTurns = 2; }
  if (has('corr_leech'))    fx.corruptionLeechPct = 0.50;
  if (has('corr_field'))    fx.glitchMisfireChance = 0.25;
  if (has('corr_purge'))    fx.purgeOnDisconnectPct = 0.25;

  if (has('proto_chain_1')) fx.chainActionChance = 0.15;
  if (has('proto_chain_2')) fx.chainActionChance = 0.30;
  if (has('proto_quick'))   fx.priorityNextTurn = true;
  if (has('proto_passive')) fx.passiveStabRestorePct = 0.06;

  return fx;
}

export function getOwnedSynergy(player: { synergyNodes?: string[] } | undefined): string[] {
  return player?.synergyNodes ?? [];
}

/** Short summary string for the combat HUD ("OC+SHLD+SPREAD"). */
export function summarizeActiveSynergy(ownedIds: string[] | undefined, deployed: boolean): string[] {
  if (!ownedIds || ownedIds.length === 0 || !deployed) return [];
  const tags: string[] = [];
  if (ownedIds.includes('oc_pwr_1') || ownedIds.includes('oc_pwr_2')) tags.push('OC');
  if (ownedIds.includes('stab_shield_1')) tags.push('SHLD');
  if (ownedIds.includes('corr_spread_1')) tags.push('SPRD');
  if (ownedIds.includes('corr_field')) tags.push('FIELD');
  if (ownedIds.includes('proto_chain_1')) tags.push('CHAIN');
  if (ownedIds.includes('stab_revive')) tags.push('HOT-PATCH');
  return tags;
}
