// ============================================================
// CYBER TILE — A single modular pixel-art tile rendered via SVG
// rects. No PNGs, no asset budget. Pass a `kind` and optional
// (x,y) coordinates and you get a deterministic, consistent
// pixel-art tile every time.
//
// Supported kinds:
//   • pavement        — base cracked-concrete floor (5 variants)
//   • corruption      — AI-corrupted purple ground (3 variants)
//   • road-marking    — yellow road stripe
//   • transition      — soft edge between two zones
//   • toxic-pool      — green hazard tile
// ============================================================
import React, { useMemo } from 'react';
import Svg, { Rect, Line } from 'react-native-svg';
import { CYBER, tileHash } from '../../data/cyberPalette';

export type CyberTileKind =
  | 'pavement'
  | 'corruption'
  | 'road-marking'
  | 'transition'
  | 'toxic-pool';

type Props = {
  kind: CyberTileKind;
  size: number;
  /** Grid coordinates — used to deterministically vary the tile. */
  x?: number;
  y?: number;
  /** Override the variant index manually. */
  variant?: number;
};

const GRID = 8;   // each tile is an 8x8 logical pixel-art grid (very chunky)

export default function CyberTile({ kind, size, x = 0, y = 0, variant }: Props) {
  const v = useMemo(() => variant ?? tileHash(x, y, 1) % 16, [variant, x, y]);
  const px = size / GRID;

  // ── Helper to drop one pixel-art "pixel" at grid (gx, gy)
  const pix = (gx: number, gy: number, color: string, key: string) => (
    <Rect
      key={key}
      x={gx * px}
      y={gy * px}
      width={px}
      height={px}
      fill={color}
    />
  );

  return useMemo(() => (
    <Svg width={size} height={size}>
      {/* ── Base fill ── */}
      {kind === 'pavement' && <>
        {/* concrete slab — base body + edge highlight + variation */}
        <Rect x={0} y={0} width={size} height={size} fill={CYBER.pavement1} />
        <Rect x={0} y={0} width={size} height={px} fill={CYBER.pavement2} />
        <Rect x={0} y={0} width={px} height={size} fill={CYBER.pavement2} />
        <Rect x={size - px} y={0} width={px} height={size} fill={CYBER.pavement0} />
        <Rect x={0} y={size - px} width={size} height={px} fill={CYBER.pavement0} />
        {/* sub-tile grime grid */}
        <Line x1={size/2} y1={0} x2={size/2} y2={size} stroke={CYBER.pavement0} strokeWidth={0.5} />
        <Line x1={0} y1={size/2} x2={size} y2={size/2} stroke={CYBER.pavement0} strokeWidth={0.5} />
        {/* variant-based detail */}
        {v % 4 === 0 && <>
          {/* crack diagonal */}
          {pix(2, 3, CYBER.pavement0, 'c1')}
          {pix(3, 4, CYBER.pavement0, 'c2')}
          {pix(4, 4, CYBER.pavement0, 'c3')}
          {pix(5, 5, CYBER.pavement0, 'c4')}
        </>}
        {v % 4 === 1 && <>
          {/* debris fleck */}
          {pix(2, 5, CYBER.pavement4, 'd1')}
          {pix(3, 5, CYBER.pavement5, 'd2')}
          {pix(5, 2, CYBER.pavement3, 'd3')}
          {pix(6, 6, CYBER.pavement4, 'd4')}
        </>}
        {v % 4 === 2 && <>
          {/* corner stain */}
          {pix(1, 6, CYBER.wallShadow, 'st1')}
          {pix(2, 6, CYBER.wallShadow, 'st2')}
          {pix(1, 5, CYBER.wallShadow, 'st3')}
        </>}
        {/* v % 4 === 3 → clean tile */}
      </>}

      {kind === 'corruption' && <>
        <Rect x={0} y={0} width={size} height={size} fill={CYBER.corruptDark} />
        {/* organic-looking vein pattern */}
        {pix(1, 1, CYBER.corruptMid, 'a')}
        {pix(2, 1, CYBER.corruptMid, 'b')}
        {pix(2, 2, CYBER.corruptHigh, 'c')}
        {pix(3, 2, CYBER.corruptMid, 'd')}
        {pix(3, 3, CYBER.corruptMid, 'e')}
        {pix(4, 3, CYBER.corruptHigh, 'f')}
        {pix(5, 4, CYBER.corruptMid, 'g')}
        {pix(6, 5, CYBER.corruptMid, 'h')}
        {pix(5, 5, CYBER.corruptHigh, 'i')}
        {pix(6, 6, CYBER.corruptGlow, 'j')}
        {v % 3 === 0 && pix(4, 1, CYBER.corruptGlow, 'v1')}
        {v % 3 === 1 && pix(1, 5, CYBER.corruptGlow, 'v2')}
        {v % 3 === 2 && pix(6, 2, CYBER.corruptGlow, 'v3')}
      </>}

      {kind === 'road-marking' && <>
        <Rect x={0} y={0} width={size} height={size} fill={CYBER.pavement1} />
        <Rect x={0} y={0} width={size} height={px} fill={CYBER.pavement2} />
        <Rect x={0} y={size - px} width={size} height={px} fill={CYBER.pavement0} />
        {/* dashed yellow stripe down centre */}
        <Rect x={size/2 - px/2} y={px} width={px} height={px * 2} fill={CYBER.yellowMid} />
        <Rect x={size/2 - px/2} y={px * 4} width={px} height={px * 2} fill={CYBER.yellowHigh} />
        <Rect x={size/2 - px/2} y={px * 7} width={px} height={px} fill={CYBER.yellowMid} />
      </>}

      {kind === 'transition' && <>
        <Rect x={0} y={0} width={size} height={size} fill={CYBER.pavement1} />
        {/* gradient steps to corruptDark */}
        <Rect x={0} y={0} width={size} height={px * 2} fill={CYBER.pavement2} />
        <Rect x={0} y={px * 5} width={size} height={px * 3} fill={CYBER.corruptDark} />
        {pix(1, 5, CYBER.corruptMid, 't1')}
        {pix(3, 6, CYBER.corruptMid, 't2')}
        {pix(5, 7, CYBER.corruptHigh, 't3')}
      </>}

      {kind === 'toxic-pool' && <>
        <Rect x={0} y={0} width={size} height={size} fill="#0c1a0c" />
        <Rect x={px} y={px} width={size - 2*px} height={size - 2*px} fill="#2a5a2a" />
        <Rect x={px*2} y={px*2} width={size - 4*px} height={size - 4*px} fill="#5cff5c" opacity={0.85} />
        {/* bubble */}
        {v % 2 === 0 && pix(4, 4, '#aaffaa', 'bub')}
      </>}
    </Svg>
  ), [kind, size, v, px]);
}
