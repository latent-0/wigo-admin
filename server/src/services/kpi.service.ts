import type { Database } from '../data/store';

export interface Kpis {
  riders: { total: number; active: number; suspended: number; pending: number };
  applications: { total: number; submitted: number; in_review: number; approved: number; rejected: number };
  deposits: { activeCount: number; settledCount: number; pendingCount: number; failedCount: number; totalSettledCents: number };
  documents: { pending: number };
  notifications: { failed: number };
  walletBalanceCents: number;
}

/**
 * KPI counts. Every count comes from Collection.all(), which excludes soft-deleted rows
 * — this is the "applications-by-status double-counting soft-deleted rows" fix from
 * 11 Sep, enforced structurally rather than per-query.
 */
export function computeKpis(db: Database): Kpis {
  const riders = db.riders.all();
  const applications = db.applications.all();
  const deposits = db.deposits.all();

  const settled = deposits.filter((d) => d.status === 'settled');
  const pending = deposits.filter((d) => d.status === 'pending');
  const failed = deposits.filter((d) => d.status === 'failed');

  return {
    riders: {
      total: riders.length,
      active: riders.filter((r) => r.status === 'active').length,
      suspended: riders.filter((r) => r.status === 'suspended').length,
      pending: riders.filter((r) => r.status === 'pending').length,
    },
    applications: {
      total: applications.length,
      submitted: applications.filter((a) => a.status === 'submitted').length,
      in_review: applications.filter((a) => a.status === 'in_review').length,
      approved: applications.filter((a) => a.status === 'approved').length,
      rejected: applications.filter((a) => a.status === 'rejected').length,
    },
    deposits: {
      activeCount: settled.length + pending.length,
      settledCount: settled.length,
      pendingCount: pending.length,
      failedCount: failed.length,
      totalSettledCents: settled.reduce((sum, d) => sum + d.amountCents, 0),
    },
    documents: { pending: db.documents.filter((d) => d.status === 'pending').length },
    notifications: { failed: db.notifications.filter((n) => n.status === 'failed').length },
    walletBalanceCents: riders.reduce((sum, r) => sum + r.walletBalanceCents, 0),
  };
}
