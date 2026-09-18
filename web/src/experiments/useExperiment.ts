import { useEffect, useState } from 'react';
import { api } from '../api/client';
import type { ExperimentAssignment } from '../api/types';

let cache: ExperimentAssignment[] | null = null;
let inflight: Promise<ExperimentAssignment[]> | null = null;

async function loadAssignments(): Promise<ExperimentAssignment[]> {
  if (cache) return cache;
  if (!inflight) {
    inflight = api
      .get<{ assignments: ExperimentAssignment[] }>('/experiments/me')
      .then((r) => {
        cache = r.assignments;
        return cache;
      })
      .finally(() => {
        inflight = null;
      });
  }
  return inflight;
}

export function resetExperimentCache(): void {
  cache = null;
}

/**
 * Read this user's variant for an experiment (A/B testing on the admin dashboard,
 * 18 Sep). Assignment is server-side and deterministic, so the variant is stable.
 * Returns `fallback` until the assignment loads.
 */
export function useExperiment(experiment: string, fallback: string): string {
  const [variant, setVariant] = useState<string>(cache ? variantFrom(cache, experiment, fallback) : fallback);

  useEffect(() => {
    let active = true;
    loadAssignments()
      .then((assignments) => {
        if (active) setVariant(variantFrom(assignments, experiment, fallback));
      })
      .catch(() => {
        /* keep fallback on failure */
      });
    return () => {
      active = false;
    };
  }, [experiment, fallback]);

  return variant;
}

function variantFrom(assignments: ExperimentAssignment[], experiment: string, fallback: string): string {
  return assignments.find((a) => a.experiment === experiment)?.variant ?? fallback;
}

/** Fire-and-forget experiment event tracking. */
export function trackExperiment(experiment: string, variant: string, event: string): void {
  void api.post('/experiments/track', { experiment, variant, event }).catch(() => {
    /* best-effort */
  });
}
