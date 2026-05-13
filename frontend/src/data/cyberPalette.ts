// ============================================================
// CYBER PALETTE — Locked colour set every modular asset must
// draw from. Keeps the visual identity coherent across the
// entire game without burning art budget on individual sprites.
//
// 24 colours total — neon accents + grimy industrial neutrals
// + AI-corruption purples/reds. Lifted from common cyberpunk-
// dystopia palettes and tuned for OLED Android contrast.
// ============================================================

export const CYBER = {
  // ── Concrete / pavement grays ──────────────────────────────
  pavement0: '#1a1d27',   // darkest crack shadow
  pavement1: '#262a36',   // base concrete
  pavement2: '#323748',   // slightly raised slab
  pavement3: '#3e4458',   // worn edge / highlight
  pavement4: '#4a5168',   // dust
  pavement5: '#586078',   // brightest concrete chip

  // ── Wall / structure ──────────────────────────────────────
  wallShadow: '#10131a',
  wallBody:   '#2a2f3e',
  wallEdge:   '#42485c',
  wallRust:   '#5a3a2a',  // exposed rebar / oxidation

  // ── AI corruption — purple/magenta line ───────────────────
  corruptDark:  '#220a36',
  corruptMid:   '#5a1a8c',
  corruptHigh:  '#a834ff',
  corruptGlow:  '#e85cff',

  // ── Hostile red / danger ──────────────────────────────────
  dangerDark:  '#3a0010',
  dangerMid:   '#a8001f',
  dangerHigh:  '#ff2a55',
  dangerGlow:  '#ff7a8c',

  // ── Friendly cyan / safe energy ───────────────────────────
  cyanDark:  '#003040',
  cyanMid:   '#0080a8',
  cyanHigh:  '#00f0ff',
  cyanGlow:  '#90ffff',

  // ── Warning yellow / road markings ────────────────────────
  yellowMid:  '#a08000',
  yellowHigh: '#ffd000',
} as const;

export const PALETTE_LIST = Object.values(CYBER);

/** Deterministic pseudo-random — keeps "variation" tiles
 *  consistent across renders (same coords → same pattern). */
export function tileHash(x: number, y: number, salt = 0): number {
  let h = (x * 73856093) ^ (y * 19349663) ^ (salt * 83492791);
  h = (h ^ (h >>> 13)) >>> 0;
  return (h * 1274126177) >>> 0;
}
