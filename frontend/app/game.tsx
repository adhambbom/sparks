import React, { useEffect, useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, ScrollView, Modal, TouchableOpacity } from 'react-native';
import { router, useFocusEffect } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS, ACADEMY_MAP, NPCS, ENCOUNTER_POOLS, ENEMIES, HOUSES } from '../src/data/gameData';
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
const SPEED = 4; // pixels per frame
const ENCOUNTER_CHANCE = 0.0; // disabled - using visible roaming enemies instead
const ROAM_TICK_MS = 900; // how often each roamer tries to move
const MAX_ROAMERS = 5;
const CHASE_RADIUS = 4; // tiles - if player within this, enemy chases

const { width: SW, height: SH } = Dimensions.get('window');

type Dialog = { name: string; lines: string[]; line: number } | null;
type Roamer = { uid: string; enemyId: string; x: number; y: number; chasing?: boolean };

function isFloor(x: number, y: number): boolean {
  if (y < 0 || y >= ACADEMY_MAP.length) return false;
  if (x < 0 || x >= ACADEMY_MAP[0].length) return false;
  const t = ACADEMY_MAP[y][x];
  // Walkable tiles: floor (0), npc (3), trial doors, store, skill chamber, arena, sapphire core (9), spike (8), console (10)
  // Walls (1) and debris (11) block movement
  return t !== 1 && t !== 11;
}

function randomFloorTile(avoidX: number, avoidY: number, occupied: Set<string>): { x: number; y: number } | null {
  for (let i = 0; i < 50; i++) {
    const x = Math.floor(Math.random() * (ACADEMY_MAP[0].length - 2)) + 1;
    const y = Math.floor(Math.random() * (ACADEMY_MAP.length - 2)) + 1;
    if (!isFloor(x, y)) continue;
    if (Math.abs(x - avoidX) < 3 && Math.abs(y - avoidY) < 3) continue;
    if (occupied.has(`${x},${y}`)) continue;
    return { x, y };
  }
  return null;
}

export default function GameScreen() {
  const { user, loading: authLoading } = useAuth();
  const { state, setState, loadFromServer, setPosition, saveCheckpoint, applyHeal, addItem } = useGame();
  const [loaded, setLoaded] = useState(false);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [pauseOpen, setPauseOpen] = useState(false);
  const [hint, setHint] = useState('');
  const dirRef = useRef({ x: 0, y: 0 });
  const lastTileRef = useRef({ x: 0, y: 0 });
  // pixel position; tile = floor(p/TILE)
  const posRef = useRef({ px: 0, py: 0 });
  const [renderTick, setRenderTick] = useState(0);
  // Roaming enemies state
  const [roamers, setRoamers] = useState<Roamer[]>([]);
  const roamersRef = useRef<Roamer[]>([]);
  const engagingRef = useRef(false);
  const [skillPanelOpen, setSkillPanelOpen] = useState(false);

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
      const tx = s.world.position.x;
      const ty = s.world.position.y;
      posRef.current = { px: tx * TILE + TILE / 2, py: ty * TILE + TILE / 2 };
      lastTileRef.current = { x: tx, y: ty };
      // Spawn roaming enemies on floor tiles, away from player
      const occupied = new Set<string>();
      const placed: Roamer[] = [];
      const pool = ENCOUNTER_POOLS.academy;
      for (let i = 0; i < MAX_ROAMERS; i++) {
        const spot = randomFloorTile(tx, ty, occupied);
        if (!spot) break;
        occupied.add(`${spot.x},${spot.y}`);
        const enemyId = pool[Math.floor(Math.random() * pool.length)];
        placed.push({ uid: `r${Date.now()}_${i}`, enemyId, x: spot.x, y: spot.y });
      }
      roamersRef.current = placed;
      setRoamers(placed);
      engagingRef.current = false;
      setLoaded(true);
    })();
  }, [user]);

  // Re-spawn enemies on focus (after returning from combat)
  useFocusEffect(
    React.useCallback(() => {
      if (!loaded) return;
      // If we returned from a combat win, the engaged enemy was already removed.
      engagingRef.current = false;
      // Top up roamers if any were defeated, after a short delay
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
      }, 1200);
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
        const np = {
          px: posRef.current.px + dx * SPEED,
          py: posRef.current.py + dy * SPEED,
        };
        const tx = Math.floor(np.px / TILE);
        const ty = Math.floor(np.py / TILE);
        // Bounds + wall collision
        if (
          ty >= 0 && ty < ACADEMY_MAP.length &&
          tx >= 0 && tx < ACADEMY_MAP[0].length &&
          ACADEMY_MAP[ty][tx] !== 1
        ) {
          posRef.current = np;
          // Check tile change
          if (tx !== lastTileRef.current.x || ty !== lastTileRef.current.y) {
            lastTileRef.current = { x: tx, y: ty };
            onTileChange(tx, ty);
            // Roamer collision check
            if (!engagingRef.current) {
              const hit = roamersRef.current.find(r => r.x === tx && r.y === ty);
              if (hit) {
                engagingRef.current = true;
                // remove engaged roamer (defeated optimistically; respawns on focus if needed)
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

  const camX = posRef.current.px - SW / 2;
  const camY = posRef.current.py - SH / 2 - 80;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* World viewport */}
      <View style={styles.world} testID="game-world">
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
                <Tile key={`${x}-${y}`} type={cell} />
              ))}
            </View>
          ))}
          {/* NPCs */}
          {Object.entries(NPCS).map(([id, npc]) => (
            <View key={id} style={[styles.npc, { left: npc.x * TILE + 6, top: npc.y * TILE + 4 }]}>
              <View style={styles.npcSprite}>
                <PixelText size={10} color="#fff" bold>!</PixelText>
              </View>
              <PixelText size={8} color={COLORS.neonYellow} style={{ marginTop: 2 }}>
                {npc.name.split(' ')[0].toUpperCase()}
              </PixelText>
            </View>
          ))}
          {/* Player sprite - layered cyborg look */}
          <View style={[
            styles.player,
            { left: posRef.current.px - 14, top: posRef.current.py - 20 },
          ]}>
            {/* Visor band */}
            <View style={styles.playerVisor} />
            {/* Head */}
            <View style={styles.playerHead} />
            {/* Body / armor */}
            <View style={[styles.playerBody, { backgroundColor: HOUSES?.[(state.player.house as any) || 'obsidian']?.color || COLORS.neonCyan }]}>
              {/* Chest accent */}
              <View style={styles.playerChestAccent} />
            </View>
            {/* Legs */}
            <View style={styles.playerLegs} />
          </View>
        </View>
      </View>

      {/* Top HUD */}
      <View style={styles.hud}>
        <View style={styles.hudLeft}>
          <PixelText size={12} color={COLORS.neonCyan} bold>{state.player.name.toUpperCase()}</PixelText>
          <PixelText size={9} color={COLORS.textDim}>LV {state.player.level} · SYNC {state.player.syncLevel}</PixelText>
        </View>
        <View style={styles.hudBars}>
          <StatBar label="HP" value={state.player.hp} max={state.player.maxHp} color={COLORS.hp} bgColor={COLORS.hpBg} width={120} height={10} />
          <View style={{ height: 4 }} />
          <StatBar label="MP" value={state.player.mp} max={state.player.maxMp} color={COLORS.mp} bgColor={COLORS.mpBg} width={120} height={10} />
        </View>
        <View style={styles.hudRight}>
          <PixelText size={10} color={COLORS.neonYellow} bold>{state.player.gold}G</PixelText>
          <PixelText size={9} color={COLORS.xp}>XP {state.player.xp}/{state.player.xpToNext}</PixelText>
        </View>
      </View>

      {/* Top action shortcuts */}
      <View style={styles.topShortcuts}>
        <TouchableOpacity
          style={[styles.shortcutBtn, { borderColor: COLORS.neonCyan }]}
          onPress={() => { sfx.click(); router.push('/inventory'); }}
          testID="hud-inventory"
        >
          <PixelText size={10} color={COLORS.neonCyan} bold>BAG</PixelText>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.shortcutBtn, { borderColor: COLORS.neonMagenta }]}
          onPress={() => { sfx.click(); router.push('/skills'); }}
          testID="hud-skills"
        >
          <PixelText size={10} color={COLORS.neonMagenta} bold>SKILLS</PixelText>
          {state.player.skillPoints > 0 && (
            <View style={styles.spDot}><PixelText size={8} color="#000" bold>{state.player.skillPoints}</PixelText></View>
          )}
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.shortcutBtn, { borderColor: COLORS.neonYellow }]}
          onPress={() => { sfx.click(); router.push('/store'); }}
          testID="hud-store"
        >
          <PixelText size={10} color={COLORS.neonYellow} bold>STORE</PixelText>
        </TouchableOpacity>
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

function Tile({ type }: { type: number }) {
  let bg = COLORS.bgDark;
  let inner: any = null;
  if (type === 0) bg = '#1e1e2e'; // floor - dark stone
  else if (type === 1) bg = '#2a2438'; // wall - stone
  else if (type === 5) { bg = '#2a1a3e'; inner = <PixelText size={14} color={COLORS.neonYellow} bold>$</PixelText>; }
  else if (type === 6) { bg = '#1a2a3e'; inner = <PixelText size={14} color={COLORS.neonMagenta} bold>★</PixelText>; }
  else if (type === 4) { bg = '#3e1a1a'; inner = <PixelText size={14} color={COLORS.neonRed} bold>↑</PixelText>; }
  else if (type === 2) { bg = '#3e2a1a'; inner = <PixelText size={12} color={COLORS.neonMagenta} bold>⚠</PixelText>; }
  else if (type === 7) { bg = '#3e0a3e'; inner = <PixelText size={12} color={COLORS.neonMagenta} glow bold>⚠</PixelText>; }
  else if (type === 8) { bg = '#3a1010'; inner = <PixelText size={14} color={COLORS.neonRed} bold>▲▲</PixelText>; }
  else if (type === 9) { bg = '#0a1838'; inner = <PixelText size={20} color={COLORS.neonCyan} glow bold>◆</PixelText>; }
  else if (type === 10) { bg = '#1a3a3a'; inner = <PixelText size={14} color={COLORS.neonGreen} glow bold>⚙</PixelText>; }
  else if (type === 11) { bg = '#1a1418'; inner = <PixelText size={14} color={COLORS.textDim} bold>▓▓</PixelText>; }
  return (
    <View style={[styles.tile, { backgroundColor: bg, width: TILE, height: TILE }]}>
      {type === 1 && <View style={styles.wallInner} />}
      {type === 0 && <View style={styles.floorDot} />}
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
  floorDot: { position: 'absolute', width: 2, height: 2, backgroundColor: 'rgba(100,100,180,0.3)' },
  player: {
    position: 'absolute',
    width: 28, height: 40,
    alignItems: 'center', justifyContent: 'flex-start',
  },
  playerHead: {
    width: 14, height: 12,
    backgroundColor: '#ffd5b3',
    borderWidth: 1, borderColor: '#000',
  },
  playerVisor: {
    position: 'absolute',
    top: 4, width: 16, height: 3,
    backgroundColor: '#00f0ff',
    zIndex: 5,
    shadowColor: '#00f0ff', shadowOpacity: 1, shadowRadius: 4,
  },
  playerBody: {
    width: 22, height: 16,
    borderWidth: 1, borderColor: '#000',
    marginTop: -1,
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#fff', shadowOpacity: 0.3, shadowRadius: 4,
  },
  playerChestAccent: {
    width: 6, height: 4,
    backgroundColor: '#ffd700',
    borderWidth: 1, borderColor: '#000',
  },
  playerLegs: {
    width: 16, height: 8,
    backgroundColor: '#202030',
    borderWidth: 1, borderColor: '#000',
    marginTop: -1,
  },
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
    width: TILE - 8, height: TILE - 8,
    alignItems: 'center', justifyContent: 'center',
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
    position: 'absolute', top: 175, right: 12,
    flexDirection: 'row', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end', maxWidth: 250,
  },
  shortcutBtn: {
    backgroundColor: 'rgba(10,10,20,0.85)',
    borderWidth: 2, paddingHorizontal: 10, paddingVertical: 6,
  },
  spDot: {
    position: 'absolute', top: -6, right: -6,
    width: 16, height: 16, borderRadius: 8,
    backgroundColor: COLORS.neonMagenta,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: '#000',
  },
  hud: {
    position: 'absolute', top: 90, left: 12, right: 12,
    flexDirection: 'row', justifyContent: 'space-between',
    backgroundColor: 'rgba(10,10,20,0.85)',
    borderWidth: 1, borderColor: COLORS.borderHi,
    padding: 8, gap: 8,
  },
  objective: {
    position: 'absolute', top: 50, left: 12, right: 12,
    backgroundColor: 'rgba(10,10,20,0.92)',
    borderWidth: 1, borderColor: COLORS.neonMagenta,
    paddingHorizontal: 12, paddingVertical: 6,
    alignItems: 'center',
    shadowColor: COLORS.neonMagenta, shadowOpacity: 0.5, shadowRadius: 8,
  },
  hudLeft: { flex: 1 },
  hudBars: { width: 130 },
  hudRight: { alignItems: 'flex-end' },
  hint: {
    position: 'absolute', top: 175, alignSelf: 'center',
    backgroundColor: 'rgba(10,10,20,0.9)',
    borderWidth: 1, borderColor: COLORS.neonGreen,
    paddingHorizontal: 12, paddingVertical: 6,
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
