import React, { useEffect } from 'react';
import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { View, ActivityIndicator } from 'react-native';
import { useFonts, PressStart2P_400Regular } from '@expo-google-fonts/press-start-2p';
import { AuthProvider } from '../src/contexts/AuthContext';
import { GameProvider } from '../src/contexts/GameContext';
import { ensureAudioMode } from '../src/utils/audio';

export default function RootLayout() {
  const [fontsLoaded] = useFonts({
    PressStart2P_400Regular,
  });

  // Configure native audio session once (iOS silent-mode playback,
  // background behaviour). No-op on web.
  useEffect(() => {
    ensureAudioMode();
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
      <AuthProvider>
        <GameProvider>
          <StatusBar style="light" />
          <Stack
            screenOptions={{
              headerShown: false,
              contentStyle: { backgroundColor: '#0a0a14' },
              animation: 'fade',
              animationDuration: 120,   // 0.12s — near-instant overworld→combat fade
            }}
          />
        </GameProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
