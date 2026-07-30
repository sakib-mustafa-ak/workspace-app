import { pgEnum } from 'drizzle-orm/pg-core';

export const canvasObjectTypeEnum = pgEnum('canvas_object_type', [
  'RECTANGLE',
  'ELLIPSE',
  'TEXT',
  'STICKY_NOTE',
  'IMAGE',
  'ARROW',
  'LINE',
  'PATH',
  'FRAME',
  'CONNECTOR',
]);

export const canvasObjectStatusEnum = pgEnum('canvas_object_status', [
  'ACTIVE',
  'ARCHIVED',
]);
