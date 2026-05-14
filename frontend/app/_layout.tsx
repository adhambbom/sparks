import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator, Platform } from 'react-native';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { AuthProvider } from '../src/contexts/AuthContext';
import { GameProvider } from '../src/contexts/GameContext';
import { TutorialProvider } from '../src/contexts/TutorialContext';
import { TutorialOverlay } from '../src/components/TutorialOverlay';
import { ErrorBoundary } from '../src/components/ErrorBoundary';
import { ensureAudioMode } from '../src/utils/audio';
import { resetTutorialState } from '../src/systems/tutorialState';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PressStart2P_400Regular,
  });

  // Configure native audio session once (iOS silent-mode playback,
  // background behaviour). No-op on web.
  useEffect(() => {
    ensureAudioMode();
  }, []);

  // ── QA RESET HOOK ─────────────────────────────────────────────────
  // Append `?resetTutorial=1` to the URL (web) OR set the deep-link
  // param in a development build to wipe the AsyncStorage tutorial
  // flag set. Useful for verifying onboarding pacing on each new
  // device without uninstalling the app.
  // The hook only runs on web for now — it's the only place a URL
  // query is reliably visible without expo-router navigation hooks.
  useEffect(() => {
    if (Platform.OS !== 'web') return;
    try {
      const url = typeof window !== 'undefined' ? window.location?.search ?? '' : '';
      if (url.includes('resetTutorial=1')) {
        void resetTutorialState();
        // eslint-disable-next-line no-console
        console.log('[Sparks] Tutorial flags cleared via ?resetTutorial=1');
      }
    } catch { /* silent — non-critical */ }
  }, []);

  if (!fontsLoaded) {
    return (
      <View style={{ flex: 1, backgroundColor: '#0a0a14', alignItems: 'center', justifyContent: 'center' }}>
        <ActivityIndicator color="#00f0ff" size="large" />
      </View>
    );
  }

  return (
    <SafeAreaProvider>
      <ErrorBoundary>
        <AuthProvider>
          <GameProvider>
            <TutorialProvider>
              <StatusBar style="light" />
              <Stack
                screenOptions={{
                  headerShown: false,
                  contentStyle: { backgroundColor: '#0a0a14' },
                  animation: 'fade',
                  animationDuration: 120,   // 0.12s — near-instant overworld→combat fade
                }}
              />
              {/* Global tutorial overlay — rendered above every screen via Modal. */}
              <TutorialOverlay />
            </TutorialProvider>
          </GameProvider>
        </AuthProvider>
      </ErrorBoundary>
    </SafeAreaProvider>
  );
}
