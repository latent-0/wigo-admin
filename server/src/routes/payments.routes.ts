import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { asyncHandler } from '../lib/async-handler';
import { requireAuth } from '../middleware/auth';
import { requirePermission } from '../middleware/rbac';
import { validateBody } from '../middleware/validate';
import { notFound } from '../lib/errors';
import { recordAudit } from '../lib/audit';
import { newId, nowIso } from '../lib/ids';
import type { Deposit } from '../domain/types';

const topupBody = z.object({
  riderId: z.string().min(1),
  amountCents: z.number().int().positive(),
  currency: z.string().length(3).default('MXN'),
  idempotencyKey: z.string().min(8).max(128),
});

export function paymentsRoutes(ctx: AppContext): Router {
  const router = Router();

  // Payments Overview — aggregate view backed by the deposits ledger.
  router.get(
    '/overview',
    requireAuth,
    requirePermission('payment:read'),
    asyncHandler(async (_req, res) => {
      const deposits = ctx.db.deposits.all();
      const sumBy = (s: Deposit['status']) =>
        deposits.filter((d) => d.status === s).reduce((acc, d) => acc + d.amountCents, 0);
      res.json({
        totals: {
          settledCents: sumBy('settled'),
          pendingCents: sumBy('pending'),
          failedCents: sumBy('failed'),
        },
        counts: {
          settled: deposits.filter((d) => d.status === 'settled').length,
          pending: deposits.filter((d) => d.status === 'pending').length,
          failed: deposits.filter((d) => d.status === 'failed').length,
        },
      });
    }),
  );

  router.get(
    '/deposits',
    requireAuth,
    requirePermission('payment:read'),
    asyncHandler(async (_req, res) => {
      const items = ctx.db.deposits.all();
      res.json({ items, total: items.length });
    }),
  );

  /**
   * Idempotent wallet top-up through the PaymentsPort (N1CO). A repeat of the same
   * idempotencyKey returns the existing deposit and never creates a duplicate — the
   * invariant retested 11 Sep, enforced here at the DB layer and in the adapter.
   */
  router.post(
    '/deposits/topup',
    requireAuth,
    requirePermission('payment:write'),
    validateBody(topupBody),
    asyncHandler(async (req, res) => {
      const { riderId, amountCents, currency, idempotencyKey } = req.body;
      const rider = ctx.db.riders.get(riderId);
      if (!rider) throw notFound('Rider not found');

      const existing = ctx.db.deposits.find((d) => d.idempotencyKey === idempotencyKey);
      if (existing) {
        res.status(200).json({ deposit: existing, idempotentReplay: true });
        return;
      }

      const result = await ctx.payments.createTopUp({ idempotencyKey, riderId, amountCents, currency });
      const now = nowIso();
      const deposit: Deposit = {
        id: newId('dep'),
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
        riderId,
        amountCents,
        currency,
        status: result.status,
        idempotencyKey,
        providerRef: result.providerRef,
      };
      ctx.db.deposits.insert(deposit);

      if (result.status === 'settled') {
        ctx.db.riders.update(rider.id, { walletBalanceCents: rider.walletBalanceCents + amountCents });
      }

      recordAudit(ctx.db, {
        actorId: req.auth!.userId,
        actorRole: req.auth!.role,
        action: 'payment.topup',
        target: deposit.id,
        meta: { riderId, amountCents, currency, status: result.status },
      });

      res.status(201).json({ deposit, idempotentReplay: result.idempotentReplay });
    }),
  );

  return router;
}
