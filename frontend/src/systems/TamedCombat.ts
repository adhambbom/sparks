// ============================================================
// TAMED COMBAT — minion deploy interceptor (combat-side helper)
// ------------------------------------------------------------
// Faithful port of the C# `TamedCombatInterceptor` blueprint, refactored
// to a stateless functional module so React owns the actual state and
// the existing turn loop in app/combat.tsx remains untouched.
//
// Combat scene calls:
//   const result = executeMinionSkill({...});
//   apply result.dmg / result.status* via the existing pipeline.
// ============================================================
import { MINION_SKILLS, MinionSkill, MinionStatus } from '../data/minionSkills';
import { CapturedMinion } from './QuantumStorage';

/** Local mirror of the relevant combat state — passed in by combat.tsx so
 *  this module never imports React. */
export type EnemyView = {
  def: number;
  /** Optional element resistances etc — left as a passthrough hook. */
};

export type MinionSkillResult = {
  /** Final integer damage to apply to the enemy. */
  damage: number;
  /** Status effect to apply on the enemy / player (firewall_up is self-buff). */
  status?: MinionStatus;
  statusTurns: number;
  /** Log line for the battle log strip. */
  log: string;
  /** Sfx tag the combat scene should play. */
  sfxTag: 'hit' | 'bigHit' | 'skill';
};

/**
 * Compute damage + status from a minion skill execution.
 * Pure function — no side effects.
 */
export function executeMinionSkill(args: {
  minion: CapturedMinion;
  skillId: string;
  enemy: EnemyView;
}): MinionSkillResult {
  const skill: MinionSkill | undefined = MINION_SKILLS[args.skillId];
  if (!skill) {
    return {
      damage: 0,
      statusTurns: 0,
      log: 'Skill misfired!',
      sfxTag: 'hit',
    };
  }

  // Mirrors CombatPipeline.DealDamage's mitigation curve used elsewhere
  // in the project: damage = max(1, atk * power - def * 0.5).
  const raw = args.minion.atk * skill.power;
  const damage = Math.max(1, Math.floor(raw - args.enemy.def * 0.5));

  const sfxTag: 'hit' | 'bigHit' | 'skill' =
    skill.power >= 1.4 ? 'bigHit' : skill.status === 'firewall_up' ? 'skill' : 'hit';

  return {
    damage,
    status: skill.status,
    statusTurns: skill.statusTurns ?? (skill.status === 'stun' ? 1 : 3),
    log: `${args.minion.name} used ${skill.name}! ${damage} dmg.`,
    sfxTag,
  };
}

/** Convenience accessor for the UI button list. */
export function getMinionSkillView(skillId: string): MinionSkill | undefined {
  return MINION_SKILLS[skillId];
}
