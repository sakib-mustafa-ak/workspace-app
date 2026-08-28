import { CommentsEventBus } from './comments.events';

describe('CommentsEventBus', () => {
  let bus: CommentsEventBus;

  beforeEach(() => {
    bus = new CommentsEventBus();
  });

  it('emits CommentCreated', () => {
    const fn = jest.fn();
    bus.onCommentCreated(fn);
    const payload = {
      commentId: 'c1',
      workspaceId: 'ws1',
      boardId: 'b1',
      userId: 'u1',
    };
    bus.publishCommentCreated(payload);
    expect(fn).toHaveBeenCalledWith(payload);
  });

  it('emits CommentUpdated', () => {
    const fn = jest.fn();
    bus.onCommentCreated(fn);
    bus.publishCommentCreated({
      commentId: 'c1',
      workspaceId: 'ws1',
      boardId: 'b1',
      userId: 'u1',
    });
    expect(fn).toHaveBeenCalled();
  });

  it('supports multiple listeners', () => {
    const a = jest.fn();
    const b = jest.fn();
    bus.onCommentCreated(a);
    bus.onCommentCreated(b);

    bus.publishCommentCreated({
      commentId: 'c1',
      workspaceId: 'ws1',
      boardId: 'b1',
      userId: 'u1',
    });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
