/**
 * TUTORIAL PROMPTS — all onboarding copy in one place.
 *
 * Tone rules (no exceptions):
 *   • Cold system-terminal voice. SHORT.
 *   • Bionic / cybernetic terminology — no fantasy verbs.
 *   • Each line ≤ ~45 chars so it never wraps awkwardly on small phones.
 *   • Body strictly ≤ 3 lines.
 *   • Eerie. "you are syncing into a dangerous artificial network."
 */

import type { TutorialFlag } from '../systems/tutorialState';

export type TutorialPrompt = {
  flag: TutorialFlag;
  /** Terminal prefix shown muted at top. */
  prefix: string;
  /** Main title — ALL CAPS, ≤ ~22 chars. */
  title: string;
  /** Body lines — strictly ≤ 3 lines, ≤ ~45 chars each. */
  body: string[];
  /** Optional accent color. Defaults to neon cyan. */
  color?: string;
  /** Optional glyph rendered next to title. */
  glyph?: string;
};

export const TUTORIAL_PROMPTS: Record<TutorialFlag, TutorialPrompt> = {
  intro_sync: {
    flag: 'intro_sync',
    prefix: '> sync_protocol_init_',
    title: 'NETWORK CONTACT',
    glyph: '◇',
    color: '#5cf7ff',
    body: [
      'You are an OPERATOR — rogue handler',
      'of corrupted AI entities recovered',
      'from collapsing sectors.',
    ],
  },
  controls_tip: {
    flag: 'controls_tip',
    prefix: '> hw_interface_bind_',
    title: 'INTERFACE BOUND',
    glyph: '⌬',
    color: '#5cb3ff',
    body: [
      'D-PAD moves. B = primary action.',
      'A = cancel / system menu.',
      'Hold near your right thumb.',
    ],
  },
  combat_basics: {
    flag: 'combat_basics',
    prefix: '> combat_subroutine_',
    title: 'TACTICAL UPLINK',
    glyph: '▲',
    color: '#ff6b6b',
    body: [
      'Turn-based duel. Strike / Protocols /',
      'Items / Deploy Entity / Extract / Escape.',
      'B button confirms — fast deploys.',
    ],
  },
  deploy_primer: {
    flag: 'deploy_primer',
    prefix: '> deploy_link_ready_',
    title: 'ENTITIES INCOMING',
    glyph: '◇',
    color: '#5cf7c4',
    body: [
      'Deploying costs POWER GRID.',
      'Entities tank damage for you.',
      'Each carries a Signature + Trait.',
    ],
  },
  stability_critical: {
    flag: 'stability_critical',
    prefix: '> warn_signal_',
    title: 'STABILITY CRITICAL',
    glyph: '✦',
    color: '#ff6b6b',
    body: [
      'Entity hit fragility threshold.',
      'On DISCONNECT, switch entities or',
      'fight solo. HOT-PATCH revives once.',
    ],
  },
  reboot_window: {
    flag: 'reboot_window',
    prefix: '> reboot_window_open_',
    title: 'DISCONNECTED',
    glyph: '⚠',
    color: '#ffb24c',
    body: [
      'Entity offline. Network fallback —',
      'redeploy another from your loadout',
      'or strike unarmored.',
    ],
  },
  synergy_intro: {
    flag: 'synergy_intro',
    prefix: '> sp_grid_unlocked_',
    title: 'SYNERGY GRID',
    glyph: '⌬',
    color: '#c46cff',
    body: [
      'OPERATOR nodes BUFF deployed entities.',
      'Cheaper deploys · damage spikes ·',
      'glitch fields · multi-actions.',
    ],
  },
  rarity_reveal: {
    flag: 'rarity_reveal',
    prefix: '> archive_grade_log_',
    title: 'RARE EXTRACT',
    glyph: '◆',
    color: '#c46cff',
    body: [
      'Archive grades: COMMON · RARE ·',
      'GLITCHED · ASCENDED. Higher grades',
      'scale harder and gain DATA faster.',
    ],
  },
  data_leveling: {
    flag: 'data_leveling',
    prefix: '> data_xp_routed_',
    title: 'ENTITY EVOLVED',
    glyph: '▲',
    color: '#5cf7c4',
    body: [
      'Surviving entities gain DATA.',
      'They level independently of you —',
      'keep using them to push their cap.',
    ],
  },
  corruption_warning: {
    flag: 'corruption_warning',
    prefix: '> anomaly_signal_',
    title: 'CORRUPTION DETECTED',
    glyph: '✦',
    color: '#ff4789',
    body: [
      'Hostile signature outside normal',
      'parameters. Burn / stun / def-down',
      'icons mark active statuses.',
    ],
  },
};
