// ============================================================
// AUTOMATION DETECTION — TS port of LoginSequenceController
// ------------------------------------------------------------
// Detects when the app is running inside an automated browser
// (Playwright / WebDriver) and exposes a single boolean used to
// bypass the manual login UI.
//
// Detection cascade (web-only — always false on native):
//   1. ?automation=1 / ?playwright=1 / ?e2e=1 URL query param
//   2. navigator.webdriver === true   (Playwright sets this)
//   3. window.__PLAYWRIGHT__ shimmed flag (manual escape hatch)
//
// Native (iOS / Android) callers always receive `false` — automated
// tests on those platforms use a different harness.
// ============================================================
import { Platform } from 'react-native';

const AUTOMATION_QUERY_KEYS = ['automation', 'playwright', 'e2e'];

export type AutomationFlags = {
  enabled: boolean;
  /** Optional target route from `?to=conduit-maze` etc. */
  redirectTo?: string;
};

function readAutomationFlagsWeb(): AutomationFlags {
  if (typeof window === 'undefined' || typeof window.location === 'undefined') {
    return { enabled: false };
  }
  try {
    const params = new URLSearchParams(window.location.search || '');
    for (const k of AUTOMATION_QUERY_KEYS) {
      const v = params.get(k);
      if (v === '1' || v === 'true' || v === 'yes') {
        return { enabled: true, redirectTo: params.get('to') || undefined };
      }
    }
    // Playwright + most webdrivers set navigator.webdriver to true.
    if (typeof navigator !== 'undefined' && (navigator as any).webdriver === true) {
      return { enabled: true, redirectTo: params.get('to') || undefined };
    }
    // Manual escape hatch — pages can set `window.__PLAYWRIGHT__ = true`
    // before the bundle boots (handy in CI pre-scripts).
    if (typeof (window as any).__PLAYWRIGHT__ !== 'undefined' && (window as any).__PLAYWRIGHT__) {
      return { enabled: true, redirectTo: params.get('to') || undefined };
    }
  } catch {
    /* defensive: never crash on SSR / locked-down browsers */
  }
  return { enabled: false };
}

/**
 * Returns automation flags. Cached on first call to avoid re-parsing
 * the URL on every render.
 */
let _cache: AutomationFlags | null = null;
export function detectAutomation(): AutomationFlags {
  if (_cache) return _cache;
  if (Platform.OS !== 'web') {
    _cache = { enabled: false };
    return _cache;
  }
  _cache = readAutomationFlagsWeb();
  if (_cache.enabled) {
    // eslint-disable-next-line no-console
    console.log('[automation] PLAYWRIGHT DETECTED — bypassing login flow', _cache);
  }
  return _cache;
}

/** Test-only: reset cache between runs. */
export function _resetAutomationCache() {
  _cache = null;
}
