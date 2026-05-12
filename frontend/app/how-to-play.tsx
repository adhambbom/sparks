// ============================================================
// HOW TO PLAY — Paginated guide book accessible any time from
// the pause menu (MENU → HOW TO PLAY). Re-runs the contextual
// interactive walkthroughs on demand via REPLAY buttons.
// ============================================================
import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { useTutorial, TUTORIAL_SEQUENCES } from '../src/contexts/TutorialContext';
import { sfx } from '../src/utils/audio';

// ── Page content authoring ───────────────────────────────────
type Page = {
  title: string;
  accent: string;
  blocks: { heading?: string; body: string }[];
};

const PAGES: Page[] = [
  {
    title: '01 · MOVEMENT',
    accent: COLORS.neonCyan,
    blocks: [
      { heading: 'JOYSTICK', body: 'The cyan circle at the bottom-left of every gameplay screen. Drag the inner knob in any direction — Adhamb walks in cardinal 4-direction grid steps (no diagonal). Movement is snap-to-grid, classic handheld feel.' },
      { heading: 'KEYBOARD (WEB)', body: 'Arrow keys or WASD work identically. Useful for testing on desktop preview.' },
      { heading: 'WALLS & TILES', body: 'Walls, server racks, NPCs, and locked objects block your path. Walk into them safely — Adhamb just stops.' },
    ],
  },
  {
    title: '02 · THE HUD',
    accent: COLORS.neonMagenta,
    blocks: [
      { heading: 'TOP BAR — STATUS', body: 'Left: your name + LEVEL and SYNC rating. Center: HP (green) and MP (magenta) bars. Right: gold coins and XP-to-next-level.' },
      { heading: 'WHEN HP REACHES 0', body: 'You respawn at the last CHECKPOINT — usually the academy entrance. You keep all items and XP, but lose any unsaved progress in the current floor.' },
      { heading: 'SHORTCUT ROW', body: 'BAG · PARTY · SKILLS · MENU — all reachable in 1 tap from anywhere in the world.' },
    ],
  },
  {
    title: '03 · A & B BUTTONS',
    accent: COLORS.neonGreen,
    blocks: [
      { heading: 'GREEN A BUTTON', body: 'Interact. Talks to NPCs, opens chests, activates terminals, fires zone triggers in the Conduit Maze, confirms menu selections.' },
      { heading: 'MAGENTA B BUTTON', body: 'Cancel / Back. Closes dialogs, exits menus, in the maze it returns you to the academy. In combat it tries to flee.' },
      { heading: 'TIP', body: 'You can always tap a tile or button directly on the touchscreen too — A/B are just shortcuts.' },
    ],
  },
  {
    title: '04 · COMBAT',
    accent: COLORS.neonRed,
    blocks: [
      { heading: 'TURN-BASED', body: 'You and the enemy alternate turns. Choose ATTACK, SKILL, ITEM, or RUN.' },
      { heading: 'ATTACK', body: 'Free basic strike. Damage scales with your level and stats. Always available.' },
      { heading: 'SKILL', body: 'Special moves from your skill tree. Cost MP. Bigger numbers, sometimes status effects (BURN, FREEZE, GLITCH).' },
      { heading: 'ITEM', body: 'Use a potion / energy cell / Quantum Tag from your bag. Doesn\'t end your turn for buffs.' },
      { heading: 'RUN', body: 'Usually works against wild minions. Doesn\'t work against bosses or trainers.' },
    ],
  },
  {
    title: '05 · QUANTUM TAMING',
    accent: COLORS.neonMagenta,
    blocks: [
      { heading: 'STEP 1 — WEAKEN', body: 'Knock the wild minion\'s HP into the red without killing it. Yellow = OK chance. Red = high chance. Green = will probably break free.' },
      { heading: 'STEP 2 — TAG', body: 'Open ITEM menu in combat → use a QUANTUM TAG. Cinematic capture sequence plays.' },
      { heading: 'STEP 3 — REGISTRY', body: 'Tamed minions appear in the OMNI-REGISTRY (PARTY button). First 3 join your active party.' },
    ],
  },
  {
    title: '06 · PARTY & REGISTRY',
    accent: COLORS.neonCyan,
    blocks: [
      { heading: 'OMNI-REGISTRY', body: 'Your captured minion archive. Tap any captured species to view stats, types, skills, and a 3D-rotating model.' },
      { heading: 'ACTIVE PARTY', body: 'Up to 3 minions deployable in combat. Re-order them in the registry — first slot is your starting fighter.' },
      { heading: 'STORAGE', body: 'Extra minions beyond 3 live in extended storage. Swap them in/out at any save point or terminal.' },
    ],
  },
  {
    title: '07 · SKILLS',
    accent: COLORS.neonYellow,
    blocks: [
      { heading: 'XP & LEVEL UP', body: 'Win combats → earn XP. Hit the XP threshold → level up → gain 1 SKILL POINT and refill HP/MP.' },
      { heading: 'SKILL TREE', body: 'Tap SKILLS in the HUD. Spend points to unlock new attacks, passive buffs, and minion-specific moves.' },
      { heading: 'RESPEC', body: 'A dedicated SKILL CLEANSER at the academy can refund all points for a credit fee.' },
    ],
  },
  {
    title: '08 · ITEMS & STORE',
    accent: COLORS.neonGreen,
    blocks: [
      { heading: 'BAG', body: 'Holds all your consumables. Stackable. Use in combat (ITEM menu) or out of combat (tap the item).' },
      { heading: 'GOLD', body: 'Drops from defeated enemies and DATA STORAGE cells. Find more in the Conduit Maze\'s loot tiles.' },
      { heading: 'STORE', body: 'Visit the SHOP NPC at the academy to buy potions, Quantum Tags, equipment, and consumable buffs.' },
    ],
  },
  {
    title: '09 · CONDUIT MAZE',
    accent: COLORS.neonCyan,
    blocks: [
      { heading: 'LEVEL 2B', body: 'Descend the spiral staircase from the academy. This is the Glitch\'s infested server vault.' },
      { heading: 'LINE-OF-SIGHT', body: 'Wild mechs patrol corridors. They see in straight lines up to 4 tiles. Server racks BREAK their line of sight.' },
      { heading: 'ALERT INDICATOR', body: 'A red "!" appears above a mech when it spots you. It will sprint toward you for several turns before giving up.' },
      { heading: 'CONTACT = COMBAT', body: 'Stepping onto a mech\'s tile (or vice versa) instantly triggers turn-based combat.' },
    ],
  },
  {
    title: '10 · ZONE TRIGGERS',
    accent: COLORS.neonYellow,
    blocks: [
      { heading: 'START TERMINAL', body: 'Cyan. Heals you for 20 HP on first interaction.' },
      { heading: 'TROJAN INJECTOR CORE', body: 'Magenta. Injects custom firmware → +25 XP.' },
      { heading: 'DATA STORAGE CELLS', body: 'Yellow. Encrypted shards → +40 credits.' },
      { heading: 'CONDUIT CONSOLE', body: 'Green. Disables every ACID VAULT within 3 tiles. Critical for safe traversal.' },
      { heading: 'ACID VAULT', body: 'Toxic green pool. −4 HP every time you step on it (unless console-disabled).' },
      { heading: 'HIVE CUSTODIAN GATE', body: 'Purple. Triggers the Level 2B mini-boss fight. Defeat it to unlock the Quantum AI.' },
      { heading: 'QUANTUM AI MEGA-BOSS', body: 'Red. Three-phase apex AI. GATED — locked until you beat the Hive Custodian.' },
    ],
  },
  {
    title: '11 · SAVES & CHECKPOINTS',
    accent: COLORS.neonGreen,
    blocks: [
      { heading: 'AUTO-SAVE', body: 'The game auto-saves every minute and on every level transition. No save fragments lost.' },
      { heading: 'MENU → SAVE', body: 'Open the pause MENU and tap SAVE to push a manual checkpoint to the cloud.' },
      { heading: 'CONTINUE', body: 'From the title screen, CONTINUE always loads the latest cloud save.' },
    ],
  },
  {
    title: '12 · PRO TIPS',
    accent: COLORS.neonMagenta,
    blocks: [
      { heading: '✦ HUG WALLS', body: 'In the Conduit Maze, walking along walls is safer — mechs have to round the corner to see you.' },
      { heading: '✦ STOCK TAGS', body: 'Always carry 3+ Quantum Tags before descending. Rare encounters never wait.' },
      { heading: '✦ HEAL FIRST', body: 'Activate the START TERMINAL before any mini-boss attempt. Free 20 HP.' },
      { heading: '✦ ELEMENT MATCH', body: 'Capture a variety of minion types. Type advantages can 2× damage in tight fights.' },
      { heading: '✦ MARK CONSOLES', body: 'When you find a CONDUIT CONSOLE, mentally note the nearby acid pools — backtracking is way faster after.' },
    ],
  },
];

export default function HowToPlay() {
  const [page, setPage] = useState(0);
  const { replay, isCompleted } = useTutorial();
  const p = PAGES[page];

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => { sfx.cancel?.(); router.back(); }} style={styles.backBtn} testID="howto-back">
          <PixelText size={12} color={COLORS.textDim}>◀ BACK</PixelText>
        </TouchableOpacity>
        <PixelText size={14} color={COLORS.neonCyan} glow bold>HOW TO PLAY</PixelText>
        <PixelText size={9} color={COLORS.textDim}>{`${page + 1} / ${PAGES.length}`}</PixelText>
      </View>

      <ScrollView style={styles.body} contentContainerStyle={{ paddingBottom: 32 }}>
        <View style={[styles.pageCard, { borderColor: p.accent }]}>
          <PixelText size={16} color={p.accent} glow bold style={{ marginBottom: 10 }}>
            {p.title}
          </PixelText>

          {p.blocks.map((b, i) => (
            <View key={i} style={styles.block}>
              {b.heading && (
                <PixelText size={10} color={p.accent} bold style={{ marginBottom: 4 }}>
                  ▸ {b.heading}
                </PixelText>
              )}
              <PixelText size={11} color={COLORS.text} style={{ lineHeight: 18 }}>
                {b.body}
              </PixelText>
            </View>
          ))}
        </View>

        {/* Replay strip — only on the last page */}
        {page === PAGES.length - 1 && (
          <View style={styles.replayCard}>
            <PixelText size={11} color={COLORS.neonYellow} bold>▶ INTERACTIVE WALKTHROUGHS</PixelText>
            <PixelText size={9} color={COLORS.textDim} style={{ marginTop: 4, marginBottom: 10 }}>
              Re-run any contextual guide. They will appear next time you enter the relevant screen.
            </PixelText>
            {Object.values(TUTORIAL_SEQUENCES).map((s) => (
              <TouchableOpacity
                key={s.id}
                onPress={() => { sfx.confirm?.(); replay(s.id); router.back(); }}
                style={styles.replayBtn}
                testID={`replay-${s.id}`}
              >
                <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                  <PixelText size={10} color={COLORS.neonCyan} bold>{s.title}</PixelText>
                  <PixelText size={8} color={isCompleted(s.id) ? COLORS.neonGreen : COLORS.textDim}>
                    {isCompleted(s.id) ? '✓ SEEN' : 'NEW'}
                  </PixelText>
                </View>
                <PixelText size={8} color={COLORS.textDim} style={{ marginTop: 3 }}>
                  Replay ›
                </PixelText>
              </TouchableOpacity>
            ))}
          </View>
        )}
      </ScrollView>

      {/* Pager controls */}
      <View style={styles.pager}>
        <TouchableOpacity
          onPress={() => { if (page > 0) { sfx.click?.(); setPage(page - 1); } }}
          style={[styles.pagerBtn, page === 0 && styles.pagerBtnDisabled]}
          disabled={page === 0}
          testID="howto-prev"
        >
          <PixelText size={11} color={page === 0 ? COLORS.textDim : COLORS.text} bold>◀ PREV</PixelText>
        </TouchableOpacity>

        <View style={styles.dots}>
          {PAGES.map((_, i) => (
            <View
              key={i}
              style={[
                styles.dot,
                i === page && { backgroundColor: COLORS.neonCyan, borderColor: COLORS.neonCyan },
              ]}
            />
          ))}
        </View>

        <TouchableOpacity
          onPress={() => { if (page < PAGES.length - 1) { sfx.click?.(); setPage(page + 1); } }}
          style={[styles.pagerBtn, page === PAGES.length - 1 && styles.pagerBtnDisabled]}
          disabled={page === PAGES.length - 1}
          testID="howto-next"
        >
          <PixelText size={11} color={page === PAGES.length - 1 ? COLORS.textDim : COLORS.text} bold>NEXT ▶</PixelText>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#04040a' },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderBottomWidth: 2,
    borderBottomColor: COLORS.neonCyan,
    backgroundColor: 'rgba(8,10,24,0.92)',
  },
  backBtn: { paddingVertical: 4, paddingHorizontal: 8 },
  body: { flex: 1, paddingHorizontal: 12, paddingTop: 12 },
  pageCard: {
    borderWidth: 2,
    backgroundColor: 'rgba(6,8,20,0.9)',
    padding: 14,
    boxShadow: '0 0 16px rgba(0,240,255,0.18)',
  } as any,
  block: {
    marginBottom: 12,
    paddingBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  replayCard: {
    marginTop: 16,
    borderWidth: 2,
    borderColor: COLORS.neonYellow,
    backgroundColor: 'rgba(20,16,4,0.6)',
    padding: 12,
  },
  replayBtn: {
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderWidth: 1,
    borderColor: COLORS.borderHi,
    backgroundColor: 'rgba(0,0,0,0.4)',
    marginBottom: 6,
  },
  pager: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderTopWidth: 2,
    borderTopColor: COLORS.neonCyan,
    backgroundColor: 'rgba(8,10,24,0.92)',
  },
  pagerBtn: {
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderWidth: 2,
    borderColor: COLORS.borderHi,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  pagerBtnDisabled: { opacity: 0.4 },
  dots: { flexDirection: 'row', gap: 4 },
  dot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    borderWidth: 1,
    borderColor: COLORS.textDim,
    backgroundColor: 'transparent',
  },
});
