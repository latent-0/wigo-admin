import { useState } from 'react';
import { api } from '../api/client';
import type { Application } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../auth/AuthContext';
import { AsyncBoundary, PageHeader, StatusBadge, formatDate } from '../components/ui';

type Sort = 'createdAt' | 'pickupAt';

export function ApplicationsPage() {
  const { can } = useAuth();
  const [sort, setSort] = useState<Sort>('createdAt');
  const [dir, setDir] = useState<'asc' | 'desc'>('desc');
  const { data, error, loading, reload } = useAsync<{ items: Application[] }>(
    () => api.get(`/applications?sort=${sort}&dir=${dir}`),
    [sort, dir],
  );

  const decide = async (app: Application, decision: 'approve' | 'reject' | 'in_review') => {
    await api.post(`/applications/${app.id}/decision`, { decision });
    reload();
  };

  const toggleSort = (col: Sort) => {
    if (sort === col) setDir((d) => (d === 'asc' ? 'desc' : 'asc'));
    else {
      setSort(col);
      setDir('desc');
    }
  };

  return (
    <div>
      <PageHeader title="Applications" subtitle="Buy and Rent applications. Rent rows carry pickup details; Buy rows do not." />
      <AsyncBoundary loading={loading} error={error}>
        <table className="data-table">
          <thead>
            <tr>
              <th>Applicant</th>
              <th>Kind</th>
              <th>Status</th>
              <th className="sortable" onClick={() => toggleSort('createdAt')}>
                Submitted {sort === 'createdAt' ? (dir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th className="sortable" onClick={() => toggleSort('pickupAt')}>
                Pickup {sort === 'pickupAt' ? (dir === 'asc' ? '▲' : '▼') : ''}
              </th>
              <th>Package</th>
              {can('application:write') && <th>Actions</th>}
            </tr>
          </thead>
          <tbody>
            {data?.items.map((a) => (
              <tr key={a.id}>
                <td>{a.applicantName}</td>
                <td>{a.kind}</td>
                <td>
                  <StatusBadge status={a.status} />
                </td>
                <td>{formatDate(a.createdAt)}</td>
                <td>{formatDate(a.pickupAt)}</td>
                <td>{a.rentalPackage ?? '—'}</td>
                {can('application:write') && (
                  <td>
                    {a.status !== 'approved' && a.status !== 'rejected' ? (
                      <>
                        <button className="btn btn-sm" onClick={() => decide(a, 'approve')}>
                          Approve
                        </button>
                        <button className="btn btn-sm btn-danger" onClick={() => decide(a, 'reject')}>
                          Reject
                        </button>
                      </>
                    ) : (
                      <span className="muted">final</span>
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
