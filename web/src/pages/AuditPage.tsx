import { useState } from 'react';
import { api } from '../api/client';
import type { AuditEntry } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { AsyncBoundary, PageHeader, formatDate } from '../components/ui';

export function AuditPage() {
  const [action, setAction] = useState('');
  const [from, setFrom] = useState('');
  const [to, setTo] = useState('');
  const [applied, setApplied] = useState({ action: '', from: '', to: '' });

  const query = new URLSearchParams();
  if (applied.action) query.set('action', applied.action);
  if (applied.from) query.set('from', applied.from);
  if (applied.to) query.set('to', applied.to);

  const { data, error, loading } = useAsync<{ items: AuditEntry[]; total: number }>(
    () => api.get(`/audit?${query.toString()}`),
    [applied.action, applied.from, applied.to],
  );

  return (
    <div>
      <PageHeader
        title="Audit Log"
        subtitle="Append-only. Date range filters cast to timestamps, so ranges across month boundaries work."
        actions={
          <div className="filter-bar">
            <input placeholder="action contains…" value={action} onChange={(e) => setAction(e.target.value)} />
            <input type="date" value={from} onChange={(e) => setFrom(e.target.value)} />
            <input type="date" value={to} onChange={(e) => setTo(e.target.value)} />
            <button className="btn btn-sm" onClick={() => setApplied({ action, from, to })}>
              Apply
            </button>
          </div>
        }
      />
      <AsyncBoundary loading={loading} error={error}>
        <table className="data-table">
          <thead>
            <tr>
              <th>When</th>
              <th>Actor</th>
              <th>Role</th>
              <th>Action</th>
              <th>Target</th>
            </tr>
          </thead>
          <tbody>
            {data?.items.map((e) => (
              <tr key={e.id}>
                <td>{formatDate(e.at)}</td>
                <td className="mono">{e.actorId}</td>
                <td>{e.actorRole}</td>
                <td>{e.action}</td>
                <td className="mono">{e.target ?? '—'}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </AsyncBoundary>
    </div>
  );
}
