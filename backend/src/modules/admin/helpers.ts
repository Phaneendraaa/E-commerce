import type { Request, Response } from 'express';
import { db, schema } from '../../db';

export async function audit(req: Request, action: string, entity: string, entityId?: string | null, meta?: unknown) {
  await db
    .insert(schema.auditLogs)
    .values({ userId: req.user?.id ?? null, action, entity, entityId: entityId ?? null, meta: meta as any })
    .catch(() => undefined);
}

function csvCell(v: unknown): string {
  if (v === null || v === undefined) return '';
  const s = v instanceof Date ? v.toISOString() : typeof v === 'object' ? JSON.stringify(v) : String(v);
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function sendCsv(res: Response, filename: string, rows: Record<string, unknown>[]) {
  const headers = rows.length ? Object.keys(rows[0]) : [];
  const body = [headers.join(','), ...rows.map((r) => headers.map((h) => csvCell(r[h])).join(','))].join('\n');
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
  res.send('﻿' + body); // BOM so Excel opens UTF-8 correctly
}

export const rupees = (paise: number | null | undefined) => (paise == null ? '' : (paise / 100).toFixed(2));
