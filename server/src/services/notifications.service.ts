import type { Database } from '../data/store';
import type { NotificationsPort } from '../ports/notifications';
import type { NotificationRecord } from '../domain/types';
import { newId, nowIso } from '../lib/ids';
import { TemplateError } from '../ports/notifications/templates';

export interface RetryOptions {
  maxAttempts: number;
  baseDelayMs: number;
  /** Injectable so tests run without real timers. */
  sleep: (ms: number) => Promise<void>;
}

const defaultRetry: RetryOptions = {
  maxAttempts: 3,
  baseDelayMs: 200,
  sleep: (ms) => new Promise((r) => setTimeout(r, ms)),
};

/** Exponential backoff: base * 2^(attempt-1). */
export function backoffDelay(attempt: number, baseMs: number): number {
  return baseMs * 2 ** (attempt - 1);
}

/**
 * Send a template message with retry/backoff, persisting a NotificationRecord that
 * reflects the outcome. A template-render error is a caller mistake, not a transient
 * provider failure, so it is NOT retried. This is the retry/backoff path flagged on
 * 11 Sep as "built to spec but not provable without a live send".
 */
export async function sendNotification(
  db: Database,
  port: NotificationsPort,
  input: { to: string; templateName: string; params: Record<string, string> },
  options: Partial<RetryOptions> = {},
): Promise<NotificationRecord> {
  const opts: RetryOptions = { ...defaultRetry, ...options };
  const now = nowIso();
  let record: NotificationRecord = {
    id: newId('ntf'),
    createdAt: now,
    updatedAt: now,
    deletedAt: null,
    to: input.to,
    templateName: input.templateName,
    params: input.params,
    status: 'queued',
    attempts: 0,
    lastError: null,
    providerMessageId: null,
    deliveredAt: null,
  };
  db.notifications.insert(record);

  let lastError = '';
  for (let attempt = 1; attempt <= opts.maxAttempts; attempt += 1) {
    try {
      const result = await port.sendTemplate(input.to, input.templateName, input.params);
      record = db.notifications.update(record.id, {
        status: 'sent',
        attempts: attempt,
        providerMessageId: result.providerMessageId,
        lastError: null,
      });
      return record;
    } catch (err) {
      lastError = err instanceof Error ? err.message : String(err);
      // Do not retry a bad template — retrying will never succeed.
      if (err instanceof TemplateError) {
        record = db.notifications.update(record.id, { status: 'failed', attempts: attempt, lastError });
        return record;
      }
      record = db.notifications.update(record.id, { status: 'queued', attempts: attempt, lastError });
      if (attempt < opts.maxAttempts) {
        await opts.sleep(backoffDelay(attempt, opts.baseDelayMs));
      }
    }
  }

  record = db.notifications.update(record.id, { status: 'failed', lastError });
  return record;
}

/**
 * Apply an inbound delivery receipt to the matching notification record (moves
 * sent -> delivered, or marks failed). Called from the WhatsApp webhook.
 */
export function applyDeliveryReceipt(
  db: Database,
  receipt: { providerMessageId: string; status: 'delivered' | 'failed'; reason?: string; at: string },
): NotificationRecord | undefined {
  const match = db.notifications.find((n) => n.providerMessageId === receipt.providerMessageId);
  if (!match) return undefined;
  if (receipt.status === 'delivered') {
    return db.notifications.update(match.id, { status: 'delivered', deliveredAt: receipt.at });
  }
  return db.notifications.update(match.id, { status: 'failed', lastError: receipt.reason ?? 'failed' });
}
