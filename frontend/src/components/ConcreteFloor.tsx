import React, { useMemo } from 'react';
import Svg, { Rect, Line, Circle } from 'react-native-svg';

/**
 * ConcreteFloor — procedural industrial concrete floor tile drawn with SVG.
 *
 * Designed to contrast sharply against the dark BrickWall:
 *   walls = dark gritty charcoal / brick   (#2e2e2e family)
 *   floor = light cool industrial grey     (#b0b0b0 family)
 *
 * Each tile gets a unique variant → unique panel seam offsets, crack
 * positions, and grit speckles, so a corridor of floor tiles never looks
 * like a copy-pasted texture.
 */

// ── Palette ─────────────────────────────────────────────────────────────
// Deep cyber-castle NAVY-BLUE stone — explicitly blue (not grey) so the
// bright pink/cyan ADHAMB and neon enemies pop hard against a moody floor.
const BASE_LIGHT    = '#1d2742';   // primary stone (deep navy blue)
const BASE_DARKER   = '#141b30';   // shaded panel
const BASE_LIGHTER  = '#27345a';   // highlighted patch
const SEAM_COLOR    = '#070a14';   // panel seams (near-black crevice)
const CRACK_COLOR   = 'rgba(0, 0, 0, 0.55)';
const GRIT_DARK     = 'rgba(0, 0, 0, 0.40)';
const GRIT_LIGHT    = 'rgba(120, 150, 200, 0.20)';
const STAIN_OIL     = 'rgba(0, 0, 0, 0.35)';
// Faint blue-cyan specular streak — sells depth without making the floor look grey.
const SPEC_HIGHLIGHT = 'rgba(150, 200, 240, 0.08)';

// Deterministic pseudo-random per (variant, salt)
function rand(variant: number, salt: number): number {
  const x = Math.sin(variant * 9301 + salt * 49297) * 233280;
  return x - Math.floor(x);
}

type Props = {
  size: number;
  variant?: number;
};

export default function ConcreteFloor({ size, variant = 0 }: Props) {
  const data = useMemo(() => {
    // Slight base-color shift per tile (tiny variation across the floor)
    const shadeRoll = rand(variant, 1);
    const base =
      shadeRoll < 0.30 ? BASE_DARKER :
      shadeRoll > 0.75 ? BASE_LIGHTER :
      BASE_LIGHT;

    // 2 horizontal + 2 vertical panel seams (offset randomly per tile so
    // adjacent tiles don't form one giant grid)
    const seamHy1 = Math.floor(rand(variant, 2) * (size * 0.4)) + size * 0.1;
    const seamHy2 = Math.floor(rand(variant, 3) * (size * 0.4)) + size * 0.55;
    const seamVx  = Math.floor(rand(variant, 4) * (size * 0.5)) + size * 0.25;

    // 2-3 hairline cracks
    const numCracks = 1 + Math.floor(rand(variant, 5) * 3);
    const cracks: Array<{ x1: number; y1: number; x2: number; y2: number }> = [];
    for (let i = 0; i < numCracks; i++) {
      const x1 = rand(variant, 10 + i) * size;
      const y1 = rand(variant, 20 + i) * size;
      const len = 4 + rand(variant, 30 + i) * 8;
      const angle = rand(variant, 40 + i) * Math.PI * 2;
      cracks.push({
        x1, y1,
        x2: x1 + Math.cos(angle) * len,
        y2: y1 + Math.sin(angle) * len,
      });
    }

    // 6-10 grit speckles (mix of dark and light)
    const numGrit = 6 + Math.floor(rand(variant, 6) * 5);
    const grit: Array<{ cx: number; cy: number; r: number; color: string }> = [];
    for (let i = 0; i < numGrit; i++) {
      grit.push({
        cx: rand(variant, 50 + i) * size,
        cy: rand(variant, 60 + i) * size,
        r: 0.8 + rand(variant, 70 + i) * 0.6,
        color: rand(variant, 80 + i) < 0.4 ? GRIT_LIGHT : GRIT_DARK,
      });
    }

    // 0-1 oil stain (rare, ~25% of tiles)
    const stain = rand(variant, 7) < 0.25
      ? {
          cx: 4 + rand(variant, 90) * (size - 8),
          cy: 4 + rand(variant, 91) * (size - 8),
          rx: 3 + rand(variant, 92) * 4,
          ry: 2 + rand(variant, 93) * 3,
        }
      : null;

    return { base, seamHy1, seamHy2, seamVx, cracks, grit, stain };
  }, [size, variant]);

  return (
    <Svg
      width={size}
      height={size}
      viewBox={`0 0 ${size} ${size}`}
      style={{ shapeRendering: 'crispEdges' as any } as any}
    >
      {/* (1) Base concrete colour */}
      <Rect x={0} y={0} width={size} height={size} fill={data.base} />

      {/* (2) Panel seams — two horizontals + one vertical */}
      <Line x1={0} y1={data.seamHy1} x2={size} y2={data.seamHy1} stroke={SEAM_COLOR} strokeWidth={1} strokeOpacity={0.65} />
      <Line x1={0} y1={data.seamHy2} x2={size} y2={data.seamHy2} stroke={SEAM_COLOR} strokeWidth={1} strokeOpacity={0.55} />
      <Line x1={data.seamVx} y1={0} x2={data.seamVx} y2={size} stroke={SEAM_COLOR} strokeWidth={1} strokeOpacity={0.5} />

      {/* (3) Optional oil stain (irregular blob) */}
      {data.stain && (
        <Rect
          x={data.stain.cx - data.stain.rx}
          y={data.stain.cy - data.stain.ry}
          width={data.stain.rx * 2}
          height={data.stain.ry * 2}
          fill={STAIN_OIL}
        />
      )}

      {/* (4) Hairline cracks */}
      {data.cracks.map((c, i) => (
        <Line key={`crack-${i}`} x1={c.x1} y1={c.y1} x2={c.x2} y2={c.y2} stroke={CRACK_COLOR} strokeWidth={1} />
      ))}

      {/* (5) Grit speckles */}
      {data.grit.map((g, i) => (
        <Circle key={`grit-${i}`} cx={g.cx} cy={g.cy} r={g.r} fill={g.color} />
      ))}

      {/* (6) Tile edge — very subtle inset shadow so floor reads as a panel */}
      <Rect x={0} y={0} width={size} height={size} fill="none" stroke="rgba(0,0,0,0.22)" strokeWidth={1} />

      {/* (7) Specular key-light from upper-left → adds depth, sells "stone catching light".
              Two thin rects: one along the top edge, one along the left edge of the tile. */}
      <Rect x={1} y={1} width={size - 2} height={1} fill={SPEC_HIGHLIGHT} />
      <Rect x={1} y={1} width={1} height={size - 2} fill={SPEC_HIGHLIGHT} />
    </Svg>
  );
}
