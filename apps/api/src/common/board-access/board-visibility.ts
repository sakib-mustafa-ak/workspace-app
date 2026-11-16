import { sql, type SQLWrapper } from '@repo/database';

/** Correlated predicate used BEFORE pagination on every cross-board read. */
export function boardVisibleTo(userId: string, boardId: SQLWrapper) {
  return sql`EXISTS (
    SELECT 1 FROM boards access_board
    JOIN workspace_members access_member ON access_member.workspace_id = access_board.workspace_id
    WHERE access_board.id = ${boardId} AND access_board.deleted_at IS NULL
      AND access_member.user_id = ${userId} AND access_member.status = 'ACTIVE'
      AND (access_member.role IN ('OWNER', 'ADMIN') OR access_board.access_user_ids IS NULL
        OR access_board.access_user_ids ? ${userId})
  )`;
}

export function canUseBoard(
  role: string,
  userId: string,
  allowed: string[] | null | undefined,
): boolean {
  return (
    role === 'OWNER' ||
    role === 'ADMIN' ||
    allowed == null ||
    allowed.includes(userId)
  );
}
