// ============================================================
// COMBAT BALANCE — Faction type-chart, minion roles, status
// effects, and signature abilities. This module is what turns
// "minions are weaker player clones" into "minions are
// strategic tools the player must wield correctly".
//
// Design philosophy:
//   • Player = reliable / adaptable / baseline damage / survival.
//   • Minion = specialized / situational / high-impact.
//   • The right minion vs the right faction is dramatically
//     better than the player's bare-handed attack.
//
// Imports avoided here on purpose — this is a pure data + small
// helper module so combat.tsx and game.tsx can pull from it
// without circular dependencies.
// ============================================================

import { FactionId } from './factions';

// ──────────────────────────────────────────────────────────
// 1. TYPE CHART — attacker-faction × defender-faction multiplier.
//
// Read as: TYPE_CHART[attacker][defender] = damage multiplier
//   2.0 = obliterates   (signature counter)
//   1.5 = strong vs
//   1.0 = neutral
//   0.6 = resisted
//
// Rules of thumb encoded:
//   🟣 corrupted_ai  → strong vs industrial (hacks them), weak vs cyber_mutant
//   🔵 industrial_bot → strong vs cyber_mutant (sterilises), weak vs corrupted_ai
//   🔴 cyber_mutant   → strong vs corrupted_ai (organic > virus), weak vs industrial
//   🟡 rogue_military → tactical generalist, weak vs corrupted_ai (gets hacked)
//   💚 player         → no faction; always 1.0×.
//   💗 boss           → resists everything 0.85×.
// ──────────────────────────────────────────────────────────
type ChartRow = Partial<Record<FactionId, number>>;
export const TYPE_CHART: Record<FactionId, ChartRow> = {
  corrupted_ai: {
    industrial_bot: 1.8,   // hacks/EMPs metal
    cyber_mutant:   0.6,   // organic mass resists code
    rogue_military: 1.5,   // disrupts comms
    corrupted_ai:   0.9,   // mirror match
    boss:           0.85,
    player:         1.0,
    npc_friendly:   1.0,
  },
  industrial_bot: {
    cyber_mutant:   1.8,   // plasma sterilisers
    corrupted_ai:   0.6,   // shields up vs code
    rogue_military: 1.2,
    industrial_bot: 0.9,
    boss:           0.85,
    player:         1.0,
    npc_friendly:   1.0,
  },
  cyber_mutant: {
    corrupted_ai:   1.8,   // bites through virtuals
    industrial_bot: 0.6,   // claws can't pierce armour
    rogue_military: 1.4,
    cyber_mutant:   0.9,
    boss:           0.85,
    player:         1.1,
    npc_friendly:   1.0,
  },
  rogue_military: {
    corrupted_ai:   0.6,   // gets hacked
    industrial_bot: 1.4,   // anti-armour rounds
    cyber_mutant:   1.5,   // suppression fire works
    rogue_military: 0.9,
    boss:           0.85,
    player:         1.0,
    npc_friendly:   1.0,
  },
  player: {
    corrupted_ai:   1.0,
    industrial_bot: 1.0,
    cyber_mutant:   1.0,
    rogue_military: 1.0,
    boss:           0.95,
    player:         1.0,
    npc_friendly:   1.0,
  },
  npc_friendly: { player: 1.0 },
  boss: {
    corrupted_ai:   1.2,
    industrial_bot: 1.2,
    cyber_mutant:   1.2,
    rogue_military: 1.2,
    boss:           1.0,
    player:         1.3,
    npc_friendly:   1.0,
  },
};

export type EffectivenessTier = 'super' | 'strong' | 'neutral' | 'resisted' | 'immune';
export function classifyEffectiveness(mult: number): EffectivenessTier {
  if (mult >= 1.7) return 'super';
  if (mult >= 1.25) return 'strong';
  if (mult <= 0.5) return 'immune';
  if (mult < 0.95) return 'resisted';
  return 'neutral';
}
export function getTypeMultiplier(atk: FactionId, def: FactionId): number {
  return TYPE_CHART[atk]?.[def] ?? 1.0;
}

// ──────────────────────────────────────────────────────────
// 2. MINION ROLES — battlefield jobs.
//
// Each role grants stat multipliers + a "play pattern" that
// the player learns to value. Roles are intentionally lopsided
// so no single minion is good at everything.
// ──────────────────────────────────────────────────────────
export type MinionRole =
  | 'tank'         // TANK — soaks hits for the player
  | 'striker'      // ASSAULT — burst single-target damage
  | 'disruptor'    // HACKER — status-effect specialist
  | 'support'      // SUPPORT — heals / shields / buffs
  | 'artillery'    // CORRUPTION — DoT specialist, fragile
  | 'swarm';       // SWARM — fast weak attackers, stacking bleed

export type RoleDef = {
  id: MinionRole;
  label: string;
  /** Stat multipliers applied on deploy. */
  mods: { hp: number; atk: number; def: number; spd: number };
  /** Probability bonus applied to status-effect application chance. */
  statusBonus: number;
  /** Flat % chance to crit (additive over base 5%). */
  critBonus: number;
  /** Short description shown in UI. */
  blurb: string;
};
export const ROLES: Record<MinionRole, RoleDef> = {
  tank: {
    id: 'tank',
    label: 'TANK',
    mods: { hp: 1.55, atk: 0.85, def: 1.50, spd: 0.85 },
    statusBonus: 0.0,
    critBonus: 0,
    blurb: 'Absorbs damage, intercepts hits.',
  },
  striker: {
    id: 'striker',
    label: 'ASSAULT',
    mods: { hp: 0.95, atk: 1.35, def: 0.95, spd: 1.10 },
    statusBonus: 0.0,
    critBonus: 0.15,
    blurb: 'High single-target burst & system breach chance.',
  },
  disruptor: {
    id: 'disruptor',
    label: 'HACKER',
    mods: { hp: 0.90, atk: 1.00, def: 0.90, spd: 1.20 },
    statusBonus: 0.50,
    critBonus: 0,
    blurb: 'Disables, stuns, drains POWER GRID.',
  },
  support: {
    id: 'support',
    label: 'SUPPORT',
    mods: { hp: 1.10, atk: 0.80, def: 1.15, spd: 1.00 },
    statusBonus: 0.0,
    critBonus: 0,
    blurb: 'Heals & shields the NETWORK.',
  },
  artillery: {
    id: 'artillery',
    label: 'CORRUPTION',
    mods: { hp: 0.80, atk: 1.55, def: 0.75, spd: 0.95 },
    statusBonus: 0.35,
    critBonus: 0.08,
    blurb: 'Massive DoT, fragile shell.',
  },
  swarm: {
    id: 'swarm',
    label: 'SWARM',
    mods: { hp: 0.70, atk: 1.10, def: 0.70, spd: 1.40 },
    statusBonus: 0.30,
    critBonus: 0.05,
    blurb: 'Fast weak hits, stacking bleed.',
  },
};

// ──────────────────────────────────────────────────────────
// 3. SPECIES → ROLE + FACTION MAP
//
// Every captured / wild minion species belongs to a faction
// AND a role. The pair determines how it plays.
// Unknown species default to (corrupted_ai, striker).
// ──────────────────────────────────────────────────────────
export const SPECIES_KIT: Record<string, { faction: FactionId; role: MinionRole }> = {
  // Phreaks — disruptors that hack metal
  phreak_1: { faction: 'corrupted_ai', role: 'disruptor' },
  phreak_2: { faction: 'corrupted_ai', role: 'disruptor' },
  phreak_3: { faction: 'corrupted_ai', role: 'artillery' },
  phreak_4: { faction: 'corrupted_ai', role: 'striker' },
  // VR-Ghosts — mutant strikers / supports
  vrghost_1: { faction: 'cyber_mutant', role: 'striker' },
  vrghost_2: { faction: 'cyber_mutant', role: 'support' },
  vrghost_3: { faction: 'cyber_mutant', role: 'striker' },
  vrghost_4: { faction: 'cyber_mutant', role: 'artillery' },
  // Mechs — industrial tanks / military strikers
  mech_1: { faction: 'industrial_bot', role: 'tank' },
  mech_2: { faction: 'industrial_bot', role: 'tank' },
  mech_3: { faction: 'rogue_military', role: 'striker' },
  mech_4: { faction: 'rogue_military', role: 'tank' },
  // Misc legacy
  tinkerer_drone: { faction: 'industrial_bot', role: 'disruptor' },
};
export function getSpeciesKit(speciesId: string): { faction: FactionId; role: MinionRole } {
  return SPECIES_KIT[speciesId] || { faction: 'corrupted_ai', role: 'striker' };
}

// ──────────────────────────────────────────────────────────
// 4. STATUS EFFECT DEFINITIONS
//
// Status effects are the second pillar of "minion value" — many
// of them are ONLY applicable by minion signature skills (player
// can't apply them with basic strike).
// ──────────────────────────────────────────────────────────
export type StatusId =
  | 'burn'         // DoT — physical
  | 'shock'        // DoT — energy + chance to skip turn
  | 'corrupt'      // DoT — cyber + reduces enemy ATK
  | 'slow'         // halves enemy SPD
  | 'armor_break'  // halves enemy DEF
  | 'stun'         // skip 1 turn outright
  | 'fear'         // enemy 25% chance to fail their turn
  | 'drain';       // damage heals attacker

export type StatusInstance = {
  id: StatusId;
  turns: number;
  /** Source stat used for DoT magnitude (e.g. attacker's atk). */
  power: number;
};
export type StatusDef = {
  id: StatusId;
  label: string;
  icon: string;          // single glyph — combat UI overlay
  color: string;         // tint
  tickDmgPct: number;    // % of power dealt as DoT each tick (0 = no DoT)
  modsTarget: {          // multipliers applied to the AFFLICTED while active
    atk?: number;
    def?: number;
    spd?: number;
    skipChance?: number; // 0..1 chance to skip their turn
  };
  blurb: string;
};
export const STATUSES: Record<StatusId, StatusDef> = {
  burn:        { id:'burn',        label:'BURN',    icon:'🔥', color:'#ff6a2a', tickDmgPct: 0.18, modsTarget:{}, blurb:'Burning. Loses HP each turn.' },
  shock:       { id:'shock',       label:'SHOCK',   icon:'⚡', color:'#00f0ff', tickDmgPct: 0.12, modsTarget:{ skipChance: 0.25 }, blurb:'Electrified. Sometimes misses turns.' },
  corrupt:     { id:'corrupt',     label:'CORRUPT', icon:'☠',  color:'#c060ff', tickDmgPct: 0.15, modsTarget:{ atk: 0.7 }, blurb:'Code rot. Weakened attacks + DoT.' },
  slow:        { id:'slow',        label:'SLOW',    icon:'❄',  color:'#80c8ff', tickDmgPct: 0.0,  modsTarget:{ spd: 0.5 }, blurb:'Movement halved.' },
  armor_break: { id:'armor_break', label:'BREAK',   icon:'✦',  color:'#ffd000', tickDmgPct: 0.0,  modsTarget:{ def: 0.5 }, blurb:'Armour shattered. Defence halved.' },
  stun:        { id:'stun',        label:'STUN',    icon:'★',  color:'#fff066', tickDmgPct: 0.0,  modsTarget:{ skipChance: 1.0 }, blurb:'Stunned. Loses next turn.' },
  fear:        { id:'fear',        label:'FEAR',    icon:'!',  color:'#a050ff', tickDmgPct: 0.0,  modsTarget:{ skipChance: 0.25, atk: 0.8 }, blurb:'Terrified. Stumbles in fight.' },
  drain:       { id:'drain',       label:'DRAIN',   icon:'❖',  color:'#80ff80', tickDmgPct: 0.10, modsTarget:{}, blurb:'Life-leech. Healing attacker.' },
};

/** Aggregate every status on a combatant into modifier multipliers. */
export function aggregateStatusMods(active: StatusInstance[]) {
  let atk = 1, def = 1, spd = 1, skip = 0;
  for (const s of active) {
    const m = STATUSES[s.id].modsTarget;
    if (m.atk) atk *= m.atk;
    if (m.def) def *= m.def;
    if (m.spd) spd *= m.spd;
    if (m.skipChance) skip = Math.max(skip, m.skipChance);
  }
  return { atk, def, spd, skip };
}

// ──────────────────────────────────────────────────────────
// 5. MINION SIGNATURE ABILITIES
//
// These are powerful, faction-flavoured skills that ONLY appear
// when the player has deployed the matching minion. They are
// the primary reason to use a minion over the player's basic kit.
//
// Player cannot learn these. They auto-appear in the minion's
// skill panel based on its species.
// ──────────────────────────────────────────────────────────
export type SignatureAbility = {
  id: string;
  name: string;
  desc: string;
  cost: number;
  power: number;
  element: 'physical' | 'cyber' | 'energy' | 'psi';
  /** Status to apply on hit (with chance). */
  applies?: { status: StatusId; turns: number; chance: number };
  /** Cooldown in turns (0 = always available). */
  cooldown: number;
  /** Which species unlock this. */
  unlockedBy: string[];
  /** Faction this signature belongs to — for type-chart calc. */
  faction: FactionId;
};
export const SIGNATURES: Record<string, SignatureAbility> = {
  // 🟣 Corrupted-AI — disruption / DoT
  glitch_beam: {
    id: 'glitch_beam', name: 'GLITCH BEAM',
    desc: 'Corrupting code lance. Applies CORRUPT (DoT + atk down).',
    cost: 8, power: 1.4, element: 'cyber',
    applies: { status: 'corrupt', turns: 3, chance: 0.85 },
    cooldown: 2,
    unlockedBy: ['phreak_1', 'phreak_2', 'phreak_3', 'phreak_4'],
    faction: 'corrupted_ai',
  },
  hack_override: {
    id: 'hack_override', name: 'HACK OVERRIDE',
    desc: 'Force-stun a metallic target for 1 turn.',
    cost: 14, power: 0.7, element: 'cyber',
    applies: { status: 'stun', turns: 1, chance: 1.0 },
    cooldown: 4,
    unlockedBy: ['phreak_3', 'phreak_4'],
    faction: 'corrupted_ai',
  },
  // 🔴 Cyber-Mutant — burst & life-leech
  claw_rend: {
    id: 'claw_rend', name: 'CLAW REND',
    desc: 'Sundering swipe. ARMOR BREAK on hit.',
    cost: 6, power: 1.5, element: 'physical',
    applies: { status: 'armor_break', turns: 3, chance: 0.9 },
    cooldown: 1,
    unlockedBy: ['vrghost_1', 'vrghost_3', 'vrghost_4'],
    faction: 'cyber_mutant',
  },
  blood_drain: {
    id: 'blood_drain', name: 'BLOOD DRAIN',
    desc: 'Bite that returns 60% damage as HP to the team.',
    cost: 10, power: 1.2, element: 'physical',
    applies: { status: 'drain', turns: 2, chance: 1.0 },
    cooldown: 3,
    unlockedBy: ['vrghost_2', 'vrghost_4'],
    faction: 'cyber_mutant',
  },
  // 🔵 Industrial-Bot — control & tanking
  emp_pulse: {
    id: 'emp_pulse', name: 'EMP PULSE',
    desc: 'Electromagnetic burst. SHOCK + chance to stun.',
    cost: 10, power: 1.1, element: 'energy',
    applies: { status: 'shock', turns: 3, chance: 0.95 },
    cooldown: 3,
    unlockedBy: ['mech_1', 'mech_2', 'tinkerer_drone'],
    faction: 'industrial_bot',
  },
  shield_wall: {
    id: 'shield_wall', name: 'SHIELD WALL',
    desc: 'Project a shield. Player+minion take 50% damage 2 turns.',
    cost: 12, power: 0, element: 'energy',
    cooldown: 4,
    unlockedBy: ['mech_2', 'mech_4'],
    faction: 'industrial_bot',
  },
  // 🟡 Rogue-Military — heavy single-target
  mark_target: {
    id: 'mark_target', name: 'MARK TARGET',
    desc: 'Laser-paint. All damage to target +40% for 2 turns.',
    cost: 6, power: 0.8, element: 'physical',
    applies: { status: 'fear', turns: 2, chance: 1.0 },
    cooldown: 3,
    unlockedBy: ['mech_3'],
    faction: 'rogue_military',
  },
  rocket_volley: {
    id: 'rocket_volley', name: 'ROCKET VOLLEY',
    desc: 'Triple high-explosive payload. Massive burst.',
    cost: 16, power: 2.6, element: 'physical',
    applies: { status: 'burn', turns: 2, chance: 0.5 },
    cooldown: 5,
    unlockedBy: ['mech_3', 'mech_4'],
    faction: 'rogue_military',
  },
};

/** Get all signature abilities available to a deployed species. */
export function getSignaturesForSpecies(speciesId: string): SignatureAbility[] {
  return Object.values(SIGNATURES).filter((s) => s.unlockedBy.includes(speciesId));
}

// ──────────────────────────────────────────────────────────
// 6. PLAYER vs MINION damage gates
//
// Player baseline never benefits from type-chart. So vs a faction
// that's super-effective to a minion, the minion can hit for ~1.8×
// while the player hits for 1.0×. This is the strategic pull.
//
// Helper for combat.tsx — call this in computeDamage().
// ──────────────────────────────────────────────────────────
export function combatMultiplier(
  attackerFaction: FactionId,
  defenderFaction: FactionId,
  roleCritBonus = 0,
): { mult: number; crit: boolean; tier: EffectivenessTier } {
  const mult = getTypeMultiplier(attackerFaction, defenderFaction);
  const tier = classifyEffectiveness(mult);
  const baseCrit = 0.05;
  const crit = Math.random() < baseCrit + roleCritBonus;
  return { mult: mult * (crit ? 1.5 : 1.0), crit, tier };
}
