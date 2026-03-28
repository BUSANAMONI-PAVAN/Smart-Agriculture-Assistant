import { createContext, ReactNode, useContext, useEffect, useMemo, useState } from 'react';
import { api, type AuthSessionResponse, type AuthUser, type FeatureFlag } from '../services/api';

const TOKEN_KEY = 'accessToken';
const USER_KEY = 'authUser';
const FEATURES_KEY = 'featureFlags';

type AuthContextValue = {
  user: AuthUser | null;
  token: string | null;
  features: FeatureFlag[];
  loading: boolean;
  isAuthenticated: boolean;
  canAccessAdmin: boolean;
  acceptSession: (session: AuthSessionResponse) => void;
  logout: () => Promise<void>;
  refreshSession: () => Promise<void>;
  applyFeatureFlags: (nextFeatures: FeatureFlag[]) => void;
  isFeatureEnabled: (key: string) => boolean;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function readStoredUser() {
  const raw = localStorage.getItem(USER_KEY);
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}

function readStoredFeatures() {
  const raw = localStorage.getItem(FEATURES_KEY);
  if (!raw) return [] as FeatureFlag[];
  try {
    return JSON.parse(raw) as FeatureFlag[];
  } catch {
    return [];
  }
}

function persistSession(token: string, user: AuthUser, features: FeatureFlag[]) {
  localStorage.setItem(TOKEN_KEY, token);
  localStorage.setItem(USER_KEY, JSON.stringify(user));
  localStorage.setItem(FEATURES_KEY, JSON.stringify(features));
  localStorage.setItem('isAuthenticated', 'true');
  localStorage.setItem('userId', user.id);
  localStorage.setItem('userName', user.name);
}

function clearSession() {
  localStorage.removeItem(TOKEN_KEY);
  localStorage.removeItem(USER_KEY);
  localStorage.removeItem(FEATURES_KEY);
  localStorage.removeItem('isAuthenticated');
  localStorage.removeItem('userId');
  localStorage.removeItem('userName');
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [token, setToken] = useState<string | null>(() => localStorage.getItem(TOKEN_KEY));
  const [user, setUser] = useState<AuthUser | null>(() => readStoredUser());
  const [features, setFeatures] = useState<FeatureFlag[]>(() => readStoredFeatures());
  const [loading, setLoading] = useState(Boolean(localStorage.getItem(TOKEN_KEY)));

  const applyFeatureFlags = (nextFeatures: FeatureFlag[]) => {
    setFeatures(nextFeatures);
    localStorage.setItem(FEATURES_KEY, JSON.stringify(nextFeatures));
  };

  const refreshSession = async () => {
    if (!localStorage.getItem(TOKEN_KEY)) {
      setLoading(false);
      setUser(null);
      setToken(null);
      setFeatures([]);
      return;
    }

    setLoading(true);
    try {
      const session = await api.getCurrentSession();
      setUser(session.user);
      setToken(localStorage.getItem(TOKEN_KEY));
      applyFeatureFlags(session.features);
      localStorage.setItem(USER_KEY, JSON.stringify(session.user));
      localStorage.setItem('isAuthenticated', 'true');
      localStorage.setItem('userId', session.user.id);
      localStorage.setItem('userName', session.user.name);
    } catch {
      clearSession();
      setUser(null);
      setToken(null);
      setFeatures([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void refreshSession();
  }, []);

  const acceptSession = (session: AuthSessionResponse) => {
    persistSession(session.token, session.user, session.features);
    setToken(session.token);
    setUser(session.user);
    setFeatures(session.features);
  };

  const logout = async () => {
    try {
      if (token) {
        await api.logout();
      }
    } catch {
      // Local logout should still succeed when backend is unavailable.
    } finally {
      clearSession();
      setUser(null);
      setToken(null);
      setFeatures([]);
      setLoading(false);
    }
  };

  const canAccessAdmin = Boolean(
    user && user.role === 'admin' && user.status === 'active',
  );

  const isFeatureEnabled = (key: string) => {
    const feature = features.find((item) => item.key === key);
    return feature ? feature.enabled : true;
  };

  const value = useMemo(
    () => ({
      user,
      token,
      features,
      loading,
      isAuthenticated: Boolean(user && token),
      canAccessAdmin,
      acceptSession,
      logout,
      refreshSession,
      applyFeatureFlags,
      isFeatureEnabled,
    }),
    [user, token, features, loading, canAccessAdmin],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) {
    throw new Error('useAuth must be used within AuthProvider');
  }
  return context;
}
