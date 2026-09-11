import type { PaymentsPort, TopUpResult } from './port';

export interface N1coLiveConfig {
  baseUrl: string;
  apiKey: string;
}

/**
 * Live N1CO adapter. Not exercised until sandbox/prod credentials land. The
 * Idempotency-Key header lets the provider dedupe server-side; we mirror that contract
 * so behaviour matches the fake exactly on the env-var flip.
 */
export class N1coAdapter implements PaymentsPort {
  constructor(private readonly cfg: N1coLiveConfig) {}

  async createTopUp(input: {
    idempotencyKey: string;
    riderId: string;
    amountCents: number;
    currency: string;
  }): Promise<TopUpResult> {
    const res = await fetch(`${this.cfg.baseUrl}/v1/topups`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.apiKey}`,
        'Content-Type': 'application/json',
        'Idempotency-Key': input.idempotencyKey,
      },
      body: JSON.stringify({
        rider_id: input.riderId,
        amount: input.amountCents,
        currency: input.currency,
      }),
    });

    if (!res.ok) {
      const detail = await res.text().catch(() => '<no body>');
      throw new Error(`n1co_topup_failed: ${res.status} ${detail.slice(0, 300)}`);
    }
    const json = (await res.json()) as { reference?: string; status?: string; replayed?: boolean };
    const status = json.status === 'settled' || json.status === 'pending' || json.status === 'failed' ? json.status : 'pending';
    return {
      providerRef: json.reference ?? `N1CO-${input.idempotencyKey}`,
      status,
      idempotentReplay: json.replayed === true,
    };
  }
}
