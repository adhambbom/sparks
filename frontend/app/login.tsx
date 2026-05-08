import React, { useState } from 'react';
import { View, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { useAuth } from '../src/contexts/AuthContext';
import { formatError } from '../src/utils/api';

export default function LoginScreen() {
  const { login } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    setLoading(true);
    try {
      await login(email.trim(), password);
      router.replace('/');
    } catch (e: any) {
      setError(formatError(e?.response?.data?.detail) || e.message || 'Login failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <PixelText size={10} color={COLORS.neonMagenta} style={{ marginBottom: 6 }}>{'> AUTHENTICATE_'}</PixelText>
          <PixelText size={28} color={COLORS.neonCyan} glow bold>LOGIN</PixelText>
          <View style={styles.divider} />

          <View style={styles.field}>
            <PixelText size={10} color={COLORS.textDim}>EMAIL</PixelText>
            <TextInput
              style={styles.input}
              value={email}
              onChangeText={setEmail}
              placeholder="cadet@nexus.io"
              placeholderTextColor={COLORS.textDim}
              keyboardType="email-address"
              autoCapitalize="none"
              autoCorrect={false}
              testID="login-email"
            />
          </View>

          <View style={styles.field}>
            <PixelText size={10} color={COLORS.textDim}>PASSWORD</PixelText>
            <TextInput
              style={styles.input}
              value={password}
              onChangeText={setPassword}
              placeholder="********"
              placeholderTextColor={COLORS.textDim}
              secureTextEntry
              testID="login-password"
            />
          </View>

          {error ? (
            <PixelText size={11} color={COLORS.neonRed} style={{ marginTop: 8 }}>! {error}</PixelText>
          ) : null}

          <View style={{ marginTop: 24, gap: 12 }}>
            <PixelButton title={loading ? 'CONNECTING…' : 'LOGIN'} onPress={submit} disabled={loading || !email || !password} color={COLORS.neonCyan} size="lg" full testID="login-submit" />
            <PixelButton title="CREATE ACCOUNT" onPress={() => router.replace('/register')} color={COLORS.neonMagenta} full testID="login-go-register" />
            <PixelButton title="BACK" onPress={() => router.back()} color={COLORS.textDim} full />
          </View>

          <PixelText size={9} color={COLORS.textDim} style={{ marginTop: 24, textAlign: 'center' }}>
            DEMO: admin@example.com / admin123
          </PixelText>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  divider: { width: 100, height: 2, backgroundColor: COLORS.neonCyan, marginVertical: 16, opacity: 0.6 },
  field: { marginVertical: 8 },
  input: {
    marginTop: 6,
    backgroundColor: COLORS.panel,
    borderWidth: 2,
    borderColor: COLORS.border,
    color: COLORS.text,
    paddingHorizontal: 14,
    paddingVertical: 12,
    fontSize: 16,
    letterSpacing: 1,
  },
});
