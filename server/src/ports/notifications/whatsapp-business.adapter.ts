import type { DeliveryReceipt, InboundMessage, NotificationsPort, SendResult } from './port';
import { TEMPLATES, TemplateError } from './templates';
import { parseInboundMeta, parseReceiptsMeta } from './fake-whatsapp.adapter';

export interface WhatsAppLiveConfig {
  phoneNumberId: string;
  accessToken: string;
}

/**
 * Live WhatsApp Business API adapter (Meta Graph API). Not exercised until the
 * provisioned credentials land (blocked as of the 18 Sep report). The env-var flip
 * WHATSAPP_DRIVER=live selects this with no change to any route handler.
 */
export class WhatsAppBusinessAdapter implements NotificationsPort {
  constructor(private readonly cfg: WhatsAppLiveConfig) {}

  async sendTemplate(to: string, templateName: string, params: Record<string, string>): Promise<SendResult> {
    const def = TEMPLATES[templateName];
    if (!def) throw new TemplateError(`Unknown template: ${templateName}`);
    // Positional params in template order — the Graph API expects an ordered array.
    const components =
      def.params.length > 0
        ? [
            {
              type: 'body',
              parameters: def.params.map((p) => ({ type: 'text', text: params[p] ?? '' })),
            },
          ]
        : [];

    const res = await fetch(`https://graph.facebook.com/v20.0/${this.cfg.phoneNumberId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${this.cfg.accessToken}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        to,
        type: 'template',
        template: { name: def.name, language: { code: 'en' }, components },
      }),
    });

    if (!res.ok) {
      const detail = await safeText(res);
      throw new Error(`whatsapp_send_failed: ${res.status} ${detail}`);
    }
    const json = (await res.json()) as { messages?: Array<{ id?: string }> };
    const id = json.messages?.[0]?.id;
    if (!id) throw new Error('whatsapp_send_failed: no message id in response');
    return { providerMessageId: id, status: 'sent' };
  }

  parseInbound(body: unknown): InboundMessage[] {
    return parseInboundMeta(body);
  }

  parseDeliveryReceipts(body: unknown): DeliveryReceipt[] {
    return parseReceiptsMeta(body);
  }
}

async function safeText(res: Response): Promise<string> {
  try {
    return (await res.text()).slice(0, 300);
  } catch {
    return '<no body>';
  }
}
