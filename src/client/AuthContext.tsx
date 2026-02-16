import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { api, setToken, clearToken, getToken } from './api.js';

// ─── Types ───

interface User {
  id: string;
  email: string;
  name: string;
  isPremium: boolean;
  gold_balance: number;
  agents_count: number;
  portfolio_value: number;
}

interface AuthContextType {
  user: User | null;
  loading: boolean;
  login: (name?: string) => Promise<void>;
  logout: () => void;
  refreshProfile: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  loading: false,
  login: async () => {},
  logout: () => {},
  refreshProfile: async () => {},
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);

  const fetchProfile = useCallback(async () => {
    if (!getToken()) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const profile = await api.get<User>('/users/me');
      setUser(profile);
    } catch {
      setUser(null);
      clearToken();
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchProfile();
  }, [fetchProfile]);

  const login = useCallback(async (name?: string) => {
    const result = await api.post<{ user: User; token: string }>('/users/demo-login', { name });
    setToken(result.token);
    const profile = await api.get<User>('/users/me');
    setUser(profile);
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshProfile: fetchProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
