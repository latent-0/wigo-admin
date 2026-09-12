import { describe, it, expect } from 'vitest';
import { createDatabase } from '../data/store';
import { seed } from '../data/seed';
import { computeKpis } from '../services/kpi.service';

describe('KPIs exclude soft-deleted rows (11 Sep fix)', () => {
  it('does not count the soft-deleted rider', async () => {
    const db = createDatabase();
    await seed(db);
    const before = computeKpis(db);
    // Seed has 8 live riders + 1 soft-deleted. Total must be 8, not 9.
    expect(before.riders.total).toBe(8);

    // Soft-deleting a live rider drops the count by one and never resurrects deleted rows.
    db.riders.softDelete('rdr_001');
    const after = computeKpis(db);
    expect(after.riders.total).toBe(7);
  });

  it('counts applications by status without inflating buckets', async () => {
    const db = createDatabase();
    await seed(db);
    const kpis = computeKpis(db);
    const sum =
      kpis.applications.submitted +
      kpis.applications.in_review +
      kpis.applications.approved +
      kpis.applications.rejected;
    expect(sum).toBe(kpis.applications.total);
  });
});
