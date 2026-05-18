import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, StyleSheet, View, Easing, BackHandler, Platform } from 'react-native';
import { COLORS } from '../data/gameData';
import { PixelText } from './PixelText';
import { PixelButton } from './PixelButton';
import { sfx } from '../utils/audio';
import { markTutorialShown, loadTutorialState, TutorialFlag } from '../systems/tutorialState';
import { TUTORIAL_PROMPTS } from '../data/tutorialPrompts';

/**
 * SystemPrompt — universal tutorial modal.
 *
 * UX rules (per the onboarding spec, post-feedback):
 *   • NO auto-close, NO timer-based dismiss, NO backdrop-press dismiss.
 *     Player MUST tap the CONTINUE button to advance.
 *   • Pauses gameplay input by sitting on top of everything in a Modal.
 *   • Typewriter effect on the body so the prompt feels intentional.
 *   • Blinking ▌ cursor on the CONTINUE button while idle.
 *   • Soft confirm beep when the prompt appears.
 *   • Large readable text, mobile-responsive padding, locked button size.
 *
 * Triggers self-gate via AsyncStorage so each flag fires exactly once
 * across all sessions.
 */
export function SystemPrompt({ flag }: { flag: TutorialFlag }) {
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;
  // Blinking ▌ cursor on the CONTINUE button — also used as the
  // typewriter cursor while text is animating in.
  const blink = useRef(new Animated.Value(0)).current;
  // ── NOTE on the removed glowPulse ─────────────────────────────────
  // We previously animated `shadowOpacity` via a JS-driven `glowPulse`
  // Animated.Value, but mixing JS-driven and native-driven animations
  // inside the same Animated.View (alongside the native `scale`
  // transform) crashes Hermes + the new architecture with:
  //   "Attempting to run JS driven animation on animated node that
  //    has been moved to 'native' earlier"
  // The pulse was purely decorative — keeping it static keeps the
  // card looking great without the runtime conflict.
  // Number of characters currently revealed by the typewriter.
  const [revealed, setRevealed] = useState(0);
  // True once the typewriter has finished — gates the CONTINUE button
  // so the player can't double-tap through a prompt without reading.
  const [typingDone, setTypingDone] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const state = await loadTutorialState();
      if (!mounted) return;
      if (!state[flag]) {
        setVisible(true);
        sfx.confirm();
      }
    })();
    return () => { mounted = false; };
  }, [flag]);

  // Open animation + cursor blink + glow pulse
  useEffect(() => {
    if (!visible) return;
    setRevealed(0);
    setTypingDone(false);
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: 460, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 0, duration: 460, useNativeDriver: true }),
      ]),
    ).start();
    // glowPulse loop removed — see comment near the declarations.
  }, [visible, opacity, scale, blink]);

  // ── TYPEWRITER ──────────────────────────────────────────────────
  // Reveals one character per ~22ms. Fully readable on the slowest
  // mobile; player can tap CONTINUE-to-skip-typewriter once we set
  // typingDone false → tap reveals everything instantly.
  const fullText = visible
    ? TUTORIAL_PROMPTS[flag].body.join('\n')
    : '';

  useEffect(() => {
    if (!visible) return;
    if (revealed >= fullText.length) {
      setTypingDone(true);
      return;
    }
    const id = setTimeout(() => {
      setRevealed((r) => r + 1);
      // Soft tick on punctuation/space — lightweight; uses existing click sfx
      const ch = fullText[revealed];
      if (ch && (ch === '.' || ch === ',' || ch === '·')) {
        // intentional pause beat — no sound to avoid spam
      }
    }, 22);
    return () => clearTimeout(id);
  }, [visible, revealed, fullText]);

  // Android back button should NOT dismiss the modal — player must
  // press CONTINUE. We swallow the back press while a tutorial is open.
  useEffect(() => {
    if (!visible) return;
    if (Platform.OS !== 'android') return;
    const sub = BackHandler.addEventListener('hardwareBackPress', () => true);
    return () => sub.remove();
  }, [visible]);

  if (!visible) return null;

  const prompt = TUTORIAL_PROMPTS[flag];
  const accent = prompt.color ?? COLORS.neonCyan;

  // CONTINUE handler — also doubles as "reveal-all" if typewriter
  // hasn't finished yet (mobile-friendly tap-to-skip).
  const handleContinue = async () => {
    if (!typingDone) {
      // First tap: reveal everything instantly. Player must tap again
      // to actually advance — keeps onboarding deliberate.
      setRevealed(fullText.length);
      setTypingDone(true);
      sfx.click();
      return;
    }
    sfx.click();
    await markTutorialShown(flag);
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setVisible(false);
    });
  };

  // Body rendered as the typewriter slice; split back into lines so
  // formatting stays clean and we can show the typing cursor at the end.
  const visibleBody = fullText.slice(0, revealed);
  const visibleLines = visibleBody.split('\n');

  // Static border-glow opacity — replaces the previous JS-driven
  // glowPulse interpolation (see notes near declarations).
  const STATIC_BORDER_GLOW = 0.7;

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={() => { /* swallow — no backdrop dismiss */ }}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity }]} pointerEvents="auto">
        {/* Inert backdrop — captures touches so gameplay underneath
            is fully paused, but does NOT dismiss the prompt. */}
        <View style={StyleSheet.absoluteFill} pointerEvents="auto" />

        <Animated.View
          style={[
            styles.card,
            {
              borderColor: accent,
              transform: [{ scale }],
              shadowColor: accent,
              shadowOpacity: STATIC_BORDER_GLOW,
            },
          ]}
        >
          {/* Top prefix line — muted green terminal cursor. */}
          <View style={styles.prefixRow}>
            <PixelText size={8} color="#5cf7c4" autoFit>
              {prompt.prefix}
            </PixelText>
            <Animated.Text style={[styles.cursor, { opacity: blink, color: '#5cf7c4' }]}>
              ▌
            </Animated.Text>
          </View>

          {/* Title */}
          <View style={styles.titleRow}>
            {prompt.glyph && (
              <PixelText size={20} color={accent} bold glow style={{ marginRight: 6 }}>
                {prompt.glyph}
              </PixelText>
            )}
            <View style={{ flex: 1 }}>
              <PixelText size={17} color={accent} bold glow autoFit>
                {prompt.title}
              </PixelText>
            </View>
          </View>

          {/* Scan-line divider */}
          <View style={[styles.divider, { backgroundColor: accent }]} />

          {/* Body — typewriter reveal, fixed minHeight so the card doesn't
              jitter as text fills in. Larger font + tighter line-height for
              mobile readability. */}
          <View style={styles.body}>
            {visibleLines.map((line, i) => (
              <View key={i} style={{ flexDirection: 'row' }}>
                <PixelText size={10} color={COLORS.text} style={styles.bodyLine}>
                  {line}
                </PixelText>
                {/* Show typing cursor at the END of the latest line only */}
                {!typingDone && i === visibleLines.length - 1 && (
                  <Animated.Text style={[styles.typingCursor, { opacity: blink, color: accent }]}>
                    ▌
                  </Animated.Text>
                )}
              </View>
            ))}
            {/* Pad to full body height so CONTINUE doesn't jump up/down */}
            {Array.from({ length: Math.max(0, prompt.body.length - visibleLines.length) }).map((_, i) => (
              <View key={`pad-${i}`} style={{ height: 14 }} />
            ))}
          </View>

          {/* Footer — locked CONTINUE button, large touch target */}
          <View style={styles.footer}>
            <View style={styles.footerHint}>
              <Animated.Text style={[styles.continueCursor, { opacity: blink, color: accent }]}>
                ▶
              </Animated.Text>
              <PixelText size={8} color="#5a6072" style={{ marginLeft: 4 }}>
                {typingDone ? 'tap CONTINUE to proceed' : 'tap to skip typing'}
              </PixelText>
            </View>
            <PixelButton
              title={typingDone ? 'CONTINUE' : 'SKIP TYPE'}
              onPress={handleContinue}
              color={accent}
              size="md"
              testID={`tut-${flag}-ack`}
            />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.82)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '94%',
    maxWidth: 400,
    backgroundColor: 'rgba(6,8,14,0.97)',
    borderWidth: 2,
    paddingHorizontal: 16,
    paddingVertical: 16,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 0 },
    gap: 10,
  },
  prefixRow: { flexDirection: 'row', alignItems: 'center' },
  cursor: {
    marginLeft: 4,
    fontFamily: 'PressStart2P_400Regular',
    fontSize: 10,
  },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  divider: { height: 1, opacity: 0.5 },
  body: {
    gap: 4,
    paddingVertical: 6,
    minHeight: 64,
  },
  bodyLine: { lineHeight: 16 },
  typingCursor: {
    marginLeft: 2,
    fontFamily: 'PressStart2P_400Regular',
    fontSize: 10,
  },
  footer: {
    marginTop: 6,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
  footerHint: {
    flexDirection: 'row',
    alignItems: 'center',
    flexShrink: 1,
  },
  continueCursor: {
    fontFamily: 'PressStart2P_400Regular',
    fontSize: 10,
  },
});
