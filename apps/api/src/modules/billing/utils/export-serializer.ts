import type { AuditEventRow } from '@repo/database';

export type ExportFormat = 'json' | 'csv';

export type ExportPayload = {
  fileName: string;
  contentType: string;
  data: string;
};

function dateStamp(d: Date): string {
  return d.toISOString().slice(0, 10).replace(/-/g, '');
}

function csvField(value: string | null | undefined): string {
  if (value === null || value === undefined) return '';
  const s = String(value);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function buildExportPayload(
  rows: AuditEventRow[],
  format: ExportFormat,
): ExportPayload {
  const stamp = dateStamp(new Date());
  if (format === 'csv') {
    const header = [
      'id',
      'workspaceId',
      'userId',
      'action',
      'resourceType',
      'resourceId',
      'metadata',
      'createdAt',
    ];
    const lines = rows.map((r) =>
      [
        csvField(r.id),
        csvField(r.workspaceId),
        csvField(r.userId),
        csvField(r.action),
        csvField(r.resourceType),
        csvField(r.resourceId),
        csvField(JSON.stringify(r.metadata ?? {})),
        csvField(r.createdAt.toISOString()),
      ].join(','),
    );
    return {
      fileName: `audit-${stamp}.csv`,
      contentType: 'text/csv',
      data: [header.join(','), ...lines].join('\n'),
    };
  }
  return {
    fileName: `audit-${stamp}.json`,
    contentType: 'application/json',
    data: JSON.stringify(
      rows.map((r) => ({
        id: r.id,
        workspaceId: r.workspaceId,
        userId: r.userId,
        action: r.action,
        resourceType: r.resourceType,
        resourceId: r.resourceId,
        metadata: r.metadata ?? {},
        createdAt: r.createdAt.toISOString(),
      })),
      null,
      2,
    ),
  };
}
