import { BadRequestException } from '@nestjs/common';
import { parseTrelloBoard, TRELLO_MAX_BYTES } from './trello-parser';

function trelloFixture() {
  return {
    id: 'board-1',
    name: 'Product roadmap',
    desc: 'Board description',
    lists: [
      { id: 'later', name: 'Later', pos: 200, closed: false },
      { id: 'now', name: 'Now', pos: 100, closed: false },
      { id: 'archive', name: 'Archive', pos: 300, closed: true },
    ],
    cards: [
      {
        id: 'b',
        idList: 'now',
        name: 'Second',
        desc: 'Details',
        pos: 200,
        due: '2026-12-01T12:00:00.000Z',
        dueComplete: true,
        closed: false,
      },
      {
        id: 'a',
        idList: 'now',
        name: 'First',
        desc: '',
        pos: 100,
        due: null,
        dueComplete: false,
        closed: false,
      },
      {
        id: 'c',
        idList: 'later',
        name: 'Archived card',
        closed: true,
        pos: 100,
      },
      {
        id: 'd',
        idList: 'archive',
        name: 'Hidden list card',
        closed: false,
        pos: 100,
      },
    ],
    checklists: [
      {
        id: 'check-1',
        idCard: 'a',
        name: 'Release',
        pos: 100,
        checkItems: [
          { id: 'item-2', name: 'Ship', state: 'incomplete', pos: 200 },
          { id: 'item-1', name: 'Test', state: 'complete', pos: 100 },
        ],
      },
    ],
  };
}

describe('Trello parser', () => {
  it('preserves ordering, dates, descriptions and completion without mutating input', () => {
    const input = trelloFixture();
    const before = JSON.stringify(input);
    const parsed = parseTrelloBoard(input);
    expect(parsed.columns.map((list) => list.name)).toEqual(['Now', 'Later']);
    expect(parsed.columns[0]?.cards.map((card) => card.title)).toEqual([
      'First',
      'Second',
    ]);
    expect(parsed.columns[0]?.cards[0]?.items).toEqual([
      { text: 'Release: Test', completed: true },
      { text: 'Release: Ship', completed: false },
    ]);
    expect(parsed.columns[0]?.cards[1]).toMatchObject({
      description: 'Details',
      dueDate: '2026-12-01T12:00:00.000Z',
      done: true,
    });
    expect(parsed.preview).toMatchObject({
      cardCount: 2,
      checklistItemCount: 2,
      skippedLists: 1,
      skippedCards: 2,
    });
    expect(JSON.stringify(input)).toBe(before);
  });

  it('supports empty boards with active lists and missing optional data', () => {
    const parsed = parseTrelloBoard({
      id: 'b',
      name: 'Empty',
      lists: [{ id: 'l', name: 'Todo' }],
      cards: [],
    });
    expect(parsed.preview.cardCount).toBe(0);
    expect(parsed.description).toBeNull();
  });

  it.each([
    ['not a board', {}],
    ['workspace export', { boards: [trelloFixture()] }],
    ['oversized export', { text: 'x'.repeat(TRELLO_MAX_BYTES) }],
    [
      'no active lists',
      { ...trelloFixture(), lists: [], cards: [], checklists: [] },
    ],
    ['overlong name', { ...trelloFixture(), name: 'x'.repeat(129) }],
    [
      'invalid date',
      {
        ...trelloFixture(),
        cards: [{ ...trelloFixture().cards[0], due: 'tomorrow' }],
        checklists: [],
      },
    ],
    [
      'missing list',
      {
        ...trelloFixture(),
        cards: [{ id: 'a', idList: 'missing', name: 'Task' }],
      },
    ],
    ['missing card', { ...trelloFixture(), cards: [] }],
    [
      'duplicate card',
      {
        ...trelloFixture(),
        cards: [trelloFixture().cards[0], trelloFixture().cards[0]],
      },
    ],
  ])('rejects %s', (_label, data) => {
    expect(() => parseTrelloBoard(data)).toThrow(BadRequestException);
  });

  it('rejects aggregate checklist limits and duplicate checklist items', () => {
    const input = trelloFixture();
    const first = input.checklists[0];
    first.checkItems = Array.from({ length: 5001 }, (_, index) => ({
      id: `i-${index}`,
      name: 'Item',
      state: 'complete',
      pos: index,
    }));
    input.checklists.push({
      ...first,
      id: 'check-2',
      checkItems: first.checkItems.map((item) => ({
        ...item,
        id: `${item.id}-2`,
      })),
    });
    expect(() => parseTrelloBoard(input)).toThrow('10,000');
    first.checkItems = [first.checkItems[0], first.checkItems[0]];
    input.checklists = [first];
    expect(() => parseTrelloBoard(input)).toThrow('Duplicate checklist item');
  });
});
