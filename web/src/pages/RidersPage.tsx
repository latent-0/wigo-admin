import { useState } from 'react';
import { api } from '../api/client';
import type { Rider, RiderStatus } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../auth/AuthContext';
import { AsyncBoundary, PageHeader, StatusBadge, formatMoney } from '../components/ui';

const STATUSES: RiderStatus[] = ['active', 'suspended', 'pending'];

export function RidersPage() {
  const { can } = useAuth();
  const [statusFilter, setStatusFilter] = useState<string>('');
  const { data, error, loading, reload } = useAsync<{ items: Rider[]; total: number }>(
    () => api.get(`/riders${statusFilter ? `?status=${statusFilter}` : ''}`),
    [statusFilter],
  );

  const changeStatus = async (rider: Rider, status: RiderStatus) => {
    await api.patch(`/riders/${rider.id}`, { status });
    reload();
  };

  return (
    <div>
      <PageHeader
        title="Riders"
        subtitle="Rider roster across pilot cities"
        actions={
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value)}>
            <option value="">All statuses</option>
            {STATUSES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        }
      />
      <AsyncBoundary loading={loading} error={error}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Name</th>
              <th>Phone</th>
              <th>City</th>
              <th>Status</th>
              <th>Wallet</th>
              {can('rider:write') && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((r) => (
              <tr key={r.id}>
                <td>{r.name}</td>
                <td className="mono">{r.phone}</td>
                <td>{r.city}</td>
                <td>
                  <StatusBadge status={r.status} />
                </td>
                <td>{formatMoney(r.walletBalanceCents)}</td>
                {can('rider:write') && (
                  <td>
                    {r.status !== 'active' && (
                      <button className="btn btn-sm" onClick={() => changeStatus(r, 'active')}>
                        Activate
                      </button>
                    )}
                    {r.status !== 'suspended' && (
                      <button className="btn btn-sm btn-danger" onClick={() => changeStatus(r, 'suspended')}>
                        Suspend
                      </button>
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncBoundary>
    </div>
  );
}
