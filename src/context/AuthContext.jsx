import { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';
import { authService } from '../services/authService.js';

/*
  Shared authentication state.
    user            current user (with permission codes) or null
    isAuthenticated true when a user is signed in
    isInitializing  true while a saved session is being checked on page load
    sessionNotice   message to show on the login page (e.g. session ended)
    login / logout / refreshUser / expireSession
    hasPermission(code), hasAnyPermission(codes)
*/
const AuthContext = createContext(null);
const STORAGE_KEY = 'pms.session.v2';

function readSession() {
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

function writeSession(session) {
  try {
    if (session) sessionStorage.setItem(STORAGE_KEY, JSON.stringify(session));
    else sessionStorage.removeItem(STORAGE_KEY);
  } catch {
    // storage unavailable: the session lasts until the page reloads
  }
}

export function AuthProvider({ children }) {
  const [user, setUser] = useState(null);
  const [isInitializing, setIsInitializing] = useState(() => Boolean(readSession()));
  const [sessionNotice, setSessionNotice] = useState('');

  // On page load: restore a saved session by asking the service who the user is.
  useEffect(() => {
    const saved = readSession();
    if (!saved) return undefined;
    let cancelled = false;

    authService
      .getCurrentUser(saved.userId)
      .then((current) => {
        if (!cancelled) setUser(current);
      })
      .catch(() => {
        writeSession(null);
        if (!cancelled) setSessionNotice('Your session has ended. Please sign in again.');
      })
      .finally(() => {
        if (!cancelled) setIsInitializing(false);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  // Throws an ApiError on failure so the login form can show the message.
  const login = useCallback(async (credentials) => {
    const { user: signedIn, token } = await authService.login(credentials);
    writeSession({ userId: signedIn.id, token });
    setSessionNotice('');
    setUser(signedIn);
    return signedIn;
  }, []);

  const logout = useCallback(async () => {
    try {
      await authService.logout();
    } finally {
      writeSession(null);
      setSessionNotice('');
      setUser(null);
    }
  }, []);

  // Call when the API reports an expired or invalid session (HTTP 401).
  const expireSession = useCallback(() => {
    writeSession(null);
    setUser(null);
    setSessionNotice('Your session has expired. Please sign in again.');
  }, []);

  // Reload the current user (e.g. after editing your own profile).
  const refreshUser = useCallback(async () => {
    const saved = readSession();
    if (!saved) return;
    try {
      setUser(await authService.getCurrentUser(saved.userId));
    } catch {
      expireSession();
    }
  }, [expireSession]);

  const value = useMemo(() => {
    const permissions = user?.permissions || [];
    return {
      user,
      isAuthenticated: Boolean(user),
      isInitializing,
      sessionNotice,
      login,
      logout,
      refreshUser,
      expireSession,
      hasPermission: (code) => permissions.includes(code),
      hasAnyPermission: (codes) => codes.some((code) => permissions.includes(code)),
    };
  }, [user, isInitializing, sessionNotice, login, logout, refreshUser, expireSession]);

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error('useAuth must be used inside <AuthProvider>');
  return context;
}
