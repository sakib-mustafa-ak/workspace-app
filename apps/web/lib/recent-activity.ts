import { getStoredUser } from '@/lib/auth';

const STORAGE_KEY = 'recentBoards';
const MAX_ITEMS = 5;

export type RecentBoard = {
  id: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
  visitedAt: string;
};

/**
 * Key is namespaced per user so recent boards never leak across accounts
 * that share the same browser (the previous single shared key showed
 * another account's boards on the dashboard).
 */
function storageKey(): string {
  const userId = getStoredUser()?.id ?? 'anon';
  return `${STORAGE_KEY}:${userId}`;
}

export function getRecentBoards(): RecentBoard[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(storageKey()) || '[]');
  } catch { return []; }
}

export function addRecentBoard(board: Omit<RecentBoard, 'visitedAt'>) {
  const recent = getRecentBoards().filter((b) => b.id !== board.id);
  recent.unshift({ ...board, visitedAt: new Date().toISOString() });
  localStorage.setItem(storageKey(), JSON.stringify(recent.slice(0, MAX_ITEMS)));
}
