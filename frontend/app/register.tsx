import React, { useState } from 'react';
import { View, StyleSheet, TextInput, KeyboardAvoidingView, Platform, ScrollView } from 'react-native';
import { router } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { COLORS } from '../src/data/gameData';
import { PixelText } from '../src/components/PixelText';
import { PixelButton } from '../src/components/PixelButton';
import { useAuth } from '../src/contexts/AuthContext';
import { formatError } from '../src/utils/api';

export default function RegisterScreen() {
  const { register } = useAuth();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const submit = async () => {
    setError('');
    if (password.length < 4) {
      setError('Password must be 4+ chars');
      return;
    }
    setLoading(true);
    try {
      await register(email.trim(), password, name.trim() || 'Cadet');
      router.replace('/');
    } catch (e: any) {
      setError(formatError(e?.response?.data?.detail) || e.message || 'Registration failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : 'height'}>
        <ScrollView contentContainerStyle={styles.scroll} keyboardShouldPersistTaps="handled">
          <PixelText size={10} color={COLORS.neonGreen} style={{ marginBottom: 6 }}>{'> NEW_CADET_REGISTRATION_'}</PixelText>
          <PixelText size={28} color={COLORS.neonMagenta} glow bold>ENROLL</PixelText>
          <View style={styles.divider} />

          <View style={styles.field}>
            <PixelText size={10} color={COLORS.textDim}>CADET NAME</PixelText>
            <TextInput style={styles.input} value={name} onChangeText={setName} placeholder="Your name" placeholderTextColor={COLORS.textDim} testID="register-name" />
          </View>
          <View style={styles.field}>
            <PixelText size={10} color={COLORS.textDim}>EMAIL</PixelText>
            <TextInput style={styles.input} value={email} onChangeText={setEmail} placeholder="cadet@nexus.io" placeholderTextColor={COLORS.textDim} keyboardType="email-address" autoCapitalize="none" testID="register-email" />
          </View>
          <View style={styles.field}>
            <PixelText size={10} color={COLORS.textDim}>PASSWORD</PixelText>
            <TextInput style={styles.input} value={password} onChangeText={setPassword} placeholder="********" placeholderTextColor={COLORS.textDim} secureTextEntry testID="register-password" />
          </View>

          {error ? <PixelText size={11} color={COLORS.neonRed} style={{ marginTop: 8 }}>! {error}</PixelText> : null}

          <View style={{ marginTop: 24, gap: 12 }}>
            <PixelButton title={loading ? 'ENROLLING…' : 'JOIN ACADEMY'} onPress={submit} disabled={loading || !email || !password} color={COLORS.neonMagenta} size="lg" full testID="register-submit" />
            <PixelButton title="HAVE ACCOUNT? LOGIN" onPress={() => router.replace('/login')} color={COLORS.neonCyan} full />
            <PixelButton title="BACK" onPress={() => router.back()} color={COLORS.textDim} full />
          </View>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: COLORS.bg },
  scroll: { padding: 24, flexGrow: 1, justifyContent: 'center' },
  divider: { width: 100, height: 2, backgroundColor: COLORS.neonMagenta, marginVertical: 16, opacity: 0.6 },
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
