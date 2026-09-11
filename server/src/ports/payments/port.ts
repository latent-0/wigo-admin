/**
 * PaymentsPort — the seam the Payments Overview and Deposits modules depend on. N1CO is
 * the implementation behind it. Selected by N1CO_DRIVER; the modules read the
 * deterministic fake until the sandbox credentials land (11/12 Sep reports).
 */
export interface TopUpResult {
  providerRef: string;
  status: 'settled' | 'pending' | 'failed';
  /** True when this call matched an existing top-up for the idempotency key. */
  idempotentReplay: boolean;
}

export interface PaymentsPort {
  /**
   * Create (or replay) a wallet top-up. Idempotency is keyed on `idempotencyKey`:
   * a repeated call with the same key returns the existing result, never a duplicate
   * (the invariant retested on 11 Sep).
   */
  createTopUp(input: {
    idempotencyKey: string;
    riderId: string;
    amountCents: number;
    currency: string;
  }): Promise<TopUpResult>;
}
