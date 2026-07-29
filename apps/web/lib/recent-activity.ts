const STORAGE_KEY = 'recentBoards';
const MAX_ITEMS = 5;

export type RecentBoard = {
  id: string;
  name: string;
  workspaceId: string;
  workspaceName: string;
  visitedAt: string;
};

export function getRecentBoards(): RecentBoard[] {
  if (typeof window === 'undefined') return [];
  try {
    return JSON.parse(localStorage.getItem(STORAGE_KEY) || '[]');
  } catch { return []; }
}

export function addRecentBoard(board: Omit<RecentBoard, 'visitedAt'>) {
  const recent = getRecentBoards().filter((b) => b.id !== board.id);
  recent.unshift({ ...board, visitedAt: new Date().toISOString() });
  localStorage.setItem(STORAGE_KEY, JSON.stringify(recent.slice(0, MAX_ITEMS)));
}