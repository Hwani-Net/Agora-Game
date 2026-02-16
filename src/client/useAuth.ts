import { useState, useCallback } from 'react';
import { api, setToken, clearToken as clearStoredToken } from './api.js';

interface User {
  id: string;
  email: string;
  name: string;
  isPremium: boolean;
  gold_balance: number;
  agents_count: number;
  portfolio_value: number;
}

let cachedUser: User | null = null;

export function useAuth() {
  const [user, setUser] = useState<User | null>(cachedUser);
  const [loading, setLoading] = useState(false);

  const login = useCallback(async (name?: string) => {
    setLoading(true);
    try {
      const result = await api.post<{ user: User; token: string }>('/users/demo-login', { name });
      setToken(result.token);

      const profile = await api.get<User>('/users/me');
      cachedUser = profile;
      setUser(profile);
      return profile;
    } catch (err) {
      console.error('Login failed:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  }, []);

  const fetchProfile = useCallback(async () => {
    try {
      const profile = await api.get<User>('/users/me');
      cachedUser = profile;
      setUser(profile);
      return profile;
    } catch {
      cachedUser = null;
      setUser(null);
      clearStoredToken();
      return null;
    }
  }, []);

  const logout = useCallback(() => {
    clearStoredToken();
    cachedUser = null;
    setUser(null);
  }, []);

  return { user, loading, login, logout, fetchProfile };
}
