// ============================================================
// DYNAMIC MINION RENDERER  —  TS port of DynamicMinionRenderer.cs
// ------------------------------------------------------------
// Acts as a *map-only* registry: speciesId + evolutionStage → sprite URL.
// No JSX here — the render layer (combat.tsx / registry.tsx / game.tsx)
// imports this and renders an <Image source={{ uri }} /> with the result.
//
// Sheet layout (provided by user):
//    row 0 → phreak   (Phone / Phreak corruption evolution line)
//    row 1 → vrghost  (VR Hacker → Ghost-Summoner line)
//    row 2 → mech     (Cyborg / Mech-AI line)
// Each row has 4 evolutionary stages (col 1..4 = stages I..IV).
//
// The sprites were pre-sliced by /app/backend/scripts/slice_quantum_minions.py
// and live at /api/static/sprites/quantum_minions/{line}_{stage}.png.
// ============================================================
import { Platform } from 'react-native';

const _BE = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
const BASE = `${_BE}/api/static/sprites/quantum_minions`;

/** The three evolution "lines" the user supplied art for. */
export type MinionLine = 'phreak' | 'vrghost' | 'mech';

/** Display metadata per line — used by the registry / battle UI for lore + colour. */
export const MINION_LINE_META: Record<MinionLine, {
  label: string;
  accent: string;
  flavor: string;
}> = {
  phreak:  { label: 'PHREAK',   accent: '#c266ff', flavor: 'Possessed devices. Wires manifest as limbs.' },
  vrghost: { label: 'VR-GHOST', accent: '#88ff88', flavor: 'Hackers who became their own avatars.' },
  mech:    { label: 'MECH-AI',  accent: '#ff8080', flavor: 'Augmented operators corrupted by the network.' },
};

/**
 * Mirrors `enemySpriteRowMap` from the C# blueprint. Maps the species id
 * that lives in `ENEMIES[]` to the row name in the sliced sheet.
 * Adding a new species = one line here + adding the id to ENEMIES.
 */
export const SPECIES_LINE_MAP: Record<string, MinionLine> = {
  // Phreak line (REG-001 equivalent)
  phreak_1: 'phreak',
  phreak_2: 'phreak',
  phreak_3: 'phreak',
  phreak_4: 'phreak',
  // VR-Ghost line (REG-002 equivalent)
  vrghost_1: 'vrghost',
  vrghost_2: 'vrghost',
  vrghost_3: 'vrghost',
  vrghost_4: 'vrghost',
  // Mech-AI line (REG-003 equivalent)
  mech_1: 'mech',
  mech_2: 'mech',
  mech_3: 'mech',
  mech_4: 'mech',
};

/**
 * Extract the evolution stage from a species id like 'phreak_3' → 3.
 * Returns 1 if the id doesn't carry a stage suffix.
 */
function stageFromId(speciesId: string): number {
  const m = /_([1-4])$/.exec(speciesId);
  return m ? parseInt(m[1], 10) : 1;
}

/**
 * Faithful port of `DeployCapturedEnemySprite(enemyId, evolutionTierOffset)`.
 * Returns a stable URI string (or null) for use as Image `source.uri`.
 */
export function resolveMinionSpriteUri(
  speciesId: string,
  evolutionTierOffset: number = 0,
): string | null {
  const line = SPECIES_LINE_MAP[speciesId];
  if (!line) return null;
  const base = stageFromId(speciesId);
  const stage = Math.max(1, Math.min(4, base + evolutionTierOffset));
  // Cache-buster keyed to the script that generated the sprites — bump if
  // we re-slice the sheet so devices fetch the new asset cleanly.
  const v = 'v3';
  return `${BASE}/${line}_${stage}.png?${v}`;
}

/** Helper: does this species id have art in the dynamic sheet? */
export function hasMinionSprite(speciesId: string): boolean {
  return !!SPECIES_LINE_MAP[speciesId];
}

/**
 * Convenience: full list of every (speciesId, line, stage) tuple.
 * Used by the Registry screen to display every slot of the compendium.
 */
export function allMinionEntries(): Array<{
  speciesId: string;
  line: MinionLine;
  stage: number;
  uri: string;
}> {
  const out: Array<{ speciesId: string; line: MinionLine; stage: number; uri: string }> = [];
  (Object.keys(SPECIES_LINE_MAP) as string[]).forEach((id) => {
    out.push({
      speciesId: id,
      line: SPECIES_LINE_MAP[id],
      stage: stageFromId(id),
      uri: resolveMinionSpriteUri(id, 0) || '',
    });
  });
  return out;
}

/** Web has aggressive HTTP image cache; warm them ahead of time. */
export function preloadAllMinionSprites(): void {
  if (Platform.OS !== 'web') return;
  if (typeof globalThis === 'undefined') return;
  const G: any = globalThis as any;
  if (typeof G.Image === 'undefined') return;
  allMinionEntries().forEach((e) => {
    try {
      const img = new G.Image();
      img.src = e.uri;
    } catch { /* noop */ }
  });
}
