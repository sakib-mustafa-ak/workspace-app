import { api } from './api';
import { recordRecentProfile } from './recent-profiles';

export type User = {
  id: string;
  email: string;
  displayName: string | null;
  avatarUrl: string | null;
  status: string;
  emailVerifiedAt: string | null;
  createdAt: string;
  isAdmin: boolean;
};

export type AuthTokens = {
  accessToken: string;
  refreshToken: string;
  accessTokenExpiresInSeconds: number;
  refreshTokenExpiresInSeconds: number;
};

export type AuthResponse = {
  user: User;
  tokens: AuthTokens;
};

export async function login(
  email: string,
  password: string,
): Promise<AuthResponse> {
  const data = await api.post<AuthResponse>('/auth/login', {
    email,
    password,
  });
  localStorage.setItem('accessToken', data.tokens.accessToken);
  localStorage.setItem('refreshToken', data.tokens.refreshToken);
  recordRecentProfile({ id: data.user.id, displayName: data.user.displayName ?? '', email: data.user.email });
  return data;
}

export async function register(
  email: string,
  password: string,
  displayName: string,
): Promise<AuthResponse> {
  const data = await api.post<AuthResponse>('/auth/register', {
    email,
    password,
    displayName,
  });
  localStorage.setItem('accessToken', data.tokens.accessToken);
  localStorage.setItem('refreshToken', data.tokens.refreshToken);
  recordRecentProfile({ id: data.user.id, displayName: data.user.displayName ?? '', email: data.user.email });
  return data;
}

export async function logout(): Promise<void> {
  try {
    const refreshToken = localStorage.getItem('refreshToken');
    await api.post('/auth/logout', refreshToken ? { refreshToken } : {});
  } catch {
    // handled
  } finally {
    localStorage.removeItem('accessToken');
    localStorage.removeItem('refreshToken');
  }
}

export async function getMe(): Promise<User> {
  return api.get<User>('/auth/me');
}

export function getStoredUser(): User | null {
  if (typeof window === 'undefined') return null;
  const raw = localStorage.getItem('user');
  if (!raw || raw === 'undefined') return null;
  try {
    return JSON.parse(raw);
  } catch {
    return null;
  }
}

export function storeUser(user: User): void {
  localStorage.setItem('user', JSON.stringify(user));
}

export function clearSession(): void {
  localStorage.removeItem('accessToken');
  localStorage.removeItem('refreshToken');
  localStorage.removeItem('user');
}

export async function requestVerification(email: string): Promise<void> {
  await api.post('/auth/request-verification', { email });
}

export async function verifyEmail(token: string): Promise<{ userId: string; email: string }> {
  return api.post<{ userId: string; email: string }>('/auth/verify-email', { token });
}

export async function requestPasswordReset(email: string): Promise<void> {
  await api.post('/auth/request-password-reset', { email });
}

export async function resetPassword(
  token: string,
  newPassword: string,
): Promise<{ userId: string; revokedSessionIds: string[] }> {
  return api.post<{ userId: string; revokedSessionIds: string[] }>(
    '/auth/reset-password',
    { token, newPassword },
  );
}
