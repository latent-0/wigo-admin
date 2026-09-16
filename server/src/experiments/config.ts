/**
 * A/B experiment definitions for the admin dashboard (the 18 Sep work: "A/B testing on
 * the admin dashboard"). Assignment is deterministic per user, so a given admin always
 * sees the same variant across sessions and reloads.
 */
export interface Variant {
  key: string;
  /** Relative weight; weights across an experiment need not sum to 100. */
  weight: number;
}

export interface Experiment {
  key: string;
  description: string;
  enabled: boolean;
  variants: Variant[];
}

export const EXPERIMENTS: Record<string, Experiment> = {
  dashboard_home_layout: {
    key: 'dashboard_home_layout',
    description: 'KPI cards layout on the dashboard home: classic grid vs. compact list.',
    enabled: true,
    variants: [
      { key: 'control', weight: 50 },
      { key: 'compact', weight: 50 },
    ],
  },
  review_queue_density: {
    key: 'review_queue_density',
    description: 'Document Review Queue row density: comfortable vs. dense.',
    enabled: true,
    variants: [
      { key: 'comfortable', weight: 50 },
      { key: 'dense', weight: 50 },
    ],
  },
};
