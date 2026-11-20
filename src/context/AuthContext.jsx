import { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { authService } from '../services/authService.js';
import { getErrorMessage } from '../services/apiError.js';
import { config } from '../utils/config.js';

const AuthContext = createContext(null);
const STORAGE_KEY = 'pms.session.v2';
function mockSession() { try { return JSON.parse(sessionStorage.getItem(STORAGE_KEY) || 'null'); } catch { return null; } }
function saveMockSession(value) { try { value ? sessionStorage.setItem(STORAGE_KEY, JSON.stringify(value)) : sessionStorage.removeItem(STORAGE_KEY); } catch { /* Storage can be unavailable. */ } }

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [sessionNotice, setSessionNotice] = useState('');
  const generation = useRef(0);

  useEffect(() => {
    let cancelled = false;
    const saved = config.isMock ? mockSession() : null;
    if (!config.isMock) saveMockSession(null);
    if (config.isMock && !saved) { setIsInitializing(false); return undefined; }
    authService.getCurrentUser(saved?.userId)
      .then((current) => { if (!cancelled) setUser(current); })
      .catch((error) => {
        if (cancelled) return;
        if (config.isMock) saveMockSession(null);
        if (error.status !== 401) setSessionNotice(getErrorMessage(error, 'Could not restore your session.'));
      })
      .finally(() => { if (!cancelled) setIsInitializing(false); });
    return () => { cancelled = true; };
  }, []);

  const login = useCallback(async (credentials) => {
    const result = await authService.login(credentials);
    generation.current += 1;
    if (config.isMock) saveMockSession({ userId: result.user.id, token: result.token });
    setUser(result.user); setSessionNotice(''); return result.user;
  }, []);

  const expireSession = useCallback(() => {
    generation.current += 1;
    if (config.isMock) saveMockSession(null);
    setUser(null); setSessionNotice('Your session has expired. Please sign in again.');
  }, []);

  const logout = useCallback(async () => {
    await authService.logout();
    generation.current += 1;
    if (config.isMock) saveMockSession(null);
    setUser(null); setSessionNotice('');
  }, []);

  const refreshUser = useCallback(async () => {
    const currentGeneration = generation.current;
    try {
      const current = await authService.getCurrentUser(config.isMock ? mockSession()?.userId : undefined);
      if (currentGeneration === generation.current) setUser(current);
    } catch (error) {
      if (currentGeneration === generation.current && error.status === 401) expireSession();
    }
  }, [expireSession]);

  const changePassword = useCallback(async (values) => {
    const current = await authService.changePassword(values);
    generation.current += 1; setUser(current); return current;
  }, []);

  useEffect(() => {
    window.addEventListener('layerflow:session-expired', expireSession);
    window.addEventListener('layerflow:access-changed', refreshUser);
    return () => { window.removeEventListener('layerflow:session-expired', expireSession); window.removeEventListener('layerflow:access-changed', refreshUser); };
  }, [expireSession, refreshUser]);

  useEffect(() => {
    if (!user || config.isMock) return undefined;
    const onVisible = () => { if (document.visibilityState === 'visible') refreshUser(); };
    document.addEventListener('visibilitychange', onVisible);
    const timer = setInterval(onVisible, 60_000);
    return () => { clearInterval(timer); document.removeEventListener('visibilitychange', onVisible); };
  }, [Boolean(user), refreshUser]);

  const value = useMemo(() => ({
    user, isAuthenticated: Boolean(user), isInitializing, sessionNotice,
    login, logout, refreshUser, expireSession, changePassword,
    hasPermission: (code) => (user?.permissions || []).includes(code),
    hasAnyPermission: (codes) => codes.some((code) => (user?.permissions || []).includes(code)),
  }), [user, isInitializing, sessionNotice, login, logout, refreshUser, expireSession, changePassword]);
  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
