import { describe, it, expect } from 'vitest';
import { assignVariant, assignAll } from '../experiments/assign';
import type { Experiment } from '../experiments/config';

const fiftyFifty: Experiment = {
  key: 'exp_test',
  description: 'test',
  enabled: true,
  variants: [
    { key: 'a', weight: 50 },
    { key: 'b', weight: 50 },
  ],
};

describe('A/B experiment assignment (18 Sep)', () => {
  it('is deterministic for the same user', () => {
    const first = assignVariant(fiftyFifty, 'usr_kunal');
    const second = assignVariant(fiftyFifty, 'usr_kunal');
    expect(first).toBe(second);
  });

  it('splits a large population roughly by weight', () => {
    const counts: Record<string, number> = { a: 0, b: 0 };
    for (let i = 0; i < 5000; i += 1) {
      const v = assignVariant(fiftyFifty, `usr_${i}`);
      counts[v] = (counts[v] ?? 0) + 1;
    }
    // Expect each arm within 45%-55% of the population.
    expect(counts.a).toBeGreaterThan(2250);
    expect(counts.a).toBeLessThan(2750);
    expect(counts.a + counts.b).toBe(5000);
  });

  it('honors unequal weights', () => {
    const weighted: Experiment = {
      key: 'exp_weighted',
      description: 'test',
      enabled: true,
      variants: [
        { key: 'control', weight: 90 },
        { key: 'treatment', weight: 10 },
      ],
    };
    let treatment = 0;
    for (let i = 0; i < 5000; i += 1) {
      if (assignVariant(weighted, `u${i}`) === 'treatment') treatment += 1;
    }
    // ~10% expected; allow a generous band.
    expect(treatment).toBeGreaterThan(350);
    expect(treatment).toBeLessThan(650);
  });

  it('returns control for a disabled experiment', () => {
    const disabled: Experiment = { ...fiftyFifty, enabled: false };
    expect(assignVariant(disabled, 'anyone')).toBe('a');
  });

  it('assigns across all configured experiments', () => {
    const all = assignAll('usr_kunal');
    expect(all.length).toBeGreaterThan(0);
    for (const a of all) expect(a.variant).toBeTruthy();
  });
});
