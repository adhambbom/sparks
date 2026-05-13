import React, { useEffect, useRef, useState } from 'react';
import { Animated, Modal, Pressable, StyleSheet, View, Easing } from 'react-native';
import { COLORS } from '../data/gameData';
import { PixelText } from './PixelText';
import { PixelButton } from './PixelButton';
import { sfx } from '../utils/audio';
import { markTutorialShown, loadTutorialState, TutorialFlag } from '../systems/tutorialState';
import { TUTORIAL_PROMPTS } from '../data/tutorialPrompts';

/**
 * SystemPrompt — universal tutorial modal.
 *
 * Game code triggers this with `<SystemPrompt flag="deploy_primer" />`.
 * The component:
 *   1. Reads the AsyncStorage flag set on mount.
 *   2. If unseen, renders an eerie terminal-style card.
 *   3. On dismiss, persists the flag and fades out.
 *
 * Design rules per the onboarding spec:
 *   • Short readable prompts (lines clamped in tutorialPrompts.ts).
 *   • Eerie cyber terminal aesthetic — green prefix line, neon title,
 *     dotted scanline border.
 *   • Mobile-friendly: 90% width, large CONTINUE button.
 *   • Non-blocking — game pauses behind it but UX never gets stuck.
 */
export function SystemPrompt({ flag }: { flag: TutorialFlag }) {
  const [visible, setVisible] = useState(false);
  const opacity = useRef(new Animated.Value(0)).current;
  const scale = useRef(new Animated.Value(0.95)).current;

  // Scanline / cursor blink — sells the "syncing into a network" tone.
  const blink = useRef(new Animated.Value(0)).current;

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

  useEffect(() => {
    if (!visible) return;
    Animated.parallel([
      Animated.timing(opacity, { toValue: 1, duration: 280, useNativeDriver: true }),
      Animated.timing(scale, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    Animated.loop(
      Animated.sequence([
        Animated.timing(blink, { toValue: 1, duration: 480, useNativeDriver: true }),
        Animated.timing(blink, { toValue: 0, duration: 480, useNativeDriver: true }),
      ]),
    ).start();
  }, [visible, opacity, scale, blink]);

  if (!visible) return null;

  const prompt = TUTORIAL_PROMPTS[flag];
  const accent = prompt.color ?? COLORS.neonCyan;

  const dismiss = async () => {
    sfx.click();
    await markTutorialShown(flag);
    Animated.timing(opacity, { toValue: 0, duration: 200, useNativeDriver: true }).start(() => {
      setVisible(false);
    });
  };

  return (
    <Modal
      visible={visible}
      transparent
      animationType="none"
      onRequestClose={dismiss}
      statusBarTranslucent
    >
      <Animated.View style={[styles.backdrop, { opacity }]} pointerEvents="auto">
        <Pressable style={StyleSheet.absoluteFill} onPress={dismiss} />
        <Animated.View
          style={[
            styles.card,
            { borderColor: accent, transform: [{ scale }], shadowColor: accent },
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
              <PixelText size={18} color={accent} bold glow style={{ marginRight: 6 }}>
                {prompt.glyph}
              </PixelText>
            )}
            <View style={{ flex: 1 }}>
              <PixelText size={16} color={accent} bold glow autoFit>
                {prompt.title}
              </PixelText>
            </View>
          </View>

          {/* Scan-line divider */}
          <View style={[styles.divider, { backgroundColor: accent }]} />

          {/* Body lines */}
          <View style={styles.body}>
            {prompt.body.map((line, i) => (
              <PixelText key={i} size={9} color={COLORS.text} style={{ lineHeight: 14 }}>
                {line}
              </PixelText>
            ))}
          </View>

          {/* Footer */}
          <View style={styles.footer}>
            <PixelText size={7} color="#5a6072">{'> ack_to_continue_'}</PixelText>
            <PixelButton title="CONTINUE" onPress={dismiss} color={accent} size="sm" testID={`tut-${flag}-ack`} />
          </View>
        </Animated.View>
      </Animated.View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.78)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 16,
  },
  card: {
    width: '92%',
    maxWidth: 380,
    backgroundColor: 'rgba(6,8,14,0.96)',
    borderWidth: 2,
    paddingHorizontal: 14,
    paddingVertical: 14,
    shadowOpacity: 0.55,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 0 },
    gap: 8,
  },
  prefixRow: { flexDirection: 'row', alignItems: 'center' },
  cursor: { marginLeft: 4, fontFamily: 'PressStart2P_400Regular', fontSize: 10 },
  titleRow: { flexDirection: 'row', alignItems: 'center', marginTop: 2 },
  divider: { height: 1, opacity: 0.4 },
  body: { gap: 4, paddingVertical: 4 },
  footer: {
    marginTop: 4,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 8,
  },
});
