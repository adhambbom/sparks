// ============================================================
// UNIFIED SPRITE — Every enemy/NPC/player rendered through this
// component picks up consistent visual rules driven by its
// Faction. This is HOW we make sprites from many sources feel
// like one art-directed world.
//
// What it applies on top of the source PNG:
//   • Faction rim-glow (CSS box-shadow / native shadow*)
//   • Inner halo glow behind the sprite
//   • Faction filter normalization (saturate/contrast/brightness)
//     so AI-generated assets stop drifting in colour temperature
//   • Drop-shadow OUTLINE so silhouettes read uniformly
//   • Idle bob animation tuned per faction (jittery, heavy, etc.)
//   • Optional combat scanline overlay → "this is the same
//     creature, just zoomed in for battle"
//
// IMPORTANT: this component does NOT change source PNGs.
// Use `getEnemyVisual(enemyId).uri` to pick the source. Same
// enemyId → same source → same identity in overworld + combat.
// ============================================================
import React, { useEffect, useRef } from 'react';
import { View, Image, Animated, Platform, StyleSheet } from 'react-native';
import { FactionDef } from '../data/factions';

type Props = {
  /** Pre-resolved source URI (use `getEnemyVisual(id).uri`). */
  uri: string;
  faction: FactionDef;
  /** Box size — width === height; sprite fills it via resizeMode "contain". */
  size: number;
  /** Animation tick from the parent loop. Drives idle bob & sway. */
  tick?: number;
  /** Apply the strong combat scanline overlay + bigger glow. */
  combat?: boolean;
  /** Override colour saturation (default = faction.saturation). */
  saturationOverride?: number;
  /** Flip horizontally (e.g. enemy facing player in combat). */
  flipX?: boolean;
  /** Optional extra transform (translate/rotate) applied AFTER bob. */
  extraTransform?: any[];
  /** Extra style for the wrapper. */
  style?: any;
  /** Disable all motion (e.g. for portraits / static icons). */
  static?: boolean;
};

export default function UnifiedSprite({
  uri,
  faction,
  size,
  tick = 0,
  combat = false,
  saturationOverride,
  flipX = false,
  extraTransform,
  style,
  static: isStatic = false,
}: Props) {
  // ── Bob / sway driven by the parent's tick value (already running
  // at 10 fps in game.tsx, so we don't add a second timer). When the
  // parent doesn't pass a tick we just hold the resting frame.
  const phase = isStatic ? 0 : tick * 0.1 * faction.bobFreq;
  const bobY = isStatic ? 0 : -Math.abs(Math.sin(phase)) * faction.bobAmp;
  const sway = isStatic ? 0 : Math.sin(phase * 0.5) * (faction.bobAmp * 0.4);

  // ── CSS filter string (web). Native ignores it gracefully —
  // we still get rim-glow + drop-shadow via shadow* props.
  // READABILITY:
  //   1) Thicker 4-direction black outline → silhouette separation.
  //   2) Faction-coloured drop-shadow follows the sprite's ALPHA
  //      shape (unlike boxShadow which would be a square halo),
  //      giving a proper rim-light that hugs the silhouette.
  const sat = saturationOverride ?? faction.saturation;
  const cssFilter =
    Platform.OS === 'web'
      ? `saturate(${sat}) contrast(${faction.contrast}) brightness(${faction.brightness})${
          faction.hueRotate ? ` hue-rotate(${faction.hueRotate}deg)` : ''
        } drop-shadow(0 1.5px 0 ${faction.outlineColor}) drop-shadow(0 -1.5px 0 ${faction.outlineColor}) drop-shadow(1.5px 0 0 ${faction.outlineColor}) drop-shadow(-1.5px 0 0 ${faction.outlineColor}) drop-shadow(0 0 ${combat ? 10 : 7}px ${faction.glowColor}) drop-shadow(0 0 ${combat ? 18 : 12}px ${faction.glowColor})`
      : undefined;

  // READABILITY: inner-halo radius — the soft background bloom
  // behind the sprite. Wider in combat for cinematic emphasis,
  // smaller in overworld so multiple enemies don't blur together.
  const innerRadius = combat ? 44 : 26;

  return (
    <View
      style={[
        {
          width: size,
          height: size,
          alignItems: 'center',
          justifyContent: 'center',
          transform: [
            { translateY: bobY },
            { translateX: sway },
            ...(flipX ? [{ scaleX: -1 }] : []),
            ...(extraTransform || []),
          ],
        },
        style,
      ]}
      pointerEvents="none"
    >
      {/* Inner halo — soft circle behind the sprite */}
      <View
        pointerEvents="none"
        style={{
          position: 'absolute',
          width: size * 0.85,
          height: size * 0.85,
          borderRadius: size * 0.5,
          backgroundColor: faction.innerGlow,
          // The halo is below the sprite; box-shadow gives it bloom on web,
          // shadow* gives a softer halo on native.
          ...(Platform.OS === 'web'
            ? { boxShadow: `0 0 ${innerRadius}px ${innerRadius / 2}px ${faction.innerGlow}` }
            : {
                shadowColor: faction.glowColor,
                shadowOpacity: 0.6,
                shadowRadius: innerRadius / 2,
                shadowOffset: { width: 0, height: 0 },
                elevation: 0,
              }),
        }}
      />

      {/* The actual sprite — rim-glow now lives INSIDE the cssFilter
          (drop-shadow with color follows the sprite's alpha), not on
          the Image's box. This means the glow hugs the silhouette
          instead of producing a square halo around the bounding box. */}
      <Image
        source={{ uri }}
        style={[
          {
            width: size,
            height: size,
            ...(Platform.OS === 'web'
              ? { filter: cssFilter as any }
              : {
                  // Native fallback — shadow* gives a softer, square-ish glow
                  // but it's the best we can do without filter support.
                  shadowColor: faction.glowColor,
                  shadowOpacity: 0.95,
                  shadowRadius: combat ? 12 : 8,
                  shadowOffset: { width: 0, height: 0 },
                }),
            backgroundColor: 'transparent',
          },
        ]}
        resizeMode="contain"
      />

      {/* Combat: faint scanline overlay on top of the sprite — gives
          the "enhanced zoom-in" feel without crushing midtones.
          Strictly cosmetic; pointerEvents none.
          READABILITY: alpha dropped to 0.07 (was 0.16) so internal
          sprite detail (eyes / armor / weapons) stays visible. */}
      {combat && (
        <View
          pointerEvents="none"
          style={{
            position: 'absolute',
            width: size,
            height: size,
            overflow: 'hidden',
          }}
        >
          {Array.from({ length: Math.ceil(size / 5) }).map((_, i) => (
            <View
              key={i}
              style={{
                height: 1,
                marginTop: 4,
                backgroundColor: 'rgba(0,0,0,0.07)',
              }}
            />
          ))}
        </View>
      )}
    </View>
  );
}

// Helpful style export for callers that want to compose around it.
export const unifiedSpriteStyles = StyleSheet.create({
  container: { alignItems: 'center', justifyContent: 'center' },
});
