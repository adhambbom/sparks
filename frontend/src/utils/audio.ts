// ============================================================
// AUDIO + HAPTICS — cross-platform feedback
// Web:    Web Audio API synth tones (zero-asset, dynamic)
// Native: bundled .wav files via expo-audio (Android/iOS APK)
// Both:   expo-haptics tactile feedback on native
// ============================================================
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';
import {
  createAudioPlayer,
  setAudioModeAsync,
} from 'expo-audio';
import type { AudioPlayer, AudioSource } from 'expo-audio';

// ─── NATIVE: bundled WAV asset registry ──────────────────────
// Keys must match the public sfx.* method names so the lookup is trivial.
// require() resolves at bundle time → these are baked into the APK/IPA.
const ASSETS: Record<string, AudioSource> = {
  click: require('../../assets/audio/click.wav'),
  confirm: require('../../assets/audio/confirm.wav'),
  cancel: require('../../assets/audio/cancel.wav'),
  hit: require('../../assets/audio/hit.wav'),
  bigHit: require('../../assets/audio/bigHit.wav'),
  damage: require('../../assets/audio/damage.wav'),
  heal: require('../../assets/audio/heal.wav'),
  victory: require('../../assets/audio/victory.wav'),
  defeat: require('../../assets/audio/defeat.wav'),
  levelUp: require('../../assets/audio/levelUp.wav'),
  encounter: require('../../assets/audio/encounter.wav'),
  skill: require('../../assets/audio/skill.wav'),
  bossPhase: require('../../assets/audio/bossPhase.wav'),
  buy: require('../../assets/audio/buy.wav'),
  footstep: require('../../assets/audio/footstep.wav'),
  drawbridge: require('../../assets/audio/drawbridge.wav'),
};

/* On native we keep ONE AudioPlayer per SFX name and replay it by seeking to 0.
 * Creating a new player every call would leak native resources and miss
 * tightly-spaced footsteps. */
const players: Record<string, AudioPlayer> = {};
let audioModeReady = false;

function getPlayer(name: string): AudioPlayer | null {
  if (Platform.OS === 'web') return null;
  const src = ASSETS[name];
  if (!src) return null;
  if (!players[name]) {
    try {
      players[name] = createAudioPlayer(src);
    } catch (e) {
      // expo-audio may not be ready in some preview modes — fail silent
      return null;
    }
  }
  return players[name];
}

/** Configure the audio mode once so SFX play in silent mode on iOS and mix
 *  with other audio. Call from app root. */
export async function ensureAudioMode(): Promise<void> {
  if (Platform.OS === 'web' || audioModeReady) return;
  audioModeReady = true;
  try {
    await setAudioModeAsync({
      playsInSilentMode: true,
      allowsRecording: false,
      shouldPlayInBackground: false,
    });
  } catch {
    // Older preview builds may not implement every option — ignore.
  }
}

function playNative(name: string, volume = 1.0) {
  const p = getPlayer(name);
  if (!p) return;
  try {
    // Reset playhead so rapidly retriggering (e.g. footsteps) restarts cleanly.
    p.volume = Math.max(0, Math.min(1, volume));
    p.seekTo(0);
    p.play();
  } catch {
    // Player may be in transient state; ignore.
  }
}

// ─── WEB: synth oscillator path (kept for richness on web preview) ───
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

// ─── Public API ──────────────────────────────────────────────
// Each method:
//   • web    → schedules oscillators via Web Audio API
//   • native → plays a bundled .wav via expo-audio + fires haptic
export const sfx = {
  click() {
    if (Platform.OS === 'web') tone(720, 50, 'square', 0.05);
    else { playNative('click', 0.6); Haptics.selectionAsync().catch(() => {}); }
  },
  confirm() {
    if (Platform.OS === 'web') {
      tone(880, 60, 'square', 0.07);
      setTimeout(() => tone(1175, 70, 'square', 0.07), 60);
    } else {
      playNative('confirm', 0.7);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  },
  cancel() {
    if (Platform.OS === 'web') tone(330, 100, 'square', 0.06);
    else { playNative('cancel', 0.7); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }
  },
  hit() {
    if (Platform.OS === 'web') sweep(220, 90, 120, 'sawtooth', 0.09);
    else { playNative('hit', 0.85); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium).catch(() => {}); }
  },
  bigHit() {
    if (Platform.OS === 'web') {
      sweep(180, 60, 220, 'square', 0.12);
      setTimeout(() => sweep(120, 40, 180, 'sawtooth', 0.1), 60);
    } else {
      playNative('bigHit', 0.95);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
  },
  damage() {
    if (Platform.OS === 'web') sweep(440, 110, 180, 'square', 0.08);
    else { playNative('damage', 0.85); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {}); }
  },
  heal() {
    if (Platform.OS === 'web') {
      tone(523, 80, 'sine', 0.08);
      setTimeout(() => tone(659, 80, 'sine', 0.08), 80);
      setTimeout(() => tone(784, 100, 'sine', 0.08), 160);
    } else {
      playNative('heal', 0.85);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  },
  victory() {
    if (Platform.OS === 'web') {
      tone(523, 100, 'square', 0.08);
      setTimeout(() => tone(659, 100, 'square', 0.08), 100);
      setTimeout(() => tone(784, 100, 'square', 0.08), 200);
      setTimeout(() => tone(1047, 200, 'square', 0.09), 300);
    } else {
      playNative('victory', 0.9);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  },
  defeat() {
    if (Platform.OS === 'web') {
      sweep(440, 100, 400, 'sawtooth', 0.09);
      setTimeout(() => sweep(220, 50, 500, 'sawtooth', 0.08), 200);
    } else {
      playNative('defeat', 0.85);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Error).catch(() => {});
    }
  },
  levelUp() {
    if (Platform.OS === 'web') {
      tone(523, 80, 'square', 0.07);
      setTimeout(() => tone(659, 80, 'square', 0.07), 80);
      setTimeout(() => tone(784, 80, 'square', 0.07), 160);
      setTimeout(() => tone(1047, 80, 'square', 0.07), 240);
      setTimeout(() => tone(1319, 200, 'square', 0.09), 320);
    } else {
      playNative('levelUp', 0.9);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
    }
  },
  encounter() {
    if (Platform.OS === 'web') {
      sweep(880, 220, 250, 'square', 0.1);
      setTimeout(() => tone(110, 120, 'sawtooth', 0.1), 250);
    } else {
      playNative('encounter', 0.95);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
  },
  skill() {
    if (Platform.OS === 'web') sweep(440, 1320, 200, 'sine', 0.08);
    else { playNative('skill', 0.85); Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {}); }
  },
  bossPhase() {
    if (Platform.OS === 'web') {
      sweep(1320, 80, 600, 'sawtooth', 0.12);
      setTimeout(() => tone(60, 300, 'square', 0.1), 200);
    } else {
      playNative('bossPhase', 1.0);
      Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning).catch(() => {});
    }
  },
  buy() {
    if (Platform.OS === 'web') {
      tone(880, 60, 'sine', 0.08);
      setTimeout(() => tone(1320, 80, 'sine', 0.08), 70);
    } else {
      playNative('buy', 0.85);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light).catch(() => {});
    }
  },
  /** Short metallic clack for each grid step. Light volume so it doesn't fatigue. */
  footstep() {
    if (Platform.OS === 'web') {
      tone(180 + Math.random() * 40, 35, 'square', 0.025);
      tone(90 + Math.random() * 20, 25, 'sawtooth', 0.018);
    } else {
      // Pitch via slight volume jitter; the wav is the same so it stays cheap.
      playNative('footstep', 0.45 + Math.random() * 0.15);
      Haptics.selectionAsync().catch(() => {});
    }
  },
  /** Heavy chain-drop / wood-thud as the throne drawbridge lowers. */
  drawbridge() {
    if (Platform.OS === 'web') {
      sweep(220, 70, 380, 'sawtooth', 0.09);
      setTimeout(() => tone(50, 220, 'square', 0.08), 200);
    } else {
      playNative('drawbridge', 0.95);
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Heavy).catch(() => {});
    }
  },
};
