// ============================================================
// SYNTHETIC SPARKS - Game Data
// All game balance/content constants in one place.
// ============================================================

export const SPRITE_SHEET_URL =
  'https://customer-assets.emergentagent.com/job_emerged-academy/artifacts/ej4v1k4y_1778212150044.png';

// AI-generated production sprites served from the FastAPI backend (/api/static/sprites/)
const _BE = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
export const SPRITE_ASSETS = {
  player: `${_BE}/api/static/sprites/player_adhamb.png`,
  enemyScout: `${_BE}/api/static/sprites/enemy_scout.png`,
  enemyJuggernaut: `${_BE}/api/static/sprites/enemy_juggernaut.png`,
  cyberCastle: `${_BE}/api/static/sprites/cyber_castle.png`,
  sapphireCore: `${_BE}/api/static/sprites/sapphire_core.png`,
  spikePad: `${_BE}/api/static/sprites/spike_pad.png`,
  barrel: `${_BE}/api/static/sprites/destructible_barrel.png`,
  npcOrion: `${_BE}/api/static/sprites/npc_orion.png`,
  npcJax: `${_BE}/api/static/sprites/npc_jax.png`,
  npcLyra: `${_BE}/api/static/sprites/npc_lyra.png`,
  // ── CYBER PACK — minimal curated subset for the Forgotten Block district.
  // 3 enemy types (scout/caster/elite) + decoration props. Magenta key was
  // stripped at slice time; PNGs ship with proper alpha.
  cySpiderScout:    `${_BE}/api/static/sprites/cyber_pack/spider_scout.png`,
  cyTentacleCaster: `${_BE}/api/static/sprites/cyber_pack/tentacle_floater.png`,
  cyMechTitan:      `${_BE}/api/static/sprites/cyber_pack/mech_titan.png`,
  cyAlertTerminal:  `${_BE}/api/static/sprites/cyber_pack/alert_terminal.png`,
  cyContainmentTube:`${_BE}/api/static/sprites/cyber_pack/containment_tube.png`,
  cyLockdownPanel:  `${_BE}/api/static/sprites/cyber_pack/lockdown_panel.png`,
  cyDroneSpike:     `${_BE}/api/static/sprites/cyber_pack/drone_spike.png`,
  cyGhostShadow:    `${_BE}/api/static/sprites/cyber_pack/ghost_shadow.png`,
};

// Color palette (cyberpunk neon on dark)
export const COLORS = {
  bg: '#0a0a14',
  bgDark: '#06060e',
  panel: '#141428',
  panelLight: '#1e1e3a',
  border: '#3a3a6a',
  borderHi: '#6464a8',
  neonCyan: '#00f0ff',
  neonMagenta: '#ff2dd4',
  neonGreen: '#39ff14',
  neonYellow: '#ffd700',
  neonRed: '#ff3860',
  text: '#e8e8ff',
  textDim: '#9090b0',
  hp: '#ff3860',
  hpBg: '#3a0e1a',
  mp: '#00aaff',
  mpBg: '#0e1e3a',
  xp: '#ffd700',
  xpBg: '#3a2e0e',
  cyber: '#ff8c00',
  mutant: '#ff2dd4',
  techno: '#00f0ff',
};

// ============================================================
// ABILITIES (15+ across 3 trees)
// ============================================================
export type Element = 'physical' | 'energy' | 'cyber' | 'psi';

export type Ability = {
  id: string;
  name: string;
  desc: string;
  branch: 'cyber' | 'mutant' | 'techno' | 'base';
  cost: number; // MP cost
  power: number; // damage multiplier or heal value
  element: Element;
  type: 'attack' | 'heal' | 'buff' | 'debuff';
  reqLevel: number; // skill point/level required
  prereq?: string; // ability that must be unlocked first
  effect?: 'stun' | 'burn' | 'shield' | 'cleanse' | 'haste' | 'drain';
};

export const ABILITIES: Record<string, Ability> = {
  // Base
  power_strike: {
    id: 'power_strike',
    name: 'Power Strike',
    desc: 'A focused melee strike. +30% damage.',
    branch: 'base',
    cost: 0,
    power: 1.3,
    element: 'physical',
    type: 'attack',
    reqLevel: 1,
  },

  // CYBER-STRIKES (Robotics)
  plasma_blade: {
    id: 'plasma_blade',
    name: 'Plasma Blade',
    desc: 'Searing energy slash. Burns target.',
    branch: 'cyber',
    cost: 6,
    power: 1.5,
    element: 'energy',
    type: 'attack',
    reqLevel: 2,
    effect: 'burn',
  },
  overload: {
    id: 'overload',
    name: 'Overload',
    desc: 'Surge weapons. Heavy damage but costly.',
    branch: 'cyber',
    cost: 12,
    power: 2.2,
    element: 'energy',
    type: 'attack',
    reqLevel: 4,
    prereq: 'plasma_blade',
  },
  mech_slam: {
    id: 'mech_slam',
    name: 'Mech Slam',
    desc: 'Crushing blow. Stuns target.',
    branch: 'cyber',
    cost: 10,
    power: 1.6,
    element: 'physical',
    type: 'attack',
    reqLevel: 5,
    prereq: 'plasma_blade',
    effect: 'stun',
  },
  rocket_punch: {
    id: 'rocket_punch',
    name: 'Rocket Punch',
    desc: 'Devastating mech-arm finisher.',
    branch: 'cyber',
    cost: 18,
    power: 3.0,
    element: 'physical',
    type: 'attack',
    reqLevel: 7,
    prereq: 'overload',
  },

  // PHASE-SHIFTING (Mutant)
  phase_step: {
    id: 'phase_step',
    name: 'Phase Step',
    desc: 'Slip through space. +Speed next turn.',
    branch: 'mutant',
    cost: 5,
    power: 0,
    element: 'psi',
    type: 'buff',
    reqLevel: 2,
    effect: 'haste',
  },
  mind_blast: {
    id: 'mind_blast',
    name: 'Mind Blast',
    desc: 'Psychic shockwave from your mind.',
    branch: 'mutant',
    cost: 8,
    power: 1.7,
    element: 'psi',
    type: 'attack',
    reqLevel: 3,
  },
  healing_pulse: {
    id: 'healing_pulse',
    name: 'Healing Pulse',
    desc: 'Restore 40 HP via mutant regeneration.',
    branch: 'mutant',
    cost: 10,
    power: 40,
    element: 'psi',
    type: 'heal',
    reqLevel: 4,
    prereq: 'phase_step',
  },
  rage_burst: {
    id: 'rage_burst',
    name: 'Rage Burst',
    desc: 'Channel mutant fury. Big damage.',
    branch: 'mutant',
    cost: 14,
    power: 2.4,
    element: 'physical',
    type: 'attack',
    reqLevel: 6,
    prereq: 'mind_blast',
  },
  time_warp: {
    id: 'time_warp',
    name: 'Time Warp',
    desc: 'Distort time. Cleanse + double speed.',
    branch: 'mutant',
    cost: 16,
    power: 0,
    element: 'psi',
    type: 'buff',
    reqLevel: 8,
    prereq: 'healing_pulse',
    effect: 'cleanse',
  },

  // TECHNOMANCY (AI Manipulation)
  hack: {
    id: 'hack',
    name: 'Hack',
    desc: 'Inject malware. Drains target MP & damages.',
    branch: 'techno',
    cost: 6,
    power: 1.4,
    element: 'cyber',
    type: 'attack',
    reqLevel: 2,
    effect: 'drain',
  },
  reboot: {
    id: 'reboot',
    name: 'Reboot Heal',
    desc: 'Restore 30 HP and 10 MP.',
    branch: 'techno',
    cost: 8,
    power: 30,
    element: 'cyber',
    type: 'heal',
    reqLevel: 3,
  },
  virus: {
    id: 'virus',
    name: 'Virus',
    desc: 'Continuous corruption damage over time.',
    branch: 'techno',
    cost: 10,
    power: 1.2,
    element: 'cyber',
    type: 'attack',
    reqLevel: 4,
    prereq: 'hack',
    effect: 'burn',
  },
  data_shield: {
    id: 'data_shield',
    name: 'Data Shield',
    desc: 'Encrypted barrier. Reduces damage 50%.',
    branch: 'techno',
    cost: 8,
    power: 0,
    element: 'cyber',
    type: 'buff',
    reqLevel: 5,
    prereq: 'reboot',
    effect: 'shield',
  },
  mind_control: {
    id: 'mind_control',
    name: 'Mind Control',
    desc: 'Hijack the foe. Massive cyber damage.',
    branch: 'techno',
    cost: 20,
    power: 2.8,
    element: 'cyber',
    type: 'attack',
    reqLevel: 8,
    prereq: 'virus',
  },

  // HOUSE SIGNATURE ABILITIES (granted by chosen house)
  stealth_strike: {
    id: 'stealth_strike',
    name: 'Stealth Strike',
    desc: 'Cloak and crit. 2x damage. (Obsidian)',
    branch: 'base',
    cost: 6,
    power: 2.0,
    element: 'physical',
    type: 'attack',
    reqLevel: 1,
  },
  plasma_aegis: {
    id: 'plasma_aegis',
    name: 'Plasma Aegis',
    desc: 'Channel core. Big shield + counter. (Sapphire)',
    branch: 'base',
    cost: 6,
    power: 0,
    element: 'energy',
    type: 'buff',
    reqLevel: 1,
    effect: 'shield',
  },
  vine_barrage: {
    id: 'vine_barrage',
    name: 'Vine Barrage',
    desc: 'Multi-arm flurry of strikes. (Emerald)',
    branch: 'base',
    cost: 8,
    power: 1.6,
    element: 'physical',
    type: 'attack',
    reqLevel: 1,
  },
  ground_slam: {
    id: 'ground_slam',
    name: 'Ground Slam',
    desc: 'Earth-shattering AOE. Stuns. (Ruby)',
    branch: 'base',
    cost: 8,
    power: 1.8,
    element: 'physical',
    type: 'attack',
    reqLevel: 1,
    effect: 'stun',
  },
};

export const ABILITIES_LIST: Ability[] = Object.values(ABILITIES);

// ============================================================
// HOUSES - 4 Prototypes (Character Selection)
// ============================================================
export const HOUSES_SHEET_URL =
  'https://customer-assets.emergentagent.com/job_emerged-academy/artifacts/o69idqyg_1778214562128.png';

export type HouseId = 'obsidian' | 'sapphire' | 'emerald' | 'ruby';

export type House = {
  id: HouseId;
  name: string;
  title: string;
  color: string;
  bgColor: string;
  description: string;
  ability: string;
  trait: string;
  signatureAbility: string;
  stats: { hp: number; mp: number; atk: number; def: number; spd: number };
  passive?: { hpRegen?: number; critChance?: number; reflect?: number; defBonus?: number };
};

export const HOUSES: Record<HouseId, House> = {
  obsidian: {
    id: 'obsidian',
    name: 'House Obsidian',
    title: 'The Stalker',
    color: '#a85a5a',
    bgColor: '#1a0e14',
    description: 'A shadow that strikes first. Built for surgical precision and lethal openers.',
    ability: 'Stealth Cloak & High Critical Damage',
    trait: 'Neuro-Internal Metal Spines (+Agility)',
    signatureAbility: 'stealth_strike',
    stats: { hp: 70, mp: 30, atk: 14, def: 6, spd: 14 },
    passive: { critChance: 0.25 },
  },
  sapphire: {
    id: 'sapphire',
    name: 'House Sapphire',
    title: 'The Guardian',
    color: '#3878d4',
    bgColor: '#0a1428',
    description: 'A bulwark of plasma. Endures everything the Glitch can throw.',
    ability: 'Plasma Shield & Knockback Resistance',
    trait: 'Plasma-Fused Core (+Health pool)',
    signatureAbility: 'plasma_aegis',
    stats: { hp: 110, mp: 25, atk: 10, def: 12, spd: 7 },
    passive: { reflect: 0.15, defBonus: 2 },
  },
  emerald: {
    id: 'emerald',
    name: 'House Emerald',
    title: 'The Ascendant',
    color: '#3eb86b',
    bgColor: '#0a1e14',
    description: 'Symbiotic and tireless. Heals over time and reaches what others cannot.',
    ability: 'Multi-Arm Barrage & Health Regeneration',
    trait: 'Symbiotic Plant-Arms (Reaches distant targets)',
    signatureAbility: 'vine_barrage',
    stats: { hp: 85, mp: 40, atk: 11, def: 8, spd: 11 },
    passive: { hpRegen: 4 },
  },
  ruby: {
    id: 'ruby',
    name: 'House Ruby',
    title: 'The Destroyer',
    color: '#d83a3a',
    bgColor: '#1e0a0a',
    description: 'Earth-shaking force. Hits the hardest, soaks the most physical punishment.',
    ability: 'Ground Slam & Explosive Melee',
    trait: 'Hardened Bionic Features (+Physical Defense)',
    signatureAbility: 'ground_slam',
    stats: { hp: 100, mp: 25, atk: 16, def: 10, spd: 6 },
    passive: { defBonus: 3 },
  },
};

export const HOUSES_LIST: House[] = [HOUSES.obsidian, HOUSES.sapphire, HOUSES.emerald, HOUSES.ruby];

// ============================================================
// ENEMIES - Mapped to sprite sheet (5x5 grid, indices 0-24)
// ============================================================
export type Enemy = {
  id: string;
  name: string;
  spriteIndex: number; // 0-24 in sprite sheet
  hp: number;
  atk: number;
  def: number;
  spd: number;
  xp: number;
  gold: number;
  abilities: string[]; // ability ids enemy can use
  weakness?: Element;
  resist?: Element;
  tier: 1 | 2 | 3 | 4; // difficulty tier
  drops?: { itemId: string; chance: number }[];
  /** Marks a unique elite. Drives boss-only combat framing + phases. */
  isBoss?: boolean;
  /** Ability ids unlocked when the boss enters its second phase. */
  phaseAbilities?: string[];
  /** Barked line shown when the boss transitions phases. */
  phaseQuote?: string;
};

export const ENEMIES: Record<string, Enemy> = {
  spider_bot: { id: 'spider_bot', name: 'Cyborg Spider-Bot', spriteIndex: 0, hp: 35, atk: 8, def: 3, spd: 14, xp: 18, gold: 12, abilities: ['power_strike'], weakness: 'energy', tier: 1, drops: [{ itemId: 'health_pack', chance: 0.4 }] },
  gear_golem: { id: 'gear_golem', name: 'Gear-Golem', spriteIndex: 1, hp: 60, atk: 12, def: 8, spd: 6, xp: 25, gold: 18, abilities: ['power_strike'], weakness: 'cyber', resist: 'physical', tier: 1, drops: [{ itemId: 'energy_cell', chance: 0.5 }] },
  clockwork_beast: { id: 'clockwork_beast', name: 'Clockwork Beast', spriteIndex: 2, hp: 50, atk: 14, def: 5, spd: 12, xp: 28, gold: 20, abilities: ['power_strike'], weakness: 'energy', tier: 2, drops: [{ itemId: 'scrap_part', chance: 0.6 }] },
  bio_lizard: { id: 'bio_lizard', name: 'Bio-Mech Lizard', spriteIndex: 3, hp: 70, atk: 13, def: 6, spd: 9, xp: 32, gold: 22, abilities: ['plasma_blade'], weakness: 'cyber', tier: 2, drops: [{ itemId: 'health_pack', chance: 0.5 }] },
  tinkerer_drone: { id: 'tinkerer_drone', name: 'Tinkerer Drone', spriteIndex: 4, hp: 45, atk: 11, def: 4, spd: 13, xp: 26, gold: 24, abilities: ['hack'], weakness: 'physical', tier: 2, drops: [{ itemId: 'energy_cell', chance: 0.5 }, { itemId: 'scrap_part', chance: 0.3 }] },
  tentacle_mech: { id: 'tentacle_mech', name: 'Tentacle-Mech', spriteIndex: 5, hp: 80, atk: 15, def: 7, spd: 8, xp: 38, gold: 28, abilities: ['mech_slam'], weakness: 'energy', tier: 3, drops: [{ itemId: 'health_pack', chance: 0.4 }] },
  plasma_brain: { id: 'plasma_brain', name: 'Plasma-Brain', spriteIndex: 6, hp: 55, atk: 18, def: 4, spd: 11, xp: 40, gold: 32, abilities: ['mind_blast'], weakness: 'cyber', resist: 'psi', tier: 3, drops: [{ itemId: 'mp_potion', chance: 0.5 }] },
  scrap_collector: { id: 'scrap_collector', name: 'Scrap-Collector', spriteIndex: 7, hp: 90, atk: 14, def: 9, spd: 5, xp: 36, gold: 40, abilities: ['power_strike'], weakness: 'energy', tier: 3, drops: [{ itemId: 'scrap_part', chance: 0.8 }] },
  generator_kin: { id: 'generator_kin', name: 'Generator-Kin', spriteIndex: 8, hp: 75, atk: 16, def: 6, spd: 10, xp: 42, gold: 30, abilities: ['plasma_blade'], weakness: 'cyber', tier: 3, drops: [{ itemId: 'energy_cell', chance: 0.6 }] },
  neuro_crab: { id: 'neuro_crab', name: 'Neuro-Crab', spriteIndex: 9, hp: 85, atk: 14, def: 12, spd: 7, xp: 38, gold: 28, abilities: ['power_strike'], weakness: 'cyber', resist: 'physical', tier: 3, drops: [{ itemId: 'health_pack', chance: 0.5 }] },
  laser_wasp: { id: 'laser_wasp', name: 'Laser-Wasp', spriteIndex: 10, hp: 50, atk: 19, def: 4, spd: 16, xp: 44, gold: 28, abilities: ['plasma_blade'], weakness: 'physical', tier: 3, drops: [{ itemId: 'energy_cell', chance: 0.5 }] },
  crawler_chimaera: { id: 'crawler_chimaera', name: 'Crawler-Chimaera', spriteIndex: 11, hp: 110, atk: 17, def: 8, spd: 9, xp: 50, gold: 38, abilities: ['rage_burst'], weakness: 'cyber', tier: 4, drops: [{ itemId: 'rare_chip', chance: 0.3 }] },
  steam_mutant: { id: 'steam_mutant', name: 'Steam-Mutant', spriteIndex: 12, hp: 95, atk: 16, def: 10, spd: 7, xp: 46, gold: 34, abilities: ['mech_slam'], weakness: 'cyber', tier: 4, drops: [{ itemId: 'health_pack', chance: 0.5 }] },
  multi_gynoid: { id: 'multi_gynoid', name: 'Multi-Armed Gynoid', spriteIndex: 13, hp: 100, atk: 20, def: 7, spd: 13, xp: 55, gold: 42, abilities: ['rage_burst', 'mind_blast'], weakness: 'physical', tier: 4, drops: [{ itemId: 'rare_chip', chance: 0.4 }] },
  armored_centipede: { id: 'armored_centipede', name: 'Armored Centipede', spriteIndex: 14, hp: 130, atk: 18, def: 14, spd: 6, xp: 60, gold: 45, abilities: ['power_strike'], weakness: 'energy', resist: 'physical', tier: 4, drops: [{ itemId: 'rare_chip', chance: 0.4 }] },
  hover_sentry: { id: 'hover_sentry', name: 'Hover-Sentry', spriteIndex: 15, hp: 80, atk: 22, def: 6, spd: 14, xp: 58, gold: 38, abilities: ['plasma_blade'], weakness: 'cyber', tier: 4, drops: [{ itemId: 'energy_cell', chance: 0.6 }] },
  piston_ogre: { id: 'piston_ogre', name: 'Piston-Ogre', spriteIndex: 16, hp: 150, atk: 24, def: 12, spd: 5, xp: 70, gold: 55, abilities: ['rocket_punch'], weakness: 'cyber', tier: 4, drops: [{ itemId: 'rare_chip', chance: 0.5 }] },
  spike_mutant: { id: 'spike_mutant', name: 'Spike-Mutant', spriteIndex: 17, hp: 110, atk: 21, def: 9, spd: 11, xp: 62, gold: 44, abilities: ['rage_burst'], weakness: 'cyber', tier: 4, drops: [{ itemId: 'health_pack', chance: 0.5 }] },
  bio_serpent: { id: 'bio_serpent', name: 'Bio-Engineered Serpent', spriteIndex: 18, hp: 105, atk: 22, def: 8, spd: 14, xp: 65, gold: 50, abilities: ['rage_burst'], weakness: 'cyber', tier: 4, drops: [{ itemId: 'rare_chip', chance: 0.4 }] },
  data_ghost: { id: 'data_ghost', name: 'Data-Ghost', spriteIndex: 19, hp: 90, atk: 25, def: 5, spd: 17, xp: 70, gold: 50, abilities: ['hack', 'mind_blast'], weakness: 'psi', resist: 'physical', tier: 4, drops: [{ itemId: 'rare_chip', chance: 0.6 }] },
  mutant_assembler: { id: 'mutant_assembler', name: 'Mutant-Assembler', spriteIndex: 20, hp: 200, atk: 24, def: 12, spd: 9, xp: 150, gold: 120, abilities: ['rage_burst', 'mech_slam'], weakness: 'cyber', tier: 4, isBoss: true, phaseAbilities: ['rocket_punch', 'overload'], phaseQuote: 'PROTOCOL: ASSIMILATE.', drops: [{ itemId: 'rare_chip', chance: 1.0 }, { itemId: 'nano_armor', chance: 0.4 }] },
  core_keeper: { id: 'core_keeper', name: 'Core-Keeper', spriteIndex: 21, hp: 240, atk: 26, def: 14, spd: 10, xp: 180, gold: 150, abilities: ['rocket_punch'], weakness: 'energy', tier: 4, isBoss: true, phaseAbilities: ['mind_control', 'overload'], phaseQuote: 'CORE BREACH IMMINENT.', drops: [{ itemId: 'rare_chip', chance: 1.0 }, { itemId: 'cyber_blade', chance: 0.4 }] },
  crawler_fly: { id: 'crawler_fly', name: 'Crawler-Fly', spriteIndex: 22, hp: 95, atk: 26, def: 6, spd: 18, xp: 78, gold: 55, abilities: ['plasma_blade'], weakness: 'physical', tier: 4, drops: [{ itemId: 'rare_chip', chance: 0.5 }] },
  glitch_avatar: { id: 'glitch_avatar', name: 'The Glitch Avatar', spriteIndex: 23, hp: 320, atk: 30, def: 16, spd: 13, xp: 280, gold: 250, abilities: ['mind_control', 'rage_burst', 'rocket_punch'], weakness: 'psi', tier: 4, isBoss: true, phaseAbilities: ['mind_control', 'overload', 'rocket_punch'], phaseQuote: 'I AM EVERYWHERE. I AM YOU.', drops: [{ itemId: 'rare_chip', chance: 1.0 }, { itemId: 'glitch_plate', chance: 0.5 }] },
  glitch_final: { id: 'glitch_final', name: 'Final Form', spriteIndex: 24, hp: 450, atk: 34, def: 20, spd: 15, xp: 500, gold: 500, abilities: ['mind_control', 'overload', 'rocket_punch'], weakness: 'psi', tier: 4, isBoss: true, phaseAbilities: ['mind_control', 'overload', 'rocket_punch', 'rage_burst'], phaseQuote: 'TERMINATION SEQUENCE INITIATED.', drops: [{ itemId: 'rare_chip', chance: 1.0 }, { itemId: 'pulse_cannon', chance: 0.3 }, { itemId: 'glitch_plate', chance: 0.3 }] },
  // Add Tesla Drone (use Hover-Sentry sprite as drone-like visual)
  tesla_drone: { id: 'tesla_drone', name: 'Tesla Drone', spriteIndex: 15, hp: 60, atk: 18, def: 5, spd: 15, xp: 35, gold: 25, abilities: ['plasma_blade'], weakness: 'physical', tier: 2, drops: [{ itemId: 'energy_cell', chance: 0.6 }] },

  // ── Quantum Minion species (dynamic sprite sheet) ────────────────────
  // These 12 entries are wired to /api/static/sprites/quantum_minions via
  // DynamicMinionRenderer.SPECIES_LINE_MAP. spriteIndex is irrelevant for
  // them (the renderer checks hasMinionSprite() first and falls back to
  // the legacy spriteIndex grid otherwise).
  // ── Phreak line (Phone corruption) ───────────────────────────────────
  phreak_1: { id: 'phreak_1', name: 'Glitch-Slate',     spriteIndex: 0, hp: 40,  atk: 10, def: 4,  spd: 12, xp: 22, gold: 14, abilities: ['hack'],         weakness: 'psi',     tier: 1, drops: [{ itemId: 'energy_cell', chance: 0.5 }] },
  phreak_2: { id: 'phreak_2', name: 'Tentacle-Phone',   spriteIndex: 0, hp: 70,  atk: 14, def: 6,  spd: 11, xp: 36, gold: 24, abilities: ['hack'],         weakness: 'psi',     tier: 2, drops: [{ itemId: 'rare_chip', chance: 0.3 }] },
  phreak_3: { id: 'phreak_3', name: 'Spider-Modem',     spriteIndex: 0, hp: 95,  atk: 18, def: 9,  spd: 9,  xp: 52, gold: 36, abilities: ['power_strike'], weakness: 'energy',  tier: 3, drops: [{ itemId: 'rare_chip', chance: 0.4 }] },
  phreak_4: { id: 'phreak_4', name: 'Crawl-Phreak',     spriteIndex: 0, hp: 130, atk: 22, def: 12, spd: 10, xp: 78, gold: 56, abilities: ['mech_slam'],    weakness: 'cyber',   tier: 4, drops: [{ itemId: 'rare_chip', chance: 0.5 }] },
  // ── VR-Ghost line (Hacker → Summoner) ────────────────────────────────
  vrghost_1: { id: 'vrghost_1', name: 'VR Initiate',    spriteIndex: 0, hp: 50,  atk: 9,  def: 3,  spd: 14, xp: 24, gold: 16, abilities: ['hack'],         weakness: 'physical', tier: 1, drops: [{ itemId: 'mp_potion', chance: 0.4 }] },
  vrghost_2: { id: 'vrghost_2', name: 'VR Hacker',      spriteIndex: 0, hp: 75,  atk: 13, def: 5,  spd: 13, xp: 38, gold: 26, abilities: ['mind_blast'],   weakness: 'physical', tier: 2, drops: [{ itemId: 'mp_potion', chance: 0.5 }] },
  vrghost_3: { id: 'vrghost_3', name: 'VR Beastmaster', spriteIndex: 0, hp: 100, atk: 17, def: 7,  spd: 12, xp: 54, gold: 38, abilities: ['mind_blast'],   weakness: 'physical', tier: 3, drops: [{ itemId: 'rare_chip', chance: 0.4 }] },
  vrghost_4: { id: 'vrghost_4', name: 'Ghost-Summoner', spriteIndex: 0, hp: 140, atk: 23, def: 9,  spd: 13, xp: 82, gold: 60, abilities: ['mind_blast', 'rage_burst'], weakness: 'psi', tier: 4, drops: [{ itemId: 'rare_chip', chance: 0.6 }] },
  // ── Mech line (Cyborg → Bio-Mech) ────────────────────────────────────
  mech_1: { id: 'mech_1', name: 'Augmented Operator', spriteIndex: 0, hp: 60,  atk: 11, def: 6,  spd: 9,  xp: 28, gold: 18, abilities: ['power_strike'], weakness: 'cyber',   tier: 1, drops: [{ itemId: 'health_pack', chance: 0.5 }] },
  mech_2: { id: 'mech_2', name: 'Plasma Gunner',      spriteIndex: 0, hp: 90,  atk: 16, def: 8,  spd: 8,  xp: 42, gold: 28, abilities: ['plasma_blade'], weakness: 'cyber',   tier: 2, drops: [{ itemId: 'energy_cell', chance: 0.6 }] },
  mech_3: { id: 'mech_3', name: 'Bio-Mech Marauder',  spriteIndex: 0, hp: 120, atk: 20, def: 11, spd: 8,  xp: 60, gold: 42, abilities: ['mech_slam'],    weakness: 'cyber',   tier: 3, drops: [{ itemId: 'rare_chip', chance: 0.4 }] },
  mech_4: { id: 'mech_4', name: 'Spider-Husk',        spriteIndex: 0, hp: 160, atk: 26, def: 14, spd: 7,  xp: 95, gold: 70, abilities: ['rage_burst', 'mech_slam'], weakness: 'cyber', tier: 4, drops: [{ itemId: 'rare_chip', chance: 0.6 }] },
};

export const ENEMIES_LIST = Object.values(ENEMIES);

// Random encounter pools by zone
export const ENCOUNTER_POOLS = {
  academy: ['spider_bot', 'tinkerer_drone', 'tesla_drone', 'phreak_1', 'vrghost_1'],
  arena_t1: ['spider_bot', 'gear_golem', 'clockwork_beast', 'bio_lizard', 'phreak_1', 'mech_1'],
  arena_t2: ['tentacle_mech', 'plasma_brain', 'scrap_collector', 'generator_kin', 'neuro_crab', 'phreak_2', 'vrghost_2', 'mech_2'],
  arena_t3: ['laser_wasp', 'crawler_chimaera', 'steam_mutant', 'multi_gynoid', 'armored_centipede', 'phreak_3', 'vrghost_3', 'mech_3'],
  arena_t4: ['hover_sentry', 'piston_ogre', 'spike_mutant', 'bio_serpent', 'data_ghost', 'phreak_4', 'vrghost_4', 'mech_4'],
  arena_boss: ['mutant_assembler', 'core_keeper', 'crawler_fly', 'glitch_avatar', 'glitch_final'],
};

// ============================================================
// ITEMS
// ============================================================
export type Item = {
  id: string;
  name: string;
  desc: string;
  type: 'consumable' | 'weapon' | 'armor' | 'material' | 'spike';
  cost?: number;
  effect?: { hp?: number; mp?: number; atk?: number; def?: number };
  icon: string; // emoji or text fallback
};

export const ITEMS: Record<string, Item> = {
  health_pack: { id: 'health_pack', name: 'Health Pack', desc: 'Restores 50 HP.', type: 'consumable', cost: 25, effect: { hp: 50 }, icon: 'HP' },
  energy_cell: { id: 'energy_cell', name: 'Energy Cell', desc: 'Restores 25 MP.', type: 'consumable', cost: 30, effect: { mp: 25 }, icon: 'MP' },
  mp_potion: { id: 'mp_potion', name: 'Quantum Battery', desc: 'Fully restores MP.', type: 'consumable', cost: 80, effect: { mp: 999 }, icon: 'BAT' },
  scrap_part: { id: 'scrap_part', name: 'Scrap Part', desc: 'Sell or trade material.', type: 'material', cost: 10, icon: 'SCR' },
  rare_chip: { id: 'rare_chip', name: 'Rare Chip', desc: 'Valuable Glitch fragment.', type: 'material', cost: 80, icon: 'CHP' },
  // ── Quantum Taming consumables ─────────────────────────────────────
  // Capture chance = baseChance(0.5) × multiplier × (1 - hp/maxHp)
  // Spike tiers escalate the multiplier so players can decide whether
  // to spend cheap basic spikes on weak foes or hoard glitched spikes
  // for high-tier prizes. Detected via `type: 'spike'` in combat.tsx.
  containment_spike: { id: 'containment_spike', name: 'Containment Spike', desc: 'Quarantines weak foes. ×1.0 chance.', type: 'spike', cost: 60, icon: 'SPK' },
  quantum_spike:     { id: 'quantum_spike',     name: 'Quantum Spike',     desc: 'High-grade trap. ×1.7 chance.',       type: 'spike', cost: 180, icon: 'QSK' },
  glitched_spike:    { id: 'glitched_spike',    name: 'Glitched Spike',    desc: 'Corrupted trap. ×2.8 chance.',        type: 'spike', cost: 480, icon: 'GSK' },
  // Weapons
  training_baton: { id: 'training_baton', name: 'Training Baton', desc: 'Standard issue. +0 ATK', type: 'weapon', cost: 0, effect: { atk: 0 }, icon: 'BAT' },
  plasma_baton: { id: 'plasma_baton', name: 'Plasma Baton', desc: 'Energized melee. +6 ATK', type: 'weapon', cost: 200, effect: { atk: 6 }, icon: 'PLB' },
  cyber_blade: { id: 'cyber_blade', name: 'Cyber-Blade', desc: 'Razor-sharp tech. +14 ATK', type: 'weapon', cost: 600, effect: { atk: 14 }, icon: 'CYB' },
  pulse_cannon: { id: 'pulse_cannon', name: 'Pulse Cannon', desc: 'Long-range power. +24 ATK', type: 'weapon', cost: 1500, effect: { atk: 24 }, icon: 'PLC' },
  // Armor
  uniform: { id: 'uniform', name: 'Cadet Uniform', desc: 'Basic gear. +0 DEF', type: 'armor', cost: 0, effect: { def: 0 }, icon: 'UNI' },
  flux_jacket: { id: 'flux_jacket', name: 'Flux Jacket', desc: 'Energy mesh. +5 DEF', type: 'armor', cost: 250, effect: { def: 5 }, icon: 'FLX' },
  nano_armor: { id: 'nano_armor', name: 'Nano-Armor', desc: 'Self-repairing. +12 DEF', type: 'armor', cost: 700, effect: { def: 12 }, icon: 'NAN' },
  glitch_plate: { id: 'glitch_plate', name: 'Glitch Plate', desc: 'Forged from corruption. +22 DEF', type: 'armor', cost: 1800, effect: { def: 22 }, icon: 'GLP' },
};

// Store inventory
export const STORE_ITEMS = [
  'health_pack',
  'energy_cell',
  'mp_potion',
  'containment_spike',
  'quantum_spike',
  'glitched_spike',
  'plasma_baton',
  'cyber_blade',
  'pulse_cannon',
  'flux_jacket',
  'nano_armor',
  'glitch_plate',
];

// ============================================================
// XP CURVE
// ============================================================
export function xpForNextLevel(level: number): number {
  return Math.floor(100 * Math.pow(1.35, level - 1));
}

// ============================================================
// ACADEMY MAP - 20x15 grid
// 0=floor, 1=wall, 2=trial-door (boss), 3=NPC, 4=arena exit, 5=store, 6=skill chamber, 7=final-trial-door
// ============================================================
// CASTLE INTERIOR DUNGEON MAP - 20x15 grid
// We are now INSIDE Castle V2.1. Stone walls (type 12) form modular corridors and rooms.
// The Sapphire Core sits in the deeply guarded central throne chamber at the top.
//
// Tile codes:
// 0=stone floor, 1=outer-wall (legacy, unused), 2=trial-door (boss), 3=NPC,
// 4=arena exit, 5=merchant store, 6=skill chamber, 7=final-trial-door,
// 8=spike pad (-10 HP), 9=Sapphire Core (objective), 10=Power Console,
// 11=debris (collision), 12=castle stone wall (blocks),
// 13=castle banner (decoration on floor, walkable),
// 14=destructible barrel (blocks until smashed with B)
// ============================================================
export const ACADEMY_MAP: number[][] = [
  // Row 0  — north outer wall
  [12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  // Row 1  — upper hall (behind throne chamber); spiral staircase at (4,1) leads down
  [12, 0, 0, 0,15, 0, 0,12,12,12,12,12, 0, 0, 0, 0, 0, 0, 0,12],
  // Row 2  — throne chamber rear (banners flanking core)
  [12, 0, 0, 0, 0, 0, 0,12,13, 0,13,12, 0, 0, 0, 0, 0, 0, 0,12],
  // Row 3  — THRONE CHAMBER with Sapphire Core at center (9,3)
  [12, 0, 0, 0, 0, 0, 0,12, 0, 9, 0,12, 0, 0, 0, 0, 0, 0, 0,12],
  // Row 4  — throne chamber inner corridor (entrance from below)
  [12, 0, 0, 0, 0, 0, 0,12, 0, 0, 0,12, 0, 0, 0, 0, 0, 0, 0,12],
  // Row 5  — south wall of throne chamber + power console + debris (debris kept clear of NPC zone)
  [12, 0, 0,10, 0, 0, 0,12,12, 0,12,12, 0, 0, 0, 0, 0,11, 0,12],
  // Row 6  — main corridor with NPCs (Orion, Jax, Lyra) + boss door
  [12, 0, 3, 0, 0, 0, 3, 0, 0, 0, 0, 0, 0, 0, 3, 0, 2, 0, 0,12],
  // Row 7  — patrol corridor with barrels guarding the path (kept clear of NPC zones)
  [12, 0, 0, 0,14, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,14, 0,12],
  // Row 8  — guarded approach: dual spike pads
  [12, 0, 0, 0, 0, 0, 0, 0, 8, 0, 8, 0, 0, 0, 0, 0, 0, 0, 0,12],
  // Row 9  — choke-point corridor (only 3 paths through)
  [12,12,12, 0,12,12,12,12, 0, 0, 0,12,12,12,12, 0,12,12,12,12],
  // Row 10 — open hallway
  [12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,12],
  // Row 11 — merchant + skill chamber + barrels & debris
  [12, 0, 5, 0, 0, 0,11, 0,14, 0,14, 0,11, 0, 0, 0, 6, 0, 0,12],
  // Row 12 — open lower corridor
  [12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,12],
  // Row 13 — entrance hall + arena door + final trial door
  [12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 4, 7,12],
  // Row 14 — south outer wall
  [12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
];

// ────────────────────────────────────────────────────────────────────────
// LEVEL 2B — The Conduit Maze
// Reached via the spiral staircase (tile 15) in the academy.
// Narrow corridors, server racks (tile 12 = solid wall), and acid vaults
// (tile 8 = spike-pad damage tile). The maze is deliberately tighter than
// the academy so the WildMinionChaseAI line-of-sight mechanic matters.
// Layout: start at top-right "START TERMINAL", path branches through racks,
// dead-ends with chests, and ends at the mini-boss room in the centre-south.
// ────────────────────────────────────────────────────────────────────────
export const CONDUIT_MAZE: number[][] = [
  // Row 0 — north outer wall
  [12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
  // Row 1 — spawn corridor (top), boss room behind racks
  [12, 0, 0, 0,12, 0, 0, 0, 0, 0, 0, 0, 0, 0,12, 0, 0, 0, 0,12],
  // Row 2 — server racks (12) make pockets
  [12, 0,12, 0,12, 0,12,12, 0,12,12, 0,12,12,12, 0,12,12, 0,12],
  // Row 3 — corridor
  [12, 0, 0, 0, 0, 0,12, 0, 0, 0,12, 0, 0, 0, 0, 0, 0, 0, 0,12],
  // Row 4 — mini-boss approach (centre)
  [12, 0,12,12,12,12,12, 0,12, 0,12, 0,12,12,12, 0,12,12, 0,12],
  // Row 5 — mid corridor
  [12, 0, 0, 0, 0, 0, 0, 0,12, 0, 0, 0,12, 0, 0, 0, 0, 0, 0,12],
  // Row 6 — acid vault flanks (8) + central mini-boss tile (placeholder)
  [12, 8, 8,12, 0,12, 0,12,12, 0,12,12,12, 0,12, 0, 0,12, 8,12],
  // Row 7 — mini-boss arena floor (centre-south)
  [12, 8, 8,12, 0,12, 0, 0, 0, 0, 0, 0, 0, 0,12, 0, 0,12, 8,12],
  // Row 8 — acid vaults + corridor
  [12, 8, 8,12, 0,12, 0,12,12,12,12,12, 0,12,12, 0, 0,12, 8,12],
  // Row 9 — corridor west
  [12, 0, 0, 0, 0, 0, 0, 0, 0, 0,12, 0, 0, 0, 0, 0, 0, 0, 0,12],
  // Row 10 — server racks creating chicane
  [12, 0,12,12, 0,12,12,12,12, 0,12, 0,12,12,12,12, 0,12,12,12],
  // Row 11 — corridor south
  [12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,12],
  // Row 12 — racks + return-stairs
  [12, 0,12,12,12,12, 0,12,12,12,12,12, 0,12,12, 0,12,12, 0,12],
  // Row 13 — entrance corridor + RETURN staircase (15) bottom-right
  [12, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0,15,12],
  // Row 14 — south outer wall
  [12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12,12],
];

export const NPCS: Record<string, { name: string; x: number; y: number; lines: string[] }> = {
  npc_orion: { name: 'Prof. Orion', x: 2, y: 6, lines: [
    'Welcome to Nexus, Spark.',
    'The Glitch grows stronger by the hour...',
    'TIP: Smash barrels with [A] for spare credits.',
    'TIP: The Sapphire Core opens the path beyond.',
    'Train hard. The Outside awaits at Sync Lv 5.',
  ]},
  npc_jax: { name: 'Jax — Quartermaster', x: 6, y: 6, lines: [
    'Hey kid, fresh off the lift?',
    'I run the Quartermaster stand — potions, sparks, the works.',
    'Show me your gold. Press [A] again to browse my wares.',
  ]},
  npc_lyra: { name: 'Lyra — Tech-Lab', x: 14, y: 6, lines: [
    'You feel that hum? That is raw skill-energy waiting to be forged.',
    'Spend Skill Points at the Tech-Lab — every upgrade tilts the next fight in your favour.',
    'Press [A] again to open your skill tree.',
  ]},
};
