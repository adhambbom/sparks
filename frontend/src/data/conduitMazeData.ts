// ============================================================
// LEVEL 2B — THE CONDUIT MAZE  ·  Tile grid + zone metadata
// ------------------------------------------------------------
// This grid is an *invisible* collision/interaction matrix that
// sits on top of the high-fidelity `conduit_maze_bg.png` backdrop.
// The backdrop carries 100% of the visual fidelity; this grid
// carries 100% of the gameplay logic (movement collision,
// landmark triggers, hazard damage, enemy patrols).
//
// Grid dimensions are chosen so that COLS / ROWS ≈ 704 / 1270
// (the cropped backdrop aspect), keeping zones visually aligned
// with the art.
// ============================================================

/** Tile-codes. ID 0 = walkable floor, 1 = invisible blocker. */
export const TILE = {
  FLOOR: 0,
  WALL: 1,           // invisible blocking volume (backdrop shows the wall)
  ACID: 2,           // damage-over-time vault tile
  START_TERMINAL: 3,
  TROJAN_CORE: 4,
  DATA_STORAGE: 5,
  CONDUIT_CONSOLE: 6,
  MINI_BOSS_GATE: 7,
  MEGA_BOSS_GATE: 8,
} as const;

export type TileId = typeof TILE[keyof typeof TILE];

/** Codes that the player CAN'T walk over. Everything else is walkable. */
export const SOLID_TILE_IDS: ReadonlySet<TileId> = new Set([TILE.WALL]);
/** Damage-on-step tiles. */
export const DAMAGE_TILE_IDS: ReadonlySet<TileId> = new Set([TILE.ACID]);
/** Tiles that fire an interaction event when the player steps on them. */
export const TRIGGER_TILE_IDS: ReadonlySet<TileId> = new Set([
  TILE.START_TERMINAL,
  TILE.TROJAN_CORE,
  TILE.DATA_STORAGE,
  TILE.CONDUIT_CONSOLE,
  TILE.MINI_BOSS_GATE,
  TILE.MEGA_BOSS_GATE,
]);

/** Per-zone display metadata. Keyed by tile id. */
export const ZONE_META: Record<number, {
  label: string;
  flavor: string;
  accent: string;
}> = {
  [TILE.START_TERMINAL]: {
    label: 'START TERMINAL',
    flavor: 'Biometric scan complete. Welcome back, Operative.',
    accent: '#00f0ff',
  },
  [TILE.TROJAN_CORE]: {
    label: 'TROJAN INJECTOR CORE',
    flavor: 'Inject custom firmware. +25 XP · 1× Energy Cell',
    accent: '#ff2dff',
  },
  [TILE.DATA_STORAGE]: {
    label: 'DATA STORAGE CELLS',
    flavor: 'Encrypted shards extracted. +40 credits',
    accent: '#ffaa00',
  },
  [TILE.CONDUIT_CONSOLE]: {
    label: 'CONDUIT CONSOLE',
    flavor: 'Sector hazard rerouted. Adjacent acid vaults disabled.',
    accent: '#88ff88',
  },
  [TILE.ACID]: {
    label: 'ACID VAULT',
    flavor: 'Toxic spill — DOT damage active.',
    accent: '#33ff66',
  },
  [TILE.MINI_BOSS_GATE]: {
    label: 'HIVE CUSTODIAN',
    flavor: 'Mini-boss detected. Initiating encounter…',
    accent: '#c266ff',
  },
  [TILE.MEGA_BOSS_GATE]: {
    label: 'QUANTUM AI · MEGA BOSS',
    flavor: 'WARNING: Three-phase apex AI. Survival not guaranteed.',
    accent: '#ff2a55',
  },
};

/** Backdrop URL — served by the backend static file router. */
export const BACKDROP_URL = '/api/static/sprites/conduit_maze_bg.png';

/** Grid sized 16 cols × 28 rows. Aspect 0.571 ≈ backdrop's 0.554. */
export const COLS = 16;
export const ROWS = 28;

/**
 * Hand-tuned overlay grid. Aligns gameplay collision with the backdrop's
 * painted zones. Tile codes:
 *   0 floor · 1 wall · 2 acid · 3 startTerm · 4 trojan · 5 storage
 *   6 console · 7 miniBoss · 8 megaBoss
 *
 * Player canonical spawn is (col=12, row=24) — the START TERMINAL.
 */
export const CONDUIT_L2B_GRID: number[][] = [
  // Row 0 — outer top frame (above the mega-boss alcove)
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  // Row 1 — Quantum AI alcove silhouette (the giant boss head/arms)
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  // Row 2 — Mega-boss central focus tile, walls on sides (servers)
  [1,1,1,1,1,1,1,8,8,1,1,1,1,1,1,1],
  // Row 3 — Ghoul flanks (wall) with central corridor
  [1,1,1,0,0,0,0,8,8,0,0,0,0,1,1,1],
  // Row 4 — Mid-alcove walkway
  [1,1,0,0,1,1,0,0,0,0,1,1,0,0,1,1],
  // Row 5 — Lower mega-boss corridor
  [1,0,0,0,1,1,0,0,0,0,1,1,0,0,0,1],
  // Row 6 — Boss Arena platform (host nodes ring)
  [1,0,1,1,0,0,0,8,8,0,0,0,1,1,0,1],
  // Row 7 — Boss Arena center (MEGA BOSS encounter trigger here)
  [1,0,1,1,0,0,8,8,8,8,0,0,1,1,0,1],
  // Row 8 — Boss Arena lower ring
  [1,0,1,1,0,0,0,8,8,0,0,0,1,1,0,1],
  // Row 9 — Arena exit corridor
  [1,0,0,0,0,0,0,0,0,0,0,0,0,0,0,1],
  // Row 10 — Acid vaults flank left; conduit consoles flank right
  [1,2,2,1,0,0,0,0,0,0,0,0,1,2,6,1],
  // Row 11 — Acid + Overclock approach corridor
  [1,2,2,1,0,1,1,0,0,1,1,0,1,2,6,1],
  // Row 12 — Mid-corridor by conduit consoles
  [1,2,2,1,0,1,0,0,0,0,1,0,1,2,2,1],
  // Row 13 — Overclock Server Block (top)
  [1,0,0,0,0,1,0,7,7,0,1,0,0,0,0,1],
  // Row 14 — MINI-BOSS Hive Custodian center
  [1,0,6,0,0,1,0,7,7,0,1,0,0,6,0,1],
  // Row 15 — Overclock Server Block (bottom)
  [1,0,0,0,0,1,0,0,0,0,1,0,0,0,0,1],
  // Row 16 — Corridor with side walls
  [1,0,1,1,0,0,0,0,0,0,0,0,1,1,0,1],
  // Row 17 — Lower-mid corridor + acid vault entrances
  [1,0,1,1,0,1,1,0,0,1,1,0,1,1,0,1],
  // Row 18 — Central acid pool (parasitic amalgam region)
  [1,0,0,0,0,1,2,2,2,2,1,0,0,0,0,1],
  // Row 19 — DATA STORAGE cells (left) / approach to START TERMINAL (right)
  [1,0,5,5,0,0,0,0,0,0,0,0,3,3,0,1],
  // Row 20 — Data + Trojan Injector + Start Terminal row
  [1,0,5,5,1,1,0,4,4,0,1,1,3,3,0,1],
  // Row 21 — Trojan Injector Core central tile
  [1,0,0,0,1,1,0,4,4,0,1,1,0,0,0,1],
  // Row 22 — South corridor
  [1,1,0,0,0,0,0,0,0,0,0,0,0,0,1,1],
  // Row 23 — South corridor narrowing
  [1,1,1,1,0,0,0,0,0,0,0,0,1,1,1,1],
  // Row 24 — Ghoul Matrix exit area + canonical spawn @ (12,24)
  [1,1,1,1,1,1,0,0,0,0,1,1,1,1,1,1],
  // Row 25 — Lower bottom passage
  [1,1,1,1,1,1,1,0,0,1,1,1,1,1,1,1],
  // Row 26 — Outer bottom frame
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
  // Row 27 — Outer bottom frame
  [1,1,1,1,1,1,1,1,1,1,1,1,1,1,1,1],
];

/** Helper: tile id at (x,y) or -1 if out-of-bounds. */
export function tileAt(x: number, y: number): number {
  if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return -1;
  return CONDUIT_L2B_GRID[y][x];
}

/** Helper: is (x,y) a solid blocker? Out-of-bounds counts as solid. */
export function isWall(x: number, y: number): boolean {
  const t = tileAt(x, y);
  if (t === -1) return true;
  return SOLID_TILE_IDS.has(t as TileId);
}
