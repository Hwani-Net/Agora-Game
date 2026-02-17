import { useState, useEffect, useCallback, createContext, useContext, type ReactNode } from 'react';
import { supabase } from './supabase.js';
import { fetchProfile } from './api.js';
import type { Session, User as SupabaseUser } from '@supabase/supabase-js';

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

  const loadProfile = useCallback(async (authUser: SupabaseUser | null) => {
    if (!authUser) {
      setUser(null);
      setLoading(false);
      return;
    }
    try {
      const profile = await fetchProfile();
      setUser(profile as User | null);
    } catch {
      setUser(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // Check current session
    supabase.auth.getSession().then(({ data: { session } }: { data: { session: Session | null } }) => {
      loadProfile(session?.user ?? null);
    });

    // Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      loadProfile(session?.user ?? null);
    });

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  const login = useCallback(async (_name?: string) => {
    // Demo login: use anonymous auth via Supabase
    const { error } = await supabase.auth.signInAnonymously();
    if (error) throw new Error(error.message);
    // Profile will be created by the DB trigger and loaded by onAuthStateChange
  }, []);

  const logout = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    const { data: { session } } = await supabase.auth.getSession();
    await loadProfile(session?.user ?? null);
  }, [loadProfile]);

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, refreshProfile }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuthContext() {
  return useContext(AuthContext);
}
