/**
 * SheetSprite — a directional, frame-animated sprite for top-down RPGs.
 *
 * Designed so the underlying spritesheet can be swapped later WITHOUT touching
 * any callers. Just edit `SHEETS.adhamb` (or add a new key) below and pass the
 * id to the component.
 *
 * Frame count per direction = 3 (idle, left-step, right-step).
 * Walking loop pattern   = [1, 0, 2, 0] (Pokémon-style "left-step → idle →
 * right-step → idle"). Idle when not moving uses frame 0.
 *
 * Each frame PNG is pre-cropped, equal-size, transparent-background, centred —
 * see `/app/backend/scripts/process_adhamb_sheet.py`. Crisp pixels are
 * guaranteed via `imageRendering: 'pixelated'` on web / no smoothing on native.
 */
import React from 'react';
import { Image, Platform, View } from 'react-native';

const BACKEND = process.env.EXPO_PUBLIC_BACKEND_URL || '';

export type Direction = 'up' | 'down' | 'left' | 'right';

/* Walk-loop frame pattern.
 * Indices reference the raw frames stored in the sheet (0=idle, 1=left, 2=right).
 * Pokémon Emerald-style cadence — keeps both feet returning to "idle" between
 * steps so the gait reads cleanly even at low fps. */
export const WALK_LOOP: Array<0 | 1 | 2> = [1, 0, 2, 0];

/* Sheet registry — add new sheets here without changing call sites. */
type SheetDef = {
  /** Frame URL pattern, %d substituted with the raw frame index 0/1/2. */
  pattern: (dir: Direction, frame: 0 | 1 | 2) => string;
};

/* Cache-buster suffix bumped whenever the underlying PNGs are re-processed.
 * Forces browsers to re-fetch instead of serving stale cached frames. */
const ADHAMB_VER = 'v2';

export const SHEETS: Record<string, SheetDef> = {
  /** ADHAMB — current player. Swap this entry to retire the temp sheet. */
  adhamb: {
    pattern: (dir, f) =>
      `${BACKEND}/api/static/sprites/adhamb_sheet/${dir}_${f}.png?${ADHAMB_VER}`,
  },
};

type Props = {
  /** Which sheet in SHEETS to use. */
  sheet?: keyof typeof SHEETS;
  /** Facing direction. */
  dir: Direction;
  /** Walking animation tick — increments at ~10fps. Pass 0 when idle. */
  tick: number;
  /** Whether the character is currently moving (drives animation playback). */
  moving: boolean;
  /** Render size in px. Frames are square so width === height. */
  size: number;
  /**
   * How fast to advance the loop. 1 step every `framesPerStep` ticks.
   * Default 3 → ~3 fps step rate ≈ Pokémon Emerald cadence at 10fps tick.
   */
  framesPerStep?: number;
};

/**
 * Renders the correct sprite frame for the given direction + walking phase.
 * Caller is expected to control its own absolute positioning / centering.
 */
export default function SheetSprite({
  sheet = 'adhamb',
  dir,
  tick,
  moving,
  size,
  framesPerStep = 3,
}: Props) {
  const def = SHEETS[sheet];
  const rawFrame: 0 | 1 | 2 = moving
    ? WALK_LOOP[Math.floor(tick / framesPerStep) % WALK_LOOP.length]
    : 0;
  const uri = def.pattern(dir, rawFrame);

  // Pre-load all 12 cells once so frame swaps don't show network blips
  // (otherwise each new direction/frame fetches lazily and flashes).
  return (
    <View style={{ width: size, height: size }} pointerEvents="none">
      <Image
        source={{ uri }}
        style={{
          width: size,
          height: size,
          backgroundColor: 'transparent',
          // Force nearest-neighbour pixel scaling for crisp pixel-art edges.
          ...(Platform.OS === 'web' ? ({ imageRendering: 'pixelated' } as object) : {}),
        }}
        resizeMode="contain"
        // RN-Web caches by URL — adding a key change forces a fresh decode but
        // the URL itself is stable per (dir, frame), so the browser cache hits.
      />
    </View>
  );
}

/**
 * Eagerly prefetch every frame in a sheet so the first walk doesn't flicker.
 * Call once on mount of any screen that uses SheetSprite.
 *
 * Production safety: if EXPO_PUBLIC_BACKEND_URL is missing the URLs become
 * "/api/static/..." which on native Android resolves to an invalid relative
 * scheme. Image.prefetch then throws an unhandled promise rejection that
 * Hermes + the new architecture can promote to a native process kill.
 * The early-return below makes this a no-op when the env var is absent.
 */
export function prefetchSheet(sheet: keyof typeof SHEETS = 'adhamb'): void {
  if (!BACKEND) return;
  const def = SHEETS[sheet];
  (['up', 'down', 'left', 'right'] as Direction[]).forEach((d) => {
    ([0, 1, 2] as const).forEach((f) => {
      try {
        const uri = def.pattern(d, f);
        Image.prefetch?.(uri)?.catch?.(() => { /* swallow per-frame failures */ });
      } catch { /* never crash on prefetch */ }
    });
  });
}
