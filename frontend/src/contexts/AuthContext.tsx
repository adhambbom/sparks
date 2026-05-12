import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { api } from '../utils/api';
import { detectAutomation } from '../utils/automation';

type User = { id: string; email: string; name: string; role: string } | null;

type AuthCtx = {
  user: User;
  loading: boolean;
  /** True when running inside Playwright / WebDriver — UI may
   *  skip the manual login form entirely. */
  automation: boolean;
  /** Optional auto-redirect route hinted by the backend bypass. */
  automationRedirect?: string;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
};

const AuthContext = createContext<AuthCtx>({} as AuthCtx);

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<User>(null);
  const [loading, setLoading] = useState(true);
  const automationFlags = detectAutomation();
  const [automationRedirect, setAutomationRedirect] = useState<string | undefined>(
    automationFlags.redirectTo,
  );

  const fetchMe = useCallback(async () => {
    try {
      const { data } = await api.get('/auth/me');
      setUser(data);
      return data;
    } catch {
      setUser(null);
      return null;
    }
  }, []);

  const automationBypass = useCallback(async () => {
    try {
      // eslint-disable-next-line no-console
      console.log('[auth] injecting automation bypass session…');
      const { data } = await api.post('/auth/automation-bypass');
      if (data?.access_token) {
        await AsyncStorage.setItem('access_token', data.access_token);
      }
      if (data?.redirect) setAutomationRedirect(data.redirect);
      // Populate user immediately so consumers don't flicker through `loading→null→user`.
      setUser({
        id: data.id,
        email: data.email,
        name: data.name,
        role: data.role,
      });
      return data;
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[auth] automation bypass failed', e);
      return null;
    }
  }, []);

  useEffect(() => {
    (async () => {
      const me = await fetchMe();
      if (!me && automationFlags.enabled) {
        await automationBypass();
      }
      setLoading(false);
    })();
    // run-once on mount
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const login = async (email: string, password: string) => {
    const { data } = await api.post('/auth/login', { email, password });
    if (data.access_token) await AsyncStorage.setItem('access_token', data.access_token);
    // Login response only returns tokens — fetch the full user profile separately.
    await fetchMe();
  };

  const register = async (email: string, password: string, name: string) => {
    const { data } = await api.post('/auth/register', { email, password, name });
    if (data.access_token) await AsyncStorage.setItem('access_token', data.access_token);
    await fetchMe();
  };

  const logout = async () => {
    try { await api.post('/auth/logout'); } catch {}
    await AsyncStorage.removeItem('access_token');
    setUser(null);
  };

  return (
    <AuthContext.Provider value={{ user, loading, automation: automationFlags.enabled, automationRedirect, login, register, logout }}>
      {children}
    </AuthContext.Provider>
  );
}
