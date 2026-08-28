'use client';

import {
  createContext,
  useContext,
  useEffect,
  useState,
  useCallback,
  type ReactNode,
} from 'react';
import { useRouter } from 'next/navigation';

import {
  getMe,
  login as apiLogin,
  register as apiRegister,
  logout as apiLogout,
  getStoredUser,
  storeUser,
  clearSession,
  type User,
} from '@/lib/auth';
import { workspacesApi } from '@/lib/workspaces';
import { getLastActiveWorkspace } from '@/lib/active-workspace';

type AuthContextType = {
  user: User | null;
  loading: boolean;
  login: (email: string, password: string) => Promise<void>;
  register: (email: string, password: string, name: string) => Promise<void>;
  logout: () => Promise<void>;
  refreshUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | null>(null);

async function resolveLandingRoute(): Promise<string> {
  try {
    const workspaces = await workspacesApi.list();
    if (workspaces.length === 0) return '/onboarding';
    const userId = getStoredUser()?.id ?? '';
    const lastActive = userId ? getLastActiveWorkspace(userId) : null;
    const target =
      lastActive && workspaces.some((w) => w.id === lastActive)
        ? lastActive
        : workspaces[0]!.id;
    return `/workspaces/${target}`;
  } catch {
    return '/dashboard';
  }
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const router = useRouter();

  useEffect(() => {
    const token =
      typeof window !== 'undefined'
        ? localStorage.getItem('accessToken')
        : null;
    if (!token) {
      setLoading(false);
      return;
    }

    const stored = getStoredUser();
    if (stored) setUser(stored);

    getMe()
      .then((u) => {
        setUser(u);
        storeUser(u);
      })
      .catch(() => {
        clearSession();
        setUser(null);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(
    async (email: string, password: string) => {
      const res = await apiLogin(email, password);
      setUser(res.user);
      storeUser(res.user);
      router.push(await resolveLandingRoute());
    },
    [router],
  );

  const refreshUser = useCallback(async () => {
    try {
      const u = await getMe();
      setUser(u);
      storeUser(u);
    } catch {
      // handled
    }
  }, []);

  const register = useCallback(
    async (email: string, password: string, name: string) => {
      const res = await apiRegister(email, password, name);
      setUser(res.user);
      storeUser(res.user);
      router.push('/onboarding');
    },
    [router],
  );

  const logout = useCallback(async () => {
    await apiLogout();
    setUser(null);
    router.push('/auth/login');
  }, [router]);

  return (
    <AuthContext.Provider value={{ user, loading, login, register, logout, refreshUser }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
}
