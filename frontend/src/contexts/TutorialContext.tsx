// ============================================================
// TUTORIAL CONTEXT — Phased contextual coaching + first-launch
// guided walkthroughs.
//
// Sequences fire automatically the first time the player reaches a
// gameplay milestone (intro / combat / taming / conduit). Completed
// flags persist to AsyncStorage so they never fire twice unless the
// player explicitly hits REPLAY from the How-To-Play book.
// ============================================================
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type ArrowTarget =
  | 'hud-top'
  | 'hud-bag'
  | 'hud-skills'
  | 'hud-party'
  | 'hud-menu'
  | 'joystick'
  | 'btn-a'
  | 'btn-b'
  | 'viewport-center'
  | 'combat-menu'
  | 'combat-enemy'
  | 'conduit-trigger'
  | 'none';

export type TutorialStep = {
  speaker?: string;     // default 'NEXUS_OS'
  emoji?: string;       // small inline icon shown next to speaker
  text: string;
  target?: ArrowTarget; // where the spotlight/arrow points
};

export type TutorialSequence = {
  id: string;
  title: string;
  steps: TutorialStep[];
};

// ── Authoring content ────────────────────────────────────────
export const TUTORIAL_SEQUENCES: Record<string, TutorialSequence> = {
  intro: {
    id: 'intro',
    title: 'WELCOME TO THE ACADEMY',
    steps: [
      {
        speaker: 'NEXUS_OS',
        emoji: '◉',
        text: 'Welcome, Operative. I am NEXUS_OS — your neural co-processor. Boot sequence complete.',
        target: 'none',
      },
      {
        speaker: 'NEXUS_OS',
        emoji: '◉',
        text: 'This is the Synthetica Academy of Emergence — a sanctuary for cyborg cadets fighting back the Glitch.',
        target: 'none',
      },
      {
        speaker: 'NEXUS_OS',
        text: 'Use the JOYSTICK at the bottom-left to walk. Movement snaps to a 4-direction grid — classic handheld feel.',
        target: 'joystick',
      },
      {
        speaker: 'NEXUS_OS',
        text: 'Press the GREEN A button to interact with NPCs, terminals, and glowing tiles.',
        target: 'btn-a',
      },
      {
        speaker: 'NEXUS_OS',
        text: 'Press the MAGENTA B button to cancel menus or back out of a screen.',
        target: 'btn-b',
      },
      {
        speaker: 'NEXUS_OS',
        text: 'The HUD at the top shows your HP, MP, gold, and XP. If HP hits zero, you respawn at the last checkpoint.',
        target: 'hud-top',
      },
      {
        speaker: 'NEXUS_OS',
        text: 'BAG → items.  SKILLS → upgrades.  PARTY → your Quantum minions.  MENU → save / pause.',
        target: 'hud-bag',
      },
      {
        speaker: 'NEXUS_OS',
        text: 'Find the SPIRAL STAIRCASE to descend into Level 2B — The Conduit Maze. The Glitch waits there.',
        target: 'viewport-center',
      },
      {
        speaker: 'NEXUS_OS',
        emoji: '◉',
        text: 'Good luck, Operative. You can replay this any time from MENU → HOW TO PLAY.',
        target: 'none',
      },
    ],
  },

  combat: {
    id: 'combat',
    title: 'COMBAT PROTOCOL',
    steps: [
      {
        speaker: 'NEXUS_OS',
        text: 'Encounter detected. Engaging turn-based combat protocol.',
        target: 'combat-enemy',
      },
      {
        speaker: 'NEXUS_OS',
        text: 'Pick ATTACK, SKILL, ITEM, or RUN. Each costs a turn. Watch both HP bars carefully.',
        target: 'combat-menu',
      },
      {
        speaker: 'NEXUS_OS',
        text: 'SKILLS cost MP but deal more damage. ITEMS heal or buff. RUN escapes — most of the time.',
        target: 'combat-menu',
      },
      {
        speaker: 'NEXUS_OS',
        text: 'Defeated enemies drop XP and credits. Survive long enough and you can capture them.',
        target: 'none',
      },
    ],
  },

  taming: {
    id: 'taming',
    title: 'QUANTUM TAMING',
    steps: [
      {
        speaker: 'NEXUS_OS',
        text: 'Weakened wild minions can be captured with a QUANTUM TAG. Lower their HP first, then use the item.',
        target: 'combat-menu',
      },
      {
        speaker: 'NEXUS_OS',
        text: 'Captured minions are stored in the OMNI-REGISTRY (PARTY button). The first 3 join your active party.',
        target: 'hud-party',
      },
      {
        speaker: 'NEXUS_OS',
        text: 'In combat, swap to a minion via the CYBORG MOVE PANEL. They have unique skills and types.',
        target: 'combat-menu',
      },
    ],
  },

  conduit: {
    id: 'conduit',
    title: 'CONDUIT MAZE PROTOCOL',
    steps: [
      {
        speaker: 'NEXUS_OS',
        emoji: '⚠',
        text: 'You are inside Level 2B. Wild MECHS patrol these corridors. They have line-of-sight detection.',
        target: 'viewport-center',
      },
      {
        speaker: 'NEXUS_OS',
        text: 'When a mech sees you, an "!" appears above its head. Move FAST or break sight behind server racks.',
        target: 'viewport-center',
      },
      {
        speaker: 'NEXUS_OS',
        text: 'Glowing tiles are zone triggers — step on them or press A. START / TROJAN / DATA / CONSOLE all give buffs.',
        target: 'conduit-trigger',
      },
      {
        speaker: 'NEXUS_OS',
        text: 'CONSOLES disable nearby ACID VAULTS. Plan your path so you don\'t take poison damage.',
        target: 'conduit-trigger',
      },
      {
        speaker: 'NEXUS_OS',
        text: 'Defeat the HIVE CUSTODIAN mini-boss before the QUANTUM AI mega-boss gate will unlock.',
        target: 'none',
      },
    ],
  },
};

// ── Context ──────────────────────────────────────────────────
type Ctx = {
  completed: Set<string>;
  active: TutorialSequence | null;
  activeStep: number;
  startSequence: (id: string) => void;
  next: () => void;
  skip: () => void;
  isCompleted: (id: string) => boolean;
  replay: (id: string) => void;
};

const TutorialCtx = createContext<Ctx>({} as Ctx);
export const useTutorial = () => useContext(TutorialCtx);

const STORAGE_KEY = 'tutorial_completed_v1';

export function TutorialProvider({ children }: { children: React.ReactNode }) {
  const [completed, setCompleted] = useState<Set<string>>(new Set());
  const [active, setActive] = useState<TutorialSequence | null>(null);
  const [activeStep, setActiveStep] = useState(0);
  const [hydrated, setHydrated] = useState(false);

  // Hydrate from storage on mount.
  useEffect(() => {
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(STORAGE_KEY);
        if (raw) {
          const arr: string[] = JSON.parse(raw);
          setCompleted(new Set(arr));
        }
      } catch {
        // ignore
      } finally {
        setHydrated(true);
      }
    })();
  }, []);

  // Persist whenever the set changes.
  useEffect(() => {
    if (!hydrated) return;
    AsyncStorage.setItem(STORAGE_KEY, JSON.stringify(Array.from(completed))).catch(() => {});
  }, [completed, hydrated]);

  const isCompleted = useCallback((id: string) => completed.has(id), [completed]);

  const startSequence = useCallback((id: string) => {
    if (completed.has(id)) return; // never auto-replay
    const seq = TUTORIAL_SEQUENCES[id];
    if (!seq) return;
    setActive(seq);
    setActiveStep(0);
  }, [completed]);

  const replay = useCallback((id: string) => {
    const seq = TUTORIAL_SEQUENCES[id];
    if (!seq) return;
    setActive(seq);
    setActiveStep(0);
  }, []);

  const next = useCallback(() => {
    setActiveStep((s) => {
      if (!active) return 0;
      if (s + 1 >= active.steps.length) {
        // Sequence finished — mark complete.
        setCompleted((prev) => {
          const n = new Set(prev);
          n.add(active.id);
          return n;
        });
        setActive(null);
        return 0;
      }
      return s + 1;
    });
  }, [active]);

  const skip = useCallback(() => {
    if (!active) return;
    setCompleted((prev) => {
      const n = new Set(prev);
      n.add(active.id);
      return n;
    });
    setActive(null);
    setActiveStep(0);
  }, [active]);

  const value = useMemo<Ctx>(() => ({
    completed,
    active,
    activeStep,
    startSequence,
    next,
    skip,
    isCompleted,
    replay,
  }), [completed, active, activeStep, startSequence, next, skip, isCompleted, replay]);

  return <TutorialCtx.Provider value={value}>{children}</TutorialCtx.Provider>;
}
