import React, { createContext, useContext, useState, useCallback, useRef } from 'react';
import { api } from '../utils/api';
import { ITEMS, ABILITIES, xpForNextLevel } from '../data/gameData';

export type GameState = {
  player: {
    name: string;
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
  lastSaved?: string;
};

type GameCtx = {
  state: GameState | null;
  setState: (s: GameState) => void;
  loadFromServer: () => Promise<GameState | null>;
  saveToServer: () => Promise<void>;
  saveCheckpoint: () => Promise<void>;
  restoreCheckpoint: () => Promise<GameState | null>;
  createCharacter: (name: string) => Promise<GameState>;
  applyDamage: (dmg: number) => void;
  applyHeal: (amt: number) => void;
  applyMpCost: (mp: number) => void;
  addItem: (id: string, qty?: number) => void;
  removeItem: (id: string, qty?: number) => void;
  addGold: (amount: number) => void;
  awardXp: (xp: number) => boolean; // returns true if leveled up
  unlockAbility: (id: string) => void;
  equip: (slot: 'weapon' | 'armor', itemId: string) => void;
  setPosition: (x: number, y: number) => void;
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
    } catch {
      return null;
    }
  }, [setState]);

  const saveToServer = useCallback(async () => {
    if (!stateRef.current) return;
    try {
      await api.post('/game/save', { state: stateRef.current });
    } catch (e) {
      console.log('save failed', e);
    }
  }, []);

  const saveCheckpoint = useCallback(async () => {
    if (!stateRef.current) return;
    try {
      await api.post('/game/checkpoint', { state: stateRef.current });
    } catch (e) {
      console.log('checkpoint failed', e);
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

  const createCharacter = useCallback(async (name: string) => {
    const { data } = await api.post('/character/create', { name });
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

  return (
    <Ctx.Provider value={{
      state, setState,
      loadFromServer, saveToServer, saveCheckpoint, restoreCheckpoint, createCharacter,
      applyDamage, applyHeal, applyMpCost,
      addItem, removeItem, addGold, awardXp, unlockAbility, equip, setPosition,
    }}>
      {children}
    </Ctx.Provider>
  );
}
