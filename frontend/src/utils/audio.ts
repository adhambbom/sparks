// ============================================================
// AUDIO + HAPTICS - cross-platform feedback
// Web: Web Audio API synth tones
// Native: expo-haptics tactile feedback
// ============================================================
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

let ctx: AudioContext | null = null;
function getCtx(): AudioContext | null {
  if (Platform.OS !== 'web') return null;
  if (typeof window === 'undefined') return null;
  if (!ctx) {
    try {
      const W: any = window;
      const AC = W.AudioContext || W.webkitAudioContext;
      if (AC) ctx = new AC();
    } catch {}
  }
  return ctx;
}

function tone(freq: number, durMs: number, type: OscillatorType = 'square', vol = 0.08) {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === 'suspended') c.resume();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(vol, c.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + durMs / 1000);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + durMs / 1000 + 0.05);
  } catch {}
}

function sweep(fStart: number, fEnd: number, durMs: number, type: OscillatorType = 'sawtooth', vol = 0.08) {
  const c = getCtx();
  if (!c) return;
  try {
    if (c.state === 'suspended') c.resume();
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(fStart, c.currentTime);
    osc.frequency.exponentialRampToValueAtTime(Math.max(40, fEnd), c.currentTime + durMs / 1000);
    gain.gain.setValueAtTime(0, c.currentTime);
    gain.gain.linearRampToValueAtTime(vol, c.currentTime + 0.01);
    gain.gain.exponentialRampToValueAtTime(0.0001, c.currentTime + durMs / 1000);
    osc.connect(gain).connect(c.destination);
    osc.start();
    osc.stop(c.currentTime + durMs / 1000 + 0.05);
  } catch {}
}

// Public API
export const sfx = {
  click() {
    tone(720, 50, 'square', 0.05);
    if (Platform.OS !== 'web') Haptics.selectionAsync().catch(() => {});
  },
  confirm() {
    tone(880, 60, 'square', 0.07);
    setTimeout(() => tone(1175, 70, 'square', 0.07), 60);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  cancel() {
    tone(330, 100, 'square', 0.06);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  hit() {
    sweep(220, 90, 120, 'sawtooth', 0.09);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {});
  },
  bigHit() {
    sweep(180, 60, 220, 'square', 0.12);
    setTimeout(() => sweep(120, 40, 180, 'sawtooth', 0.1), 60);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  },
  damage() {
    sweep(440, 110, 180, 'square', 0.08);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  },
  heal() {
    tone(523, 80, 'sine', 0.08);
    setTimeout(() => tone(659, 80, 'sine', 0.08), 80);
    setTimeout(() => tone(784, 100, 'sine', 0.08), 160);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  victory() {
    tone(523, 100, 'square', 0.08);
    setTimeout(() => tone(659, 100, 'square', 0.08), 100);
    setTimeout(() => tone(784, 100, 'square', 0.08), 200);
    setTimeout(() => tone(1047, 200, 'square', 0.09), 300);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  defeat() {
    sweep(440, 100, 400, 'sawtooth', 0.09);
    setTimeout(() => sweep(220, 50, 500, 'sawtooth', 0.08), 200);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
  },
  levelUp() {
    tone(523, 80, 'square', 0.07);
    setTimeout(() => tone(659, 80, 'square', 0.07), 80);
    setTimeout(() => tone(784, 80, 'square', 0.07), 160);
    setTimeout(() => tone(1047, 80, 'square', 0.07), 240);
    setTimeout(() => tone(1319, 200, 'square', 0.09), 320);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
  },
  encounter() {
    sweep(880, 220, 250, 'square', 0.1);
    setTimeout(() => tone(110, 120, 'sawtooth', 0.1), 250);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
  },
  skill() {
    sweep(440, 1320, 200, 'sine', 0.08);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
  bossPhase() {
    sweep(1320, 80, 600, 'sawtooth', 0.12);
    setTimeout(() => tone(60, 300, 'square', 0.1), 200);
    if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
  },
  buy() {
    tone(880, 60, 'sine', 0.08);
    setTimeout(() => tone(1320, 80, 'sine', 0.08), 70);
    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
  },
};
