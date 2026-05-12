// ============================================================
// LEVEL 2B — THE CONDUIT MAZE
// ------------------------------------------------------------
// Focused stealth-chase level. Uses the WildMinionAI state machine
// (Wandering → Alerted → Chasing → Returning) with Bresenham
// line-of-sight, so server racks (tile 12) actually break aggro.
//
// Goals when arriving here:
//   • Player spawns at tile (2,1) in the top-left corridor.
//   • 3 wild-mech roamers patrol the corridors.
//   • Step into a roamer's LOS within 4 tiles → "!" alert → chase.
//   • Player can hide behind a server rack to break sight.
//   • Step onto the spiral staircase (tile 15) bottom-right → back to academy.
//   • Touch a roamer → /combat (existing Pokémon-style turn-based screen).
// ============================================================
import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, Platform, Image, ScrollView } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, CONDUIT_MAZE, ENEMIES } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { VirtualJoystick } from '../src/components/VirtualJoystick';
import { ActionButton } from '../src/components/ActionButton';
import SpiralStaircase from '../src/components/SpiralStaircase';
import { useGame } from '../src/contexts/GameContext';
import { sfx } from '../src/utils/audio';
import {
  makeAIRoamer,
  stepWildAI,
  AIRoamer,
  AI_CONFIG,
} from '../src/systems/WildMinionAI';
import { resolveMinionSpriteUri, hasMinionSprite } from '../src/systems/DynamicMinionRenderer';

const TILE = 30;
const ROAM_TICK_MS = 600;        // patrol cadence
const PLAYER_MOVE_MS = 130;      // tile-step cadence on held joystick

const SOLID_TILES = new Set<number>([12]);
const SPIKE_TILE = 8;
const STAIRS_TILE = 15;

const COLS = CONDUIT_MAZE[0].length;
const ROWS = CONDUIT_MAZE.length;

// Roamer pool — Mech corruption line fits the Conduit Maze theme.
// They render through the DynamicMinionRenderer so the existing
// v3 sprite sheet is reused.
const ROAMER_ENEMIES = ['mech_2', 'mech_3', 'vrghost_2'].filter(
  (id) => (ENEMIES as any)[id] !== undefined,
);

function isWallTile(x: number, y: number): boolean {
  if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return true;
  return SOLID_TILES.has(CONDUIT_MAZE[y][x]);
}

function tileAt(x: number, y: number): number {
  if (y < 0 || y >= ROWS || x < 0 || x >= COLS) return -1;
  return CONDUIT_MAZE[y][x];
}

/** Find walkable spawn tiles biased away from the player. */
function pickSpawnTiles(playerX: number, playerY: number, count: number): { x: number; y: number }[] {
  const candidates: { x: number; y: number; d: number }[] = [];
  for (let y = 1; y < ROWS - 1; y++) {
    for (let x = 1; x < COLS - 1; x++) {
      if (isWallTile(x, y)) continue;
      if (tileAt(x, y) === SPIKE_TILE) continue;
      if (tileAt(x, y) === STAIRS_TILE) continue;
      const d = Math.abs(x - playerX) + Math.abs(y - playerY);
      if (d < 5) continue; // keep wild minions a few tiles away from spawn
      candidates.push({ x, y, d });
    }
  }
  // Shuffle deterministically-ish.
  candidates.sort(() => Math.random() - 0.5);
  return candidates.slice(0, count).map(({ x, y }) => ({ x, y }));
}

export default function ConduitMazeScreen() {
  const { state, applyDamage } = useGame();
  const { width: SW, height: SH } = Dimensions.get('window');

  // ── Player state ─────────────────────────────────────────
  const [playerX, setPlayerX] = useState(2);
  const [playerY, setPlayerY] = useState(1);
  const playerXRef = useRef(playerX);
  const playerYRef = useRef(playerY);
  useEffect(() => { playerXRef.current = playerX; }, [playerX]);
  useEffect(() => { playerYRef.current = playerY; }, [playerY]);

  const [facing, setFacing] = useState<'left' | 'right' | 'up' | 'down'>('down');
  const moveDirRef = useRef<{ dx: number; dy: number }>({ dx: 0, dy: 0 });

  // ── AI Roamers ───────────────────────────────────────────
  const [roamers, setRoamers] = useState<AIRoamer[]>([]);
  const roamersRef = useRef<AIRoamer[]>([]);
  useEffect(() => { roamersRef.current = roamers; }, [roamers]);

  // Hint banner
  const [hint, setHint] = useState<string>('▸ INFILTRATING THE CONDUIT MAZE …');
  const [combatTriggered, setCombatTriggered] = useState(false);

  // ── Spawn roamers on mount ──────────────────────────────
  useEffect(() => {
    const spawns = pickSpawnTiles(2, 1, 3);
    const created: AIRoamer[] = spawns.map((s, i) => {
      const enemyId = ROAMER_ENEMIES[i % ROAMER_ENEMIES.length] || 'enemy_grunt';
      return makeAIRoamer(`wild-${i}`, enemyId, s.x, s.y, false);
    });
    setRoamers(created);
    setTimeout(() => setHint(''), 2400);
  }, []);

  // ── Player movement (joystick held → step every PLAYER_MOVE_MS) ──
  const tryMove = useCallback((dx: number, dy: number) => {
    if (dx === 0 && dy === 0) return;
    const px = playerXRef.current;
    const py = playerYRef.current;
    const nx = px + dx;
    const ny = py + dy;
    if (isWallTile(nx, ny)) return;
    // Block onto roamer tile? We allow it — that triggers combat.
    setPlayerX(nx);
    setPlayerY(ny);
    if (dx > 0) setFacing('right');
    else if (dx < 0) setFacing('left');
    else if (dy > 0) setFacing('down');
    else if (dy < 0) setFacing('up');
    sfx.footstep?.();
  }, []);

  useEffect(() => {
    const t = setInterval(() => {
      const { dx, dy } = moveDirRef.current;
      if (dx === 0 && dy === 0) return;
      // Choose dominant axis to enforce strict 4-way movement.
      if (Math.abs(dx) > Math.abs(dy)) tryMove(dx > 0 ? 1 : -1, 0);
      else tryMove(0, dy > 0 ? 1 : -1);
    }, PLAYER_MOVE_MS);
    return () => clearInterval(t);
  }, [tryMove]);

  // ── Keyboard support (web — handy for Playwright testing) ──
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    const onKey = (e: any) => {
      if (e.key === 'ArrowUp' || e.key === 'w') tryMove(0, -1);
      else if (e.key === 'ArrowDown' || e.key === 's') tryMove(0, 1);
      else if (e.key === 'ArrowLeft' || e.key === 'a') tryMove(-1, 0);
      else if (e.key === 'ArrowRight' || e.key === 'd') tryMove(1, 0);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [tryMove]);

  // ── AI tick: step every roamer with player as target ──────
  useEffect(() => {
    const t = setInterval(() => {
      const px = playerXRef.current;
      const py = playerYRef.current;
      const current = roamersRef.current;
      const next = current.map((r, idx) => {
        const isWall = (x: number, y: number) => isWallTile(x, y);
        const occupied = (x: number, y: number) =>
          current.some((other, j) => j !== idx && other.x === x && other.y === y);
        return stepWildAI(r, { playerX: px, playerY: py, isWall, occupied });
      });
      setRoamers(next);
    }, ROAM_TICK_MS);
    return () => clearInterval(t);
  }, []);

  // ── Combat trigger: any roamer on player tile or stepping onto it ──
  useEffect(() => {
    if (combatTriggered) return;
    const hit = roamers.find((r) => r.x === playerX && r.y === playerY);
    if (hit) {
      setCombatTriggered(true);
      setHint('⚠ ENGAGED — combat sequence initiated');
      sfx.encounter?.();
      // Defer slightly so the player sees the contact frame.
      setTimeout(() => {
        router.push({ pathname: '/combat', params: { enemyId: hit.enemyId } } as any);
        setCombatTriggered(false);
      }, 350);
    }
  }, [roamers, playerX, playerY, combatTriggered]);

  // ── Stairs (15) → back to academy ────────────────────────
  useEffect(() => {
    if (tileAt(playerX, playerY) === STAIRS_TILE) {
      setHint('▲ ASCENDING — returning to academy');
      sfx.cancel?.();
      setTimeout(() => router.replace('/game'), 350);
    }
  }, [playerX, playerY]);

  // ── Spike damage tick (tile 8) ───────────────────────────
  useEffect(() => {
    if (tileAt(playerX, playerY) === SPIKE_TILE) {
      applyDamage?.(4);
      setHint('!! ACID VAULT — −4 HP');
      setTimeout(() => setHint(''), 900);
    }
  }, [playerX, playerY, applyDamage]);

  // Reset combat-trigger guard when re-focusing the screen
  useFocusEffect(
    useCallback(() => {
      setCombatTriggered(false);
    }, []),
  );

  // ── Camera centring (panning the grid under a viewport) ──
  const viewportW = Math.min(SW, COLS * TILE);
  const viewportH = Math.min(SH * 0.62, ROWS * TILE);
  const camX = Math.max(
    0,
    Math.min(COLS * TILE - viewportW, playerX * TILE - viewportW / 2 + TILE / 2),
  );
  const camY = Math.max(
    0,
    Math.min(ROWS * TILE - viewportH, playerY * TILE - viewportH / 2 + TILE / 2),
  );

  // ── Static tile grid (memoised — never re-renders) ───────
  const tileGrid = useMemo(() => (
    <View style={{ width: COLS * TILE, height: ROWS * TILE }}>
      {CONDUIT_MAZE.map((row, y) => (
        <View key={`r-${y}`} style={{ flexDirection: 'row' }}>
          {row.map((t, x) => {
            let bg = '#0c0c1a';
            let inner: React.ReactNode = null;
            if (t === 12) {
              // Server rack / wall
              bg = '#1c2540';
              inner = <View style={styles.rackHighlight} />;
            } else if (t === 8) {
              // Acid vault
              bg = '#2a0a1c';
              inner = <View style={styles.acid} />;
            } else if (t === 15) {
              bg = '#0c0c1a';
              inner = <SpiralStaircase tile={TILE} tick={0} />;
            } else {
              // floor
              bg = '#0a0a14';
              inner = <View style={styles.gridDot} />;
            }
            return (
              <View
                key={`t-${x}-${y}`}
                style={{ width: TILE, height: TILE, backgroundColor: bg, borderColor: '#0a0a14', borderWidth: 0.5, alignItems: 'center', justifyContent: 'center' }}
              >
                {inner}
              </View>
            );
          })}
        </View>
      ))}
    </View>
  ), []);

  // ── Roamer sprites + alert icons ────────────────────────
  const backendBase = process.env.EXPO_PUBLIC_BACKEND_URL;
  const renderRoamer = (r: AIRoamer) => {
    const alert = r.state === 'Alerted' || r.state === 'Chasing';
    // Prefer the dynamic minion sheet (v3 sliced sprites). Fall back to
    // the generic enemy_<id>.png static path.
    const dynUri = hasMinionSprite(r.enemyId) ? resolveMinionSpriteUri(r.enemyId, 0) : null;
    const uri = dynUri || `${backendBase}/api/static/sprites/enemy_${r.enemyId}.png`;
    return (
      <View
        key={r.uid}
        style={{
          position: 'absolute',
          left: r.x * TILE,
          top: r.y * TILE,
          width: TILE,
          height: TILE,
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <Image
          source={{ uri }}
          style={{
            width: TILE * 0.9,
            height: TILE * 0.9,
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

  // ── Player marker (simple cyan box; the real sprite lives in /game) ──
  const player = (
    <View
      style={{
        position: 'absolute',
        left: playerX * TILE,
        top: playerY * TILE,
        width: TILE,
        height: TILE,
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      <View style={styles.playerBox}>
        <PixelText size={9} color="#0a0a14" bold>{(state?.player?.name?.[0] || 'P').toUpperCase()}</PixelText>
      </View>
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <PixelText size={10} color={COLORS.neonMagenta}>// LEVEL 2B //</PixelText>
        <PixelText size={16} color={COLORS.neonCyan} glow bold>THE CONDUIT MAZE</PixelText>
        <PixelText size={9} color={COLORS.textDim} style={{ marginTop: 2 }}>
          {`SECTOR ${playerX.toString().padStart(2, '0')}-${playerY.toString().padStart(2, '0')}`}
          {`   ROAMERS: ${roamers.length}`}
        </PixelText>
      </View>

      {/* Viewport (camera-clipped grid) */}
      <View style={[styles.viewport, { width: viewportW, height: viewportH }]} testID="conduit-viewport">
        <View style={{ position: 'absolute', left: -camX, top: -camY }}>
          {tileGrid}
          {roamers.map(renderRoamer)}
          {player}
        </View>
      </View>

      {/* Hint banner */}
      {!!hint && (
        <View style={styles.hintBar} testID="conduit-hint">
          <PixelText size={10} color={COLORS.neonGreen}>{hint}</PixelText>
        </View>
      )}

      {/* Status bar — roamer aggro states (handy debug + flavour) */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.statusBar} contentContainerStyle={{ gap: 8, paddingHorizontal: 10 }}>
        {roamers.map((r) => {
          const c = r.state === 'Chasing' ? COLORS.neonRed
            : r.state === 'Alerted' ? COLORS.neonYellow
            : r.state === 'Returning' ? COLORS.neonMagenta
            : COLORS.neonGreen;
          return (
            <View key={r.uid} style={[styles.stateChip, { borderColor: c }]}>
              <PixelText size={8} color={c}>{r.enemyId.replace('enemy_', '').toUpperCase()}</PixelText>
              <PixelText size={8} color={c} bold>{r.state.toUpperCase()}</PixelText>
            </View>
          );
        })}
      </ScrollView>

      {/* Controls */}
      <View style={styles.controls}>
        <VirtualJoystick
          onMove={(dx, dy) => { moveDirRef.current = { dx, dy }; }}
          onEnd={() => { moveDirRef.current = { dx: 0, dy: 0 }; }}
        />
        <View style={{ gap: 10 }}>
          <PixelButton
            title="EXIT"
            onPress={() => router.replace('/game')}
            color={COLORS.textDim}
            testID="conduit-exit"
          />
          <PixelButton
            title="PARTY"
            onPress={() => router.push('/registry')}
            color={COLORS.neonMagenta}
            testID="conduit-party"
          />
        </View>
      </View>

      <PixelText size={8} color={COLORS.textDim} style={styles.tip}>
        ⓘ HIDE BEHIND SERVER RACKS — wild mechs lose line-of-sight at 7+ tiles
      </PixelText>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#06060e', alignItems: 'center' },
  header: { alignItems: 'center', marginTop: 6, marginBottom: 6 },
  viewport: {
    overflow: 'hidden',
    borderWidth: 2,
    borderColor: COLORS.neonCyan,
    backgroundColor: '#04040a',
    boxShadow: '0 0 24px rgba(0,240,255,0.25)',
  } as any,
  rackHighlight: {
    width: TILE * 0.6,
    height: TILE * 0.6,
    backgroundColor: '#2a3870',
    borderWidth: 1,
    borderColor: '#4d6ad8',
  },
  acid: {
    width: TILE * 0.7,
    height: TILE * 0.7,
    backgroundColor: '#7a1138',
    borderWidth: 1,
    borderColor: '#ff2a55',
    opacity: 0.7,
  },
  gridDot: {
    width: 2,
    height: 2,
    backgroundColor: '#1a2040',
    borderRadius: 1,
  },
  playerBox: {
    width: TILE * 0.85,
    height: TILE * 0.85,
    backgroundColor: COLORS.neonCyan,
    borderWidth: 2,
    borderColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    boxShadow: '0 0 10px #00f0ff',
  } as any,
  alertBubble: {
    position: 'absolute',
    top: -4,
    right: -2,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: '#1a0010',
    borderWidth: 1,
    borderColor: '#ff2a55',
    alignItems: 'center',
    justifyContent: 'center',
  },
  hintBar: {
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 6,
    borderWidth: 1,
    borderColor: COLORS.neonGreen,
    backgroundColor: 'rgba(0,255,128,0.08)',
  },
  statusBar: {
    marginTop: 8,
    maxHeight: 26,
  },
  stateChip: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 6,
    backgroundColor: 'rgba(0,0,0,0.5)',
  },
  controls: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    width: '100%',
    paddingHorizontal: 20,
    marginTop: 12,
  },
  tip: {
    marginTop: 6,
    marginBottom: 4,
    textAlign: 'center',
  },
});
