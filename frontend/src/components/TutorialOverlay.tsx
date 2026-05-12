// ============================================================
// TUTORIAL OVERLAY — Spotlight + dialog box that points to a
// region of the screen and explains a mechanic. Sits above the
// game UI via zIndex / Modal. Render once at the root.
// ============================================================
import React from 'react';
import {
  View,
  Modal,
  StyleSheet,
  TouchableOpacity,
  Dimensions,
  Platform,
} from 'react-native';
import { PixelText } from './PixelText';
import { COLORS } from '../data/gameData';
import { useTutorial, ArrowTarget } from '../contexts/TutorialContext';

const { width: SW, height: SH } = Dimensions.get('window');

// ── Map ArrowTarget → screen-anchor data (rough zone of UI). ────
// Coordinates are heuristic; the dim overlay + arrow is enough to
// guide the player without needing per-widget measurements.
type AnchorRect = { left?: number; top?: number; right?: number; bottom?: number; width?: number; height?: number };
type AnchorInfo = { rect: AnchorRect; arrow: 'up' | 'down' | 'left' | 'right' };

function anchorFor(target: ArrowTarget | undefined): AnchorInfo | null {
  if (!target || target === 'none') return null;
  switch (target) {
    case 'hud-top':
      return { rect: { top: 0, left: 0, right: 0, height: 96 }, arrow: 'up' };
    case 'hud-bag':
      return { rect: { top: 70, left: 6, width: SW * 0.25 - 12, height: 26 }, arrow: 'up' };
    case 'hud-skills':
      return { rect: { top: 70, left: SW * 0.5, width: SW * 0.25 - 6, height: 26 }, arrow: 'up' };
    case 'hud-party':
      return { rect: { top: 70, left: SW * 0.25 + 6, width: SW * 0.25 - 12, height: 26 }, arrow: 'up' };
    case 'hud-menu':
      return { rect: { top: 70, right: 6, width: SW * 0.25 - 12, height: 26 }, arrow: 'up' };
    case 'joystick':
      return { rect: { bottom: 16, left: 8, width: 130, height: 130 }, arrow: 'down' };
    case 'btn-a':
      return { rect: { bottom: 46, right: 86, width: 80, height: 80 }, arrow: 'down' };
    case 'btn-b':
      return { rect: { bottom: 46, right: 10, width: 80, height: 80 }, arrow: 'down' };
    case 'viewport-center':
      return { rect: { top: SH * 0.25, left: SW * 0.15, width: SW * 0.7, height: SH * 0.35 }, arrow: 'down' };
    case 'combat-menu':
      return { rect: { bottom: 120, left: 0, right: 0, height: 200 }, arrow: 'down' };
    case 'combat-enemy':
      return { rect: { top: SH * 0.22, left: SW * 0.55, width: SW * 0.35, height: SH * 0.25 }, arrow: 'up' };
    case 'conduit-trigger':
      return { rect: { top: SH * 0.3, left: SW * 0.25, width: SW * 0.5, height: SH * 0.3 }, arrow: 'down' };
  }
  return null;
}

export function TutorialOverlay() {
  const { active, activeStep, next, skip } = useTutorial();
  if (!active) return null;
  const step = active.steps[activeStep];
  if (!step) return null;

  const anchor = anchorFor(step.target);
  const speaker = step.speaker || 'NEXUS_OS';
  const isLast = activeStep >= active.steps.length - 1;
  const total = active.steps.length;

  return (
    <Modal transparent visible animationType="fade" onRequestClose={skip}>
      <View style={styles.root}>
        {/* Dim layer */}
        <View style={styles.dim} pointerEvents="none" />

        {/* Spotlight ring around the anchor */}
        {anchor && (
          <View
            pointerEvents="none"
            style={[
              styles.spotlight,
              anchor.rect,
            ]}
          />
        )}

        {/* Pulse arrow pointing toward the anchor */}
        {anchor && (
          <View
            pointerEvents="none"
            style={[
              styles.arrow,
              styles[`arrow_${anchor.arrow}` as keyof typeof styles] as any,
              arrowPositionFor(anchor),
            ]}
          >
            <PixelText size={26} color={COLORS.neonCyan} glow bold>
              {anchor.arrow === 'up' ? '▲' : anchor.arrow === 'down' ? '▼' : anchor.arrow === 'left' ? '◀' : '▶'}
            </PixelText>
          </View>
        )}

        {/* Dialog box (always anchored to a safe bottom zone of screen) */}
        <View style={styles.dialog}>
          <View style={styles.dialogHeader}>
            <PixelText size={11} color={COLORS.neonCyan} bold glow>
              {step.emoji ? `${step.emoji} ` : ''}{speaker}
            </PixelText>
            <PixelText size={8} color={COLORS.textDim}>
              {`STEP ${activeStep + 1} / ${total}`}
            </PixelText>
          </View>

          <PixelText
            size={12}
            color={COLORS.text}
            style={styles.dialogText}
          >
            {step.text}
          </PixelText>

          <View style={styles.dialogActions}>
            <TouchableOpacity
              onPress={skip}
              style={[styles.actionBtn, { borderColor: COLORS.textDim }]}
              testID="tutorial-skip"
            >
              <PixelText size={10} color={COLORS.textDim} bold>SKIP</PixelText>
            </TouchableOpacity>
            <TouchableOpacity
              onPress={next}
              style={[styles.actionBtn, styles.actionBtnPrimary]}
              testID="tutorial-next"
            >
              <PixelText size={10} color="#000" bold>
                {isLast ? 'DONE ▶' : 'NEXT ▶'}
              </PixelText>
            </TouchableOpacity>
          </View>

          <PixelText size={7} color={COLORS.textDim} style={{ textAlign: 'center', marginTop: 6 }}>
            {active.title}
          </PixelText>
        </View>
      </View>
    </Modal>
  );
}

function arrowPositionFor(anchor: AnchorInfo): any {
  const { rect, arrow } = anchor;
  // Position the arrow OUTSIDE the spotlight in the indicated direction.
  if (arrow === 'down') {
    const left = (rect.left ?? (SW - (rect.right ?? 0) - (rect.width ?? 0))) + (rect.width ?? SW) / 2 - 18;
    const top = (rect.top ?? 0) + (rect.height ?? 100) + 4;
    return { position: 'absolute', left, top };
  }
  if (arrow === 'up') {
    const left = (rect.left ?? (SW - (rect.right ?? 0) - (rect.width ?? 0))) + (rect.width ?? SW) / 2 - 18;
    const top = (rect.top ?? 0) - 36;
    return { position: 'absolute', left, top };
  }
  return {};
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  dim: {
    position: 'absolute',
    inset: 0,
    backgroundColor: 'rgba(2,4,12,0.78)',
  } as any,
  spotlight: {
    position: 'absolute',
    borderWidth: 3,
    borderColor: COLORS.neonCyan,
    backgroundColor: 'rgba(0,240,255,0.08)',
    boxShadow: '0 0 24px rgba(0,240,255,0.6), inset 0 0 16px rgba(0,240,255,0.4)',
    borderRadius: 6,
  } as any,
  arrow: {
    position: 'absolute',
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
  arrow_up: {},
  arrow_down: {},
  arrow_left: {},
  arrow_right: {},
  dialog: {
    position: 'absolute',
    left: 12,
    right: 12,
    bottom: 24,
    backgroundColor: 'rgba(6,8,20,0.96)',
    borderWidth: 2,
    borderColor: COLORS.neonCyan,
    padding: 12,
    boxShadow: '0 0 18px rgba(0,240,255,0.45)',
    ...(Platform.OS === 'android' ? { elevation: 30 } : {}),
  } as any,
  dialogHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(0,240,255,0.3)',
    paddingBottom: 4,
  },
  dialogText: {
    lineHeight: 18,
    marginVertical: 4,
  },
  dialogActions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 10,
  },
  actionBtn: {
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderWidth: 2,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  actionBtnPrimary: {
    borderColor: COLORS.neonCyan,
    backgroundColor: COLORS.neonCyan,
  },
});
