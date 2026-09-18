import { useEffect } from 'react';
import { api } from '../api/client';
import type { Kpis } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { AsyncBoundary, PageHeader, formatMoney } from '../components/ui';
import { useExperiment, trackExperiment } from '../experiments/useExperiment';

export function DashboardPage() {
  const { data, error, loading } = useAsync<Kpis>(() => api.get<Kpis>('/kpis'), []);
  // A/B test: KPI layout — classic grid ("control") vs. compact list ("compact").
  const layout = useExperiment('dashboard_home_layout', 'control');

  useEffect(() => {
    trackExperiment('dashboard_home_layout', layout, 'dashboard_view');
  }, [layout]);

  return (
    <div>
      <PageHeader title="Dashboard" subtitle={`Live pilot metrics · layout variant: ${layout}`} />
      <AsyncBoundary loading={loading} error={error}>
        {data && (
          <div className={layout === 'compact' ? 'kpi-list' : 'kpi-grid'}>
            <Kpi label="Active riders" value={data.riders.active} hint={`${data.riders.total} total`} />
            <Kpi label="Pending applications" value={data.applications.submitted + data.applications.in_review} hint={`${data.applications.total} total`} />
            <Kpi label="Approved apps" value={data.applications.approved} />
            <Kpi label="Pending KYC docs" value={data.documents.pending} />
            <Kpi label="Settled deposits" value={data.deposits.settledCount} hint={formatMoney(data.deposits.totalSettledCents)} />
            <Kpi label="Failed notifications" value={data.notifications.failed} />
            <Kpi label="Wallet float" value={formatMoney(data.walletBalanceCents)} />
          </div>
        )}
      </AsyncBoundary>
    </div>
  );
}

function Kpi({ label, value, hint }: { label: string; value: number | string; hint?: string }) {
  return (
    <div className="kpi-card">
      <div className="kpi-value">{value}</div>
      <div className="kpi-label">{label}</div>
      {hint && <div className="kpi-hint">{hint}</div>}
    </div>
  );
}
