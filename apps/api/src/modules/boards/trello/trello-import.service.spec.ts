import { ForbiddenException } from '@nestjs/common';
import type { Db } from '@repo/database';
import { boards, boardColumns, tasks, checklistItems } from '@repo/database';
import { UsageService } from '../../billing/services/usage.service';
import { BoardsEventBus } from '../events/boards.events';
import { TrelloImportService } from './trello-import.service';
function trelloFixture() {
  return {
    id: 'b',
    name: 'Product roadmap',
    lists: [
      { id: 'now', name: 'Now', pos: 0 },
      { id: 'later', name: 'Later', pos: 1 },
    ],
    cards: [
      { id: 'first', idList: 'now', name: 'First', pos: 0 },
      {
        id: 'second',
        idList: 'now',
        name: 'Second',
        pos: 1,
        due: '2026-12-01T12:00:00.000Z',
        dueComplete: true,
      },
    ],
    checklists: [
      {
        id: 'check',
        idCard: 'first',
        name: 'Release',
        checkItems: [{ id: 'item', name: 'Test', state: 'complete' }],
      },
    ],
  };
}

function setup() {
  const writes: Array<{ table: unknown; rows: unknown }> = [];
  const forUpdate = jest.fn().mockResolvedValue([{ id: 'workspace' }]);
  const where = jest
    .fn()
    .mockImplementation(() =>
      Object.assign(Promise.resolve([{ position: 7 }]), { for: forUpdate }),
    );
  const tx = {
    select: jest
      .fn()
      .mockReturnValue({ from: jest.fn().mockReturnValue({ where }) }),
    insert: jest.fn().mockImplementation((table: unknown) => ({
      values: (rows: unknown) => {
        writes.push({ table, rows });
        return Object.assign(Promise.resolve(), {
          returning: () =>
            Promise.resolve([{ id: 'new-board', name: 'Product roadmap' }]),
        });
      },
    })),
  };
  const transaction = jest
    .fn()
    .mockImplementation(
      async (run: (executor: typeof tx) => Promise<unknown>) => run(tx),
    );
  const usage = {
    requireWorkspaceRole: jest.fn().mockResolvedValue(undefined),
    assertCanCreateBoard: jest.fn().mockResolvedValue(undefined),
  };
  const events = { publishBoardCreated: jest.fn() };
  const service = new TrelloImportService(
    { transaction } as unknown as Db,
    usage as unknown as UsageService,
    events as unknown as BoardsEventBus,
  );
  return { service, usage, events, tx, transaction, writes, forUpdate };
}

describe('Trello import service', () => {
  it('previews without transactions or writes', async () => {
    const { service, transaction, usage } = setup();
    expect(
      await service.preview('workspace', 'user', trelloFixture()),
    ).toMatchObject({ cardCount: 2 });
    expect(usage.requireWorkspaceRole).toHaveBeenCalledWith(
      'workspace',
      'user',
      'EDITOR',
    );
    expect(transaction).not.toHaveBeenCalled();
  });

  it('creates mapped records with new IDs, the next free position, and a post-commit event', async () => {
    const { service, writes, events, forUpdate, transaction } = setup();
    await service.importBoard('workspace', 'user', trelloFixture());
    expect(forUpdate).toHaveBeenCalledWith('update');
    expect(writes[0]).toEqual({
      table: boards,
      rows: expect.objectContaining({
        position: 8,
        workspaceId: 'workspace',
      }) as unknown,
    });
    expect(writes[1]).toEqual({
      table: boardColumns,
      rows: expect.arrayContaining([
        expect.objectContaining({ name: 'Now', position: 0 }),
      ]) as unknown,
    });
    expect(writes[2]).toEqual({
      table: tasks,
      rows: [
        expect.objectContaining({
          title: 'First',
          status: 'TODO',
          position: 0,
          createdById: 'user',
        }),
        expect.objectContaining({
          title: 'Second',
          status: 'DONE',
          dueDate: new Date('2026-12-01T12:00:00.000Z'),
        }),
      ],
    });
    expect(writes[3]).toEqual({
      table: checklistItems,
      rows: expect.arrayContaining([
        expect.objectContaining({ text: 'Release: Test', completed: true }),
      ]) as unknown,
    });
    expect(events.publishBoardCreated).toHaveBeenCalledWith({
      boardId: 'new-board',
      workspaceId: 'workspace',
      createdBy: 'user',
    });
    expect(
      events.publishBoardCreated.mock.invocationCallOrder[0],
    ).toBeGreaterThan(transaction.mock.invocationCallOrder[0]);
  });

  it('rejects unauthorized users before starting a transaction', async () => {
    const { service, usage, transaction } = setup();
    usage.requireWorkspaceRole.mockRejectedValue(new ForbiddenException());
    await expect(
      service.importBoard('workspace', 'viewer', trelloFixture()),
    ).rejects.toThrow(ForbiddenException);
    expect(transaction).not.toHaveBeenCalled();
  });

  it('rejects plan limits before inserting anything', async () => {
    const { service, usage, writes, events } = setup();
    usage.assertCanCreateBoard.mockRejectedValue(
      new ForbiddenException('Board limit reached'),
    );
    await expect(
      service.importBoard('workspace', 'user', trelloFixture()),
    ).rejects.toThrow('Board limit');
    expect(writes).toHaveLength(0);
    expect(events.publishBoardCreated).not.toHaveBeenCalled();
  });

  it('propagates write failures through the transaction and does not publish events', async () => {
    const { service, tx, events } = setup();
    tx.insert
      .mockImplementationOnce(() => ({
        values: () => ({ returning: () => Promise.resolve([{ id: 'b' }]) }),
      }))
      .mockImplementationOnce(() => {
        throw new Error('Database write failed');
      });
    await expect(
      service.importBoard('workspace', 'user', trelloFixture()),
    ).rejects.toThrow('Database write failed');
    expect(events.publishBoardCreated).not.toHaveBeenCalled();
  });
});
