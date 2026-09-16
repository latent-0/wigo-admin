import { sha256 } from '../lib/ids';
import type { Experiment } from './config';
import { EXPERIMENTS } from './config';

export interface Assignment {
  experiment: string;
  variant: string;
}

/**
 * Deterministic bucketing: hash (experimentKey:userId) into [0, totalWeight) and walk
 * the variants. Same user + same experiment always yields the same variant, with no
 * server-side state. A disabled experiment returns the first variant as control.
 */
export function assignVariant(exp: Experiment, userId: string): string {
  const first = exp.variants[0];
  if (!first) throw new Error(`Experiment ${exp.key} has no variants`);
  if (!exp.enabled) return first.key;

  const totalWeight = exp.variants.reduce((sum, v) => sum + Math.max(0, v.weight), 0);
  if (totalWeight <= 0) return first.key;

  const hash = sha256(`${exp.key}:${userId}`);
  // Use the first 8 hex chars as an unsigned int for a stable, well-distributed bucket.
  const bucket = parseInt(hash.slice(0, 8), 16) % totalWeight;

  let cumulative = 0;
  for (const variant of exp.variants) {
    cumulative += Math.max(0, variant.weight);
    if (bucket < cumulative) return variant.key;
  }
  return first.key;
}

/** Assign a user across every defined experiment. */
export function assignAll(userId: string): Assignment[] {
  return Object.values(EXPERIMENTS).map((exp) => ({
    experiment: exp.key,
    variant: assignVariant(exp, userId),
  }));
}
