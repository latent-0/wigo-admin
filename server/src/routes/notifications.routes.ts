import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { recordAudit } from '../lib/audit';
import { TEMPLATES } from '../ports/notifications/templates';
import { sendNotification } from '../services/notifications.service';

const sendBody = z.object({
  to: z.string().regex(/^\+[1-9]\d{6,14}$/, 'to must be E.164'),
  templateName: z.string().min(1),
  params: z.record(z.string()).default({}),
});

export function notificationsRoutes(ctx: AppContext): Router {
  const router = Router();

  router.get(
    '/templates',
    requireAuth,
    requirePermission('notification:read'),
    asyncHandler(async (_req, res) => {
      res.json({ items: Object.values(TEMPLATES) });
    }),
  );

  router.get(
    '/',
    requireAuth,
    requirePermission('notification:read'),
    asyncHandler(async (_req, res) => {
      const items = ctx.db.notifications.all();
      res.json({ items, total: items.length });
    }),
  );

  // Live send through the NotificationsPort with retry/backoff.
  router.post(
    '/send',
    requireAuth,
    requirePermission('notification:send'),
    validateBody(sendBody),
    asyncHandler(async (req, res) => {
      const record = await sendNotification(ctx.db, ctx.notifications, {
        to: req.body.to,
        templateName: req.body.templateName,
        params: req.body.params,
      });
      recordAudit(ctx.db, {
        actorId: req.auth!.userId,
        actorRole: req.auth!.role,
        action: 'notification.send',
        target: record.id,
        meta: { to: record.to, template: record.templateName, status: record.status },
      });
      const code = record.status === 'failed' ? 502 : 201;
      res.status(code).json(record);
    }),
  );

  return router;
}
