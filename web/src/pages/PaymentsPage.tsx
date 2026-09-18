import { api } from '../api/client';
import { useAsync } from '../hooks/useAsync';
import { AsyncBoundary, PageHeader, StatusBadge, formatMoney, formatDate } from '../components/ui';

interface Overview {
  totals: { settledCents: number; pendingCents: number; failedCents: number };
  counts: { settled: number; pending: number; failed: number };
}

interface Deposit {
  id: string;
  riderId: string;
  amountCents: number;
  currency: string;
  status: string;
  providerRef: string | null;
  createdAt: string;
}

export function PaymentsPage() {
  const overview = useAsync<Overview>(() => api.get('/payments/overview'), []);
  const deposits = useAsync<{ items: Deposit[] }>(() => api.get('/payments/deposits'), []);

  return (
    <div>
      <PageHeader title="Payments" subtitle="N1CO deposits ledger (via PaymentsPort)" />
      <AsyncBoundary loading={overview.loading} error={overview.error}>
        {overview.data && (
          <div className="kpi-grid">
            <Card label="Settled" money={overview.data.totals.settledCents} count={overview.data.counts.settled} />
            <Card label="Pending" money={overview.data.totals.pendingCents} count={overview.data.counts.pending} />
            <Card label="Failed" money={overview.data.totals.failedCents} count={overview.data.counts.failed} />
          </div>
        )}
      </AsyncBoundary>

      <h2 className="section-title">Deposits</h2>
      <AsyncBoundary loading={deposits.loading} error={deposits.error}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Rider</th>
              <th>Amount</th>
              <th>Status</th>
              <th>Provider ref</th>
              <th>Created</th>
            </tr>
          </thead>
          <tbody>
            {deposits.data?.items.map((d) => (
              <tr key={d.id}>
                <td className="mono">{d.riderId}</td>
                <td>{formatMoney(d.amountCents, d.currency)}</td>
                <td>
                  <StatusBadge status={d.status} />
                </td>
                <td className="mono">{d.providerRef ?? '—'}</td>
                <td>{formatDate(d.createdAt)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncBoundary>
    </div>
  );
}

function Card({ label, money, count }: { label: string; money: number; count: number }) {
  return (
    <div className="kpi-card">
      <div className="kpi-value">{formatMoney(money)}</div>
      <div className="kpi-label">{label}</div>
      <div className="kpi-hint">{count} deposits</div>
    </div>
  );
}
