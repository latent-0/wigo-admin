import type { Database } from '../data/store';
import type { Role } from '../domain/roles';
import { newId, nowIso } from './ids';

export interface AuditInput {
  actorId: string;
  actorRole: Role;
  action: string;
  target?: string | null;
  meta?: Record<string, unknown>;
}

/** Append an entry to the append-only audit log. */
export function recordAudit(db: Database, input: AuditInput): void {
  db.audit.append({
    id: newId('aud'),
    at: nowIso(),
    actorId: input.actorId,
    actorRole: input.actorRole,
    action: input.action,
    target: input.target ?? null,
    meta: input.meta ?? {},
  });
}
