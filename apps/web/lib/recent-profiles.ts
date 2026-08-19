export type RecentProfile = {
  id: string;
  displayName: string;
  email: string;
  lastLoginAt: string;
};

const KEY = 'recentProfiles';
const MAX = 4;

export function getRecentProfiles(): RecentProfile[] {
  if (typeof window === 'undefined') return [];
  const raw = window.localStorage.getItem(KEY);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((p): p is RecentProfile => p && typeof p.id === 'string' && typeof p.email === 'string')
      .sort((a, b) => (a.lastLoginAt < b.lastLoginAt ? 1 : -1))
      .slice(0, MAX);
  } catch {
    return [];
  }
}

export function recordRecentProfile(p: {
  id: string;
  displayName: string;
  email: string;
}): void {
  if (typeof window === 'undefined') return;
  const next: RecentProfile[] = [
    { ...p, lastLoginAt: new Date().toISOString() },
    ...getRecentProfiles().filter((x) => x.id !== p.id),
  ].slice(0, MAX);
  window.localStorage.setItem(KEY, JSON.stringify(next));
}

export function removeRecentProfile(id: string): void {
  if (typeof window === 'undefined') return;
  window.localStorage.setItem(
    KEY,
    JSON.stringify(getRecentProfiles().filter((p) => p.id !== id)),
  );
}
