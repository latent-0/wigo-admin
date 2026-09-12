import express, { type Express } from 'express';
import helmet from 'helmet';
import cors from 'cors';
import rateLimit from 'express-rate-limit';
import type { AppContext } from './context';
import { config } from './config/env';
import { db as defaultDb } from './data/store';
import { getNotificationsPort } from './ports/notifications';
import { getPaymentsPort } from './ports/payments';
import { AuthService } from './services/auth.service';
import { authRoutes } from './routes/auth.routes';
import { kpisRoutes } from './routes/kpis.routes';
import { ridersRoutes } from './routes/riders.routes';
import { applicationsRoutes } from './routes/applications.routes';
import { paymentsRoutes } from './routes/payments.routes';
import { documentsRoutes } from './routes/documents.routes';
import { notificationsRoutes } from './routes/notifications.routes';
import { adminUsersRoutes } from './routes/admin-users.routes';
import { auditRoutes } from './routes/audit.routes';
import { experimentsRoutes } from './routes/experiments.routes';
import { webhookRoutes } from './routes/webhooks.routes';
import { searchRoutes } from './routes/search.routes';
import { errorHandler, notFoundHandler } from './middleware/error-handler';

export function buildContext(overrides: Partial<AppContext> = {}): AppContext {
  const dbInstance = overrides.db ?? defaultDb;
  const notifications = overrides.notifications ?? getNotificationsPort();
  const payments = overrides.payments ?? getPaymentsPort();
  const auth = overrides.auth ?? new AuthService(dbInstance, notifications);
  return { db: dbInstance, notifications, payments, auth };
}

export function createApp(ctx: AppContext): Express {
  const app = express();

  app.disable('x-powered-by');
  app.use(helmet());
  app.use(
    cors({
      origin: config.corsOrigins.length > 0 ? config.corsOrigins : false,
      credentials: true,
    }),
  );
  // Capture the raw body so webhook signatures can be verified against exact bytes.
  app.use(
    express.json({
      limit: '256kb',
      verify: (req, _res, buf) => {
        (req as express.Request).rawBody = Buffer.from(buf);
      },
    }),
  );

  app.get('/health', (_req, res) => {
    res.json({
      ok: true,
      env: config.env,
      drivers: { whatsapp: config.whatsapp.driver, n1co: config.n1co.driver },
    });
  });

  // Tighter rate limit on the auth surface (OTP requests, login, refresh).
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    limit: config.isProd ? 50 : 1000,
    standardHeaders: true,
    legacyHeaders: false,
  });

  app.use('/api/auth', authLimiter, authRoutes(ctx));
  app.use('/api/kpis', kpisRoutes(ctx));
  app.use('/api/riders', ridersRoutes(ctx));
  app.use('/api/applications', applicationsRoutes(ctx));
  app.use('/api/payments', paymentsRoutes(ctx));
  app.use('/api/documents', documentsRoutes(ctx));
  app.use('/api/notifications', notificationsRoutes(ctx));
  app.use('/api/admin-users', adminUsersRoutes(ctx));
  app.use('/api/audit', auditRoutes(ctx));
  app.use('/api/experiments', experimentsRoutes(ctx));
  app.use('/api/search', searchRoutes(ctx));
  app.use('/webhooks', webhookRoutes(ctx));

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
}
