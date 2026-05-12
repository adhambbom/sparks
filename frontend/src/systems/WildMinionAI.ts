// ============================================================
// WILD MINION AI  —  TS port of WildMinionChaseAI.cs
// ------------------------------------------------------------
// Pure, frame-tickable state machine. No React, no DOM. Consumed
// by game.tsx's per-tile-step roamer loop (replaces the random
// wander logic for any roamer whose level uses this AI).
//
// State diagram:
//
//    ┌────────────┐ player in radius   ┌──────────┐ player out of radius  ┌──────────┐
//    │ Wandering  │ ───────LOS────────▶│ Chasing  │ ────────────────────▶ │Returning │
//    └────────────┘                    └──────────┘                       └──────────┘
//          ▲                                                                    │
//          └────────────────── arrived back at anchor ─────────────────────────┘
// ============================================================

export type AIState = 'Wandering' | 'Alerted' | 'Chasing' | 'Returning';

export type AIRoamer = {
  uid: string;
  enemyId: string;
  x: number;          // current tile
  y: number;
  /** Aggro state — diverges per-roamer. */
  state: AIState;
  /** Anchor tile the roamer returns to after losing the player. */
  anchorX: number;
  anchorY: number;
  /** Tick counter for wander-delay (set on each step). */
  wanderCooldown: number;
  /** Facing direction so we can flip the sprite. */
  facing: 'left' | 'right' | 'up' | 'down';
  boss?: boolean;
};

export const AI_CONFIG = {
  /** Detection radius in tiles (Chebyshev). C# blueprint: 4. */
  detectionRadius: 4,
  /** Lose-target radius. C# blueprint: 7. */
  loseTargetRadius: 7,
  /** Tile distance at which the chase triggers a combat encounter. */
  contactRadius: 0,    // 0 = standing on same tile (game.tsx already handles this)
  /** Wander step delay (in roamer ticks). Random 2..5. */
  wanderMinDelay: 2,
  wanderMaxDelay: 5,
  /** Chase moves every tick (no delay). */
  chaseDelay: 0,
};

/** Chebyshev (king-move) distance — matches the radial LOS sphere on a tile grid. */
function dist(ax: number, ay: number, bx: number, by: number): number {
  return Math.max(Math.abs(ax - bx), Math.abs(ay - by));
}

/** Bresenham line-of-sight between two tiles. Returns true if no wall tile
 *  is encountered along the ray. `isWall(x,y)` is supplied by the caller. */
export function hasLineOfSight(
  ax: number, ay: number,
  bx: number, by: number,
  isWall: (x: number, y: number) => boolean,
): boolean {
  let x = ax, y = ay;
  const dx = Math.abs(bx - ax), dy = Math.abs(by - ay);
  const sx = ax < bx ? 1 : -1;
  const sy = ay < by ? 1 : -1;
  let err = dx - dy;
  // Limit ray length to detection radius to bound CPU.
  for (let i = 0; i < 32; i++) {
    if (x === bx && y === by) return true;
    if (!(x === ax && y === ay) && isWall(x, y)) return false;
    const e2 = err * 2;
    if (e2 > -dy) { err -= dy; x += sx; }
    if (e2 < dx)  { err += dx; y += sy; }
  }
  return false;
}

/** Pick the dominant cardinal toward (tx,ty). Strict 4-way (no diagonals)
 *  per the C# blueprint. Ties resolve toward X first. */
function cardinalToward(fromX: number, fromY: number, tx: number, ty: number): { dx: number; dy: number; facing: AIRoamer['facing'] } {
  const dx = tx - fromX, dy = ty - fromY;
  if (Math.abs(dx) > Math.abs(dy)) {
    return { dx: dx > 0 ? 1 : -1, dy: 0, facing: dx > 0 ? 'right' : 'left' };
  }
  return { dx: 0, dy: dy > 0 ? 1 : -1, facing: dy > 0 ? 'down' : 'up' };
}

function randomCardinal(): { dx: number; dy: number; facing: AIRoamer['facing'] } {
  const r = Math.floor(Math.random() * 4);
  if (r === 0) return { dx: 1,  dy: 0,  facing: 'right' };
  if (r === 1) return { dx: -1, dy: 0,  facing: 'left' };
  if (r === 2) return { dx: 0,  dy: 1,  facing: 'down' };
  return        { dx: 0,  dy: -1, facing: 'up'   };
}

export type StepCtx = {
  /** Player tile coords. */
  playerX: number;
  playerY: number;
  /** Set of "wall" tiles the roamer cannot enter. */
  isWall: (x: number, y: number) => boolean;
  /** Tiles currently occupied by other roamers. */
  occupied: (x: number, y: number) => boolean;
};

/**
 * Faithful port of `BehaviorStateMachineLoop()`'s per-tick body.
 * Returns the updated roamer (immutable). game.tsx calls this every
 * ROAM_TICK_MS for each roamer.
 */
export function stepWildAI(r: AIRoamer, ctx: StepCtx): AIRoamer {
  const d = dist(r.x, r.y, ctx.playerX, ctx.playerY);
  let state = r.state;

  // ── 1. Sensing radar ──────────────────────────────────────
  if (state === 'Wandering' && d <= AI_CONFIG.detectionRadius) {
    if (hasLineOfSight(r.x, r.y, ctx.playerX, ctx.playerY, ctx.isWall)) {
      state = 'Alerted';                       // brief alert this tick…
    }
  } else if (state === 'Chasing' && d > AI_CONFIG.loseTargetRadius) {
    state = 'Returning';                       // … game.tsx renders the "!" icon for Alerted/Chasing
  }
  // Alerted is a one-tick "!" flash before chasing begins. Promote on the
  // very next call so we don't get stuck in Alerted forever.
  if (state === 'Alerted') state = 'Chasing';

  // ── 2. Action execution ───────────────────────────────────
  let dx = 0, dy = 0, facing = r.facing;
  let cooldown = r.wanderCooldown;

  if (state === 'Wandering') {
    if (cooldown <= 0) {
      const pick = randomCardinal();
      dx = pick.dx; dy = pick.dy; facing = pick.facing;
      cooldown = AI_CONFIG.wanderMinDelay
        + Math.floor(Math.random() * (AI_CONFIG.wanderMaxDelay - AI_CONFIG.wanderMinDelay + 1));
    } else {
      cooldown -= 1;
    }
  } else if (state === 'Chasing') {
    const pick = cardinalToward(r.x, r.y, ctx.playerX, ctx.playerY);
    dx = pick.dx; dy = pick.dy; facing = pick.facing;
    // If primary cardinal blocked, try the secondary (avoid getting stuck on walls).
    if (ctx.isWall(r.x + dx, r.y + dy)) {
      const fx = ctx.playerX - r.x, fy = ctx.playerY - r.y;
      if (Math.abs(fx) > Math.abs(fy)) {
        dx = 0; dy = fy > 0 ? 1 : (fy < 0 ? -1 : 0);
      } else {
        dx = fx > 0 ? 1 : (fx < 0 ? -1 : 0); dy = 0;
      }
      if (dx === 1) facing = 'right';
      else if (dx === -1) facing = 'left';
      else if (dy === 1) facing = 'down';
      else if (dy === -1) facing = 'up';
    }
  } else if (state === 'Returning') {
    const arrived = (r.x === r.anchorX && r.y === r.anchorY);
    if (arrived) {
      state = 'Wandering';
    } else {
      const pick = cardinalToward(r.x, r.y, r.anchorX, r.anchorY);
      dx = pick.dx; dy = pick.dy; facing = pick.facing;
    }
  }

  // ── 3. Apply step with collision / occupancy guard ────────
  const nx = r.x + dx, ny = r.y + dy;
  const blocked = (dx === 0 && dy === 0)
    || ctx.isWall(nx, ny)
    || ctx.occupied(nx, ny)
    || (nx === ctx.playerX && ny === ctx.playerY); // player-tile collision handled by game.tsx

  if (blocked) {
    return { ...r, state, facing, wanderCooldown: cooldown };
  }
  return { ...r, x: nx, y: ny, state, facing, wanderCooldown: cooldown };
}

/** Build the initial AI state for a freshly spawned roamer. */
export function makeAIRoamer(
  uid: string,
  enemyId: string,
  x: number,
  y: number,
  boss?: boolean,
): AIRoamer {
  return {
    uid,
    enemyId,
    x, y,
    state: 'Wandering',
    anchorX: x,
    anchorY: y,
    wanderCooldown: AI_CONFIG.wanderMinDelay
      + Math.floor(Math.random() * (AI_CONFIG.wanderMaxDelay - AI_CONFIG.wanderMinDelay + 1)),
    facing: 'down',
    boss,
  };
}
