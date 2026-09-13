import type { Application } from '../domain/types';

export type ApplicationSort = 'createdAt' | 'pickupAt';

/**
 * Null-safe sort for the Applications view. Buy applications have no pickup time, so
 * sorting on `pickupAt` must not throw and must not scramble the table — Buy rows sort
 * last (the 13 Sep fix: "sort on pickupAt broke on null"). Sorting is stable-ish via a
 * createdAt tiebreak.
 */
export function sortApplications(rows: Application[], sort: ApplicationSort, dir: 'asc' | 'desc'): Application[] {
  const factor = dir === 'asc' ? 1 : -1;
  return [...rows].sort((a, b) => {
    if (sort === 'pickupAt') {
      const av = a.pickupAt;
      const bv = b.pickupAt;
      // Nulls always sink to the bottom regardless of sort direction.
      if (av === null && bv === null) return b.createdAt.localeCompare(a.createdAt);
      if (av === null) return 1;
      if (bv === null) return -1;
      const cmp = av.localeCompare(bv);
      return cmp !== 0 ? cmp * factor : b.createdAt.localeCompare(a.createdAt);
    }
    return a.createdAt.localeCompare(b.createdAt) * factor;
  });
}
