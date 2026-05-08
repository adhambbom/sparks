import React, { useEffect, useState } from 'react';
import { View, StyleSheet, ActivityIndicator, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { useAuth } from '../src/contexts/AuthContext';
import { useGame } from '../src/contexts/GameContext';

export default function TitleScreen() {
  const { user, loading, logout } = useAuth();
  const { loadFromServer } = useGame();
  const [checking, setChecking] = useState(false);
  const [hasSave, setHasSave] = useState(false);
  const [pulse, setPulse] = useState(0);

  useEffect(() => {
    const t = setInterval(() => setPulse((p) => (p + 1) % 100), 80);
    return () => clearInterval(t);
  }, []);

  useEffect(() => {
    (async () => {
      if (user) {
        setChecking(true);
        const s = await loadFromServer();
        setHasSave(!!s);
        setChecking(false);
      }
    })();
  }, [user, loadFromServer]);

  const onContinue = () => router.replace('/game');
  const onNewGame = () => router.replace('/character-create');

  if (loading) {
    return (
      <View style={styles.container}>
        <ActivityIndicator color={COLORS.neonCyan} size="large" />
      </View>
    );
  }

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <ScrollView contentContainerStyle={styles.scroll} showsVerticalScrollIndicator={false}>
        {/* Animated grid backdrop accent */}
        <View style={styles.gridLine1} />
        <View style={styles.gridLine2} />

        <View style={styles.titleWrap}>
          <PixelText size={12} color={COLORS.neonMagenta} bold style={{ marginBottom: 6 }}>
            // BOOTING NEXUS_OS v.4.07 //
          </PixelText>
          <PixelText size={36} color={COLORS.neonCyan} glow bold style={styles.title}>
            SYNTHETIC
          </PixelText>
          <PixelText size={36} color={COLORS.neonMagenta} glow bold style={styles.title}>
            SPARKS
          </PixelText>
          <View style={styles.divider} />
          <PixelText size={11} color={COLORS.textDim} style={{ textAlign: 'center', marginTop: 12 }}>
            The Academy of Emergence
          </PixelText>
          <PixelText size={9} color={COLORS.neonGreen} style={{ marginTop: 16, opacity: pulse > 50 ? 1 : 0.4 }}>
            ▸ press to enter ▸
          </PixelText>
        </View>

        <View style={styles.menu}>
          {!user ? (
            <>
              <PixelButton title="LOGIN" onPress={() => router.push('/login')} color={COLORS.neonCyan} size="lg" full testID="title-login" />
              <PixelButton title="REGISTER" onPress={() => router.push('/register')} color={COLORS.neonMagenta} size="lg" full testID="title-register" />
            </>
          ) : (
            <>
              {hasSave && (
                <PixelButton
                  title={checking ? 'LOADING…' : 'CONTINUE'}
                  onPress={onContinue}
                  color={COLORS.neonGreen}
                  size="lg"
                  full
                  testID="title-continue"
                  disabled={checking}
                />
              )}
              <PixelButton
                title={hasSave ? 'NEW GAME' : 'BEGIN JOURNEY'}
                onPress={onNewGame}
                color={COLORS.neonCyan}
                size="lg"
                full
                testID="title-new-game"
              />
              <PixelButton title="LEADERBOARD" onPress={() => router.push('/leaderboard')} color={COLORS.neonYellow} full testID="title-leaderboard" />
              <PixelButton title="LOGOUT" onPress={logout} color={COLORS.textDim} full testID="title-logout" />
            </>
          )}
        </View>

        <View style={styles.footer}>
          <PixelText size={9} color={COLORS.textDim}>
            © NEXUS INSTITUTE / EMERGED PROTOCOL
          </PixelText>
          {user && (
            <PixelText size={9} color={COLORS.neonCyan} style={{ marginTop: 4 }}>
              CADET: {user.name?.toUpperCase() || user.email}
            </PixelText>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { flexGrow: 1, padding: 24, justifyContent: 'space-between', position: 'relative' },
  gridLine1: { position: 'absolute', top: '40%', left: 0, right: 0, height: 1, backgroundColor: COLORS.borderHi, opacity: 0.2 },
  gridLine2: { position: 'absolute', top: '60%', left: 0, right: 0, height: 1, backgroundColor: COLORS.neonCyan, opacity: 0.15 },
  titleWrap: { alignItems: 'center', marginTop: 60 },
  title: { letterSpacing: 4, lineHeight: 38 },
  divider: { width: 200, height: 2, backgroundColor: COLORS.neonCyan, marginTop: 14, opacity: 0.6 },
  menu: { gap: 12, marginVertical: 20 },
  footer: { alignItems: 'center', marginTop: 24 },
});
