// ============================================================
// LEVEL 2B — THE CONDUIT MAZE  ·  Concept-art backdrop edition
// ------------------------------------------------------------
// Implements Option A from the design brief:
//   • Backdrop  = full-bleed image (conduit_maze_bg.png) sized to grid.
//   • Parallax  = slow-scrolling depth layer (vignette + scanline) on top.
//   • Overlay   = invisible 16×28 tile grid for collision + zone triggers.
//   • Logic     = WildMinionAI roamers still drive stealth-chase loop.
//
// Camera scrolls with the player at 1:1 ratio for the gameplay layer so
// the invisible collisions stay perfectly aligned with the painted
// dungeon. A second decorative layer scrolls at 0.92× to fake depth.
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  StyleSheet,
  Dimensions,
  Platform,
  Image,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, ENEMIES } from '../src/data/gameData';
import {
  CONDUIT_L2B_GRID,
  COLS,
  ROWS,
  TILE as T,
  TileId,
  SOLID_TILE_IDS,
  DAMAGE_TILE_IDS,
  TRIGGER_TILE_IDS,
  ZONE_META,
  BACKDROP_URL,
  tileAt,
  isWall,
} from '../src/data/conduitMazeData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { VirtualJoystick } from '../src/components/VirtualJoystick';
import { useGame } from '../src/contexts/GameContext';
import { sfx } from '../src/utils/audio';
import {
  makeAIRoamer,
  stepWildAI,
  AIRoamer,
} from '../src/systems/WildMinionAI';
import {
  resolveMinionSpriteUri,
  hasMinionSprite,
} from '../src/systems/DynamicMinionRenderer';

// ── Render tunings ───────────────────────────────────────────
const ROAM_TICK_MS = 650;
const PLAYER_MOVE_MS = 130;
const PARALLAX_SCALE = 0.92;       // backdrop scroll vs. camera (depth illusion)

// Roamer enemy pool for L2B — Mech corruption + parasitic VR-Ghost.
const ROAMER_ENEMIES = ['mech_2', 'mech_3', 'vrghost_2', 'mech_4'].filter(
  (id) => (ENEMIES as any)[id] !== undefined,
);

// Canonical player spawn  — START TERMINAL approach corridor.
const SPAWN = { x: 7, y: 24 };

// Backdrop intrinsic aspect (cropped image 704×1270 → 0.554).
const BG_ASPECT = 704 / 1270;

type ZoneToast = {
  key: string;
  label: string;
  flavor: string;
  accent: string;
} | null;

function pickSpawnTiles(
  px: number,
  py: number,
  count: number,
): { x: number; y: number }[] {
  const candidates: { x: number; y: number; d: number }[] = [];
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (isWall(x, y)) continue;
      const tid = tileAt(x, y);
      // Don't spawn on hazards or trigger tiles — those are sacred.
      if (DAMAGE_TILE_IDS.has(tid as TileId)) continue;
      if (TRIGGER_TILE_IDS.has(tid as TileId)) continue;
      const d = Math.abs(x - px) + Math.abs(y - py);
      if (d < 6) continue;
      candidates.push({ x, y, d });
    }
  }
  candidates.sort(() => Math.random() - 0.5);
  return candidates.slice(0, count).map(({ x, y }) => ({ x, y }));
}

export default function ConduitMazeScreen() {
  const { state, applyDamage, addGold, awardXp, applyHeal } = useGame() as any;
  const { width: SW, height: SH } = Dimensions.get('window');

  // Compute tile size so the level fits the device width nicely.
  // Reserve room for header + controls (~36% of vertical height).
  const usableW = Math.min(SW - 16, 520);
  const usableH = Math.max(360, SH * 0.62);
  // Width-bound tile size (16 cols).
  const tileFromW = Math.floor(usableW / COLS);
  // Height-bound tile size (28 rows).
  const tileFromH = Math.floor(usableH / ROWS);
  const TILE_PX = Math.max(16, Math.min(tileFromW, tileFromH));
  const viewportW = TILE_PX * COLS;
  const viewportH = TILE_PX * ROWS;
  // Display viewport clipped to a maximum window (camera follows player).
  const camViewportW = Math.min(viewportW, usableW);
  const camViewportH = Math.min(viewportH, usableH);

  // ── Player state ─────────────────────────────────────────
  const [playerX, setPlayerX] = useState(SPAWN.x);
  const [playerY, setPlayerY] = useState(SPAWN.y);
  const playerXRef = useRef(playerX);
  const playerYRef = useRef(playerY);
  useEffect(() => { playerXRef.current = playerX; }, [playerX]);
  useEffect(() => { playerYRef.current = playerY; }, [playerY]);

  const [facing, setFacing] = useState<'left' | 'right' | 'up' | 'down'>('up');
  const moveDirRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // ── AI Roamers ───────────────────────────────────────────
  const [roamers, setRoamers] = useState<AIRoamer[]>([]);
  const roamersRef = useRef<AIRoamer[]>([]);
  useEffect(() => { roamersRef.current = roamers; }, [roamers]);

  // ── World-state flags ────────────────────────────────────
  const [hazardOff, setHazardOff] = useState<Set<string>>(new Set());
  const hazardOffRef = useRef(hazardOff);
  useEffect(() => { hazardOffRef.current = hazardOff; }, [hazardOff]);

  const [miniBossCleared, setMiniBossCleared] = useState(false);
  const [zoneToast, setZoneToast] = useState<ZoneToast>(null);
  const [triggeredZones, setTriggeredZones] = useState<Set<string>>(new Set());
  const triggeredRef = useRef(triggeredZones);
  useEffect(() => { triggeredRef.current = triggeredZones; }, [triggeredZones]);

  const [debugOverlay, setDebugOverlay] = useState(false);
  const [hint, setHint] = useState<string>('▸ INFILTRATING THE CONDUIT MAZE…');

  // ── Spawn roamers on mount ──────────────────────────────
  useEffect(() => {
    const spawns = pickSpawnTiles(SPAWN.x, SPAWN.y, 3);
    const created: AIRoamer[] = spawns.map((s, i) => {
      const enemyId = ROAMER_ENEMIES[i % ROAMER_ENEMIES.length] || 'mech_2';
      return makeAIRoamer(`wild-${i}`, enemyId, s.x, s.y, false);
    });
    setRoamers(created);
    const initToast = setTimeout(() => setHint(''), 2400);
    return () => clearTimeout(initToast);
  }, []);

  // ── Player movement ──────────────────────────────────────
  const tryMove = useCallback((dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return;
    const px = playerXRef.current;
    const py = playerYRef.current;
    const nx = px + dx;
    const ny = py + dy;
    if (isWall(nx, ny)) return;
    setPlayerX(nx);
    setPlayerY(ny);
    if (dx > 0) setFacing('right');
    else if (dx < 0) setFacing('left');
    else if (dy > 0) setFacing('down');
    else if (dy < 0) setFacing('up');
    sfx.footstep?.();
  }, []);

  // Held-direction loop (joystick).
  useEffect(() => {
    const t = setInterval(() => {
      const { dx, dy } = moveDirRef.current;
      if (dx === 0 && dy === 0) return;
      if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0);
      else tryMove(0, dy > 0 ? 1 : -1);
    }, PLAYER_MOVE_MS);
    return () => clearInterval(t);
  }, [tryMove]);

  // Web keyboard (handy for Playwright + desktop testing).
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: any) => {
      if (e.key === 'ArrowUp' || e.key === 'w') tryMove(0, -1);
      else if (e.key === 'ArrowDown' || e.key === 's') tryMove(0, 1);
      else if (e.key === 'ArrowLeft' || e.key === 'a') tryMove(-1, 0);
      else if (e.key === 'ArrowRight' || e.key === 'd') tryMove(1, 0);
      else if (e.key === 'g') setDebugOverlay((v) => !v); // toggle grid overlay
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tryMove]);

  // ── AI tick ──────────────────────────────────────────────
  useEffect(() => {
    const t = setInterval(() => {
      const px = playerXRef.current;
      const py = playerYRef.current;
      const current = roamersRef.current;
      const next = current.map((r, idx) => {
        const occupied = (x: number, y: number) =>
          current.some((o, j) => j !== idx && o.x === x && o.y === y);
        return stepWildAI(r, { playerX: px, playerY: py, isWall, occupied });
      });
      setRoamers(next);
    }, ROAM_TICK_MS);
    return () => clearInterval(t);
  }, []);

  // ── Combat trigger: stepping onto a roamer tile ──────────
  const [combatLock, setCombatLock] = useState(false);
  useEffect(() => {
    if (combatLock) return;
    const hit = roamers.find((r) => r.x === playerX && r.y === playerY);
    if (hit) {
      setCombatLock(true);
      sfx.encounter?.();
      setHint(`⚠ ENGAGING — ${hit.enemyId.toUpperCase()}`);
      setTimeout(() => {
        router.push({
          pathname: '/combat',
          params: { enemyId: hit.enemyId },
        } as any);
        setCombatLock(false);
      }, 350);
    }
  }, [roamers, playerX, playerY, combatLock]);

  // ── Tile-step events: damage, triggers ───────────────────
  useEffect(() => {
    const tid = tileAt(playerX, playerY) as TileId;
    const tileKey = `${playerX},${playerY}`;

    // Damage tiles (acid) — but only if not disabled by a console.
    if (DAMAGE_TILE_IDS.has(tid)) {
      if (!hazardOffRef.current.has(tileKey)) {
        applyDamage?.(4);
        setZoneToast({
          key: tileKey,
          label: ZONE_META[T.ACID].label,
          flavor: ZONE_META[T.ACID].flavor + ' (−4 HP)',
          accent: ZONE_META[T.ACID].accent,
        });
        setTimeout(() => setZoneToast((z) => (z?.key === tileKey ? null : z)), 1300);
      }
      return;
    }

    // Trigger tiles — fire once per tile (or each step for some).
    if (TRIGGER_TILE_IDS.has(tid)) {
      handleZoneTrigger(tid, tileKey);
    }
  }, [playerX, playerY]);

  /** Per-zone behaviour for each landmark tile id. */
  function handleZoneTrigger(tid: TileId, tileKey: string) {
    const meta = ZONE_META[tid];
    if (!meta) return;

    // MEGA-BOSS is gated behind the mini-boss clear.
    if (tid === T.MEGA_BOSS_GATE && !miniBossCleared) {
      setZoneToast({
        key: tileKey,
        label: 'ACCESS DENIED',
        flavor: 'Defeat the Hive Custodian before approaching the Quantum AI.',
        accent: '#ff2a55',
      });
      setTimeout(() => setZoneToast((z) => (z?.key === tileKey ? null : z)), 1800);
      return;
    }

    // One-shot triggers (data, trojan, start terminal): only fire first time.
    const oneShot = tid === T.DATA_STORAGE || tid === T.TROJAN_CORE || tid === T.START_TERMINAL;
    const zoneId = oneShot ? `zone:${tid}` : `tile:${tileKey}`;
    if (oneShot && triggeredRef.current.has(zoneId)) return;

    setZoneToast({ key: tileKey + ':' + tid, label: meta.label, flavor: meta.flavor, accent: meta.accent });
    setTimeout(() => setZoneToast(null), 2000);

    // Effects:
    if (tid === T.DATA_STORAGE) {
      addGold?.(40);
      sfx.confirm?.();
    } else if (tid === T.TROJAN_CORE) {
      awardXp?.(25);
      sfx.confirm?.();
    } else if (tid === T.START_TERMINAL) {
      applyHeal?.(20);
      sfx.confirm?.();
    } else if (tid === T.CONDUIT_CONSOLE) {
      // Disable the nearest acid pool tiles within 3 tiles.
      const off = new Set(hazardOffRef.current);
      for (let yy = playerY - 3; yy <= playerY + 3; yy++) {
        for (let xx = playerX - 3; xx <= playerX + 3; xx++) {
          if (tileAt(xx, yy) === T.ACID) off.add(`${xx},${yy}`);
        }
      }
      setHazardOff(off);
      sfx.confirm?.();
    } else if (tid === T.MINI_BOSS_GATE) {
      // Fire mini-boss combat — re-skinned mech_4 enemy.
      sfx.encounter?.();
      setTimeout(() => {
        router.push({ pathname: '/combat', params: { enemyId: 'mech_4' } } as any);
      }, 600);
    } else if (tid === T.MEGA_BOSS_GATE) {
      sfx.encounter?.();
      setTimeout(() => {
        router.push({ pathname: '/combat', params: { enemyId: 'glitch_avatar' } } as any);
      }, 600);
    }

    if (oneShot) {
      const next = new Set(triggeredRef.current);
      next.add(zoneId);
      setTriggeredZones(next);
    }
  }

  // Reset combat-trigger guard on focus re-entry.
  useFocusEffect(useCallback(() => {
    setCombatLock(false);
    // If the player just won a combat encounter, increment kill counter (TODO).
  }, []));

  // ── Camera: centre on the player, clamp to grid bounds ──
  const camX = Math.max(
    0,
    Math.min(viewportW - camViewportW, playerX * TILE_PX - camViewportW / 2 + TILE_PX / 2),
  );
  const camY = Math.max(
    0,
    Math.min(viewportH - camViewportH, playerY * TILE_PX - camViewportH / 2 + TILE_PX / 2),
  );

  // Parallax offsets (decorative layer scrolls at 0.92x).
  const parX = camX * PARALLAX_SCALE;
  const parY = camY * PARALLAX_SCALE;

  // ── Memoised: backdrop image ────────────────────────────
  const backendBase = (process.env.EXPO_PUBLIC_BACKEND_URL || '').replace(/\/$/, '');
  const backdropUri = `${backendBase}${BACKDROP_URL}?v=1`;
  const backdrop = useMemo(() => (
    <Image
      source={{ uri: backdropUri }}
      style={{
        position: 'absolute',
        left: 0,
        top: 0,
        width: viewportW,
        height: viewportW / BG_ASPECT,
      }}
      resizeMode="cover"
      fadeDuration={0}
    />
  ), [backdropUri, viewportW]);

  // ── Memoised: invisible-by-default debug grid overlay ────
  const gridDebug = useMemo(() => {
    if (!debugOverlay) return null;
    return (
      <View style={{ width: viewportW, height: viewportH, position: 'absolute', left: 0, top: 0 }}>
        {CONDUIT_L2B_GRID.map((row, y) => (
          <View key={`r-${y}`} style={{ flexDirection: 'row' }}>
            {row.map((t, x) => {
              let bg: string | undefined;
              if (t === T.WALL) bg = 'rgba(255,42,85,0.20)';
              else if (t === T.ACID) bg = 'rgba(80,255,80,0.25)';
              else if (TRIGGER_TILE_IDS.has(t as TileId)) bg = 'rgba(255,255,0,0.22)';
              else bg = 'transparent';
              return (
                <View
                  key={`d-${x}-${y}`}
                  style={{
                    width: TILE_PX,
                    height: TILE_PX,
                    backgroundColor: bg,
                    borderColor: 'rgba(255,255,255,0.10)',
                    borderWidth: 0.5,
                  }}
                />
              );
            })}
          </View>
        ))}
      </View>
    );
  }, [debugOverlay, TILE_PX]);

  // ── Trigger-tile glow markers (subtle, always on) ────────
  const triggerMarkers = useMemo(() => {
    const out: React.ReactNode[] = [];
    for (let y = 0; y < ROWS; y++) {
      for (let x = 0; x < COLS; x++) {
        const t = CONDUIT_L2B_GRID[y][x] as TileId;
        if (!TRIGGER_TILE_IDS.has(t)) continue;
        const meta = ZONE_META[t];
        if (!meta) continue;
        out.push(
          <View
            key={`m-${x}-${y}`}
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: x * TILE_PX,
              top: y * TILE_PX,
              width: TILE_PX,
              height: TILE_PX,
              borderWidth: 1,
              borderColor: meta.accent,
              backgroundColor: meta.accent + '22',
              alignItems: 'center',
              justifyContent: 'center',
              boxShadow: `0 0 8px ${meta.accent}55`,
            } as any}
          />,
        );
      }
    }
    return out;
  }, [TILE_PX]);

  // ── Player marker ────────────────────────────────────────
  const player = (
    <View
      pointerEvents="none"
      style={{
        position: 'absolute',
        left: playerX * TILE_PX,
        top: playerY * TILE_PX,
        width: TILE_PX,
        height: TILE_PX,
        alignItems: 'center',
        justifyContent: 'center',
        zIndex: 10,
      }}
    >
      <View style={[styles.playerBox, { width: TILE_PX * 0.78, height: TILE_PX * 0.78 }]}>
        <PixelText size={Math.max(7, Math.round(TILE_PX * 0.32))} color="#0a0a14" bold>
          {(state?.player?.name?.[0] || 'P').toUpperCase()}
        </PixelText>
      </View>
    </View>
  );

  // ── Roamer markers ───────────────────────────────────────
  const renderRoamer = (r: AIRoamer) => {
    const alert = r.state === 'Alerted' || r.state === 'Chasing';
    const dynUri = hasMinionSprite(r.enemyId) ? resolveMinionSpriteUri(r.enemyId, 0) : null;
    const uri = dynUri || `${backendBase}/api/static/sprites/enemy_${r.enemyId}.png`;
    return (
      <View
        key={r.uid}
        pointerEvents="none"
        style={{
          position: 'absolute',
          left: r.x * TILE_PX,
          top: r.y * TILE_PX,
          width: TILE_PX,
          height: TILE_PX,
          alignItems: 'center',
          justifyContent: 'center',
          zIndex: 9,
        }}
      >
        <Image
          source={{ uri }}
          style={{
            width: TILE_PX * 0.92,
            height: TILE_PX * 0.92,
            transform: [{ scaleX: r.facing === 'left' ? -1 : 1 }],
          }}
          resizeMode="contain"
        />
        {alert && (
          <View style={styles.alertBubble}>
            <PixelText size={9} color="#ff2a55" bold>!</PixelText>
          </View>
        )}
      </View>
    );
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      {/* HEADER */}
      <View style={styles.header}>
        <PixelText size={9} color={COLORS.neonMagenta}>// LEVEL 2B //</PixelText>
        <PixelText size={15} color={COLORS.neonCyan} glow bold>THE CONDUIT MAZE</PixelText>
        <PixelText size={8} color={COLORS.textDim} style={{ marginTop: 2 }}>
          {`SECTOR ${String(playerX).padStart(2, '0')}-${String(playerY).padStart(2, '0')}`}
          {`   ROAMERS: ${roamers.length}`}
          {miniBossCleared ? '   ✓ HIVE CLEAR' : ''}
        </PixelText>
      </View>

      {/* VIEWPORT — backdrop + grid + roamers + player */}
      <View
        style={[styles.viewport, { width: camViewportW, height: camViewportH }]}
        testID="conduit-viewport"
      >
        {/* Parallax depth layer — dimmed darker copy of the backdrop. */}
        <View style={{ position: 'absolute', left: -parX, top: -parY, opacity: 0.30 }}>
          <Image
            source={{ uri: backdropUri }}
            style={{
              width: viewportW * 1.08,
              height: (viewportW * 1.08) / BG_ASPECT,
            }}
            resizeMode="cover"
            fadeDuration={0}
          />
        </View>

        {/* Main backdrop + interactive overlay — locked to camera. */}
        <View style={{ position: 'absolute', left: -camX, top: -camY }}>
          {backdrop}
          {/* Subtle tinted overlay for readability of UI markers */}
          <View
            pointerEvents="none"
            style={{
              position: 'absolute',
              left: 0,
              top: 0,
              width: viewportW,
              height: viewportH,
              backgroundColor: 'rgba(4,8,20,0.18)',
            }}
          />
          {triggerMarkers}
          {gridDebug}
          {roamers.map(renderRoamer)}
          {player}
        </View>

        {/* Foreground scanline (very subtle CRT effect) */}
        <View pointerEvents="none" style={styles.scanlineOverlay} />
      </View>

      {/* ZONE TOAST */}
      {!!zoneToast && (
        <View style={[styles.zoneToast, { borderColor: zoneToast.accent }]} testID="zone-toast">
          <PixelText size={10} color={zoneToast.accent} bold>{zoneToast.label}</PixelText>
          <PixelText size={9} color={COLORS.text} style={{ marginTop: 2 }}>{zoneToast.flavor}</PixelText>
        </View>
      )}

      {/* HINT */}
      {!!hint && !zoneToast && (
        <View style={styles.hintBar}>
          <PixelText size={10} color={COLORS.neonGreen}>{hint}</PixelText>
        </View>
      )}

      {/* AI STATE CHIPS */}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        style={styles.statusBar}
        contentContainerStyle={{ gap: 8, paddingHorizontal: 10 }}
      >
        {roamers.map((r) => {
          const c =
            r.state === 'Chasing' ? COLORS.neonRed
              : r.state === 'Alerted' ? COLORS.neonYellow
                : r.state === 'Returning' ? COLORS.neonMagenta
                  : COLORS.neonGreen;
          return (
            <View key={r.uid} style={[styles.stateChip, { borderColor: c }]}>
              <PixelText size={8} color={c}>{r.enemyId.replace(/_/g, ' ').toUpperCase()}</PixelText>
              <PixelText size={8} color={c} bold>{r.state.toUpperCase()}</PixelText>
            </View>
          );
        })}
      </ScrollView>

      {/* CONTROLS */}
      <View style={styles.controls}>
        <VirtualJoystick
          onMove={(dx, dy) => { moveDirRef.current = { dx, dy }; }}
          onEnd={() => { moveDirRef.current = { dx: 0, dy: 0 }; }}
        />
        <View style={{ gap: 8 }}>
          <PixelButton title="EXIT" onPress={() => router.replace('/game')} color={COLORS.textDim} testID="conduit-exit" />
          <PixelButton title="PARTY" onPress={() => router.push('/registry')} color={COLORS.neonMagenta} testID="conduit-party" />
          <TouchableOpacity
            onPress={() => setDebugOverlay((v) => !v)}
            style={styles.gridToggle}
            testID="conduit-grid-toggle"
          >
            <PixelText size={8} color={debugOverlay ? COLORS.neonGreen : COLORS.textDim}>
              {debugOverlay ? 'GRID ON' : 'GRID OFF'}
            </PixelText>
          </TouchableOpacity>
        </View>
      </View>

      <PixelText size={8} color={COLORS.textDim} style={styles.tip}>
        ⓘ Walk into glowing tiles — START / TROJAN / DATA / CONSOLE / BOSS gates
      </PixelText>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#04040a', alignItems: 'center' },
  header: { alignItems: 'center', marginTop: 4, marginBottom: 4 },
  viewport: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.neonCyan,
    backgroundColor: '#02030a',
    boxShadow: '0 0 24px rgba(0,240,255,0.25)',
    position: 'relative',
  } as any,
  scanlineOverlay: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'transparent',
    borderTopWidth: 0,
    // Diagonal cyber scan accent via box-shadow inset for cheap CRT look.
    boxShadow: 'inset 0 0 80px rgba(0,240,255,0.10), inset 0 0 14px rgba(0,0,0,0.7)',
    pointerEvents: 'none',
  } as any,
  playerBox: {
    backgroundColor: COLORS.neonCyan,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 10px #00f0ff',
  } as any,
  alertBubble: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1a0010',
    borderWidth: 1,
    borderColor: '#ff2a55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  zoneToast: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.7)',
    maxWidth: 360,
  },
  hintBar: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.neonGreen,
    backgroundColor: 'rgba(0,255,128,0.08)',
  },
  statusBar: { marginTop: 8, maxHeight: 26 },
  stateChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 10,
  },
  gridToggle: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderWidth: 1,
    borderColor: COLORS.borderHi,
    alignItems: 'center',
  },
  tip: {
    marginTop: 6,
    marginBottom: 4,
    textAlign: 'center',
    paddingHorizontal: 12,
  },
});
