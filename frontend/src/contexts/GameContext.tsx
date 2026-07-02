import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { api } from '../utils/api';
import { ITEMS, ABILITIES, xpForNextLevel } from '../data/gameData';
import type { CapturedMinion } from '../systems/QuantumStorage';
import { routeToStorage, summarizeRegistry } from '../systems/QuantumStorage';
import { applyEntityXp, entityXpToNext } from '../data/entityProgression';

export type GameState = {
  player: {
    name: string;
    house?: string;
    level: number;
    xp: number;
    xpToNext: number;
    hp: number;
    maxHp: number;
    mp: number;
    maxMp: number;
    atk: number;
    def: number;
    spd: number;
    syncLevel: number;
    gold: number;
    skillPoints: number;
    abilities: string[];
    /** Operator Framework — synergy nodes that buff deployed entities. */
    synergyNodes?: string[];
    /** Points spent on synergy tree (separate pool from skillPoints). */
    synergyPoints?: number;
    equipped: { weapon: string; armor: string };
    inventory: { id: string; qty: number }[];
  };
  world: {
    currentMap: string;
    position: { x: number; y: number };
    completedTrials: string[];
    arenaUnlocked: boolean;
    arenaBestWave: number;
  };
  // ─── Quantum Taming slice ─────────────────────────────────────────
  // Optional so existing saves load without migration. Read sites use
  // `?? []` to default when absent.
  quantum?: QuantumState;
  lastSaved?: string;
};

export type QuantumState = {
  /** Up to MAX_PARTY (6) actively deployable minions. */
  party: CapturedMinion[];
  /** Overflow when party is full \u2014 lives on the server, hot-swappable. */
  extendedStorage: CapturedMinion[];
  /** Species ids ever encountered (whether captured or not). */
  seenSpecies: string[];
  /** Species ids captured at least once \u2014 derived but cached for speed. */
  capturedSpecies: string[];
};

type GameCtx = {
  state: GameState | null;
  setState: (s: GameState) => void;
  loadFromServer: () => Promise<GameState | null>;
  saveToServer: () => Promise<void>;
  saveCheckpoint: () => Promise<void>;
  restoreCheckpoint: () => Promise<GameState | null>;
  createCharacter: (name: string, house?: string) => Promise<GameState>;
  applyDamage: (dmg: number) => void;
  applyHeal: (amt: number) => void;
  applyMpCost: (mp: number) => void;
  addItem: (id: string, qty?: number) => void;
  removeItem: (id: string, qty?: number) => void;
  addGold: (amount: number) => void;
  awardXp: (xp: number) => boolean; // returns true if leveled up
  unlockAbility: (id: string) => void;
  unlockSynergyNode: (id: string) => boolean;
  awardEntityXp: (uid: string, amount: number) => { leveled: boolean; gained: number; level: number };
  equip: (slot: 'weapon' | 'armor', itemId: string) => void;
  setPosition: (x: number, y: number) => void;
  // ─── Quantum Taming ──────────────────────────────────────────────
  addCapturedMinion: (m: CapturedMinion) => { slot: 'party' | 'extended' };
  markSpeciesSeen: (speciesId: string) => void;
  swapPartyMinion: (partyIndex: number, storageIndex: number) => void;
  releaseMinion: (uid: string) => void;
};

const Ctx = createContext<GameCtx>({} as GameCtx);
export const useGame = () => useContext(Ctx);

export function GameProvider({ children }: { children: React.ReactNode }) {
  const [state, setStateInternal] = useState<GameState | null>(null);
  const stateRef = useRef<GameState | null>(null);

  const setState = useCallback((s: GameState) => {
    stateRef.current = s;
    setStateInternal(s);
  }, []);

  const loadFromServer = useCallback(async () => {
    try {
      const { data } = await api.get('/character/me');
      if (data.has_character && data.state) {
        setState(data.state);
        return data.state as GameState;
      }
      return null;
    } catch (e: any) {
      // ── 401 fallback: trigger automation-bypass then retry ──────────
      // On a hard refresh to a sub-route the auth cookie may not yet be
      // rehydrated. The web build runs in automation mode and the
      // backend exposes /auth/automation-bypass for exactly this case.
      // Idempotent — silently swallows non-401 errors.
      if (e?.response?.status === 401) {
        try {
          await api.post('/auth/automation-bypass');
          const { data } = await api.get('/character/me');
          if (data?.has_character && data?.state) {
            setState(data.state);
            return data.state as GameState;
          }
        } catch { /* silent */ }
      }
      return null;
    }
  }, [setState]);

  // ── AUTO-LOAD ON MOUNT ─────────────────────────────────────────────
  // Previously the GameContext only filled in state when game.tsx
  // explicitly called loadFromServer() on mount. Any direct-navigation
  // to a sub-route like /operator-framework or /skills would hang on a
  // "Loading…" placeholder because nothing kicked off the fetch.
  // We now self-load on mount — idempotent, cheap, and unblocks
  // every screen that depends on state being present.
  React.useEffect(() => {
    if (stateRef.current) return;
    void loadFromServer();
  }, [loadFromServer]);

  const saveToServer = useCallback(async () => {
    if (!stateRef.current) return;
    try {
      await api.post('/game/save', { state: stateRef.current });
    } catch (e) {
      // Production-safe: gated to dev so the release bundle stays
      // free of console noise on transient network failures.
      if (__DEV__) console.warn('save failed', e);
    }
  }, []);

  const saveCheckpoint = useCallback(async () => {
    if (!stateRef.current) return;
    try {
      await api.post('/game/checkpoint', { state: stateRef.current });
    } catch (e) {
      if (__DEV__) console.warn('checkpoint failed', e);
    }
  }, []);

  const restoreCheckpoint = useCallback(async () => {
    try {
      const { data } = await api.post('/game/restore-checkpoint');
      if (data.state) {
        setState(data.state);
        return data.state as GameState;
      }
    } catch {}
    return null;
  }, [setState]);

  const createCharacter = useCallback(async (name: string, house: string = 'obsidian') => {
    const { data } = await api.post('/character/create', { name, house });
    setState(data.state);
    return data.state as GameState;
  }, [setState]);

  // ---- mutations ----
  const recompute = (s: GameState): GameState => {
    const weapon = ITEMS[s.player.equipped.weapon];
    const armor = ITEMS[s.player.equipped.armor];
    const baseAtk = 12 + (s.player.level - 1) * 2;
    const baseDef = 8 + (s.player.level - 1) * 1;
    return {
      ...s,
      player: {
        ...s.player,
        atk: baseAtk + (weapon?.effect?.atk || 0),
        def: baseDef + (armor?.effect?.def || 0),
      },
    };
  };

  const applyDamage = (dmg: number) => {
    if (!stateRef.current) return;
    const next = { ...stateRef.current };
    next.player = { ...next.player, hp: Math.max(0, next.player.hp - dmg) };
    setState(next);
  };

  const applyHeal = (amt: number) => {
    if (!stateRef.current) return;
    const next = { ...stateRef.current };
    next.player = { ...next.player, hp: Math.min(next.player.maxHp, next.player.hp + amt) };
    setState(next);
  };

  const applyMpCost = (mp: number) => {
    if (!stateRef.current) return;
    const next = { ...stateRef.current };
    next.player = { ...next.player, mp: Math.max(0, next.player.mp - mp) };
    setState(next);
  };

  const addItem = (id: string, qty: number = 1) => {
    if (!stateRef.current) return;
    const next = { ...stateRef.current };
    const inv = [...next.player.inventory];
    const idx = inv.findIndex(i => i.id === id);
    if (idx >= 0) inv[idx] = { ...inv[idx], qty: inv[idx].qty + qty };
    else inv.push({ id, qty });
    next.player = { ...next.player, inventory: inv };
    setState(next);
  };

  const removeItem = (id: string, qty: number = 1) => {
    if (!stateRef.current) return;
    const next = { ...stateRef.current };
    const inv = [...next.player.inventory];
    const idx = inv.findIndex(i => i.id === id);
    if (idx >= 0) {
      const newQty = inv[idx].qty - qty;
      if (newQty <= 0) inv.splice(idx, 1);
      else inv[idx] = { ...inv[idx], qty: newQty };
    }
    next.player = { ...next.player, inventory: inv };
    setState(next);
  };

  const addGold = (amount: number) => {
    if (!stateRef.current) return;
    const next = { ...stateRef.current };
    next.player = { ...next.player, gold: Math.max(0, next.player.gold + amount) };
    setState(next);
  };

  const awardXp = (xp: number): boolean => {
    if (!stateRef.current) return false;
    let next = { ...stateRef.current };
    let newXp = next.player.xp + xp;
    let level = next.player.level;
    let xpToNext = next.player.xpToNext;
    let sp = next.player.skillPoints;
    let maxHp = next.player.maxHp;
    let maxMp = next.player.maxMp;
    let leveled = false;
    while (newXp >= xpToNext) {
      newXp -= xpToNext;
      level += 1;
      sp += 1;
      maxHp += 12;
      maxMp += 6;
      xpToNext = xpForNextLevel(level);
      leveled = true;
    }
    next.player = {
      ...next.player,
      xp: newXp,
      level,
      xpToNext,
      skillPoints: sp,
      // Operator synergy points: 1 per level-up (legacy saves use ?? 0).
      synergyPoints: leveled
        ? (next.player.synergyPoints ?? 0) + (level - next.player.level + (next.player.synergyPoints === undefined ? 1 : 1) - 1)
        : (next.player.synergyPoints ?? 0),
      maxHp,
      maxMp,
      hp: leveled ? maxHp : next.player.hp,
      mp: leveled ? maxMp : next.player.mp,
      syncLevel: Math.max(next.player.syncLevel, level),
    };
    next = recompute(next);
    if (next.player.syncLevel >= 5) next.world = { ...next.world, arenaUnlocked: true };
    setState(next);
    return leveled;
  };

  const unlockAbility = (id: string) => {
    if (!stateRef.current) return;
    const next = { ...stateRef.current };
    if (next.player.abilities.includes(id)) return;
    if (next.player.skillPoints <= 0) return;
    if (!ABILITIES[id]) return;
    next.player = {
      ...next.player,
      abilities: [...next.player.abilities, id],
      skillPoints: next.player.skillPoints - 1,
    };
    setState(next);
  };

  // ─── Operator Synergy Framework ───────────────────────────────────
  // Spends 1 synergyPoint to unlock a node. Returns true on success.
  // The validation (prereq / reqLevel) is done at the call site so this
  // mutator stays cheap + atomic. Persisted on next saveToServer().
  const unlockSynergyNode = (id: string): boolean => {
    if (!stateRef.current) return false;
    const next = { ...stateRef.current };
    const owned = next.player.synergyNodes ?? [];
    if (owned.includes(id)) return false;
    const points = next.player.synergyPoints ?? 0;
    if (points <= 0) return false;
    next.player = {
      ...next.player,
      synergyNodes: [...owned, id],
      synergyPoints: points - 1,
    };
    setState(next);
    return true;
  };

  const equip = (slot: 'weapon' | 'armor', itemId: string) => {
    if (!stateRef.current) return;
    let next = { ...stateRef.current };
    next.player = {
      ...next.player,
      equipped: { ...next.player.equipped, [slot]: itemId },
    };
    next = recompute(next);
    setState(next);
  };

  const setPosition = (x: number, y: number) => {
    if (!stateRef.current) return;
    const next = { ...stateRef.current };
    next.world = { ...next.world, position: { x, y } };
    setState(next);
  };

  // ─── Quantum Taming mutations ──────────────────────────────────────
  // Lazy-initialise the `quantum` slice so legacy saves work without
  // a backend migration step. All readers also fall back via `?? []`.
  const ensureQuantum = (s: GameState): QuantumState =>
    s.quantum ?? { party: [], extendedStorage: [], seenSpecies: [], capturedSpecies: [] };

  const addCapturedMinion = (m: CapturedMinion): { slot: 'party' | 'extended' } => {
    if (!stateRef.current) return { slot: 'extended' };
    const next = { ...stateRef.current };
    const q = ensureQuantum(next);
    const routed = routeToStorage(q.party, q.extendedStorage, m);
    const rolled = summarizeRegistry(q.seenSpecies, routed.party, routed.extendedStorage);
    next.quantum = {
      party: routed.party,
      extendedStorage: routed.extendedStorage,
      seenSpecies: rolled.seen,
      capturedSpecies: rolled.captured,
    };
    setState(next);
    return { slot: routed.slot };
  };

  // ─── ENTITY DATA LEVELING ──────────────────────────────────────────
  // Grants independent DATA xp to a specific captured entity. Looks up
  // the entity in party FIRST, then extendedStorage. Returns:
  //   { leveled: boolean, gained: number, level: number }
  // so combat can play sfx + log line for level-ups.
  // Falls back gracefully for legacy minions without rarity (treats as common).
  // ────────────────────────────────────────────────────────────────────
  const awardEntityXp = (uid: string, amount: number): { leveled: boolean; gained: number; level: number } => {
    if (!stateRef.current) return { leveled: false, gained: 0, level: 1 };
    const next = { ...stateRef.current };
    const q = ensureQuantum(next);
    const apply = (m: CapturedMinion): { m: CapturedMinion; gained: number; leveled: boolean } => {
      const rarity = m.rarity ?? 'common';
      const lvl = m.dataLevel ?? m.level;
      const xp = m.dataXp ?? 0;
      const xpToNext = m.dataXpToNext ?? entityXpToNext(lvl);
      const r = applyEntityXp({ level: lvl, xp, xpToNext, rarity, amount });
      return {
        m: { ...m, dataLevel: r.level, dataXp: r.xp, dataXpToNext: r.xpToNext, baseLevel: m.baseLevel ?? m.level },
        gained: r.gained,
        leveled: r.leveled,
      };
    };
    let result = { leveled: false, gained: 0, level: 1 };
    const inParty = q.party.findIndex((x) => x.uid === uid);
    if (inParty >= 0) {
      const r = apply(q.party[inParty]);
      const party = [...q.party];
      party[inParty] = r.m;
      next.quantum = { ...q, party };
      result = { leveled: r.leveled, gained: r.gained, level: r.m.dataLevel || 1 };
    } else {
      const inExt = q.extendedStorage.findIndex((x) => x.uid === uid);
      if (inExt >= 0) {
        const r = apply(q.extendedStorage[inExt]);
        const extendedStorage = [...q.extendedStorage];
        extendedStorage[inExt] = r.m;
        next.quantum = { ...q, extendedStorage };
        result = { leveled: r.leveled, gained: r.gained, level: r.m.dataLevel || 1 };
      } else {
        return result;
      }
    }
    setState(next);
    return result;
  };

  const markSpeciesSeen = (speciesId: string) => {
    if (!stateRef.current || !speciesId) return;
    const next = { ...stateRef.current };
    const q = ensureQuantum(next);
    if (q.seenSpecies.includes(speciesId)) return;
    next.quantum = {
      party: q.party,
      extendedStorage: q.extendedStorage,
      seenSpecies: [...q.seenSpecies, speciesId],
      capturedSpecies: q.capturedSpecies,
    };
    setState(next);
  };

  const swapPartyMinion = (partyIndex: number, storageIndex: number) => {
    if (!stateRef.current) return;
    const next = { ...stateRef.current };
    const q = ensureQuantum(next);
    if (partyIndex < 0 || partyIndex >= q.party.length) return;
    if (storageIndex < 0 || storageIndex >= q.extendedStorage.length) return;
    const newParty = [...q.party];
    const newStore = [...q.extendedStorage];
    const tmp = newParty[partyIndex];
    newParty[partyIndex] = newStore[storageIndex];
    newStore[storageIndex] = tmp;
    next.quantum = { ...q, party: newParty, extendedStorage: newStore };
    setState(next);
  };

  const releaseMinion = (uid: string) => {
    if (!stateRef.current) return;
    const next = { ...stateRef.current };
    const q = ensureQuantum(next);
    next.quantum = {
      ...q,
      party: q.party.filter((m) => m.uid !== uid),
      extendedStorage: q.extendedStorage.filter((m) => m.uid !== uid),
    };
    setState(next);
  };

  return (
    <Ctx.Provider value={{
      state, setState,
      loadFromServer, saveToServer, saveCheckpoint, restoreCheckpoint, createCharacter,
      applyDamage, applyHeal, applyMpCost,
      addItem, removeItem, addGold, awardXp, unlockAbility, unlockSynergyNode, equip, setPosition,
      addCapturedMinion, awardEntityXp, markSpeciesSeen, swapPartyMinion, releaseMinion,
    }}>
      {children}
    </Ctx.Provider>
  );
}
