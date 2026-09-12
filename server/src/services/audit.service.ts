import type { Database } from '../data/store';
import type { AuditEntry } from '../domain/types';

export interface AuditQuery {
  actorId?: string;
  action?: string; // substring match
  from?: string; // ISO date/datetime, inclusive
  to?: string; // ISO date/datetime, inclusive
}

/**
 * Query the audit log. Date-range filtering casts BOTH sides to a numeric timestamp
 * before comparing — the 11 Sep fix for the bug where comparing ISO strings returned
 * zero rows across a month boundary. Results are newest-first.
 */
export function queryAudit(db: Database, q: AuditQuery): AuditEntry[] {
  const fromTs = q.from ? Date.parse(q.from) : Number.NEGATIVE_INFINITY;
  const toTs = q.to ? endOfRange(q.to) : Number.POSITIVE_INFINITY;

  return db.audit
    .all()
    .filter((e) => {
      if (q.actorId && e.actorId !== q.actorId) return false;
      if (q.action && !e.action.includes(q.action)) return false;
      const ts = Date.parse(e.at);
      return ts >= fromTs && ts <= toTs;
    })
    .slice()
    .sort((a, b) => Date.parse(b.at) - Date.parse(a.at));
}

/**
 * If `to` is a bare date (no time component), treat it as inclusive of the whole day so
 * a range like from=2026-07-30&to=2026-09-01 includes events on 1 September.
 */
function endOfRange(to: string): number {
  const base = Date.parse(to);
  if (Number.isNaN(base)) return Number.POSITIVE_INFINITY;
  if (/^\d{4}-\d{2}-\d{2}$/.test(to)) {
    return base + 24 * 60 * 60 * 1000 - 1;
  }
  return base;
}
