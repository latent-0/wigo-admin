import { Router } from 'express';
import { createHmac, timingSafeEqual } from 'node:crypto';
import type { AppContext } from '../context';
import { config } from '../config/env';
import { asyncHandler } from '../lib/async-handler';
import { applyDeliveryReceipt } from '../services/notifications.service';

/**
 * Verify Meta's X-Hub-Signature-256 header against the raw request body. When an app
 * secret is configured (live mode) an invalid signature is rejected. In fake/dev mode
 * with no secret, verification is skipped so local webhook testing works.
 */
function signatureValid(rawBody: Buffer | undefined, header: unknown): boolean {
  if (!config.whatsapp.appSecret) return true; // dev/fake: nothing to verify against
  if (!rawBody || typeof header !== 'string' || !header.startsWith('sha256=')) return false;
  const expected = createHmac('sha256', config.whatsapp.appSecret).update(rawBody).digest('hex');
  const provided = header.slice('sha256='.length);
  const a = Buffer.from(expected, 'utf8');
  const b = Buffer.from(provided, 'utf8');
  return a.length === b.length && timingSafeEqual(a, b);
}

export function webhookRoutes(ctx: AppContext): Router {
  const router = Router();

  // Webhook verification handshake (Meta calls this once on subscription).
  router.get(
    '/whatsapp',
    asyncHandler(async (req, res) => {
      const mode = req.query['hub.mode'];
      const token = req.query['hub.verify_token'];
      const challenge = req.query['hub.challenge'];
      if (mode === 'subscribe' && token === config.whatsapp.webhookVerifyToken) {
        res.status(200).send(String(challenge ?? ''));
        return;
      }
      res.sendStatus(403);
    }),
  );

  // Inbound messages + delivery-status receipts.
  router.post(
    '/whatsapp',
    asyncHandler(async (req, res) => {
      if (!signatureValid(req.rawBody, req.headers['x-hub-signature-256'])) {
        res.sendStatus(401);
        return;
      }
      const inbound = ctx.notifications.parseInbound(req.body);
      const receipts = ctx.notifications.parseDeliveryReceipts(req.body);
      for (const receipt of receipts) {
        applyDeliveryReceipt(ctx.db, receipt);
      }
      // Always 200 quickly so Meta does not retry; processing is best-effort.
      res.status(200).json({ received: { messages: inbound.length, receipts: receipts.length } });
    }),
  );

  return router;
}
