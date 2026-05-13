/**
 * Tutorial State — AsyncStorage-backed flags for which onboarding
 * prompts have been shown. Each flag is independent so a fork agent
 * can later relocate / re-order prompts without breaking save data.
 *
 * Stored under a single key as a JSON blob to avoid N round-trips.
 */

import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'sparks.tutorial.v1';

export type TutorialFlag =
  // First-launch SYNC PROTOCOL intro
  | 'intro_sync'
  // First combat encounter
  | 'combat_basics'
  // First time the player opens the DEPLOY panel in combat
  | 'deploy_primer'
  // First time a deployed entity falls below 30% stability
  | 'stability_critical'
  // First time a deployed entity is DISCONNECTED
  | 'reboot_window'
  // First time the player earns a synergy point
  | 'synergy_intro'
  // First time the player extracts a RARE+ entity
  | 'rarity_reveal'
  // First DATA xp award after a kept entity survives a fight
  | 'data_leveling'
  // First time the player encounters an enemy with corruption / boss tag
  | 'corruption_warning'
  // GameBoy-style control tip — shown once at first overworld load
  | 'controls_tip';

export type TutorialState = Partial<Record<TutorialFlag, true>>;

let _cache: TutorialState | null = null;

/** Loads the tutorial flags from storage. Lazy-cached. */
export async function loadTutorialState(): Promise<TutorialState> {
  if (_cache) return _cache;
  try {
    const raw = await AsyncStorage.getItem(KEY);
    _cache = raw ? JSON.parse(raw) : {};
  } catch {
    _cache = {};
  }
  return _cache!;
}

/** Sync read of last-loaded cache. */
export function getTutorialStateSync(): TutorialState {
  return _cache ?? {};
}

/** Marks a flag as shown and persists. Idempotent. */
export async function markTutorialShown(flag: TutorialFlag): Promise<void> {
  const state = await loadTutorialState();
  if (state[flag]) return;
  state[flag] = true;
  _cache = state;
  try {
    await AsyncStorage.setItem(KEY, JSON.stringify(state));
  } catch {
    /* silent — tutorial UX is non-critical */
  }
}

/** Resets all tutorial flags. Debug helper — exposed via dev menu. */
export async function resetTutorialState(): Promise<void> {
  _cache = {};
  try { await AsyncStorage.removeItem(KEY); } catch { /* silent */ }
}
