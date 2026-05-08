import React, { useMemo } from 'react';
import Svg, { Rect, Line } from 'react-native-svg';

/**
 * BrickWall — procedural pixel-art brick wall, drawn with SVG primitives
 * (the React-Native equivalent of HTML5 Canvas drawing methods).
 *
 * Theme: WORN INDUSTRIAL — gritty, dark, weathered.
 * No glowing tech, no neon — purely decorative dystopian brickwork so the
 * glowing eyes of AI enemies pop visually.
 *
 * Each tile gets a deterministic but varied pattern based on `variant`,
 * so adjacent wall tiles never look identical.
 */

// ── Palette ─────────────────────────────────────────────────────────────
const BASE_COLOR        = '#2e2e2e';   // dark moody charcoal (user-requested)
const BASE_COLOR_ALT    = '#3a3d40';   // deep industrial grey-brown (alt base)
const BRICK_DARKER      = '#1c1c1f';   // shadowed brick face
const BRICK_LIGHTER     = '#42434a';   // highlighted brick face
const GROUT_COLOR       = '#0d0d10';   // mortar / grout (between bricks)
const GROUT_LIGHT       = '#525258';   // top edge of each brick (subtle highlight)
const STAIN_MOSS        = 'rgba(74, 110, 60, 0.32)';   // dim moss
const STAIN_RUST        = 'rgba(140, 60, 30, 0.32)';   // dim rust
const CRACK_COLOR       = 'rgba(0, 0, 0, 0.55)';       // hairline cracks

// ── Pseudo-random utility — deterministic per (variant, salt) ───────────
function rand(variant: number, salt: number): number {
  // simple LCG-ish hash, returns 0..1
  const x = Math.sin(variant * 9301 + salt * 49297) * 233280;
  return x - Math.floor(x);
}

type Props = {
  size: number;          // tile size in px (square)
  variant?: number;      // 0..N — drives all randomized details deterministically
};

export default function BrickWall({ size, variant = 0 }: Props) {
  // 4 brick rows × 4 columns, staggered (English bond pattern)
  const ROWS = 4;
  const COLS = 4;
  const brickH = size / ROWS;
  const brickW = size / COLS;

  // Pre-compute every brick's individual shading + imperfections so the
  // drawing is stable across renders (memoized on size + variant).
  const bricks = useMemo(() => {
    const list: Array<{
      x: number; y: number; w: number; h: number;
      fill: string;
      stain?: { color: string; cx: number; cy: number; w: number; h: number };
      crack?: { x1: number; y1: number; x2: number; y2: number };
      darken?: boolean;
    }> = [];

    for (let r = 0; r < ROWS; r++) {
      const offset = r % 2 === 1 ? -brickW / 2 : 0;   // staggered offset
      // We render one extra brick on offset rows so they fill the full width
      const cols = r % 2 === 1 ? COLS + 1 : COLS;
      for (let c = 0; c < cols; c++) {
        const seed = variant * 31 + r * 13 + c * 7;
        const shadeRoll = rand(variant, seed);
        let fill = BASE_COLOR;
        if (shadeRoll < 0.18)      fill = BRICK_DARKER;
        else if (shadeRoll < 0.36) fill = BRICK_LIGHTER;
        else if (shadeRoll < 0.55) fill = BASE_COLOR_ALT;

        const x = offset + c * brickW;
        const y = r * brickH;
        const w = brickW;
        const h = brickH;

        // Some bricks get a stain (~25% chance)
        let stain: any = undefined;
        const stainRoll = rand(variant, seed + 100);
        if (stainRoll < 0.13) {
          const isMoss = rand(variant, seed + 200) < 0.5;
          stain = {
            color: isMoss ? STAIN_MOSS : STAIN_RUST,
            cx: x + 1 + rand(variant, seed + 300) * (w - 4),
            cy: y + 1 + rand(variant, seed + 400) * (h - 3),
            w: 2 + Math.floor(rand(variant, seed + 500) * 3),
            h: 2,
          };
        }

        // ~10% chance of a hairline crack
        let crack: any = undefined;
        if (rand(variant, seed + 600) < 0.10) {
          const cx0 = x + 1 + rand(variant, seed + 700) * (w - 2);
          const cy0 = y + 1;
          const len = h - 2;
          crack = {
            x1: cx0,
            y1: cy0,
            x2: cx0 + (rand(variant, seed + 800) - 0.5) * 2,  // slight slant
            y2: cy0 + len,
          };
        }

        list.push({ x, y, w, h, fill, stain, crack });
      }
    }
    return list;
  }, [size, variant, brickH, brickW]);

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      // Disable AA on web for crisp pixel edges
      style={{ shapeRendering: 'crispEdges' as any } as any}
    >
      {/* (1) Grout layer — single dark rect; gaps between bricks reveal it */}
      <Rect x={0} y={0} width={size} height={size} fill={GROUT_COLOR} />

      {/* (2) Brick faces, drawn 1px smaller than slot to expose grout lines */}
      {bricks.map((b, i) => (
        <React.Fragment key={`b-${i}`}>
          <Rect
            x={b.x + 0.5}
            y={b.y + 0.5}
            width={b.w - 1}
            height={b.h - 1}
            fill={b.fill}
          />
          {/* Top-edge subtle highlight (light from above) */}
          <Line
            x1={b.x + 0.5}
            y1={b.y + 0.5}
            x2={b.x + b.w - 0.5}
            y2={b.y + 0.5}
            stroke={GROUT_LIGHT}
            strokeOpacity={0.35}
            strokeWidth={1}
          />
          {/* Imperfections: stains */}
          {b.stain && (
            <Rect
              x={b.stain.cx}
              y={b.stain.cy}
              width={b.stain.w}
              height={b.stain.h}
              fill={b.stain.color}
            />
          )}
          {/* Imperfections: hairline cracks */}
          {b.crack && (
            <Line
              x1={b.crack.x1}
              y1={b.crack.y1}
              x2={b.crack.x2}
              y2={b.crack.y2}
              stroke={CRACK_COLOR}
              strokeWidth={1}
            />
          )}
        </React.Fragment>
      ))}

      {/* (3) Tile-edge vignette — subtle dark border to break up the grid feel
          when many wall tiles sit beside each other */}
      <Rect
        x={0}
        y={0}
        width={size}
        height={size}
        fill="none"
        stroke="rgba(0,0,0,0.45)"
        strokeWidth={1}
      />
    </Svg>
  );
}
