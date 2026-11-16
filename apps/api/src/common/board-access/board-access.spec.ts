import { canUseBoard } from './board-visibility';
import { BoardPresenceService } from './board-presence.service';

describe('board permissions', () => {
  it('keeps public boards available and grants restricted boards explicitly', () => {
    expect(canUseBoard('EDITOR', 'member', null)).toBe(true);
    expect(canUseBoard('EDITOR', 'member', [])).toBe(false);
    expect(canUseBoard('VIEWER', 'member', ['member'])).toBe(true);
    expect(canUseBoard('EDITOR', 'member', ['another'])).toBe(false);
    expect(canUseBoard('OWNER', 'owner', [])).toBe(true);
    expect(canUseBoard('ADMIN', 'admin', [])).toBe(true);
  });
  it('deduplicates active canvas users across tabs and removes disconnected sockets', () => {
    const presence = new BoardPresenceService();
    presence.join('tab-1', 'member', 'Alice', 'board');
    presence.join('tab-2', 'member', 'Alice', 'board');
    expect(presence.list('board')).toHaveLength(1);
    presence.leave('tab-1');
    expect(presence.list('board')).toHaveLength(1);
    presence.leave('tab-2', 'board');
    expect(presence.list('board')).toHaveLength(0);
    presence.join('tab-3', 'other', 'Bob', 'board');
    presence.clearBoard('board');
    expect(presence.list('board')).toHaveLength(0);
  });
});
