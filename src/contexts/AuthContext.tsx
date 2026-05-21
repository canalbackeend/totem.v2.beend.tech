import React, { createContext, useContext, useEffect, useState } from 'react';
import { api, setAuthToken } from '../lib/api';

interface User {
  id: string;
  email: string;
  nome?: string;
  empresa?: string;
  terminal_id?: string;
  [key: string]: any;
}

interface Session {
  access_token: string;
  user: User;
}

interface Profile {
  id: string;
  logo_url?: string;
  [key: string]: any;
}

interface AuthContextType {
  session: Session | null;
  user: User | null;
  profile: Profile | null;
  loading: boolean;
  isAdmin: boolean;
  isMasterAdmin: boolean;
  isTerminal: boolean;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
  updateSession: (session: Session) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

const ADMIN_EMAILS = import.meta.env.VITE_ADMIN_EMAILS ? import.meta.env.VITE_ADMIN_EMAILS.split(',').map((e: string) => e.trim()) : ['adm@beend.tech'];
const MASTER_ADMIN_EMAILS = import.meta.env.VITE_MASTER_ADMIN_EMAILS ? import.meta.env.VITE_MASTER_ADMIN_EMAILS.split(',').map((e: string) => e.trim()) : [];

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  const isAdmin = user?.email && !user?.terminal_id ? ADMIN_EMAILS.includes(user.email) : false;
  const isMasterAdmin = user?.email && !user?.terminal_id ? MASTER_ADMIN_EMAILS.includes(user.email) : false;
  const isTerminal = !!user?.terminal_id;

  const updateSession = (newSession: Session) => {
    setAuthToken(newSession.access_token);
    setSession(newSession);
    setUser(newSession.user);
    setProfile(newSession.user as Profile);
  };

  const loadUser = async () => {
    const token = typeof window !== 'undefined' ? localStorage.getItem('access_token') : null;
    if (!token) {
      setLoading(false);
      return;
    }

    try {
      const data = await api.get('/auth/me');
      if (data.user) {
        setUser(data.user);
        setProfile(data.user as Profile);
        setSession({ access_token: token, user: data.user });
      } else {
        setAuthToken(null);
      }
    } catch (err) {
      console.error('Failed to load user', err);
      setAuthToken(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadUser();

    // Silent refresh logic (already implemented in original but adapted)
    const handleFocus = () => {
      if (document.visibilityState === 'visible') {
        loadUser();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleFocus);

    return () => {
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleFocus);
    };
  }, []);

  const handleSignOut = async () => {
    setAuthToken(null);
    setSession(null);
    setUser(null);
    setProfile(null);
  };

  const refreshProfile = async () => {
    await loadUser();
  };

  return (
    <AuthContext.Provider value={{ 
      session, 
      user, 
      profile, 
      loading, 
      isAdmin, 
      isMasterAdmin, 
      isTerminal,
      signOut: handleSignOut, 
      refreshProfile,
      updateSession 
    }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
