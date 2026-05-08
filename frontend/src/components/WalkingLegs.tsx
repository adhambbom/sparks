import React from 'react';
import Svg, { Rect, Ellipse } from 'react-native-svg';

/**
 * WalkingLegs — procedurally-drawn animated legs overlay.
 *
 * Renders two leg shapes in one of three frames:
 *   • frame 0 → idle (both legs together)
 *   • frame 1 → step-A: left leg forward, right leg planted
 *   • frame 2 → step-B: right leg forward, left leg planted
 *
 * The character's static sprite legs should be masked/clipped above this
 * overlay so we see THESE legs instead. Three style variants match the
 * three character types we have:
 *   - 'human'      → ADHAMB pink-armored hero (2 magenta legs + cyan boots)
 *   - 'scout'      → Clockwork Scout rusty quadruped (4 spider legs)
 *   - 'juggernaut' → Heavy blue mech (2 thick steel-blue legs)
 */

type Frame = 0 | 1 | 2;
type LegStyle = 'human' | 'scout' | 'juggernaut';

type Props = {
  width: number;
  height: number;
  frame: Frame;
  style: LegStyle;
};

export default function WalkingLegs({ width, height, frame, style }: Props) {
  const w = width;
  const h = height;

  // Compute step offsets (how far forward/back each leg moves per frame)
  // step ∈ [-1, +1] : -1 = full back, +1 = full forward
  let leftStep = 0, rightStep = 0;
  let leftLift = 0, rightLift = 0;   // vertical lift (0 = planted, 1 = lifted)
  if (frame === 1) {                 // step-A: left forward, right back
    leftStep = +1; leftLift = 1;
    rightStep = -0.4; rightLift = 0;
  } else if (frame === 2) {          // step-B: right forward, left back
    rightStep = +1; rightLift = 1;
    leftStep = -0.4; leftLift = 0;
  }

  if (style === 'human') {
    return drawHumanLegs(w, h, leftStep, rightStep, leftLift, rightLift);
  } else if (style === 'scout') {
    return drawScoutLegs(w, h, frame);
  } else {
    return drawJuggernautLegs(w, h, leftStep, rightStep, leftLift, rightLift);
  }
}

// ── Style: Human (pink armor) ───────────────────────────────────────────
function drawHumanLegs(
  w: number, h: number,
  leftStep: number, rightStep: number,
  leftLift: number, rightLift: number,
) {
  // Leg dimensions
  const legW = Math.max(4, w * 0.13);
  const legH = h * 0.78;
  const stepRange = w * 0.10;
  const liftRange = h * 0.18;

  // Center positions (when idle, legs sit on either side of midline)
  const cxL = w / 2 - legW * 1.1;
  const cxR = w / 2 + legW * 0.1;
  const baseY = h - legH;

  const lx = cxL + leftStep * stepRange;
  const rx = cxR + rightStep * stepRange;
  const ly = baseY - leftLift * liftRange;
  const ry = baseY - rightLift * liftRange;

  // Boot dimensions (cyan accent at bottom of each leg)
  const bootH = legH * 0.28;
  const PINK = '#cd2d6e';
  const PINK_DARK = '#8a1f4a';
  const BOOT = '#0a0a14';
  const BOOT_HL = '#00f0ff';

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ shapeRendering: 'crispEdges' as any } as any}>
      {/* Shadow on the ground (slightly squashed when both feet planted) */}
      <Ellipse
        cx={w / 2} cy={h - 1}
        rx={w * 0.32} ry={2}
        fill="rgba(0,0,0,0.4)"
      />
      {/* Left leg — pink armor */}
      <Rect x={lx} y={ly} width={legW} height={legH - bootH} fill={PINK} />
      <Rect x={lx} y={ly + 1} width={legW} height={1} fill={PINK_DARK} opacity={0.5} />
      {/* Left boot */}
      <Rect x={lx - 1} y={ly + legH - bootH} width={legW + 2} height={bootH} fill={BOOT} />
      <Rect x={lx + 1} y={ly + legH - bootH + 1} width={legW - 2} height={1} fill={BOOT_HL} opacity={0.7} />
      {/* Right leg — pink armor */}
      <Rect x={rx} y={ry} width={legW} height={legH - bootH} fill={PINK} />
      <Rect x={rx} y={ry + 1} width={legW} height={1} fill={PINK_DARK} opacity={0.5} />
      {/* Right boot */}
      <Rect x={rx - 1} y={ry + legH - bootH} width={legW + 2} height={bootH} fill={BOOT} />
      <Rect x={rx + 1} y={ry + legH - bootH + 1} width={legW - 2} height={1} fill={BOOT_HL} opacity={0.7} />
    </Svg>
  );
}

// ── Style: Clockwork Scout (rusty quadruped) ───────────────────────────
function drawScoutLegs(w: number, h: number, frame: Frame) {
  // 4 insectoid legs splaying outward; alternate pairs lift on each frame
  const legW = Math.max(2, w * 0.06);
  const RUST = '#7a3a1a';
  const RUST_DARK = '#3e1c0c';

  // pair-A = legs 0 & 2 ; pair-B = legs 1 & 3
  const pairA_lift = frame === 1 ? 1 : 0;
  const pairB_lift = frame === 2 ? 1 : 0;
  const liftRange = h * 0.28;

  // four leg anchors at top, splaying down/out
  const topY = 0;
  const bottomY = h - 1;
  const anchors = [
    { topX: w * 0.30, botX: w * 0.05, pair: 'A' },
    { topX: w * 0.42, botX: w * 0.30, pair: 'B' },
    { topX: w * 0.58, botX: w * 0.70, pair: 'B' },
    { topX: w * 0.70, botX: w * 0.95, pair: 'A' },
  ];

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ shapeRendering: 'crispEdges' as any } as any}>
      {/* Ground shadow (4 small dots = feet planted) */}
      <Ellipse cx={w * 0.5} cy={h - 1} rx={w * 0.35} ry={1.5} fill="rgba(0,0,0,0.4)" />
      {anchors.map((a, i) => {
        const lift = a.pair === 'A' ? pairA_lift : pairB_lift;
        const adjustedBotY = bottomY - lift * liftRange;
        return (
          <React.Fragment key={`leg-${i}`}>
            {/* segmented leg: top thigh (vertical-ish) + lower shin (slanted) */}
            <Rect
              x={a.topX - legW / 2}
              y={topY}
              width={legW}
              height={h * 0.45}
              fill={RUST_DARK}
            />
            {/* Lower shin slanted toward foot */}
            <Rect
              x={(a.topX + a.botX) / 2 - legW / 2}
              y={h * 0.40}
              width={legW}
              height={(adjustedBotY - h * 0.40)}
              fill={RUST}
              transform={`rotate(${(a.botX - a.topX) * 0.4} ${(a.topX + a.botX) / 2} ${h * 0.40})`}
            />
          </React.Fragment>
        );
      })}
    </Svg>
  );
}

// ── Style: Juggernaut (heavy blue mech) ────────────────────────────────
function drawJuggernautLegs(
  w: number, h: number,
  leftStep: number, rightStep: number,
  leftLift: number, rightLift: number,
) {
  // Two thick steel-blue mech legs with footplates
  const legW = Math.max(6, w * 0.22);
  const legH = h * 0.85;
  const stepRange = w * 0.08;
  const liftRange = h * 0.10;

  const cxL = w / 2 - legW * 1.15;
  const cxR = w / 2 + legW * 0.15;
  const baseY = h - legH;

  const lx = cxL + leftStep * stepRange;
  const rx = cxR + rightStep * stepRange;
  const ly = baseY - leftLift * liftRange;
  const ry = baseY - rightLift * liftRange;

  const STEEL = '#2c4f7a';
  const STEEL_DARK = '#16263f';
  const STEEL_HL = '#5e8db8';
  const FOOT = '#0a0c14';
  const footH = legH * 0.18;

  return (
    <Svg width={w} height={h} viewBox={`0 0 ${w} ${h}`}
      style={{ shapeRendering: 'crispEdges' as any } as any}>
      {/* Heavy shadow */}
      <Ellipse cx={w / 2} cy={h - 1} rx={w * 0.4} ry={3} fill="rgba(0,0,0,0.55)" />
      {/* Left mech leg */}
      <Rect x={lx} y={ly} width={legW} height={legH - footH} fill={STEEL} />
      <Rect x={lx} y={ly} width={1} height={legH - footH} fill={STEEL_HL} opacity={0.6} />
      <Rect x={lx + legW - 1} y={ly} width={1} height={legH - footH} fill={STEEL_DARK} />
      {/* Joint band */}
      <Rect x={lx - 1} y={ly + (legH - footH) * 0.55} width={legW + 2} height={2} fill={STEEL_DARK} />
      {/* Left footplate */}
      <Rect x={lx - 2} y={ly + legH - footH} width={legW + 4} height={footH} fill={FOOT} />
      {/* Right mech leg */}
      <Rect x={rx} y={ry} width={legW} height={legH - footH} fill={STEEL} />
      <Rect x={rx} y={ry} width={1} height={legH - footH} fill={STEEL_HL} opacity={0.6} />
      <Rect x={rx + legW - 1} y={ry} width={1} height={legH - footH} fill={STEEL_DARK} />
      <Rect x={rx - 1} y={ry + (legH - footH) * 0.55} width={legW + 2} height={2} fill={STEEL_DARK} />
      <Rect x={rx - 2} y={ry + legH - footH} width={legW + 4} height={footH} fill={FOOT} />
    </Svg>
  );
}
