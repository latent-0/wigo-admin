import { useState } from 'react';
import { api } from '../api/client';
import type { DocumentRecord } from '../api/types';
import { useAsync } from '../hooks/useAsync';
import { useAuth } from '../auth/AuthContext';
import { AsyncBoundary, PageHeader, StatusBadge, formatDate } from '../components/ui';
import { useExperiment } from '../experiments/useExperiment';

const REASONS = ['blurry', 'expired', 'name_mismatch', 'wrong_document', 'other'];

export function DocumentsPage() {
  const { can } = useAuth();
  // A/B test: review queue row density.
  const density = useExperiment('review_queue_density', 'comfortable');
  const { data, error, loading, reload } = useAsync<{ items: DocumentRecord[] }>(
    () => api.get('/documents?status=pending'),
    [],
  );
  const [rejecting, setRejecting] = useState<string | null>(null);
  const [reason, setReason] = useState(REASONS[0]);

  const approve = async (doc: DocumentRecord) => {
    await api.post(`/documents/${doc.id}/approve`);
    reload();
  };

  const reject = async (doc: DocumentRecord) => {
    await api.post(`/documents/${doc.id}/reject`, { reasonCode: reason });
    setRejecting(null);
    reload();
  };

  return (
    <div>
      <PageHeader title="Document Review" subtitle={`KYC queue · density: ${density}`} />
      <AsyncBoundary loading={loading} error={error}>
        {data && data.items.length === 0 ? (
          <div className="empty">
            <h2>Queue clear</h2>
            <p>No documents are waiting for review.</p>
          </div>
        ) : (
          <table className={density === 'dense' ? 'data-table dense' : 'data-table'}>
            <thead>
              <tr>
                <th>Rider</th>
                <th>Document</th>
                <th>Uploaded</th>
                <th>Status</th>
                {can('document:review') && <th>Review</th>}
              </tr>
            </thead>
            <tbody>
              {data?.items.map((d) => (
                <tr key={d.id}>
                  <td className="mono">{d.riderId}</td>
                  <td>{d.kind.replace(/_/g, ' ')}</td>
                  <td>{formatDate(d.createdAt)}</td>
                  <td>
                    <StatusBadge status={d.status} />
                  </td>
                  {can('document:review') && (
                    <td>
                      {rejecting === d.id ? (
                        <div className="inline-form">
                          <select value={reason} onChange={(e) => setReason(e.target.value)}>
                            {REASONS.map((r) => (
                              <option key={r} value={r}>
                                {r.replace(/_/g, ' ')}
                              </option>
                            ))}
                          </select>
                          <button className="btn btn-sm btn-danger" onClick={() => reject(d)}>
                            Confirm reject
                          </button>
                          <button className="btn btn-sm btn-ghost" onClick={() => setRejecting(null)}>
                            Cancel
                          </button>
                        </div>
                      ) : (
                        <>
                          <button className="btn btn-sm" onClick={() => approve(d)}>
                            Approve
                          </button>
                          <button className="btn btn-sm btn-danger" onClick={() => setRejecting(d.id)}>
                            Reject
                          </button>
                        </>
                      )}
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </AsyncBoundary>
    </div>
  );
}
