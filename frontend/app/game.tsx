import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, ScrollView, Modal, TouchableOpacity, Image, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, ACADEMY_MAP, NPCS, ENCOUNTER_POOLS, ENEMIES, HOUSES, SPRITE_ASSETS } from '../src/data/gameData';
import BrickWall from '../src/components/BrickWall';
import ConcreteFloor from '../src/components/ConcreteFloor';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { StatBar } from '../src/components/StatBar';
import { VirtualJoystick } from '../src/components/VirtualJoystick';
import { ActionButton } from '../src/components/ActionButton';
import { Sprite } from '../src/components/Sprite';
import { ActiveSkillPanel } from '../src/components/ActiveSkillPanel';
import { useGame } from '../src/contexts/GameContext';
import { useAuth } from '../src/contexts/AuthContext';
import { sfx } from '../src/utils/audio';

const TILE = 38;
const SPEED = 6; // pixels per frame (1.5× boost from 4 for snappier movement)
const ENCOUNTER_CHANCE = 0.0; // disabled - using visible roaming enemies instead
const ROAM_TICK_MS = 1000; // every 1 second (was 2s — 2× faster patrol cycle)
const MAX_ROAMERS = 3;
const CHASE_RADIUS = 4;

const { width: SW, height: SH } = Dimensions.get('window');

type Dialog = { name: string; lines: string[]; line: number } | null;
type Roamer = { uid: string; enemyId: string; x: number; y: number; chasing?: boolean; boss?: boolean };

function isFloor(x: number, y: number, brokenBarrels?: Set<string>): boolean {
  // Backward-compatible delegate for spawn helpers — single-tile check.
  return isTileWalkable(x, y, brokenBarrels ?? new Set<string>());
}

// ──────────────────────────────────────────────────────────
// Collision constants — tile types that block player movement.
// The player sprite is 2.4× TILE tall, so the HEAD renders over the
// row above the feet (zIndex: 9999 keeps it on top of wall tiles).
// We only check collision at FEET-level (the destination tile coords).
// ──────────────────────────────────────────────────────────
const SOLID_TILE_TYPES = new Set<number>([
  1,   // outer wall
  11,  // immovable debris
  12,  // castle stone wall (interior)
]);

// Feet-hitbox proportions (relative to TILE).
// The player sprite is ~2.4× TILE tall, but only the FEET should collide with walls.
// 70% wide × 45% tall, anchored slightly below the logical position so it sits
// roughly where the boots are drawn on screen.
const FEET_W = TILE * 0.70;
const FEET_H = TILE * 0.45;
const FEET_DY = TILE * 0.20;   // shift hitbox below logical center toward the feet

/**
 * Tile-level walkability check (used by spawn/AI helpers — single tile in/out).
 */
function isTileWalkable(tx: number, ty: number, brokenBarrels: Set<string>): boolean {
  if (ty < 0 || ty >= ACADEMY_MAP.length) return false;
  if (tx < 0 || tx >= ACADEMY_MAP[0].length) return false;
  const t = ACADEMY_MAP[ty][tx];
  if (SOLID_TILE_TYPES.has(t)) return false;
  if (t === 14 && !brokenBarrels.has(`${tx},${ty}`)) return false;
  return true;
}

/**
 * Pixel-level player movement check.
 * Treats the player's FEET as a small bounding box (FEET_W × FEET_H) and verifies
 * that every tile the box overlaps is walkable. Stops the player cleanly at tile
 * boundaries — no sliding inside walls. The head/upper sprite is allowed to render
 * over wall tiles (zIndex: 9999) without affecting collision.
 */
function canMoveTo(npx: number, npy: number, brokenBarrels: Set<string>): boolean {
  const cx = npx;                 // feet center x = logical x
  const cy = npy + FEET_DY;       // feet center y = logical y + feet offset
  const left = cx - FEET_W / 2;
  const right = cx + FEET_W / 2 - 0.001;   // -ε so right edge on tile boundary doesn't bleed
  const top = cy - FEET_H / 2;
  const bottom = cy + FEET_H / 2 - 0.001;

  const colL = Math.floor(left / TILE);
  const colR = Math.floor(right / TILE);
  const rowT = Math.floor(top / TILE);
  const rowB = Math.floor(bottom / TILE);

  for (let r = rowT; r <= rowB; r++) {
    for (let c = colL; c <= colR; c++) {
      if (!isTileWalkable(c, r, brokenBarrels)) return false;
    }
  }
  return true;
}
function isNearNpc(x: number, y: number): boolean {
  for (const id of Object.keys(NPCS)) {
    const npc = NPCS[id];
    if (Math.abs(x - npc.x) <= 1 && Math.abs(y - npc.y) <= 1) return true;
  }
  return false;
}

function randomFloorTile(avoidX: number, avoidY: number, occupied: Set<string>): { x: number; y: number } | null {
  for (let i = 0; i < 80; i++) {
    const x = Math.floor(Math.random() * (ACADEMY_MAP[0].length - 2)) + 1;
    const y = Math.floor(Math.random() * (ACADEMY_MAP.length - 2)) + 1;
    if (!isFloor(x, y)) continue;
    if (Math.abs(x - avoidX) < 3 && Math.abs(y - avoidY) < 3) continue;
    if (occupied.has(`${x},${y}`)) continue;
    if (isNearNpc(x, y)) continue;            // never spawn within 1 tile of any NPC
    return { x, y };
  }
  return null;
}

export default function GameScreen() {
  const { user, loading: authLoading } = useAuth();
  const { state, setState, loadFromServer, setPosition, saveCheckpoint, applyHeal, applyDamage, addItem, addGold } = useGame();
  const [loaded, setLoaded] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [hint, setHint] = useState('');
  const dirRef = useRef({ x: 0, y: 0 });
  const lastTileRef = useRef({ x: 0, y: 0 });
  // pixel position; tile = floor(p/TILE)
  const posRef = useRef({ px: 0, py: 0 });
  const [renderTick, setRenderTick] = useState(0);
  // Animation tick — increments at 10 fps so sprites animate even when player stands still.
  const [animTick, setAnimTick] = useState(0);
  // Roaming enemies state
  const [roamers, setRoamers] = useState<Roamer[]>([]);
  const roamersRef = useRef<Roamer[]>([]);
  const engagingRef = useRef(false);
  const [skillPanelOpen, setSkillPanelOpen] = useState(false);
  // Destroyed barrels (set of "x,y") — separate from static map
  const [brokenBarrels, setBrokenBarrels] = useState<Set<string>>(new Set());
  const brokenBarrelsRef = useRef<Set<string>>(new Set());

  // Drive a 10 fps anim ticker for sprite step/bob animations.
  useEffect(() => {
    const id = setInterval(() => setAnimTick((t) => (t + 1) % 1024), 100);
    return () => clearInterval(id);
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      if (!user) {
        router.replace('/login');
      }
    }, [user])
  );

  useEffect(() => {
    (async () => {
      if (!user) return;
      let s = state;
      if (!s) s = await loadFromServer();
      if (!s) {
        router.replace('/character-create');
        return;
      }
      let tx = s.world.position.x;
      let ty = s.world.position.y;
      // Safety: if saved checkpoint is now inside a wall (map redesign), respawn at entrance hall
      if (!isFloor(tx, ty)) {
        tx = 1;
        ty = 13; // entrance hall
        try { await setPosition(tx, ty); } catch {}
      }
      posRef.current = { px: tx * TILE + TILE / 2, py: ty * TILE + TILE / 2 };
      lastTileRef.current = { x: tx, y: ty };
      // Spawn 3 scout roamers + 1 Juggernaut mini-boss patrolling the corridors
      const occupied = new Set<string>();
      const placed: Roamer[] = [];
      // 3 Clockwork Scouts (random walkable spots)
      for (let i = 0; i < 3; i++) {
        const spot = randomFloorTile(tx, ty, occupied);
        if (!spot) break;
        occupied.add(`${spot.x},${spot.y}`);
        placed.push({ uid: `scout_${Date.now()}_${i}`, enemyId: 'tinkerer_drone', x: spot.x, y: spot.y });
      }
      // 1 Juggernaut mini-boss patrolling the throne approach corridor (rows 5-9, mid columns)
      let jugSpot: { x: number; y: number } | null = null;
      for (let attempt = 0; attempt < 60; attempt++) {
        const x = 6 + Math.floor(Math.random() * 8);
        const y = 5 + Math.floor(Math.random() * 5);
        if (isFloor(x, y) && !occupied.has(`${x},${y}`) && !(x === tx && y === ty) && !isNearNpc(x, y)) {
          jugSpot = { x, y };
          break;
        }
      }
      if (jugSpot) {
        occupied.add(`${jugSpot.x},${jugSpot.y}`);
        placed.push({ uid: `juggernaut_${Date.now()}`, enemyId: 'tesla_drone', x: jugSpot.x, y: jugSpot.y, boss: true });
      }
      roamersRef.current = placed;
      setRoamers(placed);
      engagingRef.current = false;
      setLoaded(true);
    })();
  }, [user]);

  // Spawn roaming enemies on focus (after returning from combat or fresh load)
  useFocusEffect(
    React.useCallback(() => {
      if (!loaded) return;
      engagingRef.current = false;
      const refill = setTimeout(() => {
        const pool = ENCOUNTER_POOLS.academy;
        const cur = roamersRef.current;
        if (cur.length >= MAX_ROAMERS) return;
        const occupied = new Set(cur.map(r => `${r.x},${r.y}`));
        const need = MAX_ROAMERS - cur.length;
        const tx = lastTileRef.current.x;
        const ty = lastTileRef.current.y;
        const fresh: Roamer[] = [...cur];
        for (let i = 0; i < need; i++) {
          const spot = randomFloorTile(tx, ty, occupied);
          if (!spot) break;
          occupied.add(`${spot.x},${spot.y}`);
          const enemyId = pool[Math.floor(Math.random() * pool.length)];
          fresh.push({ uid: `r${Date.now()}_${i}_${Math.random()}`, enemyId, x: spot.x, y: spot.y });
        }
        roamersRef.current = fresh;
        setRoamers(fresh);
      }, 800);
      return () => clearTimeout(refill);
    }, [loaded]),
  );

  // Roaming enemy movement loop
  useEffect(() => {
    if (!loaded) return;
    const id = setInterval(() => {
      if (engagingRef.current) return;
      const cur = roamersRef.current;
      if (cur.length === 0) return;
      const occupied = new Set(cur.map(r => `${r.x},${r.y}`));
      const next = cur.map((r) => {
        const playerTx = lastTileRef.current.x;
        const playerTy = lastTileRef.current.y;
        const dxToPlayer = playerTx - r.x;
        const dyToPlayer = playerTy - r.y;
        const distToPlayer = Math.abs(dxToPlayer) + Math.abs(dyToPlayer);

        // CHASE state: if player within CHASE_RADIUS, move 1 tile toward player
        let dx = 0, dy = 0;
        if (distToPlayer > 0 && distToPlayer <= CHASE_RADIUS) {
          if (Math.abs(dxToPlayer) > Math.abs(dyToPlayer)) {
            dx = dxToPlayer > 0 ? 1 : -1;
          } else {
            dy = dyToPlayer > 0 ? 1 : -1;
          }
        } else {
          // ROAM state: pick random direction (or stay)
          const dirs = [
            { dx: 0, dy: 0 },
            { dx: 1, dy: 0 },
            { dx: -1, dy: 0 },
            { dx: 0, dy: 1 },
            { dx: 0, dy: -1 },
          ];
          const d = dirs[Math.floor(Math.random() * dirs.length)];
          dx = d.dx; dy = d.dy;
        }

        const nx = r.x + dx;
        const ny = r.y + dy;
        if (
          (dx !== 0 || dy !== 0) &&
          isFloor(nx, ny) &&
          !occupied.has(`${nx},${ny}`) &&
          !(nx === playerTx && ny === playerTy)
        ) {
          occupied.delete(`${r.x},${r.y}`);
          occupied.add(`${nx},${ny}`);
          return { ...r, x: nx, y: ny, chasing: distToPlayer <= CHASE_RADIUS };
        }
        return { ...r, chasing: distToPlayer <= CHASE_RADIUS };
      });
      roamersRef.current = next;
      setRoamers(next);
    }, ROAM_TICK_MS);
    return () => clearInterval(id);
  }, [loaded]);

  // Game loop
  useEffect(() => {
    if (!loaded) return;
    let raf: any;
    const loop = () => {
      const { x: dx, y: dy } = dirRef.current;
      if (dx !== 0 || dy !== 0) {
        // Try the full diagonal step first; if blocked, try the X- and Y-only
        // components separately so the player slides cleanly along walls instead
        // of getting stuck at corners. Collision uses a feet-bounding-box check.
        const cur = posRef.current;
        const moveX = dx * SPEED;
        const moveY = dy * SPEED;

        let next = { px: cur.px, py: cur.py };
        if (canMoveTo(cur.px + moveX, cur.py + moveY, brokenBarrelsRef.current)) {
          next = { px: cur.px + moveX, py: cur.py + moveY };
        } else if (moveX !== 0 && canMoveTo(cur.px + moveX, cur.py, brokenBarrelsRef.current)) {
          next = { px: cur.px + moveX, py: cur.py };          // slide horizontally
        } else if (moveY !== 0 && canMoveTo(cur.px, cur.py + moveY, brokenBarrelsRef.current)) {
          next = { px: cur.px, py: cur.py + moveY };          // slide vertically
        }
        // else: fully blocked — stay put

        if (next.px !== cur.px || next.py !== cur.py) {
          posRef.current = next;
          // Tile-change events: use the SINGLE tile under the feet center
          const tx = Math.floor(next.px / TILE);
          const ty = Math.floor((next.py + FEET_DY) / TILE);
          if (tx !== lastTileRef.current.x || ty !== lastTileRef.current.y) {
            lastTileRef.current = { x: tx, y: ty };
            onTileChange(tx, ty);
            // Roamer collision check
            if (!engagingRef.current) {
              const hit = roamersRef.current.find(r => r.x === tx && r.y === ty);
              if (hit) {
                engagingRef.current = true;
                const remaining = roamersRef.current.filter(r => r.uid !== hit.uid);
                roamersRef.current = remaining;
                setRoamers(remaining);
                sfx.encounter();
                router.push({ pathname: '/combat', params: { enemyId: hit.enemyId, mode: 'random' } });
                dirRef.current = { x: 0, y: 0 };
              }
            }
          }
        }
        setRenderTick((t) => (t + 1) % 1000);
      }
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [loaded]);

  const onTileChange = (tx: number, ty: number) => {
    setPosition(tx, ty);
    // Tile types
    const tile = ACADEMY_MAP[ty][tx];
    if (tile === 5) setHint('STORE — Press A');
    else if (tile === 6) setHint('SKILL CHAMBER — Press A');
    else if (tile === 4) setHint('LAUNCH PAD — Press A');
    else if (tile === 2) setHint('TRIAL DOOR — Press A · BOSS');
    else if (tile === 7) setHint('FINAL TRIAL — Press A · ⚠ BOSS');
    else if (tile === 9) setHint('★ SAPPHIRE CORE — Press A');
    else if (tile === 10) setHint('POWER CONSOLE — Press A');
    else if (tile === 8) {
      // Spike pad damage trigger
      sfx.damage();
      applyDamage(10);
      setHint('⚠ SPIKE TRAP! -10 HP');
      setTimeout(() => setHint(''), 1500);
    } else setHint('');
    // Random encounter (only on floor type 0)
    if (tile === 0 && Math.random() < ENCOUNTER_CHANCE) {
      triggerEncounter();
    }
  };

  const triggerEncounter = () => {
    const pool = ENCOUNTER_POOLS.academy;
    const enemyId = pool[Math.floor(Math.random() * pool.length)];
    sfx.encounter();
    router.push({ pathname: '/combat', params: { enemyId, mode: 'random' } });
  };

  const onActionA = () => {
    sfx.click();
    // Talk to nearby NPC, enter store, etc.
    if (dialog) {
      // advance dialog
      if (dialog.line + 1 < dialog.lines.length) setDialog({ ...dialog, line: dialog.line + 1 });
      else setDialog(null);
      return;
    }
    const { x, y } = lastTileRef.current;
    const tile = ACADEMY_MAP[y][x];
    if (tile === 5) { router.push('/store'); return; }
    if (tile === 6) { router.push('/skills'); return; }
    if (tile === 4) {
      if (state?.world.arenaUnlocked) router.push('/arena');
      else setHint('LOCKED. Reach Sync Lv 5');
      return;
    }
    if (tile === 2) {
      // Trial Boss: Mutant-Assembler
      if ((state?.player.level || 0) < 4) { setHint('SYNC TOO LOW. NEED LV 4'); return; }
      router.push({ pathname: '/combat', params: { enemyId: 'mutant_assembler', mode: 'boss' } });
      return;
    }
    if (tile === 7) {
      // Final Trial: Glitch Avatar
      if ((state?.player.level || 0) < 7) { setHint('SYNC TOO LOW. NEED LV 7'); return; }
      router.push({ pathname: '/combat', params: { enemyId: 'glitch_avatar', mode: 'boss' } });
      return;
    }
    if (tile === 9) {
      // Sapphire Core - objective completed
      sfx.victory();
      addGold(500);
      setHint('★ SAPPHIRE CORE RECOVERED! +500G');
      setTimeout(() => setHint(''), 3000);
      saveCheckpoint();
      return;
    }
    if (tile === 10) {
      // Power Console - heal + small reward
      sfx.heal();
      applyHeal(40);
      setHint('CONSOLE ACTIVATED · +40 HP');
      setTimeout(() => setHint(''), 2000);
      return;
    }
    // Find nearby NPC (within 1 tile)
    const npc = Object.values(NPCS).find(n => Math.abs(n.x - x) <= 1 && Math.abs(n.y - y) <= 1);
    if (npc) setDialog({ name: npc.name, lines: npc.lines, line: 0 });
  };

  const onActionB = () => {
    sfx.click();
    const { x, y } = lastTileRef.current;
    // Look for an adjacent barrel (4-directional) to smash
    const dirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of dirs) {
      const bx = x + dx;
      const by = y + dy;
      if (by < 0 || by >= ACADEMY_MAP.length || bx < 0 || bx >= ACADEMY_MAP[0].length) continue;
      if (ACADEMY_MAP[by][bx] !== 14) continue;
      const key = `${bx},${by}`;
      if (brokenBarrelsRef.current.has(key)) continue;
      // Smash it
      const next = new Set(brokenBarrelsRef.current);
      next.add(key);
      brokenBarrelsRef.current = next;
      setBrokenBarrels(next);
      sfx.damage();
      // Reward: small chance of gold
      const goldDrop = Math.floor(Math.random() * 15) + 5;
      addGold(goldDrop);
      setHint(`▒ BARREL SMASHED · +${goldDrop}G`);
      setTimeout(() => setHint(''), 1500);
      return;
    }
    // No barrel adjacent → open pause menu (legacy behavior)
    setPauseOpen(true);
  };

  const handleSave = async () => {
    await saveCheckpoint();
    setHint('CHECKPOINT SAVED');
    setTimeout(() => setHint(''), 1500);
    setPauseOpen(false);
  };

  const restAtAcademy = () => {
    if (!state) return;
    const next = { ...state };
    next.player = { ...next.player, hp: next.player.maxHp, mp: next.player.maxMp };
    setState(next);
    setHint('FULLY RESTORED');
    setTimeout(() => setHint(''), 1500);
    setPauseOpen(false);
  };

  if (authLoading || !loaded || !state) {
    return (
      <View style={styles.center}>
        <ActivityIndicator color={COLORS.neonCyan} size="large" />
      </View>
    );
  }

  // ──────────────────────────────────────────────────────────
  // Layout constants — keep gameplay in upper 65% of screen
  // ──────────────────────────────────────────────────────────
  // HUD = ~125px (two rows). Controls = bottom 35% of total screen.
  // Game viewport sits between HUD bottom and controls top.
  const HUD_HEIGHT = 125;
  const CONTROLS_BAND_HEIGHT = SH * 0.35;
  const VIEWPORT_HEIGHT = SH - HUD_HEIGHT - CONTROLS_BAND_HEIGHT;
  const VIEWPORT_TOP = HUD_HEIGHT;

  // Camera follow: keep player visually centered within the viewport.
  const camX = posRef.current.px - SW / 2;
  const camY = posRef.current.py - VIEWPORT_HEIGHT / 2;

  return (
    <SafeAreaView style={styles.container} edges={['bottom']}>
      {/* World viewport — strictly bounded between HUD bottom and controls top */}
      <View
        style={[
          styles.world,
          {
            position: 'absolute',
            top: VIEWPORT_TOP,
            left: 0,
            right: 0,
            height: VIEWPORT_HEIGHT,
            overflow: 'hidden',
          },
        ]}
        testID="game-world"
      >
        <View
          style={{
            position: 'absolute',
            left: -camX,
            top: -camY,
            width: ACADEMY_MAP[0].length * TILE,
            height: ACADEMY_MAP.length * TILE,
          }}
        >
          {ACADEMY_MAP.map((row, y) => (
            <View key={y} style={{ flexDirection: 'row' }}>
              {row.map((cell, x) => (
                <Tile key={`${x}-${y}`} type={cell} x={x} y={y} />
              ))}
            </View>
          ))}
          {/* No giant castle Image overlay — we are now INSIDE Castle V2.1.
              Stone walls (type 12) form the corridors and rooms; banners (13) decorate the throne chamber. */}
          {/* Sapphire Core, Spike Pad, and Destructible Barrel image overlays (1.8x scaled) */}
          {ACADEMY_MAP.flatMap((row, y) =>
            row.map((cell, x) => {
              if (cell === 9) {
                const W = TILE * 1.8, H = TILE * 2.0;
                return (
                  <Image
                    key={`core-${x}-${y}`}
                    source={{ uri: SPRITE_ASSETS.sapphireCore }}
                    style={{
                      position: 'absolute',
                      left: x * TILE + (TILE - W) / 2,
                      top: y * TILE + (TILE - H) / 2 - 8,
                      width: W, height: H,
                      backgroundColor: 'transparent',
                      zIndex: 4,
                    }}
                    resizeMode="contain"
                  />
                );
              }
              if (cell === 8) {
                const W = TILE * 1.8, H = TILE * 1.4;
                return (
                  <Image
                    key={`spike-${x}-${y}`}
                    source={{ uri: SPRITE_ASSETS.spikePad }}
                    style={{
                      position: 'absolute',
                      left: x * TILE + (TILE - W) / 2,
                      top: y * TILE + (TILE - H) / 2 + 2,
                      width: W, height: H,
                      backgroundColor: 'transparent',
                      zIndex: 3,
                    }}
                    resizeMode="contain"
                  />
                );
              }
              if (cell === 14 && !brokenBarrels.has(`${x},${y}`)) {
                const W = TILE * 1.4, H = TILE * 1.8;
                return (
                  <Image
                    key={`barrel-${x}-${y}`}
                    source={{ uri: SPRITE_ASSETS.barrel }}
                    style={{
                      position: 'absolute',
                      left: x * TILE + (TILE - W) / 2,
                      top: y * TILE + (TILE - H) / 2 - 6,
                      width: W, height: H,
                      backgroundColor: 'transparent',
                      zIndex: 4,    // below scouts (5) so player & enemies always overlay
                    }}
                    resizeMode="contain"
                  />
                );
              }
              return null;
            })
          )}
          {/* NPCs — actual sprite + clean centered nameplate */}
          {Object.entries(NPCS).map(([id, npc]) => {
            const npcSprite =
              id === 'npc_orion' ? SPRITE_ASSETS.npcOrion :
              id === 'npc_jax' ? SPRITE_ASSETS.npcJax :
              id === 'npc_lyra' ? SPRITE_ASSETS.npcLyra : null;
            const W = TILE * 1.4;
            const H = TILE * 1.9;
            return (
              <View
                key={id}
                style={{
                  position: 'absolute',
                  // Center the NPC sprite horizontally on its tile column.
                  // The bottom of the sprite sits at the bottom of the tile (so feet stand on tile floor).
                  left: npc.x * TILE + (TILE - W) / 2,
                  top: npc.y * TILE - H + TILE,
                  width: W,
                  height: H + 16,
                  alignItems: 'center',
                  justifyContent: 'flex-start',
                  zIndex: 8,
                }}
                pointerEvents="none"
              >
                {npcSprite ? (
                  <Image
                    source={{ uri: npcSprite }}
                    style={{ width: W, height: H, backgroundColor: 'transparent' }}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.npcSprite}>
                    <PixelText size={10} color="#fff" bold>!</PixelText>
                  </View>
                )}
                <View style={{ marginTop: 1, paddingHorizontal: 3, backgroundColor: 'rgba(0,0,0,0.6)' }}>
                  <PixelText size={8} color={COLORS.neonYellow}>
                    {npc.name.split(' ')[0].toUpperCase()}
                  </PixelText>
                </View>
              </View>
            );
          })}
          {/* Roaming enemies — Clockwork Scouts and Juggernaut mini-boss.
              FULL sprite is rendered (no clip + procedural-leg overlay). The AI sprite
              already includes legs. We add a subtle bob/sway transform for life. */}
          {roamers.map((r) => {
            const isBoss = r.boss;
            const spriteUri = isBoss ? SPRITE_ASSETS.enemyJuggernaut : SPRITE_ASSETS.enemyScout;
            const W = isBoss ? TILE * 1.7 : TILE * 1.4;
            const H = isBoss ? TILE * 1.7 : TILE * 1.4;
            // Per-roamer phase based on uid + animTick → asynchronous gait
            const uidHash = r.uid.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
            const tickPhase = animTick + uidHash;
            const swingPhase = tickPhase * 0.6;
            const bob = Math.abs(Math.sin(swingPhase)) * (isBoss ? 1.5 : 2);
            const sway = Math.sin(swingPhase * 0.5) * (isBoss ? 1.5 : 3);
            return (
              <View
                key={r.uid}
                style={{
                  position: 'absolute',
                  left: r.x * TILE + (TILE - W) / 2,
                  top: r.y * TILE + (TILE - H) / 2 - 4,
                  width: W,
                  height: H,
                  zIndex: isBoss ? 6 : 5,
                  transform: [
                    { translateY: -bob },
                    { rotate: `${sway}deg` },
                  ],
                }}
                pointerEvents="none"
              >
                <Image
                  source={{ uri: spriteUri }}
                  style={{ width: W, height: H, backgroundColor: 'transparent' }}
                  resizeMode="contain"
                />
              </View>
            );
          })}
          {/* Player sprite — mini-ADHAMB, ALWAYS on top (zIndex 9999).
              FULL sprite rendered with subtle bob/sway while moving — the AI-painted PNG
              already contains the legs/boots, no procedural-leg overlay required. */}
          {(() => {
            const W = TILE * 1.7;
            const H = TILE * 2.4;
            const isMoving = dirRef.current.x !== 0 || dirRef.current.y !== 0;
            const phase = animTick * 0.9;
            const bob = isMoving ? Math.abs(Math.sin(phase)) * 3 : 0;
            const sway = isMoving ? Math.sin(phase * 0.5) * 2 : 0;
            return (
              <View
                style={{
                  position: 'absolute',
                  left: posRef.current.px - W / 2,
                  top: posRef.current.py - H * 0.7,
                  width: W,
                  height: H,
                  zIndex: 9999,
                  transform: [
                    { translateY: -bob },
                    { rotate: `${sway}deg` },
                  ],
                  ...(Platform.OS === 'android' ? { elevation: 30 } : {}),
                }}
                pointerEvents="none"
              >
                <Image
                  source={{ uri: SPRITE_ASSETS.player }}
                  style={{ width: W, height: H, backgroundColor: 'transparent' }}
                  resizeMode="contain"
                />
              </View>
            );
          })()}
        </View>
      </View>

      {/* Top HUD - status row + action shortcuts row */}
      <View style={styles.hud} testID="hud-status">
        <View style={styles.hudStatusRow}>
          <View style={styles.hudLeft}>
            <PixelText size={10} color={COLORS.neonCyan} bold>{state.player.name.toUpperCase()}</PixelText>
            <PixelText size={7} color={COLORS.textDim} style={{ marginTop: 2 }}>LV{state.player.level} · S{state.player.syncLevel}</PixelText>
          </View>
          <View style={styles.hudBars}>
            <StatBar value={state.player.hp} max={state.player.maxHp} color={COLORS.hp} bgColor={COLORS.hpBg} width={110} height={8} showText={false} />
            <View style={{ height: 2 }} />
            <StatBar value={state.player.mp} max={state.player.maxMp} color={COLORS.mp} bgColor={COLORS.mpBg} width={110} height={8} showText={false} />
          </View>
          <View style={styles.hudRight}>
            <PixelText size={9} color={COLORS.neonYellow} bold>{state.player.gold}G</PixelText>
            <PixelText size={7} color={COLORS.xp} style={{ marginTop: 2 }}>XP{state.player.xp}/{state.player.xpToNext}</PixelText>
          </View>
        </View>
        <View style={styles.hudShortcutsRow}>
          <TouchableOpacity
            style={[styles.shortcutBtn, { borderColor: COLORS.neonCyan }]}
            onPress={() => { sfx.click(); router.push('/inventory'); }}
            testID="hud-inventory"
          >
            <PixelText size={9} color={COLORS.neonCyan} bold>BAG</PixelText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shortcutBtn, { borderColor: COLORS.neonMagenta }]}
            onPress={() => { sfx.click(); router.push('/skills'); }}
            testID="hud-skills"
          >
            <PixelText size={9} color={COLORS.neonMagenta} bold>SKILLS</PixelText>
            {state.player.skillPoints > 0 && (
              <View style={styles.spDot}><PixelText size={8} color="#000" bold>{state.player.skillPoints}</PixelText></View>
            )}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shortcutBtn, { borderColor: COLORS.neonYellow }]}
            onPress={() => { sfx.click(); router.push('/store'); }}
            testID="hud-store"
          >
            <PixelText size={9} color={COLORS.neonYellow} bold>STORE</PixelText>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.shortcutBtn, { borderColor: COLORS.textDim }]}
            onPress={() => { sfx.click(); setPauseOpen(true); }}
            testID="hud-menu"
          >
            <PixelText size={9} color={COLORS.text} bold>MENU</PixelText>
          </TouchableOpacity>
        </View>
      </View>

      {hint ? (
        <View style={styles.hint}>
          <PixelText size={11} color={COLORS.neonGreen} glow bold>{hint}</PixelText>
        </View>
      ) : null}

      {/* Dialog */}
      {dialog && (
        <View style={styles.dialog}>
          <PixelText size={12} color={COLORS.neonCyan} bold>{dialog.name.toUpperCase()}</PixelText>
          <View style={{ height: 1, backgroundColor: COLORS.border, marginVertical: 8 }} />
          <PixelText size={12} color={COLORS.text} style={{ lineHeight: 20 }}>{dialog.lines[dialog.line]}</PixelText>
          <PixelText size={9} color={COLORS.textDim} style={{ marginTop: 8, textAlign: 'right' }}>▼ Press A</PixelText>
        </View>
      )}

      {/* Controls */}
      <VirtualJoystick
        onMove={(dx, dy) => { dirRef.current = { x: dx, y: dy }; }}
        onEnd={() => { dirRef.current = { x: 0, y: 0 }; }}
      />
      <ActionButton label="A" position="A" color={COLORS.neonGreen} onPress={onActionA} testID="btn-a" />
      <ActionButton label="B" position="B" color={COLORS.neonMagenta} onPress={onActionB} testID="btn-b" />

      {/* Pause modal */}
      <Modal visible={pauseOpen} transparent animationType="fade" onRequestClose={() => setPauseOpen(false)}>
        <View style={styles.modalBg}>
          <ScrollView contentContainerStyle={styles.modalContent}>
            <PixelText size={20} color={COLORS.neonCyan} glow bold style={{ marginBottom: 4, textAlign: 'center' }}>PAUSE MENU</PixelText>
            <PixelText size={9} color={COLORS.textDim} style={{ textAlign: 'center', marginBottom: 16 }}>NEXUS_OS // STATUS</PixelText>

            <View style={styles.menuStat}>
              <PixelText size={11} color={COLORS.text}>{state.player.name.toUpperCase()}</PixelText>
              <PixelText size={11} color={COLORS.neonCyan}>LV {state.player.level}</PixelText>
            </View>
            <View style={styles.menuStat}><PixelText size={10} color={COLORS.textDim}>HP</PixelText><PixelText size={10} color={COLORS.hp}>{state.player.hp}/{state.player.maxHp}</PixelText></View>
            <View style={styles.menuStat}><PixelText size={10} color={COLORS.textDim}>MP</PixelText><PixelText size={10} color={COLORS.mp}>{state.player.mp}/{state.player.maxMp}</PixelText></View>
            <View style={styles.menuStat}><PixelText size={10} color={COLORS.textDim}>ATK / DEF / SPD</PixelText><PixelText size={10} color={COLORS.text}>{state.player.atk}/{state.player.def}/{state.player.spd}</PixelText></View>
            <View style={styles.menuStat}><PixelText size={10} color={COLORS.textDim}>GOLD</PixelText><PixelText size={10} color={COLORS.neonYellow}>{state.player.gold}G</PixelText></View>
            <View style={styles.menuStat}><PixelText size={10} color={COLORS.textDim}>SKILL POINTS</PixelText><PixelText size={10} color={COLORS.neonMagenta}>{state.player.skillPoints}</PixelText></View>

            <View style={{ height: 14 }} />
            <PixelButton title="SKILL TREE" onPress={() => { setPauseOpen(false); router.push('/skills'); }} color={COLORS.neonMagenta} full />
            <View style={{ height: 8 }} />
            <PixelButton title="INVENTORY" onPress={() => { setPauseOpen(false); router.push('/inventory'); }} color={COLORS.neonCyan} full />
            <View style={{ height: 8 }} />
            <PixelButton title="REST (FULL HEAL)" onPress={restAtAcademy} color={COLORS.neonGreen} full />
            <View style={{ height: 8 }} />
            <PixelButton title="SAVE CHECKPOINT" onPress={handleSave} color={COLORS.neonYellow} full />
            <View style={{ height: 8 }} />
            <PixelButton title="QUIT TO TITLE" onPress={() => { setPauseOpen(false); router.replace('/'); }} color={COLORS.textDim} full />
            <View style={{ height: 12 }} />
            <PixelButton title="RESUME" onPress={() => setPauseOpen(false)} color={COLORS.neonCyan} size="lg" full />
          </ScrollView>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function Tile({ type, x, y }: { type: number; x: number; y: number }) {
  // Wall tiles (1 = outer wall, 12 = castle stone) → procedural BrickWall texture.
  if (type === 1 || type === 12) {
    return (
      <View style={[styles.tile, { width: TILE, height: TILE }]}>
        <BrickWall size={TILE} variant={(x * 31 + y * 17) % 7} />
      </View>
    );
  }

  // Floor tile → procedural ConcreteFloor texture (light industrial grey)
  if (type === 0) {
    return (
      <View style={[styles.tile, { width: TILE, height: TILE }]}>
        <ConcreteFloor size={TILE} variant={(x * 19 + y * 23) % 11} />
      </View>
    );
  }

  let bg = COLORS.bgDark;
  let inner: any = null;
  if (type === 5) { bg = '#2a1a3e'; inner = <PixelText size={14} color={COLORS.neonYellow} bold>$</PixelText>; }
  else if (type === 6) { bg = '#1a2a3e'; inner = <PixelText size={14} color={COLORS.neonMagenta} bold>★</PixelText>; }
  else if (type === 4) { bg = '#3e1a1a'; inner = <PixelText size={14} color={COLORS.neonRed} bold>↑</PixelText>; }
  else if (type === 2) { bg = '#3e2a1a'; inner = <PixelText size={12} color={COLORS.neonMagenta} bold>⚠</PixelText>; }
  else if (type === 7) { bg = '#3e0a3e'; inner = <PixelText size={12} color={COLORS.neonMagenta} glow bold>⚠</PixelText>; }
  else if (type === 8) { bg = '#1e1e2e'; }  // spike pad - floor bg, image overlay handles visual
  else if (type === 9) { bg = '#1e1e2e'; }  // sapphire core - floor bg, image overlay
  else if (type === 10) { bg = '#1a3a3a'; inner = <PixelText size={14} color={COLORS.neonGreen} glow bold>⚙</PixelText>; }
  else if (type === 11) { bg = '#1a1418'; inner = <PixelText size={14} color={COLORS.textDim} bold>▓▓</PixelText>; }
  else if (type === 13) { bg = '#26183a'; inner = <PixelText size={12} color={COLORS.neonMagenta} glow bold>♦</PixelText>; }  // throne chamber banner
  else if (type === 14) { bg = '#1e1e2e'; }  // barrel sits on floor; image overlay handles visual
  return (
    <View style={[styles.tile, { backgroundColor: bg, width: TILE, height: TILE }]}>
      {inner}
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  center: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: COLORS.bg },
  world: { flex: 1, overflow: 'hidden', backgroundColor: COLORS.bgDark },
  tile: { alignItems: 'center', justifyContent: 'center', borderWidth: 0.5, borderColor: 'rgba(60,60,100,0.15)' },
  wallInner: {
    width: TILE - 6, height: TILE - 6,
    backgroundColor: '#0d0d1a',
    borderColor: '#2a2a4a', borderWidth: 1,
  },
  castleWallInner: {
    width: TILE - 4, height: TILE - 4,
    backgroundColor: '#1f1830',
    borderColor: '#6a4a8a', borderWidth: 2,
    shadowColor: '#ff2dd4', shadowOpacity: 0.4, shadowRadius: 4,
  },
  floorDot: { position: 'absolute', width: 2, height: 2, backgroundColor: 'rgba(100,100,180,0.3)' },
  player: {
    position: 'absolute',
    width: 36, height: 52,
    alignItems: 'center', justifyContent: 'flex-start',
    zIndex: 10,
  },
  playerSprite: {
    position: 'absolute',
    width: 44, height: 60,
    zIndex: 10,
  },
  playerAntenna: { display: 'none' },
  playerHead: { display: 'none' },
  playerHair: { display: 'none' },
  playerVisor: { display: 'none' },
  playerBody: { display: 'none' },
  playerChestAccent: { display: 'none' },
  playerShoulderL: { display: 'none' },
  playerShoulderR: { display: 'none' },
  playerBelt: { display: 'none' },
  playerLegs: { display: 'none' },
  playerKnee: { display: 'none' },
  npc: {
    position: 'absolute',
    width: 30, alignItems: 'center',
  },
  npcSprite: {
    width: 22, height: 22,
    backgroundColor: COLORS.neonYellow,
    borderWidth: 1, borderColor: '#000',
    alignItems: 'center', justifyContent: 'center',
  },
  roamer: {
    position: 'absolute',
    width: 50, height: 50,
    alignItems: 'center', justifyContent: 'center',
    zIndex: 8,
  },
  roamerBg: {
    width: 48, height: 48,
    backgroundColor: 'rgba(255,56,96,0.18)',
    borderWidth: 2, borderColor: COLORS.neonRed,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: COLORS.neonRed,
    shadowOpacity: 0.8,
    shadowRadius: 6,
    shadowOffset: { width: 0, height: 0 },
  },
  roamerBgChasing: {
    backgroundColor: 'rgba(255,45,212,0.35)',
    borderColor: COLORS.neonMagenta,
    shadowColor: COLORS.neonMagenta,
    shadowOpacity: 1,
    shadowRadius: 12,
  },
  roamerGlow: {
    shadowColor: COLORS.neonRed,
    shadowOpacity: 0.7,
    shadowRadius: 8,
    shadowOffset: { width: 0, height: 0 },
  },
  roamerChasing: {
    shadowColor: COLORS.neonMagenta,
    shadowOpacity: 1,
    shadowRadius: 16,
  },
  alertDot: {
    position: 'absolute',
    top: -4, right: -2,
    width: 8, height: 8,
    backgroundColor: COLORS.neonRed,
    borderRadius: 4,
    borderWidth: 1, borderColor: '#000',
  },
  alertDotChasing: {
    backgroundColor: COLORS.neonMagenta,
    width: 10, height: 10,
  },
  topShortcuts: {
    // legacy - kept for backward compat but no longer used (shortcuts now live inside HUD)
    display: 'none',
  },
  shortcutBtn: {
    backgroundColor: 'rgba(10,10,20,0.85)',
    borderWidth: 2, paddingHorizontal: 10, paddingVertical: 5,
    minWidth: 56, alignItems: 'center',
  },
  spDot: {
    position: 'absolute', top: -6, right: -6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.neonMagenta,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#000',
  },
  hud: {
    position: 'absolute', top: 0, left: 0, right: 0,
    backgroundColor: 'rgba(8,8,18,0.95)',
    borderBottomWidth: 2, borderBottomColor: COLORS.neonCyan,
    paddingTop: 36, paddingBottom: 6, paddingHorizontal: 10,
    shadowColor: COLORS.neonCyan, shadowOpacity: 0.4, shadowRadius: 6,
    zIndex: 50,
  },
  hudStatusRow: {
    flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center',
    gap: 8,
  },
  hudShortcutsRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginTop: 6,
    gap: 4,
  },
  objective: {
    position: 'absolute', top: 78, left: 12, right: 12,
    backgroundColor: 'rgba(10,10,20,0.92)',
    borderWidth: 1, borderColor: COLORS.neonMagenta,
    paddingHorizontal: 12, paddingVertical: 5,
    alignItems: 'center',
    zIndex: 49,
  },
  hudLeft: { flex: 1 },
  hudBars: { width: 130 },
  hudRight: { alignItems: 'flex-end' },
  hint: {
    position: 'absolute', top: 165, alignSelf: 'center',
    backgroundColor: 'rgba(10,10,20,0.9)',
    borderWidth: 1, borderColor: COLORS.neonGreen,
    paddingHorizontal: 12, paddingVertical: 6,
    zIndex: 47,
  },
  dialog: {
    position: 'absolute', bottom: 180, left: 16, right: 16,
    backgroundColor: 'rgba(10,10,20,0.95)',
    borderWidth: 2, borderColor: COLORS.neonCyan,
    padding: 14,
    shadowColor: COLORS.neonCyan, shadowOpacity: 0.5, shadowRadius: 8,
  },
  modalBg: { flex: 1, backgroundColor: 'rgba(0,0,0,0.85)', alignItems: 'center', justifyContent: 'center' },
  modalContent: {
    backgroundColor: COLORS.panel,
    borderWidth: 2, borderColor: COLORS.neonCyan,
    padding: 20, width: '90%', maxWidth: 380,
  },
  menuStat: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingVertical: 4,
    borderBottomWidth: 1, borderBottomColor: COLORS.border,
  },
});
