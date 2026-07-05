/**
 * ErrorBoundary — production safety net.
 *
 * Catches uncaught render-time exceptions anywhere below it in the
 * component tree. Without this, the Hermes + new-arch runtime can
 * promote unhandled JS exceptions to a native process kill on Android
 * (the dreaded "App keeps stopping" dialog).
 *
 * Showing a recoverable fallback screen lets the player tap RETURN and
 * try again, AND surfaces the actual error message so we can debug
 * without needing adb logcat.
 */
import React from 'react';
import { View, Text, ScrollView, TouchableOpacity, StyleSheet, Platform } from 'react-native';

type State = { error: Error | null; info: string };

export class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  State
> {
  state: State = { error: null, info: '' };

  static getDerivedStateFromError(error: Error): State {
    return { error, info: '' };
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // eslint-disable-next-line no-console
    if (__DEV__) console.error('[ErrorBoundary]', error, info);
    this.setState({ info: info?.componentStack ?? '' });
  }

  handleReset = () => {
    this.setState({ error: null, info: '' });
  };

  render() {
    if (!this.state.error) return this.props.children;

    const msg = this.state.error?.message ?? String(this.state.error);
    return (
      <View style={styles.root}>
        <ScrollView contentContainerStyle={styles.scroll}>
          <Text style={styles.banner}>{'// SYSTEM FAULT //'}</Text>
          <Text style={styles.title}>CRITICAL ERROR</Text>
          <Text style={styles.sub}>
            The Operator console encountered an unrecoverable exception.
          </Text>
          <View style={styles.box}>
            <Text style={styles.label}>ERROR</Text>
            <Text style={styles.code} selectable>{msg}</Text>
          </View>
          {!!this.state.info && (
            <View style={styles.box}>
              <Text style={styles.label}>COMPONENT STACK</Text>
              <Text style={styles.codeSmall} selectable>{this.state.info.trim()}</Text>
            </View>
          )}
          <Text style={styles.hint}>
            If this keeps happening, please report the error text above.
          </Text>
          <TouchableOpacity style={styles.btn} onPress={this.handleReset} accessibilityRole="button">
            <Text style={styles.btnText}>↻ RETURN TO TITLE</Text>
          </TouchableOpacity>
          <Text style={styles.platform}>
            {Platform.OS.toUpperCase()} · build v1.0.0
          </Text>
        </ScrollView>
      </View>
    );
  }
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: '#0a0a14' },
  scroll: { padding: 24, paddingTop: 60, alignItems: 'center' },
  banner: { color: '#ff4566', fontSize: 11, marginBottom: 12, letterSpacing: 1 },
  title: { color: '#ff4566', fontSize: 22, marginBottom: 8, fontWeight: '700', letterSpacing: 2 },
  sub: { color: '#8088aa', fontSize: 12, textAlign: 'center', marginBottom: 24, lineHeight: 18 },
  box: { width: '100%', backgroundColor: '#101426', borderColor: '#ff456644', borderWidth: 1, padding: 12, marginBottom: 16, borderRadius: 4 },
  label: { color: '#ff4566', fontSize: 10, marginBottom: 6, letterSpacing: 1 },
  code: { color: '#e4e6f2', fontSize: 12, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  codeSmall: { color: '#a4a7b8', fontSize: 10, fontFamily: Platform.select({ ios: 'Menlo', android: 'monospace' }) },
  hint: { color: '#6b6f88', fontSize: 11, textAlign: 'center', marginBottom: 20 },
  btn: { backgroundColor: '#00f0ff', paddingVertical: 14, paddingHorizontal: 28, borderRadius: 4 },
  btnText: { color: '#0a0a14', fontSize: 14, fontWeight: '700', letterSpacing: 2 },
  platform: { color: '#444a66', fontSize: 9, marginTop: 24, letterSpacing: 1 },
});
