const KEY_PREFIX = 'lastActiveWorkspace:';

function keyFor(userId: string): string {
  return `${KEY_PREFIX}${userId}`;
}

export function getLastActiveWorkspace(userId: string): string | null {
  if (typeof window === 'undefined') return null;
  try {
    return localStorage.getItem(keyFor(userId));
  } catch {
    return null;
  }
}

export function setLastActiveWorkspace(
  userId: string,
  workspaceId: string,
): void {
  if (typeof window === 'undefined') return;
  try {
    localStorage.setItem(keyFor(userId), workspaceId);
  } catch {
    // storage unavailable (private mode etc.) — persistence is best-effort
  }
}
