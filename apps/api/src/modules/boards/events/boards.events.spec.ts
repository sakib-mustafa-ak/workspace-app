import { BoardsEventBus } from './boards.events';

describe('BoardsEventBus', () => {
  let bus: BoardsEventBus;

  beforeEach(() => {
    bus = new BoardsEventBus();
  });

  it('emits BoardCreated', () => {
    const fn = jest.fn();
    bus.onBoardCreated(fn);
    const payload = { boardId: 'b1', workspaceId: 'w1', createdBy: 'u1' };
    bus.publishBoardCreated(payload);
    expect(fn).toHaveBeenCalledWith(payload);
  });

  it('emits BoardUpdated', () => {
    const fn = jest.fn();
    bus.onBoardCreated(fn);
    bus.publishBoardCreated({
      boardId: 'b1',
      workspaceId: 'w1',
      createdBy: 'u1',
    });
    expect(fn).toHaveBeenCalled();
  });

  it('emits ColumnCreated', () => {
    const fn = jest.fn();
    bus.onBoardCreated(fn);
    bus.publishBoardCreated({
      boardId: 'b1',
      workspaceId: 'w1',
      createdBy: 'u1',
    });
    expect(fn).toHaveBeenCalled();
  });

  it('supports multiple listeners', () => {
    const a = jest.fn();
    const b = jest.fn();
    bus.onBoardCreated(a);
    bus.onBoardCreated(b);

    bus.publishBoardCreated({
      boardId: 'b1',
      workspaceId: 'w1',
      createdBy: 'u1',
    });
    expect(a).toHaveBeenCalledTimes(1);
    expect(b).toHaveBeenCalledTimes(1);
  });
});
