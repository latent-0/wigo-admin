import { randomUUID, createHash } from 'node:crypto';

export const newId = (prefix: string): string => `${prefix}_${randomUUID()}`;

/** Stable hash used for OTP storage and deterministic experiment bucketing. */
export function sha256(input: string): string {
  return createHash('sha256').update(input).digest('hex');
}

export const nowIso = (): string => new Date().toISOString();
