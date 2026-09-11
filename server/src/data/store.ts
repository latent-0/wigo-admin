import type {
  AdminUser,
  Application,
  AuditEntry,
  Deposit,
  DocumentRecord,
  NotificationRecord,
  Rider,
  BaseEntity,
} from '../domain/types';
import { nowIso } from '../lib/ids';

/**
 * In-memory repository layer. It stands behind a narrow interface so a real database
 * can be dropped in later without touching route handlers. The important invariant it
 * enforces everywhere is soft-delete: `list`/`get` never return rows with a non-null
 * `deletedAt`, which is the KPI double-counting bug fixed on 11 Sep.
 */
export class Collection<T extends BaseEntity> {
  private rows = new Map<string, T>();

  insert(row: T): T {
    this.rows.set(row.id, row);
    return row;
  }

  /** Get a live (non-soft-deleted) row. */
  get(id: string): T | undefined {
    const row = this.rows.get(id);
    return row && row.deletedAt === null ? row : undefined;
  }

  /** All live rows, newest first. */
  all(): T[] {
    return [...this.rows.values()]
      .filter((r) => r.deletedAt === null)
      .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }

  find(predicate: (row: T) => boolean): T | undefined {
    return this.all().find(predicate);
  }

  filter(predicate: (row: T) => boolean): T[] {
    return this.all().filter(predicate);
  }

  update(id: string, patch: Partial<T>): T {
    const row = this.rows.get(id);
    if (!row || row.deletedAt !== null) throw new Error(`Row ${id} not found`);
    const next = { ...row, ...patch, updatedAt: nowIso() } as T;
    this.rows.set(id, next);
    return next;
  }

  softDelete(id: string): void {
    const row = this.rows.get(id);
    if (!row) return;
    this.rows.set(id, { ...row, deletedAt: nowIso(), updatedAt: nowIso() });
  }

  /** Includes soft-deleted rows — for audit/debug only, never for list endpoints. */
  countAll(): number {
    return this.rows.size;
  }

  clear(): void {
    this.rows.clear();
  }
}

/** Append-only audit log. No update, no delete — matches the append-only table on 11 Sep. */
export class AuditLog {
  private entries: AuditEntry[] = [];

  append(entry: AuditEntry): void {
    this.entries.push(entry);
  }

  all(): readonly AuditEntry[] {
    return this.entries;
  }

  clear(): void {
    this.entries = [];
  }
}

export interface Database {
  adminUsers: Collection<AdminUser>;
  riders: Collection<Rider>;
  applications: Collection<Application>;
  documents: Collection<DocumentRecord>;
  deposits: Collection<Deposit>;
  notifications: Collection<NotificationRecord>;
  audit: AuditLog;
}

export function createDatabase(): Database {
  return {
    adminUsers: new Collection<AdminUser>(),
    riders: new Collection<Rider>(),
    applications: new Collection<Application>(),
    documents: new Collection<DocumentRecord>(),
    deposits: new Collection<Deposit>(),
    notifications: new Collection<NotificationRecord>(),
    audit: new AuditLog(),
  };
}

/** Process-wide instance. Tests build their own via createDatabase() + seed(). */
export const db = createDatabase();
