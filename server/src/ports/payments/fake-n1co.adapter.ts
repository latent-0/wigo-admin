import type { PaymentsPort, TopUpResult } from './port';

/**
 * Deterministic N1CO sandbox stand-in, hardened against N1CO's public docs (12 Sep).
 * Enforces idempotency at the provider level: the same key always returns the same
 * providerRef and status. An amount <= 0 is rejected; an amount ending in 13 cents
 * simulates a provider decline so the failed path is testable without live access.
 */
export class FakeN1coAdapter implements PaymentsPort {
  private readonly byKey = new Map<string, TopUpResult>();
  private counter = 0;

  async createTopUp(input: {
    idempotencyKey: string;
    riderId: string;
    amountCents: number;
    currency: string;
  }): Promise<TopUpResult> {
    const existing = this.byKey.get(input.idempotencyKey);
    if (existing) return { ...existing, idempotentReplay: true };

    if (input.amountCents <= 0) throw new Error('n1co_invalid_amount');

    this.counter += 1;
    const status: TopUpResult['status'] = input.amountCents % 100 === 13 ? 'failed' : 'settled';
    const result: TopUpResult = {
      providerRef: `N1CO-FAKE-${String(this.counter).padStart(6, '0')}`,
      status,
      idempotentReplay: false,
    };
    this.byKey.set(input.idempotencyKey, result);
    return result;
  }
}
