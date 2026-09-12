import { Router } from 'express';
import { z } from 'zod';
import type { AppContext } from '../context';
import { asyncHandler } from '../lib/async-handler';
import { validateBody } from '../middleware/validate';
import { requireAuth } from '../middleware/auth';
import { assertPhone } from '../services/auth.service';
import { verifyRefreshToken } from '../lib/jwt';
import { recordAudit } from '../lib/audit';
import { unauthorized } from '../lib/errors';

const phoneSchema = z.object({ phone: z.string() });
const verifySchema = z.object({ phone: z.string(), code: z.string().min(4).max(8) });
const loginSchema = z.object({ phone: z.string(), password: z.string().min(1) });
const refreshSchema = z.object({ refreshToken: z.string().min(1) });

export function authRoutes(ctx: AppContext): Router {
  const router = Router();

  router.post(
    '/otp/request',
    validateBody(phoneSchema),
    asyncHandler(async (req, res) => {
      const phone = assertPhone(req.body.phone);
      const result = await ctx.auth.requestOtp(phone);
      res.json(result);
    }),
  );

  router.post(
    '/otp/verify',
    validateBody(verifySchema),
    asyncHandler(async (req, res) => {
      const phone = assertPhone(req.body.phone);
      const tokens = await ctx.auth.verifyOtp(phone, req.body.code);
      recordAudit(ctx.db, { actorId: tokens.user.id, actorRole: tokens.user.role, action: 'auth.otp_login' });
      res.json(tokens);
    }),
  );

  router.post(
    '/login',
    validateBody(loginSchema),
    asyncHandler(async (req, res) => {
      const phone = assertPhone(req.body.phone);
      const tokens = await ctx.auth.loginWithPassword(phone, req.body.password);
      recordAudit(ctx.db, { actorId: tokens.user.id, actorRole: tokens.user.role, action: 'auth.password_login' });
      res.json(tokens);
    }),
  );

  router.post(
    '/refresh',
    validateBody(refreshSchema),
    asyncHandler(async (req, res) => {
      let claims;
      try {
        claims = verifyRefreshToken(req.body.refreshToken);
      } catch {
        throw unauthorized('Invalid or expired refresh token');
      }
      // The role is re-read from the user record inside refresh(), and the fresh tokens
      // carry it — a refreshed session never loses its role (11 Sep fix).
      const tokens = await ctx.auth.refresh(claims.sub);
      res.json(tokens);
    }),
  );

  router.get(
    '/me',
    requireAuth,
    asyncHandler(async (req, res) => {
      const user = ctx.db.adminUsers.get(req.auth!.userId);
      if (!user) throw unauthorized();
      res.json({ id: user.id, name: user.name, role: user.role, phone: user.phone, email: user.email });
    }),
  );

  return router;
}
