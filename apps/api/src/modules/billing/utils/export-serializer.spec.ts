import type { AuditEventRow } from '@repo/database';
import { buildExportPayload } from './export-serializer';

const row: AuditEventRow = {
  id: 'a1',
  workspaceId: 'ws-1',
  userId: 'u-1',
  action: 'board.created',
  resourceType: 'board',
  resourceId: 'b-1',
  metadata: { name: 'Plan, "Q3"', n: 1 },
  createdAt: new Date('2026-08-30T12:00:00.000Z'),
};

describe('buildExportPayload', () => {
  it('serializes JSON with ISO dates and an .json filename', () => {
    const out = buildExportPayload([row], 'json');
    expect(out.contentType).toBe('application/json');
    expect(out.fileName).toMatch(/\.json$/);
    const parsed = JSON.parse(out.data) as Array<Record<string, unknown>>;
    expect(parsed[0]).toMatchObject({
      id: 'a1',
      action: 'board.created',
      createdAt: '2026-08-30T12:00:00.000Z',
    });
  });

  it('serializes CSV with header row and escaped fields', () => {
    const out = buildExportPayload([row], 'csv');
    expect(out.contentType).toBe('text/csv');
    expect(out.fileName).toMatch(/\.csv$/);
    const lines = out.data.split('\n');
    expect(lines[0]).toBe(
      'id,workspaceId,userId,action,resourceType,resourceId,metadata,createdAt',
    );
    expect(lines[1]).toContain('""Q3');
  });
});
