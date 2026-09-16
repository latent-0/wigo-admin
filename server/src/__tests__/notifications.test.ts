import { describe, it, expect } from 'vitest';
import { createDatabase } from '../data/store';
import { FakeWhatsAppAdapter } from '../ports/notifications';
import { sendNotification, applyDeliveryReceipt, backoffDelay } from '../services/notifications.service';
import { renderTemplate, TemplateError } from '../ports/notifications/templates';
import type { NotificationsPort } from '../ports/notifications';

const noSleep = () => Promise.resolve();

describe('WhatsApp templates', () => {
  it('renders a template with params', () => {
    expect(renderTemplate('otp_login', { code: '123456' })).toContain('123456');
  });

  it('throws on a missing param', () => {
    expect(() => renderTemplate('application_approved', { name: 'A' })).toThrow(TemplateError);
  });

  it('throws on an unknown template', () => {
    expect(() => renderTemplate('nope', {})).toThrow(TemplateError);
  });
});

describe('notification send with retry/backoff (11 Sep, provable now)', () => {
  it('marks sent on success', async () => {
    const db = createDatabase();
    const port = new FakeWhatsAppAdapter();
    const rec = await sendNotification(
      db,
      port,
      { to: '+5215515590000', templateName: 'application_approved', params: { name: 'Ana', city: 'CDMX' } },
      { sleep: noSleep },
    );
    expect(rec.status).toBe('sent');
    expect(rec.attempts).toBe(1);
    expect(port.outbox).toHaveLength(1);
  });

  it('retries a transient failure up to maxAttempts then marks failed', async () => {
    const db = createDatabase();
    let calls = 0;
    const flaky: NotificationsPort = {
      async sendTemplate() {
        calls += 1;
        throw new Error('transient');
      },
      parseInbound: () => [],
      parseDeliveryReceipts: () => [],
    };
    const rec = await sendNotification(
      db,
      flaky,
      { to: '+5215515590000', templateName: 'otp_login', params: { code: '111111' } },
      { maxAttempts: 3, baseDelayMs: 1, sleep: noSleep },
    );
    expect(rec.status).toBe('failed');
    expect(rec.attempts).toBe(3);
    expect(calls).toBe(3);
    expect(rec.lastError).toContain('transient');
  });

  it('does not retry a template error', async () => {
    const db = createDatabase();
    let calls = 0;
    const port: NotificationsPort = {
      async sendTemplate() {
        calls += 1;
        throw new TemplateError('bad template');
      },
      parseInbound: () => [],
      parseDeliveryReceipts: () => [],
    };
    const rec = await sendNotification(
      db,
      port,
      { to: '+5215515590000', templateName: 'x', params: {} },
      { maxAttempts: 3, sleep: noSleep },
    );
    expect(rec.status).toBe('failed');
    expect(rec.attempts).toBe(1);
    expect(calls).toBe(1);
  });

  it('uses exponential backoff', () => {
    expect(backoffDelay(1, 200)).toBe(200);
    expect(backoffDelay(2, 200)).toBe(400);
    expect(backoffDelay(3, 200)).toBe(800);
  });
});

describe('WhatsApp webhook parsing + delivery receipts', () => {
  it('parses inbound messages and delivery statuses from the Meta envelope', () => {
    const port = new FakeWhatsAppAdapter();
    const body = {
      entry: [
        {
          changes: [
            {
              value: {
                messages: [{ from: '+5215515590000', text: { body: 'hola' }, timestamp: '1758000000' }],
                statuses: [{ id: 'wamid.ABC', status: 'delivered', timestamp: '1758000100' }],
              },
            },
          ],
        },
      ],
    };
    expect(port.parseInbound(body)).toHaveLength(1);
    const receipts = port.parseDeliveryReceipts(body);
    expect(receipts[0]?.status).toBe('delivered');
  });

  it('applies a delivery receipt to the matching record', async () => {
    const db = createDatabase();
    const port = new FakeWhatsAppAdapter();
    const rec = await sendNotification(
      db,
      port,
      { to: '+5215515590000', templateName: 'otp_login', params: { code: '222222' } },
      { sleep: noSleep },
    );
    const updated = applyDeliveryReceipt(db, {
      providerMessageId: rec.providerMessageId!,
      status: 'delivered',
      at: '2026-09-18T10:00:00.000Z',
    });
    expect(updated?.status).toBe('delivered');
    expect(updated?.deliveredAt).toBe('2026-09-18T10:00:00.000Z');
  });
});
