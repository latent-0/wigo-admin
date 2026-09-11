import type { DeliveryReceipt, InboundMessage, NotificationsPort, SendResult } from './port';
import { renderTemplate } from './templates';

/**
 * Deterministic in-memory WhatsApp adapter. It exercises the exact same code path as
 * the live adapter — template render, send, inbound + delivery-receipt parsing — with
 * no real credentials, which is how the build runs on staging and in CI. It records
 * every send so tests and the smoke test can assert on it.
 *
 * A number containing "fail" (or the reserved +5215500000000) simulates a hard failure
 * so the caller's retry/backoff can be tested without a live send.
 */
export class FakeWhatsAppAdapter implements NotificationsPort {
  public readonly outbox: Array<{ to: string; body: string; providerMessageId: string }> = [];
  private counter = 0;

  async sendTemplate(to: string, templateName: string, params: Record<string, string>): Promise<SendResult> {
    // Render first — a bad template must fail loudly regardless of driver.
    const body = renderTemplate(templateName, params);
    if (to.includes('fail') || to === '+5215500000000') {
      throw new Error('fake_provider_error: recipient_unreachable');
    }
    this.counter += 1;
    const providerMessageId = `wamid.FAKE${String(this.counter).padStart(6, '0')}`;
    this.outbox.push({ to, body, providerMessageId });
    return { providerMessageId, status: 'sent' };
  }

  parseInbound(body: unknown): InboundMessage[] {
    return parseInboundMeta(body);
  }

  parseDeliveryReceipts(body: unknown): DeliveryReceipt[] {
    return parseReceiptsMeta(body);
  }
}

/**
 * Meta's WhatsApp webhook envelope is the same shape for the fake and live adapters, so
 * the parsers live here and are reused. Structure:
 * { entry: [{ changes: [{ value: { messages?: [...], statuses?: [...] } }] }] }
 */
export function parseInboundMeta(body: unknown): InboundMessage[] {
  const out: InboundMessage[] = [];
  const entries = asArray((body as any)?.entry);
  for (const entry of entries) {
    for (const change of asArray((entry as any)?.changes)) {
      const value = (change as any)?.value;
      for (const msg of asArray(value?.messages)) {
        const from = (msg as any)?.from;
        const text = (msg as any)?.text?.body;
        const ts = (msg as any)?.timestamp;
        if (typeof from === 'string' && typeof text === 'string') {
          out.push({
            from,
            text,
            receivedAt: ts ? new Date(Number(ts) * 1000).toISOString() : new Date().toISOString(),
          });
        }
      }
    }
  }
  return out;
}

export function parseReceiptsMeta(body: unknown): DeliveryReceipt[] {
  const out: DeliveryReceipt[] = [];
  const entries = asArray((body as any)?.entry);
  for (const entry of entries) {
    for (const change of asArray((entry as any)?.changes)) {
      const value = (change as any)?.value;
      for (const st of asArray(value?.statuses)) {
        const id = (st as any)?.id;
        const status = (st as any)?.status;
        const ts = (st as any)?.timestamp;
        if (typeof id !== 'string') continue;
        if (status === 'delivered' || status === 'read') {
          out.push({ providerMessageId: id, status: 'delivered', at: tsToIso(ts) });
        } else if (status === 'failed') {
          const reason = (st as any)?.errors?.[0]?.title ?? 'failed';
          out.push({ providerMessageId: id, status: 'failed', reason, at: tsToIso(ts) });
        }
      }
    }
  }
  return out;
}

function asArray(v: unknown): unknown[] {
  return Array.isArray(v) ? v : [];
}

function tsToIso(ts: unknown): string {
  return ts ? new Date(Number(ts) * 1000).toISOString() : new Date().toISOString();
}
