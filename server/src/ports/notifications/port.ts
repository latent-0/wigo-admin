/**
 * NotificationsPort — the seam the Notifications / Messaging Center depends on. The UI
 * and route handlers only ever see this interface; the WhatsApp Business API is an
 * implementation detail behind it. Swapping fake <-> live is an env-var flip
 * (WHATSAPP_DRIVER), no code change — the design point from the 11 Sep report.
 */
export interface SendResult {
  providerMessageId: string;
  status: 'sent';
}

export interface InboundMessage {
  from: string;
  text: string;
  receivedAt: string;
}

export interface DeliveryReceipt {
  providerMessageId: string;
  status: 'delivered' | 'failed';
  reason?: string;
  at: string;
}

export interface NotificationsPort {
  /**
   * Send a pre-approved template message. Throws on a provider failure so the caller's
   * retry/backoff logic can decide whether to re-queue.
   */
  sendTemplate(to: string, templateName: string, params: Record<string, string>): Promise<SendResult>;

  /** Parse a raw inbound webhook body into normalized messages. */
  parseInbound(body: unknown): InboundMessage[];

  /** Parse a raw delivery-status webhook body into normalized receipts. */
  parseDeliveryReceipts(body: unknown): DeliveryReceipt[];
}
