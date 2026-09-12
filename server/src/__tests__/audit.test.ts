import { describe, it, expect } from 'vitest';
import { createDatabase } from '../data/store';
import { queryAudit } from '../services/audit.service';
import type { AuditEntry } from '../domain/types';

function entry(id: string, at: string, action = 'test.action'): AuditEntry {
  return { id, at, actorId: 'usr_x', actorRole: 'admin', action, target: null, meta: {} };
}

describe('audit date-range filter casts to timestamp (11 Sep fix)', () => {
  it('returns rows across a month boundary', () => {
    const db = createDatabase();
    db.audit.append(entry('a1', '2026-07-31T23:00:00.000Z'));
    db.audit.append(entry('a2', '2026-08-15T12:00:00.000Z'));
    db.audit.append(entry('a3', '2026-09-01T00:30:00.000Z'));

    // A range spanning 30 July -> 1 September must include the 1 September row.
    const rows = queryAudit(db, { from: '2026-07-30', to: '2026-09-01' });
    const ids = rows.map((r) => r.id).sort();
    expect(ids).toEqual(['a1', 'a2', 'a3']);
  });

  it('filters by actor and action substring', () => {
    const db = createDatabase();
    db.audit.append({ ...entry('a1', '2026-09-10T09:00:00.000Z', 'rider.status_change'), actorId: 'usr_ops' });
    db.audit.append({ ...entry('a2', '2026-09-10T09:05:00.000Z', 'payment.topup'), actorId: 'usr_finance' });

    expect(queryAudit(db, { actorId: 'usr_ops' }).map((r) => r.id)).toEqual(['a1']);
    expect(queryAudit(db, { action: 'payment' }).map((r) => r.id)).toEqual(['a2']);
  });

  it('returns newest first', () => {
    const db = createDatabase();
    db.audit.append(entry('old', '2026-09-01T00:00:00.000Z'));
    db.audit.append(entry('new', '2026-09-18T00:00:00.000Z'));
    expect(queryAudit(db, {}).map((r) => r.id)).toEqual(['new', 'old']);
  });
});
