import { describe, it, expect } from 'vitest';
import request from 'supertest';
import { makeTestApp, bearerFor } from './helpers';
import { FakeN1coAdapter } from '../ports/payments';

describe('payments: idempotent top-up (11 Sep invariant)', () => {
  it('returns the existing deposit on a repeated idempotency key, no duplicate', async () => {
    const { app, db } = await makeTestApp();
    const body = { riderId: 'rdr_002', amountCents: 2500, currency: 'MXN', idempotencyKey: 'topup-key-abc123' };

    const first = await request(app)
      .post('/api/payments/deposits/topup')
      .set('Authorization', bearerFor('finance'))
      .send(body);
    expect(first.status).toBe(201);
    expect(first.body.idempotentReplay).toBe(false);

    const countAfterFirst = db.deposits.all().length;

    const second = await request(app)
      .post('/api/payments/deposits/topup')
      .set('Authorization', bearerFor('finance'))
      .send(body);
    expect(second.status).toBe(200);
    expect(second.body.idempotentReplay).toBe(true);
    expect(second.body.deposit.id).toBe(first.body.deposit.id);

    // No duplicate row was created.
    expect(db.deposits.all().length).toBe(countAfterFirst);
  });

  it('credits the rider wallet only on settlement', async () => {
    const { app, db } = await makeTestApp();
    const before = db.riders.get('rdr_002')!.walletBalanceCents;
    await request(app)
      .post('/api/payments/deposits/topup')
      .set('Authorization', bearerFor('finance'))
      .send({ riderId: 'rdr_002', amountCents: 1000, currency: 'MXN', idempotencyKey: 'settle-key-xyz789' });
    const after = db.riders.get('rdr_002')!.walletBalanceCents;
    expect(after).toBe(before + 1000);
  });

  it('adapter replays the same result for the same key', async () => {
    const adapter = new FakeN1coAdapter();
    const input = { idempotencyKey: 'k1', riderId: 'rdr_001', amountCents: 500, currency: 'MXN' };
    const a = await adapter.createTopUp(input);
    const b = await adapter.createTopUp(input);
    expect(b.providerRef).toBe(a.providerRef);
    expect(b.idempotentReplay).toBe(true);
  });
});
