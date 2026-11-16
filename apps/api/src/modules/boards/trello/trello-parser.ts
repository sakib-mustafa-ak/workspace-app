import { BadRequestException } from '@nestjs/common';
import { z } from 'zod';

export const TRELLO_MAX_BYTES = 5 * 1024 * 1024;
const id = z.string().min(1).max(128);
const position = z.number().finite().default(0);
const title = (max: number) => z.string().trim().min(1).max(max);
const schema = z.object({
  id,
  name: title(128),
  desc: z.string().max(100_000).default(''),
  lists: z
    .array(
      z.object({
        id,
        name: title(64),
        closed: z.boolean().default(false),
        pos: position,
      }),
    )
    .max(100),
  cards: z
    .array(
      z.object({
        id,
        idList: id,
        name: title(256),
        desc: z.string().max(100_000).default(''),
        closed: z.boolean().default(false),
        pos: position,
        due: z.iso.datetime({ offset: true }).nullable().default(null),
        dueComplete: z.boolean().default(false),
      }),
    )
    .max(2000),
  checklists: z
    .array(
      z.object({
        id,
        idCard: id,
        name: title(256),
        pos: position,
        checkItems: z
          .array(
            z.object({
              id,
              name: title(4096),
              pos: position,
              state: z.enum(['complete', 'incomplete']),
            }),
          )
          .max(10000),
      }),
    )
    .max(2000)
    .default([]),
});

function invalid(message: string): never {
  throw new BadRequestException({ code: 'TRELLO.INVALID_EXPORT', message });
}

function unique(rows: Array<{ id: string }>, label: string) {
  if (new Set(rows.map((row) => row.id)).size !== rows.length)
    invalid(`Duplicate ${label} IDs in this export.`);
}

export function parseTrelloBoard(input: unknown) {
  if (Buffer.byteLength(JSON.stringify(input) ?? '', 'utf8') > TRELLO_MAX_BYTES)
    invalid('Choose a Trello JSON export smaller than 5 MB.');
  const result = schema.safeParse(input);
  if (!result.success) {
    const issue = result.error.issues[0];
    invalid(
      `Invalid Trello board export at ${issue?.path.join('.') || 'board'}: ${issue?.message ?? 'unsupported format'}. Export a single board as JSON.`,
    );
  }
  const data = result.data;
  unique(data.lists, 'list');
  unique(data.cards, 'card');
  unique(data.checklists, 'checklist');
  const items = data.checklists.flatMap((list) => list.checkItems);
  if (items.length > 10000)
    invalid('Exports may contain at most 10,000 checklist items.');
  unique(items, 'checklist item');
  const listIds = new Set(data.lists.map((list) => list.id));
  const cardIds = new Set(data.cards.map((card) => card.id));
  if (data.cards.some((card) => !listIds.has(card.idList)))
    invalid('A card references a missing list. Export the complete board.');
  if (data.checklists.some((list) => !cardIds.has(list.idCard)))
    invalid(
      'A checklist references a missing card. Export the complete board.',
    );
  const byPosition = <T extends { pos: number }>(a: T, b: T) => a.pos - b.pos;
  const columns = data.lists
    .filter((list) => !list.closed)
    .sort(byPosition)
    .map((list) => ({
      name: list.name,
      cards: data.cards
        .filter((card) => !card.closed && card.idList === list.id)
        .sort(byPosition)
        .map((card) => ({
          title: card.name,
          description: card.desc || null,
          dueDate: card.due,
          done: card.dueComplete,
          items: data.checklists
            .filter((checklist) => checklist.idCard === card.id)
            .sort(byPosition)
            .flatMap((checklist) =>
              [...checklist.checkItems].sort(byPosition).map((item) => ({
                text: `${checklist.name}: ${item.name}`,
                completed: item.state === 'complete',
              })),
            ),
        })),
    }));
  if (!columns.length) invalid('This board has no active lists to import.');
  const cardCount = columns.reduce(
    (sum, column) => sum + column.cards.length,
    0,
  );
  return {
    name: data.name,
    description: data.desc || null,
    columns,
    preview: {
      name: data.name,
      lists: columns.map((column) => ({
        name: column.name,
        cards: column.cards.length,
      })),
      cardCount,
      checklistItemCount: columns.reduce(
        (sum, column) =>
          sum +
          column.cards.reduce((count, card) => count + card.items.length, 0),
        0,
      ),
      skippedLists: data.lists.length - columns.length,
      skippedCards: data.cards.length - cardCount,
      warnings: [
        'Archived lists and cards are skipped.',
        'Members, labels, comments, attachments, custom fields, automations and history are not imported.',
        'Cards marked due-complete in Trello become Done. Other cards become To do.',
        'Checklist names are added as prefixes to their items.',
      ],
    },
  };
}
