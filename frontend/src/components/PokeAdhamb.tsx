/**
 * PokeAdhamb — Pokémon-GBA-style overworld sprite of the player character.
 *
 * Drawn entirely with `react-native-svg` primitives (no AI-image cost) so we
 * can produce 4 facing directions × 2 walking frames cheaply. The same ADHAMB
 * colour palette as the combat / overworld PNG: pink helmet, cyan visor, pink
 * torso, dark-magenta legs, near-black boots.
 *
 * Props:
 *   - `dir`     'up' | 'down' | 'left' | 'right'  — facing direction
 *   - `frame`   0 | 1                              — walking frame (alternate)
 *   - `width` / `height`                           — render size in px
 *
 * The sprite is drawn inside a 32 × 44 viewBox so resizing is crisp.
 */
import React from 'react';
import Svg, { Rect, Ellipse, Path, G } from 'react-native-svg';

type Dir = 'up' | 'down' | 'left' | 'right';

const PINK = '#e84cae';        // helmet + torso plate
const PINK_SHADE = '#a8307d';  // helmet shadow
const VISOR = '#5ee5ff';       // cyan visor
const VISOR_SHADE = '#1f8aa8'; // visor shadow
const SKIN = '#f5d2b3';        // chin / face peek
const LEG = '#7a1f5e';         // dark magenta legs
const BOOT = '#1a1a22';        // boots / outline
const OUTLINE = '#0a0a14';     // pixel outline

type Props = {
  dir?: Dir;
  frame?: 0 | 1;
  width?: number;
  height?: number;
};

export default function PokeAdhamb({ dir = 'down', frame = 0, width = 32, height = 44 }: Props) {
  return (
    <Svg width={width} height={height} viewBox="0 0 32 44">
      {/* Soft ground shadow */}
      <Ellipse cx={16} cy={42} rx={9} ry={1.6} fill="rgba(0,0,0,0.45)" />
      {dir === 'down' && <FrontView frame={frame} />}
      {dir === 'up'   && <BackView frame={frame} />}
      {dir === 'left' && <SideView frame={frame} flip={false} />}
      {dir === 'right'&& <SideView frame={frame} flip={true} />}
    </Svg>
  );
}

/* ─────────────────────────── FRONT (facing camera) ─────────────────────── */
function FrontView({ frame }: { frame: 0 | 1 }) {
  // Walking offsets — one leg forward, one back, swapped each frame.
  const legL = frame === 0 ? 0 : 1;
  const legR = frame === 0 ? 1 : 0;
  return (
    <G>
      {/* Helmet outline */}
      <Rect x={9} y={4} width={14} height={14} fill={OUTLINE} />
      {/* Helmet body */}
      <Rect x={10} y={5} width={12} height={12} fill={PINK} />
      {/* Helmet top highlight */}
      <Rect x={11} y={5} width={10} height={2} fill={PINK_SHADE} opacity={0.55} />
      {/* Visor */}
      <Rect x={11} y={9} width={10} height={3} fill={VISOR} />
      <Rect x={11} y={11} width={10} height={1} fill={VISOR_SHADE} />
      {/* Tiny chin peek */}
      <Rect x={13} y={16} width={6} height={2} fill={SKIN} />
      {/* Torso */}
      <Rect x={9} y={18} width={14} height={11} fill={OUTLINE} />
      <Rect x={10} y={19} width={12} height={9} fill={PINK} />
      {/* Belt seam */}
      <Rect x={10} y={26} width={12} height={2} fill={OUTLINE} />
      {/* Arms */}
      <Rect x={8} y={20} width={2} height={6} fill={PINK_SHADE} />
      <Rect x={22} y={20} width={2} height={6} fill={PINK_SHADE} />
      {/* Legs */}
      <Rect x={11} y={29 - legL} width={4} height={9 + legL} fill={LEG} />
      <Rect x={17} y={29 - legR} width={4} height={9 + legR} fill={LEG} />
      {/* Boots */}
      <Rect x={10} y={37} width={6} height={3} fill={BOOT} />
      <Rect x={16} y={37} width={6} height={3} fill={BOOT} />
    </G>
  );
}

/* ─────────────────────────── BACK (away from camera) ───────────────────── */
function BackView({ frame }: { frame: 0 | 1 }) {
  const legL = frame === 0 ? 0 : 1;
  const legR = frame === 0 ? 1 : 0;
  return (
    <G>
      {/* Helmet — same silhouette as front, but no visor */}
      <Rect x={9} y={4} width={14} height={14} fill={OUTLINE} />
      <Rect x={10} y={5} width={12} height={12} fill={PINK} />
      {/* Back-of-helmet panel seam */}
      <Rect x={10} y={9} width={12} height={1} fill={PINK_SHADE} />
      <Rect x={15} y={5} width={2} height={12} fill={PINK_SHADE} opacity={0.6} />
      {/* No chin — back of head */}
      {/* Torso (back plate) */}
      <Rect x={9} y={18} width={14} height={11} fill={OUTLINE} />
      <Rect x={10} y={19} width={12} height={9} fill={PINK} />
      {/* Spine seam */}
      <Rect x={15} y={19} width={2} height={9} fill={PINK_SHADE} opacity={0.6} />
      {/* Belt */}
      <Rect x={10} y={26} width={12} height={2} fill={OUTLINE} />
      {/* Arms */}
      <Rect x={8} y={20} width={2} height={6} fill={PINK_SHADE} />
      <Rect x={22} y={20} width={2} height={6} fill={PINK_SHADE} />
      {/* Legs */}
      <Rect x={11} y={29 - legL} width={4} height={9 + legL} fill={LEG} />
      <Rect x={17} y={29 - legR} width={4} height={9 + legR} fill={LEG} />
      {/* Boots */}
      <Rect x={10} y={37} width={6} height={3} fill={BOOT} />
      <Rect x={16} y={37} width={6} height={3} fill={BOOT} />
    </G>
  );
}

/* ─────────────────────── SIDE (left, mirror for right) ─────────────────── */
function SideView({ frame, flip }: { frame: 0 | 1; flip: boolean }) {
  // Side-view legs alternate front/back position rather than up/down.
  const frontX = frame === 0 ? 13 : 15;
  const backX  = frame === 0 ? 15 : 13;
  const inner = (
    <G>
      {/* Helmet (3/4 profile silhouette) */}
      <Rect x={10} y={4} width={12} height={14} fill={OUTLINE} />
      <Rect x={11} y={5} width={10} height={12} fill={PINK} />
      {/* Visor — only on the forward-facing half */}
      <Rect x={11} y={9} width={6} height={3} fill={VISOR} />
      <Rect x={11} y={11} width={6} height={1} fill={VISOR_SHADE} />
      {/* Helmet back highlight */}
      <Rect x={18} y={6} width={3} height={10} fill={PINK_SHADE} opacity={0.5} />
      {/* Tiny chin peek (forward side) */}
      <Rect x={11} y={16} width={4} height={2} fill={SKIN} />
      {/* Torso (narrower in profile) */}
      <Rect x={11} y={18} width={10} height={11} fill={OUTLINE} />
      <Rect x={12} y={19} width={8} height={9} fill={PINK} />
      {/* Single visible arm in profile, swinging */}
      <Rect x={frame === 0 ? 9 : 11} y={20} width={2} height={6} fill={PINK_SHADE} />
      {/* Belt */}
      <Rect x={11} y={26} width={10} height={2} fill={OUTLINE} />
      {/* Two legs in profile — front leg + back leg, positions swap each frame */}
      <Rect x={frontX} y={29} width={4} height={9} fill={LEG} />
      <Rect x={backX}  y={29} width={4} height={9} fill={LEG} opacity={0.85} />
      {/* Boots */}
      <Rect x={frontX - 1} y={37} width={6} height={3} fill={BOOT} />
      <Rect x={backX - 1}  y={37} width={6} height={3} fill={BOOT} opacity={0.85} />
    </G>
  );
  // Flip horizontally for the right-facing variant.
  return flip ? (
    <G transform="translate(32 0) scale(-1 1)">{inner}</G>
  ) : inner;
}
