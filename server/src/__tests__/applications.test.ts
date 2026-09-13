import { describe, it, expect } from 'vitest';
import { sortApplications } from '../services/applications.service';
import type { Application } from '../domain/types';

function app(id: string, pickupAt: string | null, createdAt: string): Application {
  return {
    id,
    createdAt,
    updatedAt: createdAt,
    deletedAt: null,
    riderId: 'rdr_x',
    applicantName: id,
    kind: pickupAt === null ? 'buy' : 'rent',
    status: 'submitted',
    rentalPackage: pickupAt === null ? null : 'weekly-basic',
    pickupLocation: pickupAt === null ? null : 'Hub',
    pickupAt,
  };
}

describe('applications null-safe sort (13 Sep fix)', () => {
  const rows = [
    app('rent_late', '2026-09-22T10:00:00.000Z', '2026-09-13T09:00:00.000Z'),
    app('buy_null', null, '2026-09-14T09:00:00.000Z'),
    app('rent_early', '2026-09-18T10:00:00.000Z', '2026-09-12T09:00:00.000Z'),
  ];

  it('does not throw on null pickupAt and sinks Buy rows to the bottom (asc)', () => {
    const sorted = sortApplications(rows, 'pickupAt', 'asc');
    expect(sorted.map((r) => r.id)).toEqual(['rent_early', 'rent_late', 'buy_null']);
  });

  it('sinks Buy rows to the bottom regardless of direction (desc)', () => {
    const sorted = sortApplications(rows, 'pickupAt', 'desc');
    expect(sorted.map((r) => r.id)).toEqual(['rent_late', 'rent_early', 'buy_null']);
  });

  it('sorts by createdAt when requested', () => {
    const sorted = sortApplications(rows, 'createdAt', 'asc');
    expect(sorted.map((r) => r.id)).toEqual(['rent_early', 'rent_late', 'buy_null']);
  });
});
