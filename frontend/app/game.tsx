import React, { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Dimensions, ActivityIndicator, ScrollView, Modal, TouchableOpacity, Image, Platform } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, ACADEMY_MAP, CONDUIT_MAZE, NPCS, ENCOUNTER_POOLS, ENEMIES, HOUSES, SPRITE_ASSETS } from '../src/data/gameData';
import BrickWall from '../src/components/BrickWall';
import { AtmosphereLayer } from '../src/components/AtmosphereLayer';
import GroundShadow from '../src/components/GroundShadow';
import ConcreteFloor from '../src/components/ConcreteFloor';
import Drawbridge from '../src/components/Drawbridge';
import SpiralStaircase from '../src/components/SpiralStaircase';
import CyberTile from '../src/components/cyber/CyberTile';
import CyberProp from '../src/components/cyber/CyberProp';
import VoidBackdrop from '../src/components/VoidBackdrop';
import { isTileBlocked as _isTileBlocked, categoryAt, ruleForTile } from '../src/data/tileRules';
import {
  CORRUPTION_SET,
  ROAD_SET,
  PROPS as FORGOTTEN_PROPS,
} from '../src/data/forgottenBlock';
import SheetSprite, { prefetchSheet } from '../src/components/SheetSprite';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { SystemPrompt } from '../src/components/SystemPrompt';
import { StatBar } from '../src/components/StatBar';
import { VirtualJoystick } from '../src/components/VirtualJoystick';
import { ActionButton } from '../src/components/ActionButton';
import { Sprite } from '../src/components/Sprite';
import { ActiveSkillPanel } from '../src/components/ActiveSkillPanel';
import { useGame } from '../src/contexts/GameContext';
import { useAuth } from '../src/contexts/AuthContext';
import { useTutorial } from '../src/contexts/TutorialContext';
import { sfx } from '../src/utils/audio';
import { resolveMinionSpriteUri, hasMinionSprite } from '../src/systems/DynamicMinionRenderer';
import { stepWildAI, makeAIRoamer, AIRoamer, AI_CONFIG } from '../src/systems/WildMinionAI';
import { getEnemyVisual } from '../src/systems/enemyVisual';
import UnifiedSprite from '../src/components/UnifiedSprite';
import { FACTIONS } from '../src/data/factions';

const TILE = 44;

// ──────────────────────────────────────────────────────────
// Debug toggles — driven by URL query params. Zero overhead in
// production (the boolean is false on first paint and stays false).
//   ?debug=collision  → colour-coded tile overlay (Readable Map pass)
// ──────────────────────────────────────────────────────────
const DEBUG_COLLISION =
  (typeof window !== 'undefined' &&
    typeof window.location !== 'undefined' &&
    /[?&]debug=collision\b/.test(window.location.search)) || false;
const SPEED = 12; // pixels per frame (was 9 → another +33% on the overworld walk)
const ENCOUNTER_CHANCE = 0.0; // disabled - using visible roaming enemies instead
const ROAM_TICK_MS = 800; // every 0.8s — slightly faster patrol cycle
const MAX_ROAMERS = 3;
const CHASE_RADIUS = 4;

const { width: SW, height: SH } = Dimensions.get('window');

type Dialog = {
  name: string;
  lines: string[];
  line: number;
  /** Called once after the dialog reaches its final line and is closed —
   *  used to chain into the store / skill-tree screens after Jax / Lyra
   *  finish their pitch. */
  onComplete?: () => void;
} | null;
// Roamer = base record + the AI fields from WildMinionAI. We keep the
// existing fields (uid, enemyId, x, y, boss) so all the spawn/render code
// stays working, and add `state/anchor/wanderCooldown/facing` so the AI
// state machine can do its thing.
type Roamer = AIRoamer & { chasing?: boolean };

function isFloor(x: number, y: number, brokenBarrels?: Set<string>): boolean {
  // Backward-compatible delegate for spawn helpers — single-tile check.
  return isTileWalkable(x, y, brokenBarrels ?? new Set<string>());
}

// ──────────────────────────────────────────────────────────
// Collision constants — tile types that block player movement.
// The player sprite is 2.4× TILE tall, so the HEAD renders over the
// row above the feet (zIndex: 9999 keeps it on top of wall tiles).
// We only check collision at FEET-level (the destination tile coords).
//
// Centralised: see /app/frontend/src/data/tileRules.ts for the full
// rule table that drives both collision and the debug overlay.
// ──────────────────────────────────────────────────────────

// Feet-hitbox proportions (relative to TILE).
// The player sprite is ~2.4× TILE tall, but only the FEET should collide with walls.
// 70% wide × 45% tall, anchored slightly below the logical position so it sits
// roughly where the boots are drawn on screen.
const FEET_W = TILE * 0.70;
const FEET_H = TILE * 0.45;
const FEET_DY = TILE * 0.20;   // shift hitbox below logical center toward the feet

/**
 * Tile-level walkability check (used by spawn/AI helpers — single tile in/out).
 * Now centralises through tileRules.ts which ALSO blocks PROP_LARGE props
 * (debris piles, car wrecks, generators, terminals, locked gates) that
 * previously rendered as decorative overlays the player could walk through.
 */
function isTileWalkable(tx: number, ty: number, brokenBarrels: Set<string>): boolean {
  if (ty < 0 || ty >= ACADEMY_MAP.length) return false;
  if (tx < 0 || tx >= ACADEMY_MAP[0].length) return false;
  const t = ACADEMY_MAP[ty][tx];
  return !_isTileBlocked(t, tx, ty, brokenBarrels);
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
  const { startSequence, isCompleted } = useTutorial();
  const [loaded, setLoaded] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [hint, setHint] = useState('');
  const dirRef = useRef({ x: 0, y: 0 });
  // Last *non-zero* movement direction the player faced. Used to pick which
  // PokeAdhamb side-sprite (up/down/left/right) to render even when standing still.
  const facingRef = useRef<'up' | 'down' | 'left' | 'right'>('down');
  const lastTileRef = useRef({ x: 0, y: 0 });
  // True once the throne drawbridge has fired its lowering thud SFX. Reset when
  // the player walks far enough away so the SFX retriggers on the next approach.
  const bridgeThudFiredRef = useRef(false);
  // pixel position; tile = floor(p/TILE)
  const posRef = useRef({ px: 0, py: 0 });
  // Smoothed camera position — lerps toward the player each frame so the world
  // glides instead of hard-snapping at the new high SPEED. Closer-to-1 = stiffer
  // follow, closer-to-0 = lazier. 0.32 ≈ ~3 frames to catch up at 60 FPS.
  const camRef = useRef({ x: 0, y: 0 });
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

  // Prefetch every ADHAMB sheet frame on mount so the first walk doesn't flicker.
  useEffect(() => {
    prefetchSheet('adhamb');
  }, []);

  useFocusEffect(
    React.useCallback(() => {
      // Wait for the auth check to complete before deciding to bounce.
      // Otherwise a hard refresh on /game flashes a redirect to /login
      // before /auth/me resolves the cookie session.
      if (authLoading) return;
      if (!user) {
        router.replace('/login');
      }
    }, [user, authLoading])
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
      // Initialise camera to the player so we don't pan-in from (0,0) on load.
      camRef.current = { x: posRef.current.px, y: posRef.current.py };
      lastTileRef.current = { x: tx, y: ty };
      // Spawn a mixed roster of academy roamers — legacy tinkerers PLUS the
      // new Quantum Minion species (phreak/vrghost/mech) so the corridors
      // feel populated with the captureable enemies the player will meet.
      const occupied = new Set<string>();
      const placed: Roamer[] = [];
      // ── Roaming roster ─────────────────────────────────────────────────
      // Pull from the academy encounter pool so the world stays in-sync with
      // ENCOUNTER_POOLS.academy (which already includes phreak_1 / vrghost_1).
      const academySpawnIds = ['tinkerer_drone', 'phreak_1', 'vrghost_1', 'mech_1', 'phreak_2', 'vrghost_2'];
      for (let i = 0; i < 6; i++) {
        const spot = randomFloorTile(tx, ty, occupied);
        if (!spot) break;
        occupied.add(`${spot.x},${spot.y}`);
        const enemyId = academySpawnIds[i % academySpawnIds.length];
        placed.push(makeAIRoamer(`roamer_${Date.now()}_${i}`, enemyId, spot.x, spot.y, false));
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
        // Use a high-tier Quantum Minion as the mini-boss so its unique
        // sprite shows up in the world too — far more interesting visually
        // than the legacy tesla_drone scout silhouette.
        placed.push(makeAIRoamer(`juggernaut_${Date.now()}`, 'mech_3', jugSpot.x, jugSpot.y, true));
      }
      roamersRef.current = placed;
      setRoamers(placed);
      engagingRef.current = false;
      setLoaded(true);
      // ▶ Auto-trigger the welcome walkthrough on first entry to the academy.
      // The Tutorial context will silently no-op if the player has already
      // completed it. The tiny delay lets the world render so the dim
      // overlay highlights look anchored.
      setTimeout(() => {
        if (!isCompleted('intro')) startSequence('intro');
      }, 700);
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
      const playerTx = lastTileRef.current.x;
      const playerTy = lastTileRef.current.y;
      // Build collision predicates ONCE per tick — sharing them across all
      // roamers avoids O(N²) per-roamer work and keeps the tick under 1ms.
      const occupiedSet = new Set(cur.map((r) => `${r.x},${r.y}`));
      const isWallFn = (x: number, y: number) => !isFloor(x, y);
      const next = cur.map((r) => {
        const occupiedFn = (x: number, y: number) =>
          (x !== r.x || y !== r.y) && occupiedSet.has(`${x},${y}`);
        const advanced = stepWildAI(r, {
          playerX: playerTx,
          playerY: playerTy,
          isWall: isWallFn,
          occupied: occupiedFn,
        });
        // Keep `chasing` legacy field in-sync for the existing render guards.
        const chasing = advanced.state === 'Chasing' || advanced.state === 'Alerted';
        // Update occupancy set so subsequent roamers see the new positions.
        if (advanced.x !== r.x || advanced.y !== r.y) {
          occupiedSet.delete(`${r.x},${r.y}`);
          occupiedSet.add(`${advanced.x},${advanced.y}`);
        }
        return { ...advanced, chasing };
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
      // Track whether anything visually changed this frame so we re-render
      // AT MOST ONCE per RAF tick (was up to 2× — was the main Android lag
      // source because each setState re-mounts ~600 tile/sprite components).
      let dirty = false;
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
          dirty = true;
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
                router.push({
                  pathname: '/combat',
                  params: {
                    enemyId: hit.enemyId,
                    mode: 'random',
                    // Pass the same `boss` flag the overworld used to render
                    // the roamer's sprite, so combat can pick the matching
                    // sprite (Juggernaut for boss, Scout otherwise) and the
                    // visual stays consistent across screens.
                    boss: hit.boss ? '1' : '0',
                  },
                });
                dirRef.current = { x: 0, y: 0 };
              }
            }
          }
        }
      }
      // Camera follow — lerp the camera position toward the player every
      // frame so the world glides instead of hard-snapping at high SPEED.
      // 0.32 ≈ catches up in ~3 frames at 60 FPS — just enough damping to feel
      // cinematic without ever lagging behind. Snap when close enough so the
      // float doesn't accumulate drift while the player is idle.
      {
        const target = posRef.current;
        const cam = camRef.current;
        const dxC = target.px - cam.x;
        const dyC = target.py - cam.y;
        if (Math.abs(dxC) > 0.5 || Math.abs(dyC) > 0.5) {
          camRef.current = { x: cam.x + dxC * 0.32, y: cam.y + dyC * 0.32 };
          dirty = true;
        } else if (cam.x !== target.px || cam.y !== target.py) {
          camRef.current = { x: target.px, y: target.py };
          dirty = true;
        }
      }
      // Re-render at most ONCE per frame, only when the player or camera
      // actually moved. Keeps idle CPU near zero and halves the render rate
      // during movement vs. the previous double-setState path.
      if (dirty) setRenderTick((t) => (t + 1) % 1000);
      raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [loaded]);

  const onTileChange = (tx: number, ty: number) => {
    setPosition(tx, ty);
    // Footstep SFX — fires once per grid tile entered while moving on walkable
    // floor (type 0), so the cadence stays in sync with the actual movement
    // rather than the animation tick (no foot-noise while standing still).
    const tile = ACADEMY_MAP[ty][tx];
    if (tile === 0) sfx.footstep();
    if (tile === 5) setHint('STORE — Press A');
    else if (tile === 6) setHint('SKILL CHAMBER — Press A');
    else if (tile === 4) setHint('LAUNCH PAD — Press A');
    else if (tile === 2) setHint('TRIAL DOOR — Press A · BOSS');
    else if (tile === 7) setHint('FINAL TRIAL — Press A · ⚠ BOSS');
    else if (tile === 9) setHint('★ SAPPHIRE CORE — Press A');
    else if (tile === 10) setHint('POWER CONSOLE — Press A');
    else if (tile === 15) setHint('▼ SPIRAL STAIRCASE — Press A · DESCEND');
    else if (tile === 8) {
      // Spike pad damage trigger
      sfx.damage();
      applyDamage(10);
      setHint('⚠ ION SPIKES! -10 STABILITY');
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
      if (dialog.line + 1 < dialog.lines.length) {
        setDialog({ ...dialog, line: dialog.line + 1 });
      } else {
        // Final line — close dialog and chain into the NPC's follow-up action
        // (Jax → store, Lyra → skill tree, Orion → no-op).
        const cb = dialog.onComplete;
        setDialog(null);
        if (cb) cb();
      }
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
      // Sapphire Core - main objective. ONE-TIME reward only — guards against
      // the gold-farm exploit where pressing A repeatedly granted +500G each time.
      const claimed = state?.world?.completedTrials?.includes('sapphire_core');
      if (claimed) {
        setHint('★ SAPPHIRE CORE — already secured');
        setTimeout(() => setHint(''), 1500);
        return;
      }
      sfx.victory();
      addGold(500);
      // Mark the core as claimed so subsequent presses do nothing.
      if (state) {
        setState({
          ...state,
          world: {
            ...state.world,
            completedTrials: [...(state.world.completedTrials || []), 'sapphire_core'],
          },
        });
      }
      setHint('★ SAPPHIRE CORE RECOVERED! +500G');
      setTimeout(() => setHint(''), 3000);
      saveCheckpoint();
      return;
    }
    if (tile === 10) {
      // Power Console — ONE-TIME emergency heal. Mirrors the Sapphire-Core
      // claim pattern so players can't camp on the tile and spam +40 HP.
      const consoleClaimed = state?.world?.completedTrials?.includes('power_console');
      if (consoleClaimed) {
        setHint('CONSOLE — already activated');
        setTimeout(() => setHint(''), 1500);
        return;
      }
      sfx.heal();
      applyHeal(40);
      if (state) {
        setState({
          ...state,
          world: {
            ...state.world,
            completedTrials: [...(state.world.completedTrials || []), 'power_console'],
          },
        });
      }
      setHint('CONSOLE ACTIVATED · +40 STABILITY');
      setTimeout(() => setHint(''), 2000);
      saveCheckpoint();
      return;
    }
    if (tile === 15) {
      // Spiral staircase — descend into Level 2B (Conduit Maze).
      sfx.confirm();
      setHint('▼ DESCENDING — Conduit Maze unlocked');
      setTimeout(() => router.replace('/conduit-maze'), 300);
      return;
    }
    // Find nearby NPC (within 1 tile)
    const npcEntry = Object.entries(NPCS).find(
      ([_id, n]) => Math.abs(n.x - x) <= 1 && Math.abs(n.y - y) <= 1,
    );
    if (npcEntry) {
      const [npcId, npc] = npcEntry;
      // Each NPC's "follow-up" runs after the dialog finishes:
      //   • Jax  → store      • Lyra → skill tree      • Orion → no-op (hint only)
      const followUp =
        npcId === 'npc_jax'
          ? () => router.push('/store')
          : npcId === 'npc_lyra'
          ? () => router.push('/skills')
          : undefined;
      setDialog({ name: npc.name, lines: npc.lines, line: 0, onComplete: followUp });
      return;
    }

    // Smash an adjacent barrel (4-directional) for a small gold drop.
    // Moved here from the old B button so A is the single "interact / hit"
    // button — B is now reserved exclusively for the pause menu.
    const smashDirs = [[0, -1], [0, 1], [-1, 0], [1, 0]];
    for (const [dx, dy] of smashDirs) {
      const bx = x + dx;
      const by = y + dy;
      if (by < 0 || by >= ACADEMY_MAP.length || bx < 0 || bx >= ACADEMY_MAP[0].length) continue;
      if (ACADEMY_MAP[by][bx] !== 14) continue;
      const key = `${bx},${by}`;
      if (brokenBarrelsRef.current.has(key)) continue;
      const next = new Set(brokenBarrelsRef.current);
      next.add(key);
      brokenBarrelsRef.current = next;
      setBrokenBarrels(next);
      sfx.damage();
      const goldDrop = Math.floor(Math.random() * 15) + 5;
      addGold(goldDrop);
      setHint(`▒ BARREL SMASHED · +${goldDrop}G`);
      setTimeout(() => setHint(''), 1500);
      return;
    }
  };

  // B button is now ONLY the pause menu — never doubles as an action button.
  const onActionB = () => {
    sfx.click();
    setPauseOpen(true);
  };

  const handleSave = async () => {
    await saveCheckpoint();
    setHint('CHECKPOINT SAVED');
    setTimeout(() => setHint(''), 1500);
    setPauseOpen(false);
  };

  // ──────────────────────────────────────────────────────────
  // Memoized static map render
  // ──────────────────────────────────────────────────────────
  // The 20×15 tile grid + sprite overlays = 600+ components per render.
  // Re-creating them every RAF tick during movement (60fps) was the main
  // cause of jank on lower-end Android devices. By memoizing on the inputs
  // that actually change (brokenBarrels, animTick), we cut the work to
  // ~10 renders/sec for the static layer regardless of player movement.
  //
  // IMPORTANT: these hooks MUST live above the early-return guard so the
  // hook count is identical on the loading render and on subsequent renders
  // (Rules of Hooks).
  const tileGrid = useMemo(
    () =>
      ACADEMY_MAP.map((row, y) => (
        <View key={y} style={{ flexDirection: 'row' }}>
          {row.map((cell, x) => (
            <Tile key={`${x}-${y}`} type={cell} x={x} y={y} />
          ))}
        </View>
      )),
    []
  );

  const staticOverlays = useMemo(
    () =>
      ACADEMY_MAP.flatMap((row, y) =>
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
          if (cell === 15) {
            // Procedurally rendered spiral staircase (downward exit).
            return (
              <View
                key={`stairs-${x}-${y}`}
                style={{
                  position: 'absolute',
                  left: x * TILE,
                  top: y * TILE,
                  width: TILE,
                  height: TILE,
                  zIndex: 3,
                }}
                pointerEvents="none"
              >
                <SpiralStaircase tile={TILE} tick={animTick} />
              </View>
            );
          }
          return null;
        })
      ),
    [brokenBarrels, animTick]
  );

  // ──────────────────────────────────────────────────────────
  // CYBER PROP OVERLAYS — decorative-only ruined-district dressing
  // (warning signs, debris, terminals, gates, pipes, etc.).
  // Pure visual layer; no collision changes. Memoized statically.
  // ──────────────────────────────────────────────────────────
  const propOverlays = useMemo(
    () =>
      FORGOTTEN_PROPS.map((p) => {
        // Props are slightly larger than the tile so they read clearly,
        // and bottom-anchored so they sit "on" the floor instead of
        // floating in the centre.
        const PW = TILE * 1.15;
        const PH = TILE * 1.15;
        return (
          <View
            key={`prop-${p.x}-${p.y}-${p.kind}`}
            style={{
              position: 'absolute',
              left: p.x * TILE + (TILE - PW) / 2,
              top:  p.y * TILE + (TILE - PH) / 2,
              width: PW,
              height: PH,
              zIndex: 2, // below characters (5+), above floor (0)
            }}
            pointerEvents="none"
          >
            <CyberProp kind={p.kind} size={PW} />
          </View>
        );
      }),
    []
  );

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
  // Controls band is intentionally tight so the world fills as much of the
  // phone screen as possible — Phase 1 Foundation: "fill the viewport".
  const HUD_HEIGHT = 125;
  const CONTROLS_BAND_HEIGHT = Math.min(260, SH * 0.30);
  const VIEWPORT_HEIGHT = SH - HUD_HEIGHT - CONTROLS_BAND_HEIGHT;
  const VIEWPORT_TOP = HUD_HEIGHT;

  // Camera follow: smoothed via lerp inside the game loop. Round to integer
  // pixels so the SVG floor/wall textures don't sub-pixel-shimmer at high SPEED.
  const camX = Math.round(camRef.current.x - SW / 2);
  const camY = Math.round(camRef.current.y - VIEWPORT_HEIGHT / 2);

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
          {/* Ambient cyberpunk void — extends 27 tiles past every map edge so
              the camera never reveals pure-black borders. Pure decorative
              layer, sits below the tile grid via zIndex -1. */}
          <VoidBackdrop
            mapWidth={ACADEMY_MAP[0].length * TILE}
            mapHeight={ACADEMY_MAP.length * TILE}
            padding={TILE * 27}
          />
          {tileGrid}
          {/* No giant castle Image overlay — we are now INSIDE Castle V2.1.
              Stone walls (type 12) form the corridors and rooms; banners (13) decorate the throne chamber. */}
          {/* Sapphire Core, Spike Pad, Destructible Barrel and Spiral Staircase
              overlays — memoized so they don't re-mount every movement frame. */}
          {staticOverlays}
          {/* Forgotten-Block decorative props (SVG) — pure visual layer.  */}
          {propOverlays}

          {/* ── COLLISION DEBUG OVERLAY ────────────────────────────────
              Toggle with `?debug=collision` URL param. Colour-codes every
              tile by category so we can audit the readability of the map:
                green   = FLOOR walkable
                red     = WALL blocked
                cyan    = INTERACTABLE press-A
                yellow  = HAZARD
                orange  = PROP_LARGE (debris/wreck/generator/etc.)
                ochre   = PROP_SMALL (sign/pipe)
              Prop tiles render their override colour ON TOP of the floor. */}
          {DEBUG_COLLISION && (
            <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0 }}>
              {ACADEMY_MAP.map((row, y) =>
                row.map((tileId, x) => {
                  const rule = categoryAt(tileId, x, y);
                  return (
                    <View
                      key={`dbg-${x}-${y}`}
                      style={{
                        position: 'absolute',
                        left: x * TILE,
                        top: y * TILE,
                        width: TILE,
                        height: TILE,
                        backgroundColor: rule.debugColor,
                        borderWidth: 0.5,
                        borderColor: 'rgba(255,255,255,0.08)',
                        alignItems: 'center',
                        justifyContent: 'center',
                      }}
                    >
                      <PixelText size={10} color={'#ffffff'} bold>{rule.debugLabel}</PixelText>
                    </View>
                  );
                }),
              )}
            </View>
          )}

          {/* Animated drawbridge at the throne chamber south entrance (9,5).
              Lowers as the player approaches and raises again when they walk away.
              Plays a heavy thud SFX when it crosses the lowered threshold. */}
          {(() => {
            const BRIDGE_X = 9;
            const BRIDGE_Y = 5;
            // Distance from player tile to the bridge tile (Chebyshev so the
            // animation feels "near" along corridors as well as diagonals).
            const px = Math.round(posRef.current.px / TILE);
            const py = Math.round(posRef.current.py / TILE);
            const dist = Math.max(Math.abs(px - BRIDGE_X), Math.abs(py - BRIDGE_Y));
            // 0 tiles → fully lowered (1.0), 4+ tiles → fully raised (0.0).
            const proximity = Math.max(0, Math.min(1, (4 - dist) / 4));
            // Trigger thud SFX once when the bridge transitions from raised→lowered.
            if (proximity > 0.95 && !bridgeThudFiredRef.current) {
              bridgeThudFiredRef.current = true;
              sfx.drawbridge();
            } else if (proximity < 0.3) {
              bridgeThudFiredRef.current = false;
            }
            return (
              <View
                style={{
                  position: 'absolute',
                  left: BRIDGE_X * TILE,
                  top: BRIDGE_Y * TILE,
                  width: TILE,
                  height: TILE,
                  zIndex: 2,
                }}
                pointerEvents="none"
              >
                <Drawbridge tile={TILE} proximity={proximity} />
              </View>
            );
          })()}
          {/* NPCs — actual sprite + clean centered nameplate */}
          {Object.entries(NPCS).map(([id, npc]) => {
            const npcSprite =
              id === 'npc_orion' ? SPRITE_ASSETS.npcOrion :
              id === 'npc_jax' ? SPRITE_ASSETS.npcJax :
              id === 'npc_lyra' ? SPRITE_ASSETS.npcLyra : null;
            const W = TILE * 1.4;
            const H = TILE * 1.9;
            const npcFaction = FACTIONS.npc_friendly;
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
                  <UnifiedSprite
                    uri={npcSprite}
                    faction={npcFaction}
                    size={W}
                    tick={animTick + id.charCodeAt(id.length - 1)}
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
          {/* Roaming enemies — academy scouts, Quantum Minions (phreak/vrghost/mech),
              and a mech mini-boss. The sprite is resolved dynamically per-roamer
              so each species shows its own art in the overworld.  */}
          {roamers.map((r) => {
            // Single source of truth: same enemyId → same sprite + faction
            // in overworld and combat. The cyber-pack override and faction
            // resolution live entirely inside getEnemyVisual().
            const visual = getEnemyVisual(r.enemyId, { forceBoss: !!r.boss });
            const W = TILE * 1.15 * visual.scale;
            const H = W;
            // Per-roamer phase based on uid + animTick → asynchronous gait
            const uidHash = r.uid.split('').reduce((a, c) => a + c.charCodeAt(0), 0);
            const tickPhase = animTick + uidHash;
            const swingPhase = tickPhase * 0.6;
            return (
              <View
                key={r.uid}
                style={{
                  position: 'absolute',
                  left: r.x * TILE + (TILE - W) / 2,
                  top: r.y * TILE + (TILE - H) / 2 - 4,
                  width: W,
                  height: H,
                  zIndex: visual.isBoss ? 6 : 5,
                }}
                pointerEvents="none"
              >
                <UnifiedSprite
                  uri={visual.uri}
                  faction={visual.faction}
                  size={W}
                  tick={animTick + uidHash}
                />
                {/* WildMinionAI "!" alert icon */}
                {(r.state === 'Chasing' || r.state === 'Alerted') && (
                  <View
                    pointerEvents="none"
                    style={{
                      position: 'absolute',
                      top: -16 + Math.sin(swingPhase * 1.6) * 2,
                      left: W / 2 - 7,
                      width: 14,
                      height: 18,
                      backgroundColor: '#1a0a0a',
                      borderWidth: 1.5,
                      borderColor: visual.faction.glowColor,
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Text style={{ color: '#ff5555', fontSize: 11, fontWeight: 'bold' }}>!</Text>
                  </View>
                )}
              </View>
            );
          })}
          {/* Player sprite — real spritesheet via <SheetSprite>.
              Walk loop = [left-step, idle, right-step, idle] driven by `animTick`.
              Animation only plays while moving; idle frame snaps when joystick released.
              Frames are pre-cropped, equal-size, transparent — see
              /app/backend/scripts/process_adhamb_sheet.py.
              Swap the active sheet later by adding a key in SHEETS and passing it. */}
          {(() => {
            // SheetSprite frames are square (319×319). Render slightly larger than
            // a tile so the chibi reads clearly while still feeling Pokémon-Emerald
            // proportioned (~1×1 tile + a smidge of headroom).
            const SIZE = TILE * 1.55;
            const isMoving = dirRef.current.x !== 0 || dirRef.current.y !== 0;
            const playerFaction = FACTIONS.player;
            return (
              <View
                style={{
                  position: 'absolute',
                  // Centre on the feet anchor: half size left, ~75% size up.
                  left: posRef.current.px - SIZE / 2,
                  top: posRef.current.py - SIZE * 0.78,
                  width: SIZE,
                  height: SIZE,
                  zIndex: 9999,
                  ...(Platform.OS === 'android' ? { elevation: 30 } : {}),
                }}
                pointerEvents="none"
              >
                {/* Friendly player halo — absolutely positioned so it never
                    pushes the SheetSprite out of place. Sits just under the
                    chibi's feet. */}
                <View
                  pointerEvents="none"
                  style={{
                    position: 'absolute',
                    bottom: SIZE * 0.08,
                    left: SIZE * 0.125,
                    width: SIZE * 0.75,
                    height: SIZE * 0.18,
                    borderRadius: SIZE * 0.5,
                    backgroundColor: playerFaction.innerGlow,
                    ...(Platform.OS === 'web'
                      ? { boxShadow: `0 0 20px 4px ${playerFaction.innerGlow}` } as any
                      : {
                          shadowColor: playerFaction.glowColor,
                          shadowOpacity: 0.6,
                          shadowRadius: 12,
                          shadowOffset: { width: 0, height: 0 },
                        }),
                  }}
                />
                <SheetSprite
                  sheet="adhamb"
                  dir={facingRef.current}
                  tick={animTick}
                  moving={isMoving}
                  size={SIZE}
                  framesPerStep={3}
                />
              </View>
            );
          })()}
        </View>

        {/* Cinematic vignette — soft edge darkening over the viewport so the
            scene has depth without ever obscuring the characters at the centre.
            Opacities pulled WAY down from the previous pass (was 0.45/0.22/0.10
            top + 0.18 sides → players reported the cast looked almost invisible). */}
        <View
          style={{
            position: 'absolute',
            top: 0, left: 0, right: 0, height: 32,
          }}
          pointerEvents="none"
        >
          <View style={{ height: 12, backgroundColor: 'rgba(0,0,0,0.18)' }} />
          <View style={{ height: 10, backgroundColor: 'rgba(0,0,0,0.09)' }} />
          <View style={{ height: 10, backgroundColor: 'rgba(0,0,0,0.04)' }} />
        </View>
        <View
          style={{
            position: 'absolute',
            bottom: 0, left: 0, right: 0, height: 32,
          }}
          pointerEvents="none"
        >
          <View style={{ height: 10, backgroundColor: 'rgba(0,0,0,0.04)' }} />
          <View style={{ height: 10, backgroundColor: 'rgba(0,0,0,0.09)' }} />
          <View style={{ height: 12, backgroundColor: 'rgba(0,0,0,0.18)' }} />
        </View>
        {/* Side bars stripped entirely — they were the worst offender for
            washing out the character and roaming enemies. */}

        {/* ── ATMOSPHERE LAYER ── Code-driven cyberpunk-decay ambience. */}
        <AtmosphereLayer width={SW} height={VIEWPORT_HEIGHT} intensity="subtle" />
      </View>

      {/* Top HUD - status row + action shortcuts row */}
      <View style={styles.hud} testID="hud-status">
        <View style={styles.hudStatusRow}>
          <View style={styles.hudLeft}>
            {(() => {
              // Auto-truncate long player names so they never wrap mid-word.
              // 12 chars + ellipsis is the readable ceiling at size=10 in our
              // pixel font. PLAYWRIGHTRUNNER → PLAYWRIGHTRU…
              const n = state.player.name.toUpperCase();
              const display = n.length > 13 ? n.slice(0, 12) + '…' : n;
              return (
                <PixelText size={10} color={COLORS.neonCyan} bold numberOfLines={1}>
                  {display}
                </PixelText>
              );
            })()}
            <PixelText size={7} color={COLORS.textDim} style={{ marginTop: 2 }}>LV{state.player.level} · S{state.player.syncLevel}</PixelText>
          </View>
          {(() => {
            // STABILITY low-warning pulse: tint the bar magenta-red when
            // below 25% so the player sees danger at a glance. Driven by
            // animTick so it pulses 2 Hz.
            const hpPct = state.player.hp / Math.max(1, state.player.maxHp);
            const lowStab = hpPct < 0.25;
            const pulse = lowStab ? 0.55 + 0.45 * Math.abs(Math.sin(animTick * 0.6)) : 1;
            return (
              <View style={[styles.hudBars, { opacity: pulse }]}>
                <StatBar
                  value={state.player.hp}
                  max={state.player.maxHp}
                  color={lowStab ? '#ff4566' : COLORS.hp}
                  bgColor={COLORS.hpBg}
                  width={110}
                  height={8}
                  showText={false}
                />
                <View style={{ height: 2 }} />
                <StatBar value={state.player.mp} max={state.player.maxMp} color={COLORS.mp} bgColor={COLORS.mpBg} width={110} height={8} showText={false} />
              </View>
            );
          })()}
          <View style={styles.hudRight}>
            <PixelText size={9} color={COLORS.neonYellow} bold>{state.player.gold}G</PixelText>
            <PixelText size={7} color={COLORS.xp} style={{ marginTop: 2 }}>DATA{state.player.xp}/{state.player.xpToNext}</PixelText>
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
            style={[styles.shortcutBtn, { borderColor: '#c46cff' }]}
            onPress={() => { sfx.click(); router.push('/operator-framework'); }}
            testID="hud-synergy"
          >
            <PixelText size={9} color={'#c46cff'} bold>SYNERGY</PixelText>
            {(state.player.synergyPoints ?? 0) > 0 && (
              <View style={styles.spDot}><PixelText size={8} color="#000" bold>{state.player.synergyPoints}</PixelText></View>
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
        onMove={(dx, dy) => {
          // Pokémon-style 4-way movement at FULL SPEED regardless of how far
          // the user pushes the knob. The joystick reports normalised -1..1
          // values, so a half-push previously gave half-speed walking — that's
          // why traversal felt sluggish. We snap to the dominant axis ±1 with
          // a small dead-zone so accidental tilts don't trigger movement.
          const adx = Math.abs(dx);
          const ady = Math.abs(dy);
          const mag = Math.max(adx, ady);
          if (mag < 0.18) {
            dirRef.current = { x: 0, y: 0 };
            return;
          }
          let snapX = 0;
          let snapY = 0;
          if (adx > ady) {
            snapX = dx < 0 ? -1 : 1;
            facingRef.current = dx < 0 ? 'left' : 'right';
          } else {
            snapY = dy < 0 ? -1 : 1;
            facingRef.current = dy < 0 ? 'up' : 'down';
          }
          dirRef.current = { x: snapX, y: snapY };
        }}
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
            <View style={styles.menuStat}><PixelText size={10} color={COLORS.textDim}>STAB</PixelText><PixelText size={10} color={COLORS.hp}>{state.player.hp}/{state.player.maxHp}</PixelText></View>
            <View style={styles.menuStat}><PixelText size={10} color={COLORS.textDim}>PWR</PixelText><PixelText size={10} color={COLORS.mp}>{state.player.mp}/{state.player.maxMp}</PixelText></View>
            <View style={styles.menuStat}><PixelText size={10} color={COLORS.textDim}>ATK / DEF / SPD</PixelText><PixelText size={10} color={COLORS.text}>{state.player.atk}/{state.player.def}/{state.player.spd}</PixelText></View>
            <View style={styles.menuStat}><PixelText size={10} color={COLORS.textDim}>GOLD</PixelText><PixelText size={10} color={COLORS.neonYellow}>{state.player.gold}G</PixelText></View>
            <View style={styles.menuStat}><PixelText size={10} color={COLORS.textDim}>SKILL POINTS</PixelText><PixelText size={10} color={COLORS.neonMagenta}>{state.player.skillPoints}</PixelText></View>

            <View style={{ height: 14 }} />
            <PixelButton title="SKILL TREE" onPress={() => { setPauseOpen(false); router.push('/skills'); }} color={COLORS.neonMagenta} full />
            <View style={{ height: 6 }} />
            <PixelButton title="SYNERGY GRID" onPress={() => { setPauseOpen(false); router.push('/operator-framework'); }} color={'#c46cff'} full />
            <View style={{ height: 8 }} />
            <PixelButton title="INVENTORY" onPress={() => { setPauseOpen(false); router.push('/inventory'); }} color={COLORS.neonCyan} full />
            <View style={{ height: 8 }} />
            <PixelButton title="QUANTUM REGISTRY" onPress={() => { setPauseOpen(false); router.push('/registry'); }} color={COLORS.neonYellow} full />
            <View style={{ height: 8 }} />
            <PixelButton title="HOW TO PLAY" onPress={() => { setPauseOpen(false); router.push('/how-to-play'); }} color={COLORS.neonCyan} full />
            <View style={{ height: 8 }} />
            <PixelButton title="SAVE CHECKPOINT" onPress={handleSave} color={COLORS.neonYellow} full />
            <View style={{ height: 8 }} />
            <PixelButton title="QUIT TO TITLE" onPress={() => { setPauseOpen(false); router.replace('/'); }} color={COLORS.textDim} full />
            <View style={{ height: 12 }} />
            <PixelButton title="RESUME" onPress={() => setPauseOpen(false)} color={COLORS.neonCyan} size="lg" full />
          </ScrollView>
        </View>
      </Modal>
      {/* ── ONBOARDING TUTORIAL PROMPTS ──────────────────────────
          intro_sync   — first launch (NETWORK CONTACT)
          controls_tip — first overworld load (INTERFACE BOUND)
          synergy_intro shown ONLY when player has at least one
          unspent synergy point — keeps it contextual to the moment
          the SYNERGY GRID button actually starts pulsing. */}
      <SystemPrompt flag="intro_sync" />
      <SystemPrompt flag="controls_tip" />
      {(state.player.synergyPoints ?? 0) > 0 && <SystemPrompt flag="synergy_intro" />}
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

  // Floor tile → CyberTile pavement with corruption / road-stripe variants
  // for cohesive ruined-cyberpunk-district look. Walkability unchanged.
  if (type === 0) {
    const key = `${x},${y}`;
    let kind: 'pavement' | 'corruption' | 'road-marking' = 'pavement';
    if (CORRUPTION_SET.has(key)) kind = 'corruption';
    else if (ROAD_SET.has(key))  kind = 'road-marking';
    return (
      <View style={[styles.tile, { width: TILE, height: TILE }]}>
        <CyberTile kind={kind} size={TILE} x={x} y={y} />
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
