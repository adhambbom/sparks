// ============================================================
// CYBER PROP — Modular pixel-art prop rendered as SVG. Each
// prop is hand-laid using the locked Cyber palette so they
// all read as the same art style despite being individual
// components.
//
// Available kinds: barrel · crate · terminal · generator
//                  debris · car · fence · gate · pipe
// ============================================================
import React, { useMemo } from 'react';
import Svg, { Rect } from 'react-native-svg';
import { CYBER } from '../../data/cyberPalette';

export type CyberPropKind =
  | 'barrel-radioactive'
  | 'barrel-energy'
  | 'crate'
  | 'terminal'
  | 'generator'
  | 'debris-pile'
  | 'car-wreck'
  | 'fence'
  | 'gate-locked'
  | 'pipe-vertical'
  | 'warning-sign';

type Props = {
  kind: CyberPropKind;
  size: number;
};

const GRID = 8;

export default function CyberProp({ kind, size }: Props) {
  const px = size / GRID;
  const pix = (gx: number, gy: number, color: string, key: string) => (
    <Rect key={key} x={gx * px} y={gy * px} width={px} height={px} fill={color} />
  );

  return useMemo(() => (
    <Svg width={size} height={size}>
      {kind === 'barrel-radioactive' && <>
        {/* drum body */}
        {[1,2,3,4,5,6].map((gy) => pix(2, gy, CYBER.pavement1, `bl${gy}`))}
        {[1,2,3,4,5,6].map((gy) => pix(3, gy, CYBER.pavement2, `bc${gy}`))}
        {[1,2,3,4,5,6].map((gy) => pix(4, gy, CYBER.pavement2, `bd${gy}`))}
        {[1,2,3,4,5,6].map((gy) => pix(5, gy, CYBER.pavement0, `br${gy}`))}
        {/* radioactive symbol — green hazard */}
        {pix(3, 3, '#5cff5c', 'r1')}
        {pix(4, 3, '#5cff5c', 'r2')}
        {pix(3, 4, '#aaffaa', 'r3')}
        {pix(4, 4, '#aaffaa', 'r4')}
        {/* top rim */}
        {pix(2, 0, CYBER.pavement3, 't1')}
        {pix(3, 0, CYBER.pavement4, 't2')}
        {pix(4, 0, CYBER.pavement4, 't3')}
        {pix(5, 0, CYBER.pavement3, 't4')}
        {/* drip */}
        {pix(2, 7, '#5cff5c', 'd1')}
      </>}

      {kind === 'barrel-energy' && <>
        {[1,2,3,4,5,6].map((gy) => pix(2, gy, CYBER.pavement1, `bl${gy}`))}
        {[1,2,3,4,5,6].map((gy) => pix(3, gy, CYBER.pavement2, `bc${gy}`))}
        {[1,2,3,4,5,6].map((gy) => pix(4, gy, CYBER.pavement2, `bd${gy}`))}
        {[1,2,3,4,5,6].map((gy) => pix(5, gy, CYBER.pavement0, `br${gy}`))}
        {pix(3, 3, CYBER.cyanHigh, 'g1')}
        {pix(4, 3, CYBER.cyanHigh, 'g2')}
        {pix(3, 4, CYBER.cyanGlow, 'g3')}
        {pix(4, 4, CYBER.cyanGlow, 'g4')}
        {pix(2, 0, CYBER.pavement3, 't1')}
        {pix(3, 0, CYBER.pavement4, 't2')}
        {pix(4, 0, CYBER.pavement4, 't3')}
        {pix(5, 0, CYBER.pavement3, 't4')}
      </>}

      {kind === 'crate' && <>
        {[1,2,3,4,5,6].map((gy) => [1,2,3,4,5,6].map((gx) =>
          pix(gx, gy, gx === 1 || gy === 1 ? CYBER.wallEdge : gx === 6 || gy === 6 ? CYBER.wallShadow : CYBER.wallBody, `c${gx}${gy}`)))}
        {/* X cross-band */}
        {pix(2, 2, CYBER.pavement5, 'x1')}
        {pix(3, 3, CYBER.pavement5, 'x2')}
        {pix(4, 4, CYBER.pavement5, 'x3')}
        {pix(5, 5, CYBER.pavement5, 'x4')}
        {pix(5, 2, CYBER.pavement5, 'x5')}
        {pix(4, 3, CYBER.pavement5, 'x6')}
        {pix(3, 4, CYBER.pavement5, 'x7')}
        {pix(2, 5, CYBER.pavement5, 'x8')}
      </>}

      {kind === 'terminal' && <>
        {/* base */}
        {[5,6].map((gy) => [1,2,3,4,5,6].map((gx) =>
          pix(gx, gy, CYBER.wallShadow, `b${gx}${gy}`)))}
        {/* screen housing */}
        {[1,2,3,4].map((gy) => [1,6].map((gx) =>
          pix(gx, gy, CYBER.wallBody, `h${gx}${gy}`)))}
        {[0,5].map((gy) => [1,2,3,4,5,6].map((gx) =>
          pix(gx, gy, CYBER.wallEdge, `t${gx}${gy}`)))}
        {/* screen */}
        {[1,2,3,4].map((gy) => [2,3,4,5].map((gx) =>
          pix(gx, gy, CYBER.cyanDark, `s${gx}${gy}`)))}
        {/* scan line on screen */}
        {pix(2, 2, CYBER.cyanHigh, 'l1')}
        {pix(3, 2, CYBER.cyanHigh, 'l2')}
        {pix(4, 2, CYBER.cyanHigh, 'l3')}
        {pix(5, 2, CYBER.cyanHigh, 'l4')}
        {/* data lines */}
        {pix(2, 4, CYBER.cyanMid, 'd1')}
        {pix(4, 4, CYBER.cyanMid, 'd2')}
      </>}

      {kind === 'generator' && <>
        {/* casing */}
        {[1,2,3,4,5,6].map((gy) => [1,2,3,4,5,6].map((gx) =>
          pix(gx, gy, gx === 1 || gy === 1 ? CYBER.wallEdge : gx === 6 || gy === 6 ? CYBER.wallShadow : CYBER.wallBody, `g${gx}${gy}`)))}
        {/* vents */}
        {pix(2, 3, CYBER.wallShadow, 'v1')}
        {pix(3, 3, CYBER.wallShadow, 'v2')}
        {pix(4, 3, CYBER.wallShadow, 'v3')}
        {pix(5, 3, CYBER.wallShadow, 'v4')}
        {/* status led */}
        {pix(5, 5, CYBER.dangerHigh, 'led')}
        {pix(2, 5, CYBER.cyanHigh, 'led2')}
        {/* coil glow */}
        {pix(3, 2, CYBER.yellowHigh, 'c1')}
        {pix(4, 2, CYBER.yellowMid, 'c2')}
      </>}

      {kind === 'debris-pile' && <>
        {/* irregular rock pile */}
        {pix(1, 5, CYBER.wallBody, 'a')}
        {pix(2, 4, CYBER.wallEdge, 'b')}
        {pix(2, 5, CYBER.wallBody, 'c')}
        {pix(3, 5, CYBER.wallBody, 'd')}
        {pix(3, 4, CYBER.wallEdge, 'e')}
        {pix(4, 5, CYBER.wallBody, 'f')}
        {pix(4, 4, CYBER.wallShadow, 'g')}
        {pix(5, 5, CYBER.wallBody, 'h')}
        {pix(5, 4, CYBER.wallEdge, 'i')}
        {pix(6, 5, CYBER.wallShadow, 'j')}
        {pix(3, 3, CYBER.wallEdge, 'k')}
        {pix(4, 3, CYBER.wallBody, 'l')}
        {/* rust speck */}
        {pix(4, 4, CYBER.wallRust, 'r')}
        {/* base shadow */}
        {pix(1, 6, CYBER.wallShadow, 'sh1')}
        {pix(2, 6, CYBER.wallShadow, 'sh2')}
        {pix(3, 6, CYBER.wallShadow, 'sh3')}
        {pix(4, 6, CYBER.wallShadow, 'sh4')}
        {pix(5, 6, CYBER.wallShadow, 'sh5')}
        {pix(6, 6, CYBER.wallShadow, 'sh6')}
      </>}

      {kind === 'car-wreck' && <>
        {/* car silhouette — flattened wreck */}
        {[3,4].map((gy) => [1,2,3,4,5,6].map((gx) =>
          pix(gx, gy, CYBER.wallRust, `bb${gx}${gy}`)))}
        {/* hood */}
        {pix(1, 3, CYBER.wallShadow, 'h1')}
        {pix(6, 3, CYBER.wallShadow, 'h2')}
        {/* roof crumpled */}
        {pix(3, 2, CYBER.wallBody, 'r1')}
        {pix(4, 2, CYBER.wallEdge, 'r2')}
        {pix(2, 2, CYBER.wallShadow, 'r3')}
        {pix(5, 2, CYBER.wallShadow, 'r4')}
        {/* wheels */}
        {pix(2, 5, CYBER.wallShadow, 'w1')}
        {pix(5, 5, CYBER.wallShadow, 'w2')}
        {/* broken windshield glint */}
        {pix(3, 1, CYBER.cyanMid, 'g1')}
        {pix(4, 1, CYBER.cyanMid, 'g2')}
      </>}

      {kind === 'fence' && <>
        {/* chain link pattern — vertical posts */}
        {[0,7].map((gy) => pix(0, gy, CYBER.wallShadow, `p1${gy}`))}
        {[0,7].map((gy) => pix(7, gy, CYBER.wallShadow, `p2${gy}`))}
        {[1,2,3,4,5,6].map((gy) => pix(0, gy, CYBER.wallEdge, `pa${gy}`))}
        {[1,2,3,4,5,6].map((gy) => pix(7, gy, CYBER.wallEdge, `pb${gy}`))}
        {/* chain pattern */}
        {[1,3,5].map((gy) => [1,3,5].map((gx) =>
          pix(gx + 0, gy, CYBER.wallEdge, `cl${gx}${gy}`)))}
        {[2,4,6].map((gy) => [2,4,6].map((gx) =>
          pix(gx, gy, CYBER.wallEdge, `cm${gx}${gy}`)))}
      </>}

      {kind === 'gate-locked' && <>
        {/* solid gate with red lock */}
        {[0,1,2,3,4,5,6,7].map((gy) => [0,1,2,3,4,5,6,7].map((gx) =>
          pix(gx, gy, gx === 0 || gx === 7 || gy === 0 || gy === 7 ? CYBER.wallShadow : CYBER.wallBody, `g${gx}${gy}`)))}
        {/* centre lock */}
        {pix(3, 3, CYBER.dangerHigh, 'lk1')}
        {pix(4, 3, CYBER.dangerHigh, 'lk2')}
        {pix(3, 4, CYBER.dangerHigh, 'lk3')}
        {pix(4, 4, CYBER.dangerHigh, 'lk4')}
        {pix(3, 5, CYBER.dangerMid, 'lk5')}
        {pix(4, 5, CYBER.dangerMid, 'lk6')}
      </>}

      {kind === 'pipe-vertical' && <>
        {[0,1,2,3,4,5,6,7].map((gy) => pix(3, gy, CYBER.pavement0, `pl${gy}`))}
        {[0,1,2,3,4,5,6,7].map((gy) => pix(4, gy, CYBER.pavement3, `pc${gy}`))}
        {[0,1,2,3,4,5,6,7].map((gy) => pix(5, gy, CYBER.pavement0, `pr${gy}`))}
        {/* connector ring */}
        {pix(2, 3, CYBER.wallShadow, 'r1')}
        {pix(6, 3, CYBER.wallShadow, 'r2')}
        {pix(2, 4, CYBER.wallShadow, 'r3')}
        {pix(6, 4, CYBER.wallShadow, 'r4')}
      </>}

      {kind === 'warning-sign' && <>
        {/* triangle warning sign */}
        {pix(3, 1, CYBER.yellowHigh, 'a')}
        {pix(2, 2, CYBER.yellowHigh, 'b')}
        {pix(3, 2, CYBER.yellowMid, 'c')}
        {pix(4, 2, CYBER.yellowHigh, 'd')}
        {pix(1, 3, CYBER.yellowHigh, 'e')}
        {[2,3,4].map((gx) => pix(gx, 3, CYBER.yellowMid, `f${gx}`))}
        {pix(5, 3, CYBER.yellowHigh, 'g')}
        {pix(0, 4, CYBER.yellowHigh, 'h')}
        {[1,2,3,4,5].map((gx) => pix(gx, 4, CYBER.yellowMid, `i${gx}`))}
        {pix(6, 4, CYBER.yellowHigh, 'j')}
        {[0,1,2,3,4,5,6].map((gx) => pix(gx, 5, CYBER.yellowHigh, `k${gx}`))}
        {/* exclamation */}
        {pix(3, 3, '#000', 'ex1')}
        {pix(3, 4, '#000', 'ex2')}
      </>}
    </Svg>
  ), [kind, size, px]);
}
